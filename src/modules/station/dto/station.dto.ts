import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  Max,
  IsNumber,
  IsBoolean,
  Length,
} from 'class-validator';
import { StationStatus } from '../station.entity';
import { PaginationDto } from '../../../common/dto/common.dto';

export class CreateStationDto {
  @ApiProperty({ description: '站点名称' })
  @IsString()
  @IsNotEmpty({ message: '站点名称不能为空' })
  @Length(2, 100, { message: '站点名称长度为2-100个字符' })
  name: string;

  @ApiProperty({ description: '站点代码（三字码）' })
  @IsString()
  @IsNotEmpty({ message: '站点代码不能为空' })
  @Length(2, 10, { message: '站点代码长度为2-10个字符' })
  code: string;

  @ApiPropertyOptional({ description: '拼音首字母' })
  @IsOptional()
  @IsString()
  pinyin?: string;

  @ApiPropertyOptional({ description: '所属省份' })
  @IsOptional()
  @IsString()
  province?: string;

  @ApiPropertyOptional({ description: '所属城市' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ description: '地址' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ description: '经度' })
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiPropertyOptional({ description: '纬度' })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({ description: '站点等级 1-5', default: 3 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  level?: number;

  @ApiPropertyOptional({ description: '是否为始发站', default: false })
  @IsOptional()
  @IsBoolean()
  isOrigin?: boolean;

  @ApiPropertyOptional({ description: '是否为终点站', default: false })
  @IsOptional()
  @IsBoolean()
  isTerminal?: boolean;

  @ApiPropertyOptional({ description: '排序号', default: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateStationDto extends CreateStationDto {
  @ApiPropertyOptional({ description: '站点状态', enum: StationStatus })
  @IsOptional()
  @IsEnum(StationStatus)
  status?: StationStatus;
}

export class QueryStationDto extends PaginationDto {
  @ApiPropertyOptional({ description: '站点状态', enum: StationStatus })
  @IsOptional()
  @IsEnum(StationStatus)
  status?: StationStatus;

  @ApiPropertyOptional({ description: '省份' })
  @IsOptional()
  @IsString()
  province?: string;

  @ApiPropertyOptional({ description: '城市' })
  @IsOptional()
  @IsString()
  city?: string;
}
