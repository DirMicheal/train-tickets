import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';

import { Inventory } from './inventory.entity';
import { TicketLock, LockStatus, SeatLockItem } from './ticket-lock.entity';
import { Train, TrainSeatInfo } from '../train/train.entity';
import { TrainService } from '../train/train.service';
import { RedisService } from '../../redis/redis.service';
import { LockService } from '../../lock/lock.service';
import { QueueService } from '../../queue/queue.service';
import {
  TicketSoldOutException,
  LockAcquireException,
  NotFoundException,
  TicketLockTimeoutException,
  BadRequestException,
} from '../../common/exceptions/business.exception';
import { IdGeneratorService } from '../../common/services/id-generator.service';
import dayjs from 'dayjs';

export interface LockInventoryResult {
  lockBatchNo: string;
  status: 'success' | 'partial' | 'failed';
  expireAt: number;
  lockedSeats: Array<{
    seatTypeCode: string;
    seatTypeName: string;
    lockedQuantity: number;
    requestQuantity: number;
    price: number;
  }>;
  trainId: string;
  trainNo: string;
  fromStationId: string;
  fromStationName: string;
  toStationId: string;
  toStationName: string;
  travelDate: string;
  totalQuantity: number;
  totalAmount: number;
}

@Injectable()
export class InventoryService implements OnModuleInit {
  private readonly logger = new Logger(InventoryService.name);
  private readonly ticketLockTtl: number;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Inventory)
    private readonly inventoryRepository: Repository<Inventory>,
    @InjectRepository(TicketLock)
    private readonly ticketLockRepository: Repository<TicketLock>,
    @InjectRepository(Train)
    private readonly trainRepository: Repository<Train>,
    private readonly trainService: TrainService,
    private readonly redisService: RedisService,
    private readonly lockService: LockService,
    private readonly queueService: QueueService,
    private readonly dataSource: DataSource,
    private readonly idGenerator: IdGeneratorService,
  ) {
    this.ticketLockTtl = parseInt(
      this.configService.get('TICKET_LOCK_TTL', '300'),
    );
  }

  async onModuleInit() {
    this.queueService.subscribe<{ inventoryId: string }>(
      'inventory:init',
      async (msg) => {
        this.logger.log(`处理库存初始化消息: inventoryId=${msg.data.inventoryId}`);
      },
    );

    this.queueService.subscribe<{ lockBatchNo: string }>(
      'lock:expire',
      async (msg) => {
        await this.handleLockExpire(msg.data.lockBatchNo);
      },
    );
  }

  private getInventoryCacheKey(trainId: string, seatTypeCode: string): string {
    return `inventory:${trainId}:${seatTypeCode}`;
  }

  private getLockCacheKey(lockBatchNo: string): string {
    return `lock:batch:${lockBatchNo}`;
  }

  async initInventoryForTrain(trainId: string): Promise<Inventory[]> {
    return this.lockService.withLock(
      `init:inventory:${trainId}`,
      async () => {
        const trainDetail = await this.trainService.findTrainById(trainId);

        const existing = await this.inventoryRepository.count({
          where: { trainId },
        });
        if (existing > 0) {
          this.logger.warn(`车次 ${trainId} 库存已初始化，跳过`);
          return this.inventoryRepository.find({ where: { trainId } });
        }

        const inventories: Inventory[] = [];
        for (const seat of trainDetail.seatTypes) {
          const inventory = this.inventoryRepository.create({
            trainId,
            seatTypeCode: seat.code,
            seatTypeName: seat.name,
            totalCount: seat.totalCount,
            soldCount: 0,
            lockedCount: 0,
            availableCount: seat.totalCount,
            price: seat.price,
            version: 0,
          });
          inventories.push(inventory);

          await this.redisService.set(
            this.getInventoryCacheKey(trainId, seat.code),
            JSON.stringify({
              totalCount: seat.totalCount,
              soldCount: 0,
              lockedCount: 0,
              availableCount: seat.totalCount,
              price: seat.price,
              version: 0,
            }),
          );
        }

        const saved = await this.inventoryRepository.save(inventories);
        await this.trainService.markInventoryInitialized(trainId);

        this.logger.log(
          `车次 ${trainDetail.trainNo} @ ${trainDetail.travelDate} 库存初始化完成，共 ${saved.length} 种座位类型`,
        );
        return saved;
      },
    );
  }

  async getInventory(trainId: string, seatTypeCode: string): Promise<Inventory> {
    const cacheKey = this.getInventoryCacheKey(trainId, seatTypeCode);
    const cached = await this.redisService.getJson<any>(cacheKey);

    if (cached) {
      return {
        ...cached,
        trainId,
        seatTypeCode,
      } as Inventory;
    }

    const inventory = await this.inventoryRepository.findOne({
      where: { trainId, seatTypeCode },
    });
    if (!inventory) {
      throw new NotFoundException('库存记录');
    }

    await this.redisService.setJson(cacheKey, {
      totalCount: inventory.totalCount,
      soldCount: inventory.soldCount,
      lockedCount: inventory.lockedCount,
      availableCount: inventory.availableCount,
      price: inventory.price,
      version: inventory.version,
    });

    return inventory;
  }

  async getAllInventories(trainId: string): Promise<Inventory[]> {
    const trainDetail = await this.trainService.findTrainById(trainId);
    if (!trainDetail.inventoryInitialized) {
      await this.initInventoryForTrain(trainId);
    }

    let inventories = await this.inventoryRepository.find({
      where: { trainId },
      order: { seatTypeCode: 'ASC' },
    });

    if (inventories.length === 0) {
      inventories = await this.initInventoryForTrain(trainId);
    }

    return inventories;
  }

  async lockInventory(
    userId: string,
    trainId: string,
    fromStationId: string,
    toStationId: string,
    seatRequests: Array<{
      seatTypeCode: string;
      quantity: number;
      price: number;
    }>,
    idempotencyKey?: string,
  ): Promise<LockInventoryResult> {
    if (idempotencyKey) {
      const idemKey = `idem:lock:${idempotencyKey}`;
      const existingResult = await this.redisService.getJson<LockInventoryResult>(idemKey);
      if (existingResult) {
        this.logger.log(`锁票幂等性命中: ${idempotencyKey}`);
        return existingResult;
      }
    }

    const trainDetail = await this.trainService.findTrainById(trainId);

    const fromStation = trainDetail.stations.find(
      (s) => s.stationId === fromStationId,
    );
    const toStation = trainDetail.stations.find(
      (s) => s.stationId === toStationId,
    );
    if (!fromStation || !toStation) {
      throw new BadRequestException('出发站或到达站不在该车次运行线路上');
    }

    if (!trainDetail.inventoryInitialized) {
      await this.initInventoryForTrain(trainId);
    }

    const lockBatchNo = `LK${this.idGenerator.nextId()}`;

    const result: LockInventoryResult = {
      lockBatchNo,
      status: 'success',
      expireAt: Math.floor(Date.now() / 1000) + this.ticketLockTtl,
      lockedSeats: [],
      trainId,
      trainNo: trainDetail.trainNo,
      fromStationId,
      fromStationName: fromStation.stationName,
      toStationId,
      toStationName: toStation.stationName,
      travelDate: trainDetail.travelDate,
      totalQuantity: 0,
      totalAmount: 0,
    };

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const lockItems: SeatLockItem[] = [];

      for (const req of seatRequests) {
        const lockResource = `inventory:lock:${trainId}:${req.seatTypeCode}`;

        try {
          const lock = await this.lockService.acquire(lockResource, {
            ttl: 5000,
            retryCount: 5,
            retryDelay: 100,
          });

          try {
            const inventory = await queryRunner.manager.findOne(Inventory, {
              where: { trainId, seatTypeCode: req.seatTypeCode },
            });

            if (!inventory) {
              result.status = result.status === 'success' ? 'partial' : result.status;
              result.lockedSeats.push({
                seatTypeCode: req.seatTypeCode,
                seatTypeName: '',
                lockedQuantity: 0,
                requestQuantity: req.quantity,
                price: req.price,
              });
              continue;
            }

            const seatTypeInfo = trainDetail.seatTypes.find(
              (s) => s.code === req.seatTypeCode,
            );
            const seatPrice = req.price || seatTypeInfo?.price || inventory.price;

            const actualAvail = inventory.totalCount - inventory.soldCount - inventory.lockedCount;
            const realAvailable = Math.max(0, actualAvail);
            const lockedQty = Math.min(req.quantity, realAvailable);

            if (lockedQty <= 0) {
              result.status = result.status === 'success' ? 'partial' : result.status;
              result.lockedSeats.push({
                seatTypeCode: req.seatTypeCode,
                seatTypeName: inventory.seatTypeName,
                lockedQuantity: 0,
                requestQuantity: req.quantity,
                price: seatPrice,
              });
              continue;
            }

            inventory.lockedCount += lockedQty;
            inventory.availableCount = inventory.totalCount - inventory.soldCount - inventory.lockedCount;
            inventory.version += 1;

            await queryRunner.manager.save(inventory);

            const cacheKey = this.getInventoryCacheKey(trainId, req.seatTypeCode);
            await this.redisService.setJson(cacheKey, {
              totalCount: inventory.totalCount,
              soldCount: inventory.soldCount,
              lockedCount: inventory.lockedCount,
              availableCount: inventory.availableCount,
              price: inventory.price,
              version: inventory.version,
            });

            lockItems.push({
              seatTypeCode: req.seatTypeCode,
              seatTypeName: inventory.seatTypeName,
              quantity: lockedQty,
              price: seatPrice,
            });

            result.lockedSeats.push({
              seatTypeCode: req.seatTypeCode,
              seatTypeName: inventory.seatTypeName,
              lockedQuantity: lockedQty,
              requestQuantity: req.quantity,
              price: seatPrice,
            });

            result.totalQuantity += lockedQty;
            result.totalAmount += lockedQty * seatPrice;
          } finally {
            await lock.unlock();
          }
        } catch (e) {
          if (e instanceof LockAcquireException) {
            throw new BadRequestException('系统繁忙，请稍后重试');
          }
          throw e;
        }
      }

      if (result.totalQuantity === 0) {
        result.status = 'failed';
        await queryRunner.rollbackTransaction();
        if (idempotencyKey) {
          await this.redisService.setJson(
            `idem:lock:${idempotencyKey}`,
            result,
            this.ticketLockTtl,
          );
        }
        throw new TicketSoldOutException('所选座位已售罄');
      }

      if (result.totalQuantity < seatRequests.reduce((sum, r) => sum + r.quantity, 0)) {
        result.status = 'partial';
      }

      const ticketLock = this.ticketLockRepository.create({
        lockBatchNo,
        userId,
        trainId,
        trainNo: trainDetail.trainNo,
        fromStationId,
        fromStationName: fromStation.stationName,
        toStationId,
        toStationName: toStation.stationName,
        travelDate: trainDetail.travelDate,
        locksJson: JSON.stringify(lockItems),
        totalQuantity: result.totalQuantity,
        totalAmount: result.totalAmount,
        status: LockStatus.LOCKED,
        expireAt: new Date(Date.now() + this.ticketLockTtl * 1000),
      });

      await queryRunner.manager.save(ticketLock);
      await queryRunner.commitTransaction();

      await this.redisService.setJson(
        this.getLockCacheKey(lockBatchNo),
        {
          ...ticketLock,
          lockItems,
        },
        this.ticketLockTtl,
      );

      await this.queueService.publish(
        'lock:expire',
        { lockBatchNo },
        { delay: this.ticketLockTtl * 1000 + 1000 },
      );

      if (idempotencyKey) {
        await this.redisService.setJson(
          `idem:lock:${idempotencyKey}`,
          result,
          this.ticketLockTtl,
        );
      }

      this.logger.log(
        `锁票成功: batchNo=${lockBatchNo}, userId=${userId}, quantity=${result.totalQuantity}, amount=${result.totalAmount}`,
      );

      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async confirmLock(
    lockBatchNo: string,
    orderNo: string,
    userId: string,
  ): Promise<void> {
    const ticketLock = await this.ticketLockRepository.findOne({
      where: { lockBatchNo },
    });

    if (!ticketLock) {
      throw new TicketLockTimeoutException();
    }

    if (ticketLock.userId !== userId) {
      throw new BadRequestException('该锁票不属于当前用户');
    }

    if (ticketLock.status !== LockStatus.LOCKED) {
      if (ticketLock.status === LockStatus.CONFIRMED) {
        return;
      }
      throw new BadRequestException(`锁票状态异常: ${ticketLock.status}`);
    }

    if (new Date() > ticketLock.expireAt) {
      await this.handleLockExpire(lockBatchNo);
      throw new TicketLockTimeoutException();
    }

    let lockItems: SeatLockItem[] = [];
    try {
      lockItems = JSON.parse(ticketLock.locksJson);
    } catch {}

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      for (const item of lockItems) {
        const inventory = await queryRunner.manager.findOne(Inventory, {
          where: { trainId: ticketLock.trainId, seatTypeCode: item.seatTypeCode },
        });

        if (inventory) {
          inventory.soldCount += item.quantity;
          inventory.lockedCount = Math.max(0, inventory.lockedCount - item.quantity);
          inventory.availableCount = inventory.totalCount - inventory.soldCount - inventory.lockedCount;
          inventory.version += 1;

          await queryRunner.manager.save(inventory);

          const cacheKey = this.getInventoryCacheKey(
            ticketLock.trainId,
            item.seatTypeCode,
          );
          await this.redisService.setJson(cacheKey, {
            totalCount: inventory.totalCount,
            soldCount: inventory.soldCount,
            lockedCount: inventory.lockedCount,
            availableCount: inventory.availableCount,
            price: inventory.price,
            version: inventory.version,
          });
        }
      }

      ticketLock.status = LockStatus.CONFIRMED;
      ticketLock.orderNo = orderNo;
      await queryRunner.manager.save(ticketLock);

      await queryRunner.commitTransaction();

      await this.redisService.del(this.getLockCacheKey(lockBatchNo));

      this.logger.log(
        `锁票确认成功: batchNo=${lockBatchNo}, orderNo=${orderNo}`,
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async releaseLock(lockBatchNo: string, userId?: string): Promise<void> {
    const ticketLock = await this.ticketLockRepository.findOne({
      where: { lockBatchNo },
    });

    if (!ticketLock) {
      return;
    }

    if (userId && ticketLock.userId !== userId) {
      throw new BadRequestException('该锁票不属于当前用户');
    }

    if (ticketLock.status !== LockStatus.LOCKED) {
      return;
    }

    await this.handleLockExpire(lockBatchNo);
  }

  private async handleLockExpire(lockBatchNo: string): Promise<void> {
    const ticketLock = await this.ticketLockRepository.findOne({
      where: { lockBatchNo },
    });

    if (!ticketLock) return;
    if (ticketLock.status !== LockStatus.LOCKED) return;

    let lockItems: SeatLockItem[] = [];
    try {
      lockItems = JSON.parse(ticketLock.locksJson);
    } catch {}

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      for (const item of lockItems) {
        const lockResource = `inventory:lock:${ticketLock.trainId}:${item.seatTypeCode}`;
        const lock = await this.lockService.tryAcquire(lockResource, 3000);

        try {
          const inventory = await queryRunner.manager.findOne(Inventory, {
            where: { trainId: ticketLock.trainId, seatTypeCode: item.seatTypeCode },
          });

          if (inventory) {
            inventory.lockedCount = Math.max(0, inventory.lockedCount - item.quantity);
            inventory.availableCount = inventory.totalCount - inventory.soldCount - inventory.lockedCount;
            inventory.version += 1;

            await queryRunner.manager.save(inventory);

            const cacheKey = this.getInventoryCacheKey(
              ticketLock.trainId,
              item.seatTypeCode,
            );
            await this.redisService.setJson(cacheKey, {
              totalCount: inventory.totalCount,
              soldCount: inventory.soldCount,
              lockedCount: inventory.lockedCount,
              availableCount: inventory.availableCount,
              price: inventory.price,
              version: inventory.version,
            });
          }
        } finally {
          if (lock) await lock.unlock();
        }
      }

      ticketLock.status = LockStatus.RELEASED;
      ticketLock.releasedAt = new Date();
      await queryRunner.manager.save(ticketLock);

      await queryRunner.commitTransaction();

      await this.redisService.del(this.getLockCacheKey(lockBatchNo));

      this.logger.log(`锁票释放: batchNo=${lockBatchNo}`);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `释放锁票失败: batchNo=${lockBatchNo}`,
        error instanceof Error ? error.stack : '',
      );
    } finally {
      await queryRunner.release();
    }
  }

  async releaseInventory(
    trainId: string,
    seatReleases: Array<{ seatTypeCode: string; quantity: number }>,
  ): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      for (const release of seatReleases) {
        const lockResource = `inventory:lock:${trainId}:${release.seatTypeCode}`;
        const lock = await this.lockService.tryAcquire(lockResource, 5000);

        try {
          const inventory = await queryRunner.manager.findOne(Inventory, {
            where: { trainId, seatTypeCode: release.seatTypeCode },
          });

          if (inventory) {
            inventory.soldCount = Math.max(0, inventory.soldCount - release.quantity);
            inventory.availableCount = inventory.totalCount - inventory.soldCount - inventory.lockedCount;
            inventory.version += 1;

            await queryRunner.manager.save(inventory);

            const cacheKey = this.getInventoryCacheKey(trainId, release.seatTypeCode);
            await this.redisService.setJson(cacheKey, {
              totalCount: inventory.totalCount,
              soldCount: inventory.soldCount,
              lockedCount: inventory.lockedCount,
              availableCount: inventory.availableCount,
              price: inventory.price,
              version: inventory.version,
            });
          }
        } finally {
          if (lock) await lock.unlock();
        }
      }

      await queryRunner.commitTransaction();
      this.logger.log(`库存释放完成: trainId=${trainId}`);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async cleanExpiredLocks() {
    const now = new Date();
    const expiredLocks = await this.ticketLockRepository.find({
      where: { status: LockStatus.LOCKED },
    });

    for (const lock of expiredLocks) {
      if (now > lock.expireAt) {
        this.logger.log(`定时清理过期锁票: ${lock.lockBatchNo}`);
        await this.handleLockExpire(lock.lockBatchNo);
      }
    }
  }

  async getLockRecord(lockBatchNo: string): Promise<{
    ticketLock: TicketLock;
    lockItems: SeatLockItem[];
  }> {
    const cacheKey = this.getLockCacheKey(lockBatchNo);
    const cached = await this.redisService.getJson<any>(cacheKey);

    if (cached) {
      return {
        ticketLock: cached,
        lockItems: cached.lockItems || [],
      };
    }

    const ticketLock = await this.ticketLockRepository.findOne({
      where: { lockBatchNo },
    });

    if (!ticketLock) {
      throw new NotFoundException('锁票记录');
    }

    let lockItems: SeatLockItem[] = [];
    try {
      lockItems = JSON.parse(ticketLock.locksJson);
    } catch {}

    return { ticketLock, lockItems };
  }
}
