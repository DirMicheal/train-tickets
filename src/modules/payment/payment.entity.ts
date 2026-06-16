import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

export enum PaymentStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
  REFUNDED = 'refunded',
  PARTIAL_REFUND = 'partial_refund',
  CANCELLED = 'cancelled',
  TIMEOUT = 'timeout',
}

export enum PaymentMethod {
  ALIPAY = 'alipay',
  WECHAT = 'wechat',
  UNIONPAY = 'unionpay',
  CREDIT_CARD = 'credit_card',
  BALANCE = 'balance',
  MOCK = 'mock',
}

@Entity('payments')
export class Payment {
  @ApiProperty({ description: '支付记录ID' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: '支付单号' })
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64, unique: true })
  paymentNo: string;

  @ApiProperty({ description: '订单号' })
  @Index()
  @Column({ type: 'varchar', length: 64 })
  orderNo: string;

  @ApiProperty({ description: '用户ID' })
  @Index()
  @Column({ type: 'varchar', length: 36 })
  userId: string;

  @ApiProperty({ description: '支付方式', enum: PaymentMethod })
  @Column({
    type: 'varchar',
    length: 30,
    default: PaymentMethod.MOCK,
  })
  paymentMethod: PaymentMethod;

  @ApiProperty({ description: '支付金额' })
  @Column({ type: 'real', default: 0 })
  amount: number;

  @ApiProperty({ description: '支付币种' })
  @Column({ type: 'varchar', length: 10, default: 'CNY' })
  currency: string;

  @ApiProperty({ description: '支付状态', enum: PaymentStatus })
  @Index()
  @Column({
    type: 'varchar',
    length: 30,
    default: PaymentStatus.PENDING,
  })
  status: PaymentStatus;

  @ApiProperty({ description: '第三方交易流水号' })
  @Index()
  @Column({ type: 'varchar', length: 100, nullable: true })
  transactionId?: string;

  @ApiProperty({ description: '支付请求数据JSON' })
  @Column({ type: 'text', nullable: true })
  requestData?: string;

  @ApiProperty({ description: '支付响应数据JSON' })
  @Column({ type: 'text', nullable: true })
  responseData?: string;

  @ApiProperty({ description: '回调数据JSON' })
  @Column({ type: 'text', nullable: true })
  callbackData?: string;

  @ApiProperty({ description: '支付过期时间' })
  @Index()
  @Column({ type: 'datetime' })
  expireAt: Date;

  @ApiProperty({ description: '支付成功时间' })
  @Column({ type: 'datetime', nullable: true })
  paidAt?: Date;

  @ApiProperty({ description: '失败原因' })
  @Column({ type: 'varchar', length: 500, nullable: true })
  failReason?: string;

  @ApiProperty({ description: '创建时间' })
  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;

  @ApiProperty({ description: '更新时间' })
  @UpdateDateColumn({ type: 'datetime' })
  updatedAt: Date;
}
