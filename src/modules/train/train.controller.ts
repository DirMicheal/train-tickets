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
import { TrainService } from './train.service';
import { SeatType } from './seat-type.entity';
import { Train } from './train.entity';
import {
  CreateSeatTypeDto,
  UpdateSeatTypeDto,
  CreateTrainDto,
  UpdateTrainDto,
  QueryTrainDto,
  GenerateTrainsDto,
} from './dto/train.dto';
import { Public, Roles } from '../../common/decorators/index.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UserRole } from '../user/user.entity';

@ApiTags('车次管理')
@Controller('trains')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class TrainController {
  constructor(private readonly trainService: TrainService) {}

  // 座位类型管理
  @Post('seat-types')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '创建座位类型（管理员）' })
  @ApiResponse({ status: 201, type: SeatType })
  async createSeatType(@Body() dto: CreateSeatTypeDto) {
    return this.trainService.createSeatType(dto);
  }

  @Get('seat-types')
  @Public()
  @ApiOperation({ summary: '获取座位类型列表' })
  @ApiResponse({ status: 200, type: [SeatType] })
  async findAllSeatTypes(@Query('enabled') enabled?: string) {
    return this.trainService.findAllSeatTypes(enabled === 'true');
  }

  @Get('seat-types/:code')
  @Public()
  @ApiOperation({ summary: '根据代码获取座位类型' })
  @ApiParam({ name: 'code', description: '座位类型代码' })
  async findSeatTypeByCode(@Param('code') code: string) {
    return this.trainService.findSeatTypeByCode(code);
  }

  @Put('seat-types/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '更新座位类型（管理员）' })
  async updateSeatType(
    @Param('id') id: string,
    @Body() dto: UpdateSeatTypeDto,
  ) {
    return this.trainService.updateSeatType(id, dto);
  }

  @Delete('seat-types/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '删除座位类型（管理员）' })
  @HttpCode(HttpStatus.OK)
  async deleteSeatType(@Param('id') id: string) {
    return this.trainService.deleteSeatType(id);
  }

  // 车次管理
  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '创建车次（管理员）' })
  @ApiResponse({ status: 201, type: Train })
  async createTrain(@Body() dto: CreateTrainDto) {
    return this.trainService.createTrain(dto);
  }

  @Post('generate')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '批量生成车次（管理员）' })
  async generateTrains(@Body() dto: GenerateTrainsDto) {
    return this.trainService.generateTrains(dto);
  }

  @Get()
  @Public()
  @ApiOperation({ summary: '分页查询车次列表' })
  async findAllTrains(@Query() dto: QueryTrainDto) {
    return this.trainService.findAllTrains(dto);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: '根据ID获取车次详情' })
  @ApiParam({ name: 'id', description: '车次ID' })
  async findTrainById(@Param('id') id: string) {
    return this.trainService.findTrainById(id);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '更新车次（管理员）' })
  @ApiParam({ name: 'id', description: '车次ID' })
  async updateTrain(@Param('id') id: string, @Body() dto: UpdateTrainDto) {
    return this.trainService.updateTrain(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '删除车次（管理员）' })
  @HttpCode(HttpStatus.OK)
  async deleteTrain(@Param('id') id: string) {
    return this.trainService.deleteTrain(id);
  }
}
