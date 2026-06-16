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
import { RouteService } from './route.service';
import { Route, RouteStatus } from './route.entity';
import { CreateRouteDto, UpdateRouteDto, QueryRouteDto } from './dto/route.dto';
import { Public, Roles } from '../../common/decorators/index.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UserRole } from '../user/user.entity';

@ApiTags('线路管理')
@Controller('routes')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class RouteController {
  constructor(private readonly routeService: RouteService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '创建线路（管理员）' })
  @ApiResponse({ status: 201, type: Route })
  async create(@Body() dto: CreateRouteDto) {
    return this.routeService.create(dto);
  }

  @Get('list')
  @Public()
  @ApiOperation({ summary: '获取所有激活的线路列表' })
  async findAllActive() {
    return this.routeService.findAllActive();
  }

  @Get()
  @ApiOperation({ summary: '分页查询线路列表' })
  async findAll(@Query() dto: QueryRouteDto) {
    return this.routeService.findAll(dto);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: '根据ID获取线路详情' })
  @ApiParam({ name: 'id', description: '线路ID' })
  async findById(@Param('id') id: string) {
    return this.routeService.findById(id);
  }

  @Get('code/:code')
  @Public()
  @ApiOperation({ summary: '根据编号获取线路详情' })
  @ApiParam({ name: 'code', description: '线路编号' })
  async findByCode(@Param('code') code: string) {
    return this.routeService.findByCode(code);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '更新线路（管理员）' })
  @ApiParam({ name: 'id', description: '线路ID' })
  async update(@Param('id') id: string, @Body() dto: UpdateRouteDto) {
    return this.routeService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '删除线路（管理员）' })
  @HttpCode(HttpStatus.OK)
  async delete(@Param('id') id: string) {
    return this.routeService.delete(id);
  }
}
