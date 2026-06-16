import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

export enum SeatStatus {
  AVAILABLE = 'available',
  SOLD = 'sold',
  LOCKED = 'locked',
  MAINTAINED = 'maintained',
}

export enum SeatClass {
  BUSINESS = 'business',
  FIRST = 'first',
  SECOND = 'second',
  SOFT_SLEEPER = 'soft_sleeper',
  HARD_SLEEPER = 'hard_sleeper',
  SOFT_SEAT = 'soft_seat',
  HARD_SEAT = 'hard_seat',
  STANDING = 'standing',
}

export interface SeatTypeConfig {
  code: string;
  name: string;
  seatClass: SeatClass;
  carriageCount: number;
  seatsPerCarriage: number;
  basePricePerKm: number;
  sortOrder: number;
}

export const DEFAULT_SEAT_TYPES: SeatTypeConfig[] = [
  {
    code: 'BUSINESS',
    name: '商务座',
    seatClass: SeatClass.BUSINESS,
    carriageCount: 1,
    seatsPerCarriage: 28,
    basePricePerKm: 1.8,
    sortOrder: 1,
  },
  {
    code: 'FIRST',
    name: '一等座',
    seatClass: SeatClass.FIRST,
    carriageCount: 2,
    seatsPerCarriage: 56,
    basePricePerKm: 0.8,
    sortOrder: 2,
  },
  {
    code: 'SECOND',
    name: '二等座',
    seatClass: SeatClass.SECOND,
    carriageCount: 8,
    seatsPerCarriage: 85,
    basePricePerKm: 0.5,
    sortOrder: 3,
  },
  {
    code: 'SOFT_SLEEPER',
    name: '软卧',
    seatClass: SeatClass.SOFT_SLEEPER,
    carriageCount: 2,
    seatsPerCarriage: 36,
    basePricePerKm: 1.2,
    sortOrder: 4,
  },
  {
    code: 'HARD_SLEEPER',
    name: '硬卧',
    seatClass: SeatClass.HARD_SLEEPER,
    carriageCount: 6,
    seatsPerCarriage: 60,
    basePricePerKm: 0.7,
    sortOrder: 5,
  },
  {
    code: 'SOFT_SEAT',
    name: '软座',
    seatClass: SeatClass.SOFT_SEAT,
    carriageCount: 3,
    seatsPerCarriage: 72,
    basePricePerKm: 0.6,
    sortOrder: 6,
  },
  {
    code: 'HARD_SEAT',
    name: '硬座',
    seatClass: SeatClass.HARD_SEAT,
    carriageCount: 10,
    seatsPerCarriage: 118,
    basePricePerKm: 0.3,
    sortOrder: 7,
  },
  {
    code: 'STANDING',
    name: '无座',
    seatClass: SeatClass.STANDING,
    carriageCount: 0,
    seatsPerCarriage: 0,
    basePricePerKm: 0.3,
    sortOrder: 8,
  },
];

@Entity('seat_types')
export class SeatType {
  @ApiProperty({ description: '座位类型ID' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: '座位类型代码' })
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 50, unique: true })
  code: string;

  @ApiProperty({ description: '座位类型名称' })
  @Column({ type: 'varchar', length: 50 })
  name: string;

  @ApiProperty({ description: '座位等级', enum: SeatClass })
  @Column({ type: 'varchar', length: 30 })
  seatClass: SeatClass;

  @ApiProperty({ description: '车厢数量' })
  @Column({ type: 'integer', default: 0 })
  carriageCount: number;

  @ApiProperty({ description: '每车厢座位数' })
  @Column({ type: 'integer', default: 0 })
  seatsPerCarriage: number;

  @ApiProperty({ description: '每公里基础价格' })
  @Column({ type: 'real', default: 0 })
  basePricePerKm: number;

  @ApiProperty({ description: '排序号' })
  @Column({ type: 'integer', default: 0 })
  sortOrder: number;

  @ApiProperty({ description: '是否启用' })
  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @ApiProperty({ description: '描述' })
  @Column({ type: 'varchar', length: 500, nullable: true })
  description?: string;

  @ApiProperty({ description: '创建时间' })
  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;

  @ApiProperty({ description: '更新时间' })
  @UpdateDateColumn({ type: 'datetime' })
  updatedAt: Date;
}
