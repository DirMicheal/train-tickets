import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  Min,
  IsDateString,
  IsArray,
  ArrayMinSize,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../../common/dto/common.dto';

export class SearchTicketDto extends PaginationDto {
  @ApiProperty({ description: '出发站ID' })
  @IsString()
  @IsNotEmpty({ message: '出发站不能为空' })
  fromStationId: string;

  @ApiProperty({ description: '到达站ID' })
  @IsString()
  @IsNotEmpty({ message: '到达站不能为空' })
  toStationId: string;

  @ApiProperty({ description: '出发日期 YYYY-MM-DD' })
  @IsDateString({}, { message: '出发日期格式不正确' })
  travelDate: string;

  @ApiPropertyOptional({ description: '座位类型代码' })
  @IsOptional()
  @IsString()
  seatTypeCode?: string;

  @ApiPropertyOptional({ description: '列车类型: 高铁/动车/普快/特快' })
  @IsOptional()
  @IsString()
  trainType?: string;

  @ApiPropertyOptional({ description: '出发时间范围开始 HH:mm' })
  @IsOptional()
  @IsString()
  departTimeStart?: string;

  @ApiPropertyOptional({ description: '出发时间范围结束 HH:mm' })
  @IsOptional()
  @IsString()
  departTimeEnd?: string;

  @ApiPropertyOptional({ description: '是否只看有票', default: false })
  @IsOptional()
  @Type(() => Boolean)
  onlyAvailable?: boolean;
}

export class TicketInfoItem {
  @ApiProperty({ description: '座位类型代码' })
  code: string;

  @ApiProperty({ description: '座位类型名称' })
  name: string;

  @ApiProperty({ description: '座位数总量' })
  totalCount: number;

  @ApiProperty({ description: '已售数量' })
  soldCount: number;

  @ApiProperty({ description: '锁定数量' })
  lockedCount: number;

  @ApiProperty({ description: '可用数量' })
  availableCount: number;

  @ApiProperty({ description: '价格(元)' })
  price: number;
}

export class StationInfoItem {
  @ApiProperty({ description: '站点ID' })
  stationId: string;

  @ApiProperty({ description: '站点名称' })
  stationName: string;

  @ApiProperty({ description: '站点序号' })
  stationIndex: number;

  @ApiProperty({ description: '到达时间' })
  arriveTime: string;

  @ApiProperty({ description: '发车时间' })
  departTime: string;
}

export class SearchTicketResult {
  @ApiProperty({ description: '车次ID' })
  trainId: string;

  @ApiProperty({ description: '车次号' })
  trainNo: string;

  @ApiProperty({ description: '运行日期' })
  travelDate: string;

  @ApiProperty({ description: '出发站信息' })
  fromStation: StationInfoItem;

  @ApiProperty({ description: '到达站信息' })
  toStation: StationInfoItem;

  @ApiProperty({ description: '历经时间(分钟)' })
  durationMinutes: number;

  @ApiProperty({ description: '历经公里数' })
  distance: number;

  @ApiProperty({ description: '列车类型' })
  trainType: string;

  @ApiProperty({ description: '车次状态' })
  status: string;

  @ApiProperty({ description: '座位票信息列表', type: [TicketInfoItem] })
  seatTypes: TicketInfoItem[];
}

export class LockTicketDto {
  @ApiProperty({ description: '车次ID' })
  @IsString()
  @IsNotEmpty()
  trainId: string;

  @ApiProperty({ description: '出发站ID' })
  @IsString()
  @IsNotEmpty()
  fromStationId: string;

  @ApiProperty({ description: '到达站ID' })
  @IsString()
  @IsNotEmpty()
  toStationId: string;

  @ApiProperty({ description: '座位项列表', type: 'object' })
  @IsArray()
  @ArrayMinSize(1)
  @Type(() => LockSeatItem)
  seats: LockSeatItem[];

  @ApiPropertyOptional({ description: '幂等性Key，用于重复请求校验' })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

export class LockSeatItem {
  @ApiProperty({ description: '座位类型代码' })
  @IsString()
  @IsNotEmpty()
  seatTypeCode: string;

  @ApiProperty({ description: '锁票数量' })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiProperty({ description: '单价' })
  @IsNumber()
  @Min(0)
  price: number;
}

export class LockTicketResult {
  @ApiProperty({ description: '锁票批次号' })
  lockBatchNo: string;

  @ApiProperty({ description: '锁票状态' })
  status: 'success' | 'partial' | 'failed';

  @ApiProperty({ description: '过期时间戳(秒)' })
  expireAt: number;

  @ApiProperty({ description: '锁定详情' })
  lockedSeats: Array<{
    seatTypeCode: string;
    lockedQuantity: number;
    requestQuantity: number;
    price: number;
  }>;
}

export class UnlockTicketDto {
  @ApiProperty({ description: '锁票批次号' })
  @IsString()
  @IsNotEmpty()
  lockBatchNo: string;
}
