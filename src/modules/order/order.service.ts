import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';

import {
  Order,
  OrderStatus,
  ChangeStatus,
  RefundStatus,
  RefundReason,
  PassengerInfo,
} from './order.entity';
import {
  CreateOrderDto,
  QueryOrderDto,
  CancelOrderDto,
  RequestRefundDto,
  ChangeOrderDto,
} from './dto/order.dto';
import { InventoryService } from '../inventory/inventory.service';
import { LockService } from '../../lock/lock.service';
import { QueueService } from '../../queue/queue.service';
import { RedisService } from '../../redis/redis.service';
import { UtilService } from '../../common/services/util.service';
import {
  NotFoundException,
  BadRequestException,
  OrderExpiredException,
  ConflictException,
  UnauthorizedException,
} from '../../common/exceptions/business.exception';
import { SeatLockItem } from '../inventory/ticket-lock.entity';

@Injectable()
export class OrderService implements OnModuleInit {
  private readonly logger = new Logger(OrderService.name);
  private readonly orderExpireMinutes: number;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly inventoryService: InventoryService,
    private readonly lockService: LockService,
    private readonly queueService: QueueService,
    private readonly redisService: RedisService,
    private readonly utilService: UtilService,
    private readonly dataSource: DataSource,
  ) {
    this.orderExpireMinutes = parseInt(
      this.configService.get('ORDER_EXPIRE_MINUTES', '30'),
    );
  }

  async onModuleInit() {
    this.queueService.subscribe<{ orderNo: string }>(
      'order:expire',
      async (msg) => {
        await this.handleOrderExpire(msg.data.orderNo);
      },
    );

    this.queueService.subscribe<{ orderNo: string }>(
      'order:refund:process',
      async (msg) => {
        await this.processRefund(msg.data.orderNo);
      },
    );
  }

  private getOrderIdemKey(key: string): string {
    return `order:idem:${key}`;
  }

  async createOrder(
    userId: string,
    dto: CreateOrderDto,
  ): Promise<Order & { passengers: PassengerInfo[] }> {
    if (dto.idempotencyKey) {
      const key = this.getOrderIdemKey(dto.idempotencyKey);
      const cached = await this.redisService.getJson<Order>(key);
      if (cached) {
        this.logger.log(`下单幂等性命中: ${dto.idempotencyKey}`);
        let passengers: PassengerInfo[] = [];
        try {
          passengers = JSON.parse(cached.passengersJson);
        } catch {}
        return { ...cached, passengers };
      }
    }

    const lockRecord = await this.inventoryService.getLockRecord(dto.lockBatchNo);
    const { ticketLock, lockItems } = lockRecord;

    if (!ticketLock) {
      throw new BadRequestException('锁票记录不存在或已过期');
    }

    if (ticketLock.userId !== userId) {
      throw new UnauthorizedException('该锁票不属于当前用户');
    }

    const totalLockQuantity = lockItems.reduce((sum, item) => sum + item.quantity, 0);
    const totalPassengerSeats = dto.passengers.reduce((acc, p) => {
      acc[p.seatTypeCode] = (acc[p.seatTypeCode] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    for (const item of lockItems) {
      if ((totalPassengerSeats[item.seatTypeCode] || 0) !== item.quantity) {
        throw new BadRequestException(
          `乘车人数量与锁票数量不匹配: ${item.seatTypeName} 锁票${item.quantity}张，乘车人${totalPassengerSeats[item.seatTypeCode] || 0}人`,
        );
      }
    }

    if (Object.keys(totalPassengerSeats).length !== lockItems.length) {
      throw new BadRequestException('乘车人座位类型与锁票不匹配');
    }

    const orderNo = this.utilService.generateOrderNo('O');
    const totalAmount = dto.passengers.reduce((sum, p) => sum + p.price, 0);

    const order = this.orderRepository.create({
      orderNo,
      userId,
      contactName: dto.contactName,
      contactPhone: dto.contactPhone,
      lockBatchNo: dto.lockBatchNo,
      trainId: ticketLock.trainId,
      trainNo: ticketLock.trainNo,
      fromStationId: ticketLock.fromStationId,
      fromStationName: ticketLock.fromStationName,
      toStationId: ticketLock.toStationId,
      toStationName: ticketLock.toStationName,
      travelDate: ticketLock.travelDate,
      departTime: '--:--',
      arriveTime: '--:--',
      durationMinutes: 0,
      passengersJson: JSON.stringify(dto.passengers),
      passengerCount: dto.passengers.length,
      totalAmount,
      paidAmount: 0,
      serviceFee: 0,
      discountAmount: 0,
      refundAmount: 0,
      status: OrderStatus.PENDING_PAYMENT,
      changeStatus: ChangeStatus.NONE,
      refundStatus: RefundStatus.NONE,
      expireAt: new Date(Date.now() + this.orderExpireMinutes * 60 * 1000),
      remark: dto.remark,
    });

    await this.inventoryService.confirmLock(dto.lockBatchNo, orderNo, userId);

    const saved = await this.orderRepository.save(order);

    await this.queueService.publish(
      'order:expire',
      { orderNo },
      { delay: this.orderExpireMinutes * 60 * 1000 + 1000 },
    );

    if (dto.idempotencyKey) {
      await this.redisService.setJson(
        this.getOrderIdemKey(dto.idempotencyKey),
        saved,
        24 * 3600,
      );
    }

    this.logger.log(`创建订单成功: orderNo=${orderNo}, userId=${userId}, amount=${totalAmount}`);

    return { ...saved, passengers: dto.passengers as PassengerInfo[] };
  }

  async getOrderDetail(
    orderNo: string,
    userId?: string,
    requireOwner = true,
  ): Promise<Order & { passengers: PassengerInfo[]; lockItems?: SeatLockItem[] }> {
    const order = await this.orderRepository.findOne({
      where: { orderNo },
    });

    if (!order) {
      throw new NotFoundException('订单');
    }

    if (requireOwner && userId && order.userId !== userId) {
      throw new UnauthorizedException('无权查看该订单');
    }

    let passengers: PassengerInfo[] = [];
    try {
      passengers = JSON.parse(order.passengersJson);
    } catch {}

    let lockItems: SeatLockItem[] = [];
    if (order.lockBatchNo) {
      try {
        const lr = await this.inventoryService.getLockRecord(order.lockBatchNo);
        lockItems = lr.lockItems;
      } catch {}
    }

    return { ...order, passengers, lockItems };
  }

  async getUserOrders(
    userId: string,
    dto: QueryOrderDto,
  ): Promise<{
    list: (Order & { passengers: PassengerInfo[] })[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const page = dto.page || 1;
    const pageSize = dto.pageSize || 10;
    const skip = (page - 1) * pageSize;

    const queryBuilder = this.orderRepository.createQueryBuilder('order');
    queryBuilder.where('order.userId = :userId', { userId });

    if (dto.status) {
      queryBuilder.andWhere('order.status = :status', { status: dto.status });
    }
    if (dto.orderNo) {
      queryBuilder.andWhere('order.orderNo LIKE :orderNo', {
        orderNo: `%${dto.orderNo}%`,
      });
    }
    if (dto.trainNo) {
      queryBuilder.andWhere('order.trainNo LIKE :trainNo', {
        trainNo: `%${dto.trainNo}%`,
      });
    }
    if (dto.travelDate) {
      queryBuilder.andWhere('order.travelDate = :travelDate', {
        travelDate: dto.travelDate,
      });
    }
    if (dto.keyword) {
      queryBuilder.andWhere(
        '(order.orderNo LIKE :keyword OR order.trainNo LIKE :keyword OR order.fromStationName LIKE :keyword OR order.toStationName LIKE :keyword)',
        { keyword: `%${dto.keyword}%` },
      );
    }

    queryBuilder.orderBy('order.createdAt', 'DESC');

    const [orders, total] = await queryBuilder
      .skip(skip)
      .take(pageSize)
      .getManyAndCount();

    const list = orders.map((order) => {
      let passengers: PassengerInfo[] = [];
      try {
        passengers = JSON.parse(order.passengersJson);
      } catch {}
      return { ...order, passengers };
    });

    const totalPages = Math.ceil(total / pageSize);
    return { list, total, page, pageSize, totalPages };
  }

  async getAllOrders(
    dto: QueryOrderDto,
  ): Promise<{
    list: (Order & { passengers: PassengerInfo[] })[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const page = dto.page || 1;
    const pageSize = dto.pageSize || 10;
    const skip = (page - 1) * pageSize;

    const queryBuilder = this.orderRepository.createQueryBuilder('order');

    if (dto.status) {
      queryBuilder.andWhere('order.status = :status', { status: dto.status });
    }
    if (dto.orderNo) {
      queryBuilder.andWhere('order.orderNo LIKE :orderNo', {
        orderNo: `%${dto.orderNo}%`,
      });
    }
    if (dto.trainNo) {
      queryBuilder.andWhere('order.trainNo LIKE :trainNo', {
        trainNo: `%${dto.trainNo}%`,
      });
    }
    if (dto.travelDate) {
      queryBuilder.andWhere('order.travelDate = :travelDate', {
        travelDate: dto.travelDate,
      });
    }
    if (dto.fromStationName) {
      queryBuilder.andWhere('order.fromStationName LIKE :fromStationName', {
        fromStationName: `%${dto.fromStationName}%`,
      });
    }
    if (dto.toStationName) {
      queryBuilder.andWhere('order.toStationName LIKE :toStationName', {
        toStationName: `%${dto.toStationName}%`,
      });
    }
    if (dto.keyword) {
      queryBuilder.andWhere(
        '(order.orderNo LIKE :keyword OR order.trainNo LIKE :keyword OR order.contactName LIKE :keyword OR order.contactPhone LIKE :keyword)',
        { keyword: `%${dto.keyword}%` },
      );
    }

    queryBuilder.orderBy('order.createdAt', 'DESC');

    const [orders, total] = await queryBuilder
      .skip(skip)
      .take(pageSize)
      .getManyAndCount();

    const list = orders.map((order) => {
      let passengers: PassengerInfo[] = [];
      try {
        passengers = JSON.parse(order.passengersJson);
      } catch {}
      return { ...order, passengers };
    });

    const totalPages = Math.ceil(total / pageSize);
    return { list, total, page, pageSize, totalPages };
  }

  async cancelOrder(
    orderNo: string,
    userId: string,
    dto: CancelOrderDto,
  ): Promise<void> {
    const order = await this.getOrderDetail(orderNo, userId, true);

    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      throw new BadRequestException(`当前订单状态${order.status}不允许取消`);
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      order.status = OrderStatus.CANCELLED;
      order.cancelledAt = new Date();
      order.remark = dto.cancelReason
        ? `${order.remark || ''} 取消原因:${dto.cancelReason}`.trim()
        : order.remark;

      await queryRunner.manager.save(order);

      const seatTypeCounts: Record<string, number> = {};
      for (const p of order.passengers) {
        seatTypeCounts[p.seatTypeCode] = (seatTypeCounts[p.seatTypeCode] || 0) + 1;
      }

      const releases = Object.entries(seatTypeCounts).map(([code, qty]) => ({
        seatTypeCode: code,
        quantity: qty,
      }));

      await queryRunner.commitTransaction();

      await this.inventoryService.releaseInventory(order.trainId, releases);

      if (order.lockBatchNo) {
        await this.inventoryService.releaseLock(order.lockBatchNo);
      }

      this.logger.log(`取消订单成功: orderNo=${orderNo}`);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async requestRefund(
    orderNo: string,
    userId: string,
    dto: RequestRefundDto,
  ): Promise<Order & { passengers: PassengerInfo[] }> {
    const order = await this.getOrderDetail(orderNo, userId, true);

    if (order.status !== OrderStatus.PAID && order.status !== OrderStatus.ISSUED) {
      throw new BadRequestException(`当前订单状态${order.status}不允许退票`);
    }

    if (order.refundStatus !== RefundStatus.NONE) {
      throw new ConflictException('该订单已提交过退票申请');
    }

    if (order.changeStatus === ChangeStatus.COMPLETED && order.changedToOrderNo) {
      throw new BadRequestException('该订单已改签，无法退票');
    }

    order.refundStatus = RefundStatus.REQUESTED;
    order.refundReason = dto.reason;
    order.refundRemark = dto.remark;
    order.status = OrderStatus.REFUND_REQUESTED;

    await this.orderRepository.save(order);

    await this.queueService.publish('order:refund:process', { orderNo });

    this.logger.log(`提交退票申请: orderNo=${orderNo}, reason=${dto.reason}`);

    return { ...order, passengers: order.passengers };
  }

  private async processRefund(orderNo: string): Promise<void> {
    const order = await this.orderRepository.findOne({ where: { orderNo } });
    if (!order) return;
    if (order.refundStatus !== RefundStatus.REQUESTED) return;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      order.refundStatus = RefundStatus.PROCESSING;
      await queryRunner.manager.save(order);

      let passengers: PassengerInfo[] = [];
      try {
        passengers = JSON.parse(order.passengersJson);
      } catch {}

      let refundRate = 1;
      if (order.refundReason === RefundReason.PERSONAL) {
        refundRate = 0.95;
      }
      const refundAmount = Math.round(order.paidAmount * refundRate * 100) / 100;

      order.refundStatus = RefundStatus.COMPLETED;
      order.refundAmount = refundAmount;
      order.refundedAt = new Date();
      order.status = OrderStatus.REFUNDED;

      await queryRunner.manager.save(order);

      const seatTypeCounts: Record<string, number> = {};
      for (const p of passengers) {
        seatTypeCounts[p.seatTypeCode] = (seatTypeCounts[p.seatTypeCode] || 0) + 1;
      }

      const releases = Object.entries(seatTypeCounts).map(([code, qty]) => ({
        seatTypeCode: code,
        quantity: qty,
      }));

      await queryRunner.commitTransaction();

      await this.inventoryService.releaseInventory(order.trainId, releases);

      this.logger.log(
        `退票处理完成: orderNo=${orderNo}, 退款金额=${refundAmount}, 原支付金额=${order.paidAmount}`,
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      order.refundStatus = RefundStatus.FAILED;
      order.refundRemark = `退票处理失败: ${error.message}`;
      await this.orderRepository.save(order);
      this.logger.error(
        `退票处理失败: orderNo=${orderNo}`,
        error instanceof Error ? error.stack : '',
      );
    } finally {
      await queryRunner.release();
    }
  }

  async changeOrder(
    orderNo: string,
    userId: string,
    dto: ChangeOrderDto,
  ): Promise<{
    originalOrder: Order & { passengers: PassengerInfo[] };
    newOrder: Order & { passengers: PassengerInfo[] };
  }> {
    const originalOrderDetail = await this.getOrderDetail(orderNo, userId, true);
    const originalOrder = await this.orderRepository.findOne({ where: { orderNo } });
    if (!originalOrder) throw new NotFoundException('订单');

    if (originalOrderDetail.status !== OrderStatus.PAID && originalOrderDetail.status !== OrderStatus.ISSUED) {
      throw new BadRequestException(`当前订单状态${originalOrderDetail.status}不允许改签`);
    }

    if (originalOrderDetail.changeStatus !== ChangeStatus.NONE) {
      throw new ConflictException('该订单已办理过改签');
    }

    if (originalOrderDetail.refundStatus !== RefundStatus.NONE) {
      throw new ConflictException('该订单已退票或正在退票中，无法改签');
    }

    if (dto.newPassengers.length !== originalOrderDetail.passengerCount) {
      throw new BadRequestException('改签后乘车人数必须与原订单一致');
    }

    const newLock = await this.inventoryService.getLockRecord(dto.newLockBatchNo);
    if (!newLock || !newLock.ticketLock) {
      throw new BadRequestException('新的锁票记录不存在或已过期');
    }
    if (newLock.ticketLock.userId !== userId) {
      throw new UnauthorizedException('新的锁票不属于当前用户');
    }

    const totalLockQty = newLock.lockItems.reduce((sum, it) => sum + it.quantity, 0);
    if (totalLockQty !== originalOrderDetail.passengerCount) {
      throw new BadRequestException('改签锁票数量与乘车人数不匹配');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      originalOrder.changeStatus = ChangeStatus.PROCESSING;
      await queryRunner.manager.save(originalOrder);

      const newOrderNo = this.utilService.generateOrderNo('O');
      const totalAmount = dto.newPassengers.reduce((sum, p) => sum + p.price, 0);

      const newOrder = this.orderRepository.create({
        orderNo: newOrderNo,
        userId,
        contactName: originalOrder.contactName,
        contactPhone: originalOrder.contactPhone,
        lockBatchNo: dto.newLockBatchNo,
        trainId: newLock.ticketLock.trainId,
        trainNo: newLock.ticketLock.trainNo,
        fromStationId: newLock.ticketLock.fromStationId,
        fromStationName: newLock.ticketLock.fromStationName,
        toStationId: newLock.ticketLock.toStationId,
        toStationName: newLock.ticketLock.toStationName,
        travelDate: newLock.ticketLock.travelDate,
        departTime: '--:--',
        arriveTime: '--:--',
        durationMinutes: 0,
        passengersJson: JSON.stringify(dto.newPassengers),
        passengerCount: dto.newPassengers.length,
        totalAmount,
        paidAmount: originalOrder.paidAmount,
        serviceFee: Math.max(0, totalAmount - originalOrder.paidAmount) < 0 ? 0 : Math.abs(totalAmount - originalOrder.paidAmount) * 0.05,
        discountAmount: 0,
        refundAmount: 0,
        status: totalAmount > originalOrder.paidAmount ? OrderStatus.PENDING_PAYMENT : OrderStatus.PAID,
        changeStatus: ChangeStatus.COMPLETED,
        refundStatus: RefundStatus.NONE,
        originalOrderNo: orderNo,
        expireAt: new Date(Date.now() + this.orderExpireMinutes * 60 * 1000),
        paidAt: totalAmount > originalOrder.paidAmount ? undefined : new Date(),
        remark: `改签自原订单 ${orderNo}`,
      });

      await this.inventoryService.confirmLock(dto.newLockBatchNo, newOrderNo, userId);

      const savedNewOrder = await queryRunner.manager.save(newOrder);

      originalOrder.changeStatus = ChangeStatus.COMPLETED;
      originalOrder.changedToOrderNo = newOrderNo;
      originalOrder.status = OrderStatus.CHANGED;

      await queryRunner.manager.save(originalOrder);

      const origPassengers = originalOrderDetail.passengers;
      const seatTypeCounts: Record<string, number> = {};
      for (const p of origPassengers) {
        seatTypeCounts[p.seatTypeCode] = (seatTypeCounts[p.seatTypeCode] || 0) + 1;
      }

      const releases = Object.entries(seatTypeCounts).map(([code, qty]) => ({
        seatTypeCode: code,
        quantity: qty,
      }));

      await queryRunner.commitTransaction();

      await this.inventoryService.releaseInventory(originalOrder.trainId, releases);

      this.logger.log(
        `改签成功: originalOrderNo=${orderNo} -> newOrderNo=${newOrderNo}`,
      );

      let newPassengers: PassengerInfo[] = [];
      try {
        newPassengers = JSON.parse(savedNewOrder.passengersJson);
      } catch {}

      return {
        originalOrder: { ...originalOrder, passengers: origPassengers },
        newOrder: { ...savedNewOrder, passengers: newPassengers },
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      originalOrder.changeStatus = ChangeStatus.FAILED;
      await this.orderRepository.save(originalOrder);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async handleOrderExpire(orderNo: string): Promise<void> {
    const order = await this.orderRepository.findOne({ where: { orderNo } });
    if (!order) return;
    if (order.status !== OrderStatus.PENDING_PAYMENT) return;

    if (new Date() < order.expireAt) {
      await this.queueService.publish(
        'order:expire',
        { orderNo },
        { delay: Math.ceil(order.expireAt.getTime() - Date.now()) + 1000 },
      );
      return;
    }

    try {
      let passengers: PassengerInfo[] = [];
      try {
        passengers = JSON.parse(order.passengersJson);
      } catch {}

      order.status = OrderStatus.EXPIRED;
      order.cancelledAt = new Date();
      await this.orderRepository.save(order);

      const seatTypeCounts: Record<string, number> = {};
      for (const p of passengers) {
        seatTypeCounts[p.seatTypeCode] = (seatTypeCounts[p.seatTypeCode] || 0) + 1;
      }

      const releases = Object.entries(seatTypeCounts).map(([code, qty]) => ({
        seatTypeCode: code,
        quantity: qty,
      }));

      await this.inventoryService.releaseInventory(order.trainId, releases);

      this.logger.log(`订单过期处理: orderNo=${orderNo}`);
    } catch (error) {
      this.logger.error(
        `订单过期处理失败: orderNo=${orderNo}`,
        error instanceof Error ? error.stack : '',
      );
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async cleanExpiredOrders() {
    const now = new Date();
    const expiredOrders = await this.orderRepository.find({
      where: { status: OrderStatus.PENDING_PAYMENT },
    });

    for (const order of expiredOrders) {
      if (now > order.expireAt) {
        this.logger.log(`定时清理过期订单: ${order.orderNo}`);
        await this.handleOrderExpire(order.orderNo);
      }
    }
  }

  async updateOrderStatus(
    orderNo: string,
    status: OrderStatus,
    extraData?: Partial<Order>,
  ): Promise<Order> {
    const order = await this.orderRepository.findOne({ where: { orderNo } });
    if (!order) {
      throw new NotFoundException('订单');
    }
    Object.assign(order, extraData || {}, { status });
    return this.orderRepository.save(order);
  }
}
