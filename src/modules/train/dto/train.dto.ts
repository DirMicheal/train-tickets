import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  IsNumber,
  IsBoolean,
  IsDateString,
  IsArray,
  Length,
} from 'class-validator';
import { TrainStatus } from '../train.entity';
import { SeatClass } from '../seat-type.entity';
import { PaginationDto } from '../../../common/dto/common.dto';

export class CreateSeatTypeDto {
  @ApiProperty({ description: '座位类型代码' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ description: '座位类型名称' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: '座位等级', enum: SeatClass })
  @IsEnum(SeatClass)
  seatClass: SeatClass;

  @ApiPropertyOptional({ description: '车厢数量', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  carriageCount?: number;

  @ApiPropertyOptional({ description: '每车厢座位数', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  seatsPerCarriage?: number;

  @ApiPropertyOptional({ description: '每公里基础价格', default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  basePricePerKm?: number;

  @ApiPropertyOptional({ description: '排序号', default: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ description: '是否启用', default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ description: '描述' })
  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateSeatTypeDto extends CreateSeatTypeDto {}

export class CreateTrainDto {
  @ApiProperty({ description: '车次号 如 G1234' })
  @IsString()
  @IsNotEmpty()
  @Length(2, 20)
  trainNo: string;

  @ApiProperty({ description: '线路ID' })
  @IsString()
  @IsNotEmpty()
  routeId: string;

  @ApiProperty({ description: '运行日期 YYYY-MM-DD' })
  @IsDateString({}, { message: '运行日期格式不正确' })
  travelDate: string;

  @ApiPropertyOptional({ description: '列车类型', default: '高铁' })
  @IsOptional()
  @IsString()
  trainType?: string;

  @ApiPropertyOptional({ description: '备注' })
  @IsOptional()
  @IsString()
  remark?: string;
}

export class UpdateTrainDto {
  @ApiPropertyOptional({ description: '车次状态', enum: TrainStatus })
  @IsOptional()
  @IsEnum(TrainStatus)
  status?: TrainStatus;

  @ApiPropertyOptional({ description: '延迟分钟数' })
  @IsOptional()
  @IsInt()
  @Min(0)
  delayMinutes?: number;

  @ApiPropertyOptional({ description: '备注' })
  @IsOptional()
  @IsString()
  remark?: string;
}

export class QueryTrainDto extends PaginationDto {
  @ApiPropertyOptional({ description: '车次号' })
  @IsOptional()
  @IsString()
  trainNo?: string;

  @ApiPropertyOptional({ description: '运行日期 YYYY-MM-DD' })
  @IsOptional()
  @IsDateString()
  travelDate?: string;

  @ApiPropertyOptional({ description: '始发站ID' })
  @IsOptional()
  @IsString()
  originStationId?: string;

  @ApiPropertyOptional({ description: '终点站ID' })
  @IsOptional()
  @IsString()
  terminalStationId?: string;

  @ApiPropertyOptional({ description: '始发站名称（模糊查询）' })
  @IsOptional()
  @IsString()
  originStationName?: string;

  @ApiPropertyOptional({ description: '终点站名称（模糊查询）' })
  @IsOptional()
  @IsString()
  terminalStationName?: string;

  @ApiPropertyOptional({ description: '车次状态', enum: TrainStatus })
  @IsOptional()
  @IsEnum(TrainStatus)
  status?: TrainStatus;

  @ApiPropertyOptional({ description: '列车类型' })
  @IsOptional()
  @IsString()
  trainType?: string;
}

export class GenerateTrainsDto {
  @ApiProperty({ description: '线路ID列表' })
  @IsArray()
  routeIds: string[];

  @ApiProperty({ description: '开始日期 YYYY-MM-DD' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ description: '结束日期 YYYY-MM-DD' })
  @IsDateString()
  endDate: string;
}
