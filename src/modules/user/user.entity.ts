import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
}

export enum UserStatus {
  ACTIVE = 'active',
  DISABLED = 'disabled',
  LOCKED = 'locked',
}

@Entity('users')
export class User {
  @ApiProperty({ description: '用户ID' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: '用户名' })
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 50, unique: true })
  username: string;

  @ApiProperty({ description: '手机号' })
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 20, unique: true, nullable: true })
  phone?: string;

  @ApiProperty({ description: '邮箱' })
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 100, unique: true, nullable: true })
  email?: string;

  @Column({ type: 'varchar', length: 255, select: false })
  password: string;

  @ApiProperty({ description: '真实姓名' })
  @Column({ type: 'varchar', length: 50, nullable: true })
  realName?: string;

  @ApiProperty({ description: '身份证号' })
  @Column({ type: 'varchar', length: 18, nullable: true })
  idCard?: string;

  @ApiProperty({ description: '用户角色', enum: UserRole })
  @Column({
    type: 'varchar',
    length: 20,
    default: UserRole.USER,
  })
  role: UserRole;

  @ApiProperty({ description: '用户状态', enum: UserStatus })
  @Column({
    type: 'varchar',
    length: 20,
    default: UserStatus.ACTIVE,
  })
  status: UserStatus;

  @ApiProperty({ description: '头像URL' })
  @Column({ type: 'varchar', length: 500, nullable: true })
  avatar?: string;

  @ApiProperty({ description: '创建时间' })
  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;

  @ApiProperty({ description: '更新时间' })
  @UpdateDateColumn({ type: 'datetime' })
  updatedAt: Date;

  @ApiProperty({ description: '最后登录时间' })
  @Column({ type: 'datetime', nullable: true })
  lastLoginAt?: Date;

  @ApiProperty({ description: '最后登录IP' })
  @Column({ type: 'varchar', length: 50, nullable: true })
  lastLoginIp?: string;
}
