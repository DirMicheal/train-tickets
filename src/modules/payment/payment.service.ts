import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';

import { Payment, PaymentStatus, PaymentMethod } from './payment.entity';
import { Order, OrderStatus } from '../order/order.entity';
import {
  CreatePaymentDto,
  ProcessPaymentDto,
  PaymentCallbackDto,
  QueryPaymentDto,
} from './dto/payment.dto';
import { OrderService } from '../order/order.service';
import { QueueService } from '../../queue/queue.service';
import { RedisService } from '../../redis/redis.service';
import { LockService } from '../../lock/lock.service';
import { UtilService } from '../../common/services/util.service';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '../../common/exceptions/business.exception';

@Injectable()
export class PaymentService implements OnModuleInit {
  private readonly logger = new Logger(PaymentService.name);
  private readonly paymentTimeoutMinutes: number;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly orderService: OrderService,
    private readonly queueService: QueueService,
    private readonly redisService: RedisService,
    private readonly lockService: LockService,
    private readonly utilService: UtilService,
    private readonly dataSource: DataSource,
  ) {
    this.paymentTimeoutMinutes = parseInt(
      this.configService.get('PAYMENT_TIMEOUT_MINUTES', '15'),
    );
  }

  async onModuleInit() {
    this.queueService.subscribe<{ paymentNo: string }>(
      'payment:timeout',
      async (msg) => {
        await this.handlePaymentTimeout(msg.data.paymentNo);
      },
    );
  }

  private getPaymentIdemKey(key: string): string {
    return `payment:idem:${key}`;
  }

  async createPayment(
    userId: string,
    dto: CreatePaymentDto,
  ): Promise<{
    payment: Payment;
    paymentUrl?: string;
    qrCode?: string;
  }> {
    if (dto.idempotencyKey) {
      const key = this.getPaymentIdemKey(dto.idempotencyKey);
      const cached = await this.redisService.getJson<Payment>(key);
      if (cached) {
        return { payment: cached };
      }
    }

    const order = await this.orderRepository.findOne({
      where: { orderNo: dto.orderNo },
    });
    if (!order) {
      throw new NotFoundException('订单');
    }

    if (order.userId !== userId) {
      throw new UnauthorizedException('该订单不属于当前用户');
    }

    if (order.status === OrderStatus.PAID || order.status === OrderStatus.ISSUED) {
      const existingPayment = await this.paymentRepository.findOne({
        where: { orderNo: dto.orderNo, status: PaymentStatus.SUCCESS },
      });
      if (existingPayment) {
        return { payment: existingPayment };
      }
    }

    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      throw new BadRequestException(`当前订单状态${order.status}不允许支付`);
    }

    const pendingPayment = await this.paymentRepository.findOne({
      where: { orderNo: dto.orderNo, status: PaymentStatus.PENDING },
    });
    if (pendingPayment) {
      return { payment: pendingPayment };
    }

    const paymentNo = this.utilService.generateOrderNo('P');
    const unpaidAmount = Math.max(0, order.totalAmount - order.paidAmount);

    if (unpaidAmount <= 0) {
      throw new BadRequestException('该订单无需支付');
    }

    const payment = this.paymentRepository.create({
      paymentNo,
      orderNo: dto.orderNo,
      userId,
      paymentMethod: dto.paymentMethod || PaymentMethod.MOCK,
      amount: unpaidAmount,
      currency: 'CNY',
      status: PaymentStatus.PENDING,
      expireAt: new Date(Date.now() + this.paymentTimeoutMinutes * 60 * 1000),
      requestData: JSON.stringify({
        orderNo: dto.orderNo,
        amount: unpaidAmount,
        method: dto.paymentMethod,
      }),
    });

    const saved = await this.paymentRepository.save(payment);

    await this.queueService.publish(
      'payment:timeout',
      { paymentNo },
      { delay: this.paymentTimeoutMinutes * 60 * 1000 + 1000 },
    );

    if (dto.idempotencyKey) {
      await this.redisService.setJson(
        this.getPaymentIdemKey(dto.idempotencyKey),
        saved,
        24 * 3600,
      );
    }

    this.logger.log(
      `创建支付单: paymentNo=${paymentNo}, orderNo=${dto.orderNo}, amount=${unpaidAmount}, method=${dto.paymentMethod}`,
    );

    return {
      payment: saved,
      paymentUrl: `/api/v1/payments/mock-pay?paymentNo=${paymentNo}`,
      qrCode: `MOCK_PAYMENT_QR_${paymentNo}`,
    };
  }

  async processMockPayment(dto: ProcessPaymentDto): Promise<Payment> {
    return this.lockService.withLock(
      `payment:process:${dto.paymentNo}`,
      async () => {
        const payment = await this.paymentRepository.findOne({
          where: { paymentNo: dto.paymentNo },
        });

        if (!payment) {
          throw new NotFoundException('支付记录');
        }

        if (payment.status !== PaymentStatus.PENDING) {
          if (payment.status === PaymentStatus.SUCCESS) {
            return payment;
          }
          throw new ConflictException(`支付单状态${payment.status}不允许处理`);
        }

        if (dto.delayMs && dto.delayMs > 0) {
          await this.utilService.sleep(dto.delayMs);
        }

        if (dto.success === false) {
          payment.status = PaymentStatus.FAILED;
          payment.failReason = '模拟支付失败';
          payment.responseData = JSON.stringify({ success: false, mock: true });
          await this.paymentRepository.save(payment);

          await this.orderService.updateOrderStatus(payment.orderNo, OrderStatus.PAYMENT_FAILED);

          this.logger.warn(
            `模拟支付失败: paymentNo=${dto.paymentNo}, orderNo=${payment.orderNo}`,
          );
          return payment;
        }

        return this.handlePaymentCallback({
          paymentNo: dto.paymentNo,
          transactionId: `MOCK_TX_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`,
          success: true,
          amount: payment.amount,
          rawData: { mock: true, paidAt: new Date().toISOString() },
        });
      },
      { ttl: 30000, retryCount: 3, retryDelay: 500 },
    );
  }

  async handlePaymentCallback(dto: PaymentCallbackDto): Promise<Payment> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const payment = await queryRunner.manager.findOne(Payment, {
        where: { paymentNo: dto.paymentNo },
      });

      if (!payment) {
        throw new NotFoundException('支付记录');
      }

      if (payment.status === PaymentStatus.SUCCESS) {
        return payment;
      }

      if (payment.status === PaymentStatus.PENDING && dto.success) {
        payment.status = PaymentStatus.SUCCESS;
        payment.transactionId = dto.transactionId;
        payment.paidAt = new Date();
        payment.callbackData = JSON.stringify(dto.rawData || {});
        payment.responseData = JSON.stringify({ success: true, ...dto });

        const order = await queryRunner.manager.findOne(Order, {
          where: { orderNo: payment.orderNo },
        });

        if (!order) {
          throw new NotFoundException('订单');
        }

        order.paidAmount = order.paidAmount + payment.amount;
        order.paidAt = payment.paidAt;
        order.transactionId = dto.transactionId;
        order.paymentMethod = payment.paymentMethod;

        if (order.paidAmount >= order.totalAmount) {
          order.status = OrderStatus.PAID;
        } else {
          order.status = OrderStatus.PENDING_PAYMENT;
        }

        await queryRunner.manager.save(order);
        await queryRunner.manager.save(payment);

        await queryRunner.commitTransaction();

        this.logger.log(
          `支付成功回调处理完成: paymentNo=${dto.paymentNo}, orderNo=${payment.orderNo}, amount=${payment.amount}`,
        );

        return payment;
      } else if (!dto.success) {
        payment.status = PaymentStatus.FAILED;
        payment.failReason = dto.failReason || '支付失败';
        payment.callbackData = JSON.stringify(dto.rawData || {});
        await queryRunner.manager.save(payment);

        const order = await queryRunner.manager.findOne(Order, {
          where: { orderNo: payment.orderNo },
        });
        if (order && order.status === OrderStatus.PENDING_PAYMENT) {
          order.status = OrderStatus.PAYMENT_FAILED;
          await queryRunner.manager.save(order);
        }

        await queryRunner.commitTransaction();

        this.logger.warn(
          `支付失败回调: paymentNo=${dto.paymentNo}, reason=${dto.failReason}`,
        );

        return payment;
      }

      await queryRunner.rollbackTransaction();
      return payment;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `支付回调处理失败: paymentNo=${dto.paymentNo}`,
        error instanceof Error ? error.stack : '',
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getPaymentDetail(
    paymentNo: string,
    userId?: string,
  ): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({
      where: { paymentNo },
    });

    if (!payment) {
      throw new NotFoundException('支付记录');
    }

    if (userId && payment.userId !== userId) {
      throw new UnauthorizedException('无权查看该支付记录');
    }

    return payment;
  }

  async getPaymentsByOrder(orderNo: string, userId?: string): Promise<Payment[]> {
    const order = await this.orderRepository.findOne({ where: { orderNo } });
    if (!order) {
      throw new NotFoundException('订单');
    }

    if (userId && order.userId !== userId) {
      throw new UnauthorizedException('无权查看该订单的支付记录');
    }

    return this.paymentRepository.find({
      where: { orderNo },
      order: { createdAt: 'DESC' },
    });
  }

  async getUserPayments(
    userId: string,
    dto: QueryPaymentDto,
  ): Promise<{
    list: Payment[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const page = dto.page || 1;
    const pageSize = dto.pageSize || 10;
    const skip = (page - 1) * pageSize;

    const queryBuilder = this.paymentRepository.createQueryBuilder('payment');
    queryBuilder.where('payment.userId = :userId', { userId });

    if (dto.orderNo) {
      queryBuilder.andWhere('payment.orderNo LIKE :orderNo', {
        orderNo: `%${dto.orderNo}%`,
      });
    }
    if (dto.paymentMethod) {
      queryBuilder.andWhere('payment.paymentMethod = :paymentMethod', {
        paymentMethod: dto.paymentMethod,
      });
    }
    if (dto.status) {
      queryBuilder.andWhere('payment.status = :status', { status: dto.status });
    }

    queryBuilder.orderBy('payment.createdAt', 'DESC');

    const [list, total] = await queryBuilder
      .skip(skip)
      .take(pageSize)
      .getManyAndCount();

    const totalPages = Math.ceil(total / pageSize);
    return { list, total, page, pageSize, totalPages };
  }

  async getAllPayments(
    dto: QueryPaymentDto,
  ): Promise<{
    list: Payment[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const page = dto.page || 1;
    const pageSize = dto.pageSize || 10;
    const skip = (page - 1) * pageSize;

    const queryBuilder = this.paymentRepository.createQueryBuilder('payment');

    if (dto.orderNo) {
      queryBuilder.andWhere('payment.orderNo LIKE :orderNo', {
        orderNo: `%${dto.orderNo}%`,
      });
    }
    if (dto.paymentMethod) {
      queryBuilder.andWhere('payment.paymentMethod = :paymentMethod', {
        paymentMethod: dto.paymentMethod,
      });
    }
    if (dto.status) {
      queryBuilder.andWhere('payment.status = :status', { status: dto.status });
    }
    if (dto.keyword) {
      queryBuilder.andWhere(
        '(payment.paymentNo LIKE :keyword OR payment.orderNo LIKE :keyword OR payment.transactionId LIKE :keyword)',
        { keyword: `%${dto.keyword}%` },
      );
    }

    queryBuilder.orderBy('payment.createdAt', 'DESC');

    const [list, total] = await queryBuilder
      .skip(skip)
      .take(pageSize)
      .getManyAndCount();

    const totalPages = Math.ceil(total / pageSize);
    return { list, total, page, pageSize, totalPages };
  }

  private async handlePaymentTimeout(paymentNo: string): Promise<void> {
    const payment = await this.paymentRepository.findOne({
      where: { paymentNo },
    });
    if (!payment) return;
    if (payment.status !== PaymentStatus.PENDING) return;

    if (new Date() < payment.expireAt) {
      await this.queueService.publish(
        'payment:timeout',
        { paymentNo },
        { delay: Math.ceil(payment.expireAt.getTime() - Date.now()) + 1000 },
      );
      return;
    }

    try {
      payment.status = PaymentStatus.TIMEOUT;
      payment.failReason = '支付超时';
      await this.paymentRepository.save(payment);

      this.logger.log(`支付超时: paymentNo=${paymentNo}`);
    } catch (error) {
      this.logger.error(
        `支付超时处理失败: paymentNo=${paymentNo}`,
        error instanceof Error ? error.stack : '',
      );
    }
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async cleanTimeoutPayments() {
    const now = new Date();
    const timeoutPayments = await this.paymentRepository.find({
      where: { status: PaymentStatus.PENDING },
    });

    for (const payment of timeoutPayments) {
      if (now > payment.expireAt) {
        this.logger.log(`定时清理超时支付: ${payment.paymentNo}`);
        await this.handlePaymentTimeout(payment.paymentNo);
      }
    }
  }
}
