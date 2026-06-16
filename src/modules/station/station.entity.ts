import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

export enum StationStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  UNDER_MAINTENANCE = 'under_maintenance',
}

@Entity('stations')
export class Station {
  @ApiProperty({ description: '站点ID' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: '站点名称' })
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 100 })
  name: string;

  @ApiProperty({ description: '站点代码（三字码）' })
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 10 })
  code: string;

  @ApiProperty({ description: '拼音首字母' })
  @Index()
  @Column({ type: 'varchar', length: 50, nullable: true })
  pinyin?: string;

  @ApiProperty({ description: '所属省份' })
  @Column({ type: 'varchar', length: 50, nullable: true })
  province?: string;

  @ApiProperty({ description: '所属城市' })
  @Column({ type: 'varchar', length: 50, nullable: true })
  city?: string;

  @ApiProperty({ description: '地址' })
  @Column({ type: 'varchar', length: 255, nullable: true })
  address?: string;

  @ApiProperty({ description: '经度' })
  @Column({ type: 'real', nullable: true })
  longitude?: number;

  @ApiProperty({ description: '纬度' })
  @Column({ type: 'real', nullable: true })
  latitude?: number;

  @ApiProperty({ description: '站点等级 1-5' })
  @Column({ type: 'integer', default: 3 })
  level: number;

  @ApiProperty({ description: '是否为始发站' })
  @Column({ type: 'boolean', default: false })
  isOrigin: boolean;

  @ApiProperty({ description: '是否为终点站' })
  @Column({ type: 'boolean', default: false })
  isTerminal: boolean;

  @ApiProperty({ description: '排序号' })
  @Column({ type: 'integer', default: 0 })
  sortOrder: number;

  @ApiProperty({ description: '站点状态', enum: StationStatus })
  @Column({
    type: 'varchar',
    length: 30,
    default: StationStatus.ACTIVE,
  })
  status: StationStatus;

  @ApiProperty({ description: '创建时间' })
  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;

  @ApiProperty({ description: '更新时间' })
  @UpdateDateColumn({ type: 'datetime' })
  updatedAt: Date;
}
