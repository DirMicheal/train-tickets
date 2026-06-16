import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEmail, Matches, IsEnum } from 'class-validator';
import { UserRole, UserStatus } from '../user.entity';
import { PaginationDto } from '../../../common/dto/common.dto';

export class UpdateUserDto {
  @ApiPropertyOptional({ description: '真实姓名' })
  @IsOptional()
  @IsString()
  realName?: string;

  @ApiPropertyOptional({ description: '身份证号' })
  @IsOptional()
  @Matches(/^\d{17}[\dXx]$/, { message: '身份证号格式不正确' })
  idCard?: string;

  @ApiPropertyOptional({ description: '邮箱' })
  @IsOptional()
  @IsEmail({}, { message: '邮箱格式不正确' })
  email?: string;

  @ApiPropertyOptional({ description: '头像URL' })
  @IsOptional()
  @IsString()
  avatar?: string;
}

export class QueryUserDto extends PaginationDto {
  @ApiPropertyOptional({ description: '用户角色', enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({ description: '用户状态', enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}

export class UpdateStatusDto {
  @ApiPropertyOptional({ description: '用户状态', enum: UserStatus })
  @IsEnum(UserStatus)
  status: UserStatus;
}

export class UpdateRoleDto {
  @ApiPropertyOptional({ description: '用户角色', enum: UserRole })
  @IsEnum(UserRole)
  role: UserRole;
}
