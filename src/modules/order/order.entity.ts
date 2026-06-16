import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

export enum OrderStatus {
  PENDING_PAYMENT = 'pending_payment',
  PAID = 'paid',
  ISSUED = 'issued',
  CHANGED = 'changed',
  REFUND_REQUESTED = 'refund_requested',
  REFUNDED = 'refunded',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
  PAYMENT_FAILED = 'payment_failed',
}

export enum ChangeStatus {
  NONE = 'none',
  REQUESTED = 'requested',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum RefundStatus {
  NONE = 'none',
  REQUESTED = 'requested',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum RefundReason {
  PERSONAL = 'personal',
  SCHEDULE_CHANGE = 'schedule_change',
  TRAIN_DELAY = 'train_delay',
  TRAIN_CANCELLED = 'train_cancelled',
  OTHER = 'other',
}

export interface PassengerInfo {
  name: string;
  idCard: string;
  phone?: string;
  seatTypeCode: string;
  seatTypeName: string;
  price: number;
  seatNo?: string;
  carriageNo?: string;
}

@Entity('orders')
export class Order {
  @ApiProperty({ description: '订单ID' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: '订单号' })
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64, unique: true })
  orderNo: string;

  @ApiProperty({ description: '用户ID' })
  @Index()
  @Column({ type: 'varchar', length: 36 })
  userId: string;

  @ApiProperty({ description: '联系人姓名' })
  @Column({ type: 'varchar', length: 50 })
  contactName: string;

  @ApiProperty({ description: '联系人手机' })
  @Column({ type: 'varchar', length: 20 })
  contactPhone: string;

  @ApiProperty({ description: '关联的锁票批次号' })
  @Index()
  @Column({ type: 'varchar', length: 64, nullable: true })
  lockBatchNo?: string;

  @ApiProperty({ description: '车次ID' })
  @Index()
  @Column({ type: 'varchar', length: 36 })
  trainId: string;

  @ApiProperty({ description: '车次号' })
  @Column({ type: 'varchar', length: 20 })
  trainNo: string;

  @ApiProperty({ description: '出发站ID' })
  @Column({ type: 'varchar', length: 36 })
  fromStationId: string;

  @ApiProperty({ description: '出发站名称' })
  @Column({ type: 'varchar', length: 100 })
  fromStationName: string;

  @ApiProperty({ description: '到达站ID' })
  @Column({ type: 'varchar', length: 36 })
  toStationId: string;

  @ApiProperty({ description: '到达站名称' })
  @Column({ type: 'varchar', length: 100 })
  toStationName: string;

  @ApiProperty({ description: '出发日期' })
  @Index()
  @Column({ type: 'date' })
  travelDate: string;

  @ApiProperty({ description: '出发时间' })
  @Column({ type: 'varchar', length: 10 })
  departTime: string;

  @ApiProperty({ description: '到达时间' })
  @Column({ type: 'varchar', length: 10 })
  arriveTime: string;

  @ApiProperty({ description: '运行历时(分钟)' })
  @Column({ type: 'integer', default: 0 })
  durationMinutes: number;

  @ApiProperty({ description: '乘车人信息JSON' })
  @Column({ type: 'text' })
  passengersJson: string;

  @ApiProperty({ description: '乘车人数' })
  @Column({ type: 'integer', default: 1 })
  passengerCount: number;

  @ApiProperty({ description: '订单总额' })
  @Column({ type: 'real', default: 0 })
  totalAmount: number;

  @ApiProperty({ description: '实际支付金额' })
  @Column({ type: 'real', default: 0 })
  paidAmount: number;

  @ApiProperty({ description: '手续费' })
  @Column({ type: 'real', default: 0 })
  serviceFee: number;

  @ApiProperty({ description: '优惠金额' })
  @Column({ type: 'real', default: 0 })
  discountAmount: number;

  @ApiProperty({ description: '退款金额' })
  @Column({ type: 'real', default: 0 })
  refundAmount: number;

  @ApiProperty({ description: '订单状态', enum: OrderStatus })
  @Index()
  @Column({
    type: 'varchar',
    length: 30,
    default: OrderStatus.PENDING_PAYMENT,
  })
  status: OrderStatus;

  @ApiProperty({ description: '改签状态', enum: ChangeStatus })
  @Column({
    type: 'varchar',
    length: 30,
    default: ChangeStatus.NONE,
  })
  changeStatus: ChangeStatus;

  @ApiProperty({ description: '退票状态', enum: RefundStatus })
  @Column({
    type: 'varchar',
    length: 30,
    default: RefundStatus.NONE,
  })
  refundStatus: RefundStatus;

  @ApiProperty({ description: '原订单号（改签用）' })
  @Index()
  @Column({ type: 'varchar', length: 64, nullable: true })
  originalOrderNo?: string;

  @ApiProperty({ description: '改签后新订单号' })
  @Column({ type: 'varchar', length: 64, nullable: true })
  changedToOrderNo?: string;

  @ApiProperty({ description: '支付方式' })
  @Column({ type: 'varchar', length: 30, nullable: true })
  paymentMethod?: string;

  @ApiProperty({ description: '支付时间' })
  @Column({ type: 'datetime', nullable: true })
  paidAt?: Date;

  @ApiProperty({ description: '交易流水号' })
  @Index()
  @Column({ type: 'varchar', length: 100, nullable: true })
  transactionId?: string;

  @ApiProperty({ description: '订单过期时间' })
  @Index()
  @Column({ type: 'datetime' })
  expireAt: Date;

  @ApiProperty({ description: '备注' })
  @Column({ type: 'varchar', length: 500, nullable: true })
  remark?: string;

  @ApiProperty({ description: '退票原因' })
  @Column({
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  refundReason?: RefundReason;

  @ApiProperty({ description: '退票说明' })
  @Column({ type: 'varchar', length: 500, nullable: true })
  refundRemark?: string;

  @ApiProperty({ description: '退票时间' })
  @Column({ type: 'datetime', nullable: true })
  refundedAt?: Date;

  @ApiProperty({ description: '创建时间' })
  @Index()
  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;

  @ApiProperty({ description: '更新时间' })
  @UpdateDateColumn({ type: 'datetime' })
  updatedAt: Date;

  @ApiProperty({ description: '取消时间' })
  @Column({ type: 'datetime', nullable: true })
  cancelledAt?: Date;
}
