import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, Max, IsEnum, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export enum OrderBy {
  ASC = 'ASC',
  DESC = 'DESC',
}

export class PaginationDto {
  @ApiPropertyOptional({ description: '页码', default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: '每页数量', default: 10, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 10;

  @ApiPropertyOptional({ description: '排序字段' })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({ description: '排序方式', enum: OrderBy, default: OrderBy.DESC })
  @IsOptional()
  @IsEnum(OrderBy)
  orderBy?: OrderBy = OrderBy.DESC;

  @ApiPropertyOptional({ description: '搜索关键字' })
  @IsOptional()
  @IsString()
  keyword?: string;
}

export class ApiResponseDto<T> {
  @ApiProperty({ description: '是否成功' })
  success: boolean;

  @ApiProperty({ description: '状态码' })
  code: number;

  @ApiProperty({ description: '消息' })
  message: string;

  @ApiProperty({ description: '数据' })
  data: T;

  @ApiProperty({ description: '时间戳' })
  timestamp: string;

  @ApiProperty({ description: '请求路径' })
  path: string;

  @ApiProperty({ description: '请求ID' })
  requestId: string;
}

export class PaginatedResponseDto<T> {
  @ApiProperty({ description: '数据列表', type: [Object] })
  list: T[];

  @ApiProperty({ description: '总数' })
  total: number;

  @ApiProperty({ description: '当前页码' })
  page: number;

  @ApiProperty({ description: '每页数量' })
  pageSize: number;

  @ApiProperty({ description: '总页数' })
  totalPages: number;
}
