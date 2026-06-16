import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  IsArray,
  ArrayMinSize,
  IsNumber,
  ValidateNested,
  Length,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OrderStatus, RefundReason } from '../order.entity';
import { PaginationDto } from '../../../common/dto/common.dto';

export class PassengerDto {
  @ApiProperty({ description: '姓名' })
  @IsString()
  @IsNotEmpty({ message: '乘车人姓名不能为空' })
  @Length(2, 20)
  name: string;

  @ApiProperty({ description: '身份证号' })
  @IsString()
  @IsNotEmpty({ message: '身份证号不能为空' })
  @Matches(/^\d{17}[\dXx]$/, { message: '身份证号格式不正确' })
  idCard: string;

  @ApiPropertyOptional({ description: '手机号' })
  @IsOptional()
  @Matches(/^1[3-9]\d{9}$/, { message: '手机号格式不正确' })
  phone?: string;

  @ApiProperty({ description: '座位类型代码' })
  @IsString()
  @IsNotEmpty()
  seatTypeCode: string;

  @ApiProperty({ description: '座位类型名称' })
  @IsString()
  @IsNotEmpty()
  seatTypeName: string;

  @ApiProperty({ description: '单价' })
  @IsNumber()
  @Min(0)
  price: number;
}

export class CreateOrderDto {
  @ApiProperty({ description: '锁票批次号' })
  @IsString()
  @IsNotEmpty({ message: '锁票批次号不能为空' })
  lockBatchNo: string;

  @ApiProperty({ description: '联系人姓名' })
  @IsString()
  @IsNotEmpty({ message: '联系人姓名不能为空' })
  @Length(2, 50)
  contactName: string;

  @ApiProperty({ description: '联系人手机' })
  @IsString()
  @IsNotEmpty({ message: '联系人手机不能为空' })
  @Matches(/^1[3-9]\d{9}$/, { message: '手机号格式不正确' })
  contactPhone: string;

  @ApiProperty({ description: '乘车人列表', type: [PassengerDto] })
  @IsArray()
  @ArrayMinSize(1, { message: '至少需要1个乘车人' })
  @ValidateNested({ each: true })
  @Type(() => PassengerDto)
  passengers: PassengerDto[];

  @ApiPropertyOptional({ description: '备注' })
  @IsOptional()
  @IsString()
  remark?: string;

  @ApiPropertyOptional({ description: '幂等性Key' })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

export class QueryOrderDto extends PaginationDto {
  @ApiPropertyOptional({ description: '订单状态', enum: OrderStatus })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiPropertyOptional({ description: '订单号' })
  @IsOptional()
  @IsString()
  orderNo?: string;

  @ApiPropertyOptional({ description: '车次号' })
  @IsOptional()
  @IsString()
  trainNo?: string;

  @ApiPropertyOptional({ description: '出发日期' })
  @IsOptional()
  @IsString()
  travelDate?: string;

  @ApiPropertyOptional({ description: '出发站名称' })
  @IsOptional()
  @IsString()
  fromStationName?: string;

  @ApiPropertyOptional({ description: '到达站名称' })
  @IsOptional()
  @IsString()
  toStationName?: string;
}

export class CancelOrderDto {
  @ApiPropertyOptional({ description: '取消原因' })
  @IsOptional()
  @IsString()
  cancelReason?: string;
}

export class RequestRefundDto {
  @ApiProperty({ description: '退票原因', enum: RefundReason })
  @IsEnum(RefundReason)
  reason: RefundReason;

  @ApiPropertyOptional({ description: '退票说明' })
  @IsOptional()
  @IsString()
  remark?: string;
}

export class ChangeOrderDto {
  @ApiProperty({ description: '新的锁票批次号' })
  @IsString()
  @IsNotEmpty()
  newLockBatchNo: string;

  @ApiProperty({ description: '新乘车人列表（可复用原乘车人）', type: [PassengerDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PassengerDto)
  newPassengers: PassengerDto[];

  @ApiPropertyOptional({ description: '改签原因' })
  @IsOptional()
  @IsString()
  changeReason?: string;
}
