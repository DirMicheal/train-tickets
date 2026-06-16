import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity('inventories')
@Unique('uk_train_seat', ['trainId', 'seatTypeCode'])
export class Inventory {
  @ApiProperty({ description: '库存ID' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: '车次ID' })
  @Index()
  @Column({ type: 'varchar', length: 36 })
  trainId: string;

  @ApiProperty({ description: '座位类型代码' })
  @Column({ type: 'varchar', length: 50 })
  seatTypeCode: string;

  @ApiProperty({ description: '座位类型名称' })
  @Column({ type: 'varchar', length: 50 })
  seatTypeName: string;

  @ApiProperty({ description: '座位总数' })
  @Column({ type: 'integer', default: 0 })
  totalCount: number;

  @ApiProperty({ description: '已售数量' })
  @Column({ type: 'integer', default: 0 })
  soldCount: number;

  @ApiProperty({ description: '锁定数量（待支付）' })
  @Column({ type: 'integer', default: 0 })
  lockedCount: number;

  @ApiProperty({ description: '可用数量 = 总数 - 已售 - 锁定' })
  @Column({ type: 'integer', default: 0 })
  availableCount: number;

  @ApiProperty({ description: '单价' })
  @Column({ type: 'real', default: 0 })
  price: number;

  @ApiProperty({ description: '版本号，用于乐观锁' })
  @Column({ type: 'integer', default: 0 })
  version: number;

  @ApiProperty({ description: '创建时间' })
  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;

  @ApiProperty({ description: '更新时间' })
  @UpdateDateColumn({ type: 'datetime' })
  updatedAt: Date;
}
