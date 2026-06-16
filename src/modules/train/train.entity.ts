import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

export enum TrainStatus {
  AVAILABLE = 'available',
  DELAYED = 'delayed',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
  MAINTENANCE = 'maintenance',
}

@Entity('trains')
export class Train {
  @ApiProperty({ description: '车次ID' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: '车次号 如 G1234' })
  @Index()
  @Column({ type: 'varchar', length: 20 })
  trainNo: string;

  @ApiProperty({ description: '线路ID' })
  @Column({ type: 'varchar', length: 36 })
  routeId: string;

  @ApiProperty({ description: '线路名称' })
  @Column({ type: 'varchar', length: 200 })
  routeName: string;

  @ApiProperty({ description: '始发站ID' })
  @Column({ type: 'varchar', length: 36 })
  originStationId: string;

  @ApiProperty({ description: '始发站名称' })
  @Column({ type: 'varchar', length: 100 })
  originStationName: string;

  @ApiProperty({ description: '终点站ID' })
  @Column({ type: 'varchar', length: 36 })
  terminalStationId: string;

  @ApiProperty({ description: '终点站名称' })
  @Column({ type: 'varchar', length: 100 })
  terminalStationName: string;

  @ApiProperty({ description: '运行日期 YYYY-MM-DD' })
  @Index()
  @Column({ type: 'date' })
  travelDate: string;

  @ApiProperty({ description: '始发发车时间 HH:mm' })
  @Column({ type: 'varchar', length: 10 })
  departTime: string;

  @ApiProperty({ description: '终点到达时间 HH:mm' })
  @Column({ type: 'varchar', length: 10 })
  arriveTime: string;

  @ApiProperty({ description: '预计运行时间(分钟)' })
  @Column({ type: 'integer', default: 0 })
  durationMinutes: number;

  @ApiProperty({ description: '总距离(公里)' })
  @Column({ type: 'real', default: 0 })
  totalDistance: number;

  @ApiProperty({ description: '列车类型: 高铁/动车/普快/特快' })
  @Column({ type: 'varchar', length: 20, default: '高铁' })
  trainType: string;

  @ApiProperty({ description: '车次状态', enum: TrainStatus })
  @Index()
  @Column({
    type: 'varchar',
    length: 30,
    default: TrainStatus.AVAILABLE,
  })
  status: TrainStatus;

  @ApiProperty({ description: '座位类型JSON [{code, name, totalCount, soldCount, lockedCount, price}]' })
  @Column({ type: 'text', nullable: true })
  seatTypesJson?: string;

  @ApiProperty({ description: '站点信息JSON 复用于运行时刻表' })
  @Column({ type: 'text', nullable: true })
  stationsJson?: string;

  @ApiProperty({ description: '是否已初始化库存' })
  @Column({ type: 'boolean', default: false })
  inventoryInitialized: boolean;

  @ApiProperty({ description: '延迟分钟数' })
  @Column({ type: 'integer', default: 0 })
  delayMinutes: number;

  @ApiProperty({ description: '备注' })
  @Column({ type: 'varchar', length: 500, nullable: true })
  remark?: string;

  @ApiProperty({ description: '创建时间' })
  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;

  @ApiProperty({ description: '更新时间' })
  @UpdateDateColumn({ type: 'datetime' })
  updatedAt: Date;
}

export interface TrainSeatInfo {
  code: string;
  name: string;
  seatClass: string;
  totalCount: number;
  soldCount: number;
  lockedCount: number;
  availableCount: number;
  price: number;
}
