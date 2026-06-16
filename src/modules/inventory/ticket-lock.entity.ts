import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

export enum LockStatus {
  LOCKED = 'locked',
  CONFIRMED = 'confirmed',
  RELEASED = 'released',
  EXPIRED = 'expired',
}

@Entity('ticket_locks')
export class TicketLock {
  @ApiProperty({ description: '锁票记录ID' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: '锁票批次号' })
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64, unique: true })
  lockBatchNo: string;

  @ApiProperty({ description: '用户ID' })
  @Index()
  @Column({ type: 'varchar', length: 36 })
  userId: string;

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
  @Column({ type: 'date' })
  travelDate: string;

  @ApiProperty({ description: '锁票详情JSON' })
  @Column({ type: 'text' })
  locksJson: string;

  @ApiProperty({ description: '锁票总数量' })
  @Column({ type: 'integer', default: 0 })
  totalQuantity: number;

  @ApiProperty({ description: '总金额' })
  @Column({ type: 'real', default: 0 })
  totalAmount: number;

  @ApiProperty({ description: '锁票状态', enum: LockStatus })
  @Index()
  @Column({
    type: 'varchar',
    length: 20,
    default: LockStatus.LOCKED,
  })
  status: LockStatus;

  @ApiProperty({ description: '关联订单号' })
  @Index()
  @Column({ type: 'varchar', length: 64, nullable: true })
  orderNo?: string;

  @ApiProperty({ description: '过期时间' })
  @Index()
  @Column({ type: 'datetime' })
  expireAt: Date;

  @ApiProperty({ description: '创建时间' })
  @Index()
  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;

  @ApiProperty({ description: '释放时间' })
  @Column({ type: 'datetime', nullable: true })
  releasedAt?: Date;
}

export interface SeatLockItem {
  seatTypeCode: string;
  seatTypeName: string;
  quantity: number;
  price: number;
}
