import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  IsNumber,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  Length,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RouteStatus, RouteStationInfo } from '../route.entity';
import { PaginationDto } from '../../../common/dto/common.dto';

export class RouteStationDto {
  @ApiProperty({ description: '站点ID' })
  @IsString()
  @IsNotEmpty()
  stationId: string;

  @ApiProperty({ description: '站点名称' })
  @IsString()
  @IsNotEmpty()
  stationName: string;

  @ApiPropertyOptional({ description: '站点代码' })
  @IsOptional()
  @IsString()
  stationCode?: string;

  @ApiProperty({ description: '到达时间 HH:mm' })
  @IsString()
  @IsNotEmpty()
  arriveTime: string;

  @ApiProperty({ description: '发车时间 HH:mm' })
  @IsString()
  @IsNotEmpty()
  departTime: string;

  @ApiProperty({ description: '停靠分钟数' })
  @IsInt()
  @Min(0)
  stopMinutes: number;

  @ApiProperty({ description: '距离始发站的距离(公里)' })
  @IsNumber()
  @Min(0)
  distanceFromOrigin: number;

  @ApiPropertyOptional({ description: '座位类型价格映射 {seatTypeCode: price}' })
  @IsOptional()
  seatPrices?: Record<string, number>;
}

export class CreateRouteDto {
  @ApiProperty({ description: '线路名称' })
  @IsString()
  @IsNotEmpty({ message: '线路名称不能为空' })
  @Length(2, 200)
  name: string;

  @ApiProperty({ description: '线路编号' })
  @IsString()
  @IsNotEmpty({ message: '线路编号不能为空' })
  @Length(2, 50)
  code: string;

  @ApiProperty({ description: '始发站ID' })
  @IsString()
  @IsNotEmpty()
  originStationId: string;

  @ApiProperty({ description: '始发站名称' })
  @IsString()
  @IsNotEmpty()
  originStationName: string;

  @ApiProperty({ description: '终点站ID' })
  @IsString()
  @IsNotEmpty()
  terminalStationId: string;

  @ApiProperty({ description: '终点站名称' })
  @IsString()
  @IsNotEmpty()
  terminalStationName: string;

  @ApiProperty({ description: '途经站点列表', type: [RouteStationDto] })
  @IsArray()
  @ArrayMinSize(2, { message: '至少需要2个站点' })
  @ValidateNested({ each: true })
  @Type(() => RouteStationDto)
  stations: RouteStationDto[];

  @ApiPropertyOptional({ description: '总距离(公里)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalDistance?: number;

  @ApiPropertyOptional({ description: '预计运行时间(分钟)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  durationMinutes?: number;

  @ApiPropertyOptional({ description: '线路类型', default: '高铁' })
  @IsOptional()
  @IsString()
  routeType?: string;

  @ApiPropertyOptional({ description: '备注' })
  @IsOptional()
  @IsString()
  remark?: string;
}

export class UpdateRouteDto extends CreateRouteDto {
  @ApiPropertyOptional({ description: '线路状态', enum: RouteStatus })
  @IsOptional()
  @IsEnum(RouteStatus)
  status?: RouteStatus;
}

export class QueryRouteDto extends PaginationDto {
  @ApiPropertyOptional({ description: '线路状态', enum: RouteStatus })
  @IsOptional()
  @IsEnum(RouteStatus)
  status?: RouteStatus;

  @ApiPropertyOptional({ description: '始发站ID' })
  @IsOptional()
  @IsString()
  originStationId?: string;

  @ApiPropertyOptional({ description: '终点站ID' })
  @IsOptional()
  @IsString()
  terminalStationId?: string;

  @ApiPropertyOptional({ description: '线路类型' })
  @IsOptional()
  @IsString()
  routeType?: string;
}
