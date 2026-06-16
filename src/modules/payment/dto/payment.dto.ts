import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
} from 'class-validator';
import { PaymentMethod } from '../payment.entity';
import { PaginationDto } from '../../../common/dto/common.dto';

export class CreatePaymentDto {
  @ApiProperty({ description: '订单号' })
  @IsString()
  @IsNotEmpty({ message: '订单号不能为空' })
  orderNo: string;

  @ApiProperty({ description: '支付方式', enum: PaymentMethod, default: PaymentMethod.MOCK })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @ApiPropertyOptional({ description: '幂等性Key' })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

export class ProcessPaymentDto {
  @ApiProperty({ description: '支付单号' })
  @IsString()
  @IsNotEmpty()
  paymentNo: string;

  @ApiPropertyOptional({ description: '模拟是否支付成功，默认true' })
  @IsOptional()
  success?: boolean = true;

  @ApiPropertyOptional({ description: '模拟延迟毫秒数' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  delayMs?: number;
}

export class PaymentCallbackDto {
  @ApiProperty({ description: '支付单号' })
  @IsString()
  @IsNotEmpty()
  paymentNo: string;

  @ApiProperty({ description: '第三方交易号' })
  @IsString()
  @IsNotEmpty()
  transactionId: string;

  @ApiProperty({ description: '是否支付成功' })
  success: boolean;

  @ApiPropertyOptional({ description: '支付金额' })
  @IsOptional()
  @IsNumber()
  amount?: number;

  @ApiPropertyOptional({ description: '失败原因' })
  @IsOptional()
  @IsString()
  failReason?: string;

  @ApiPropertyOptional({ description: '回调原始数据' })
  @IsOptional()
  rawData?: any;
}

export class QueryPaymentDto extends PaginationDto {
  @ApiPropertyOptional({ description: '订单号' })
  @IsOptional()
  @IsString()
  orderNo?: string;

  @ApiPropertyOptional({ description: '支付方式', enum: PaymentMethod })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({ description: '支付状态' })
  @IsOptional()
  @IsString()
  status?: string;
}
