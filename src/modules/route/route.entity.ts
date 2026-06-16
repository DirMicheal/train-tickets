import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

export enum RouteStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
}

@Entity('routes')
export class Route {
  @ApiProperty({ description: '线路ID' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: '线路名称' })
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 200 })
  name: string;

  @ApiProperty({ description: '线路编号' })
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 50 })
  code: string;

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

  @ApiProperty({ description: '途经站点JSON [{stationId, stationName, arriveTime, departTime, distance, price}]' })
  @Column({ type: 'text' })
  stationsJson: string;

  @ApiProperty({ description: '总距离(公里)' })
  @Column({ type: 'real', default: 0 })
  totalDistance: number;

  @ApiProperty({ description: '预计运行时间(分钟)' })
  @Column({ type: 'integer', default: 0 })
  durationMinutes: number;

  @ApiProperty({ description: '线路类型: 高铁/动车/普快/特快' })
  @Column({ type: 'varchar', length: 20, default: '高铁' })
  routeType: string;

  @ApiProperty({ description: '线路状态', enum: RouteStatus })
  @Column({
    type: 'varchar',
    length: 30,
    default: RouteStatus.ACTIVE,
  })
  status: RouteStatus;

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

export interface RouteStationInfo {
  stationId: string;
  stationName: string;
  stationCode?: string;
  arriveTime: string;
  departTime: string;
  stopMinutes: number;
  distanceFromOrigin: number;
  seatPrices?: Record<string, number>;
}
