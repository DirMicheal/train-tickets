import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MinLength, MaxLength, IsOptional, IsEnum, IsEmail, Matches } from 'class-validator';

export enum RegisterType {
  PHONE = 'phone',
  EMAIL = 'email',
  USERNAME = 'username',
}

export class RegisterDto {
  @ApiProperty({ description: '注册类型', enum: RegisterType, default: RegisterType.PHONE })
  @IsEnum(RegisterType)
  @IsNotEmpty({ message: '注册类型不能为空' })
  type: RegisterType;

  @ApiProperty({ description: '用户名' })
  @IsOptional()
  @IsString()
  @MinLength(4, { message: '用户名至少4位' })
  @MaxLength(50, { message: '用户名最多50位' })
  username?: string;

  @ApiProperty({ description: '手机号' })
  @IsOptional()
  @Matches(/^1[3-9]\d{9}$/, { message: '手机号格式不正确' })
  phone?: string;

  @ApiProperty({ description: '邮箱' })
  @IsOptional()
  @IsEmail({}, { message: '邮箱格式不正确' })
  email?: string;

  @ApiProperty({ description: '密码' })
  @IsString()
  @IsNotEmpty({ message: '密码不能为空' })
  @MinLength(6, { message: '密码至少6位' })
  @MaxLength(50, { message: '密码最多50位' })
  password: string;

  @ApiPropertyOptional({ description: '确认密码' })
  @IsOptional()
  @IsString()
  confirmPassword?: string;

  @ApiPropertyOptional({ description: '真实姓名' })
  @IsOptional()
  @IsString()
  realName?: string;

  @ApiPropertyOptional({ description: '身份证号' })
  @IsOptional()
  @Matches(/^\d{17}[\dXx]$/, { message: '身份证号格式不正确' })
  idCard?: string;
}

export class LoginDto {
  @ApiProperty({ description: '登录账号(用户名/手机号/邮箱)' })
  @IsString()
  @IsNotEmpty({ message: '登录账号不能为空' })
  account: string;

  @ApiProperty({ description: '密码' })
  @IsString()
  @IsNotEmpty({ message: '密码不能为空' })
  password: string;
}

export class RefreshTokenDto {
  @ApiProperty({ description: '刷新令牌' })
  @IsString()
  @IsNotEmpty({ message: '刷新令牌不能为空' })
  refreshToken: string;
}

export class ChangePasswordDto {
  @ApiProperty({ description: '旧密码' })
  @IsString()
  @IsNotEmpty({ message: '旧密码不能为空' })
  oldPassword: string;

  @ApiProperty({ description: '新密码' })
  @IsString()
  @IsNotEmpty({ message: '新密码不能为空' })
  @MinLength(6, { message: '新密码至少6位' })
  newPassword: string;
}

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

  @ApiPropertyOptional({ description: '头像' })
  @IsOptional()
  @IsString()
  avatar?: string;
}

export class LoginResponseDto {
  @ApiProperty({ description: '访问令牌' })
  accessToken: string;

  @ApiProperty({ description: '刷新令牌' })
  refreshToken: string;

  @ApiProperty({ description: '令牌过期时间(秒)' })
  expiresIn: number;

  @ApiProperty({ description: '令牌类型' })
  tokenType: string;

  @ApiProperty({ description: '用户信息' })
  user: any;
}
