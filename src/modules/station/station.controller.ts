import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { StationService } from './station.service';
import { Station, StationStatus } from './station.entity';
import { CreateStationDto, UpdateStationDto, QueryStationDto } from './dto/station.dto';
import { Public, Roles } from '../../common/decorators/index.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UserRole } from '../user/user.entity';

@ApiTags('站点管理')
@Controller('stations')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class StationController {
  constructor(private readonly stationService: StationService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '创建站点（管理员）' })
  @ApiResponse({ status: 201, type: Station })
  async create(@Body() dto: CreateStationDto) {
    return this.stationService.create(dto);
  }

  @Get('list')
  @Public()
  @ApiOperation({ summary: '获取所有激活的站点列表' })
  @ApiResponse({ status: 200, type: [Station] })
  async findAllActive() {
    return this.stationService.findAllActive();
  }

  @Get()
  @ApiOperation({ summary: '分页查询站点列表' })
  async findAll(@Query() dto: QueryStationDto) {
    return this.stationService.findAll(dto);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: '根据ID获取站点详情' })
  @ApiParam({ name: 'id', description: '站点ID' })
  @ApiResponse({ status: 200, type: Station })
  async findById(@Param('id') id: string) {
    return this.stationService.findById(id);
  }

  @Get('code/:code')
  @Public()
  @ApiOperation({ summary: '根据代码获取站点详情' })
  @ApiParam({ name: 'code', description: '站点代码' })
  @ApiResponse({ status: 200, type: Station })
  async findByCode(@Param('code') code: string) {
    return this.stationService.findByCode(code);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '更新站点（管理员）' })
  @ApiParam({ name: 'id', description: '站点ID' })
  async update(@Param('id') id: string, @Body() dto: UpdateStationDto) {
    return this.stationService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '删除站点（管理员）' })
  @HttpCode(HttpStatus.OK)
  async delete(@Param('id') id: string) {
    return this.stationService.delete(id);
  }

  @Post('batch')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '批量创建站点（管理员）' })
  async batchCreate(@Body() stations: CreateStationDto[]) {
    return this.stationService.batchCreate(stations);
  }
}
