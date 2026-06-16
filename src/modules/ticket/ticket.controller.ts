import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Headers,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiHeader,
} from '@nestjs/swagger';

import { TicketService } from './ticket.service';
import { InventoryService } from '../inventory/inventory.service';
import {
  SearchTicketDto,
  SearchTicketResult,
  LockTicketDto,
  LockTicketResult,
  UnlockTicketDto,
} from './dto/ticket.dto';
import { Public, CurrentUser } from '../../common/decorators/index.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('车票查询')
@Controller('tickets')
export class TicketQueryController {
  constructor(private readonly ticketService: TicketService) {}

  @Public()
  @Get('search')
  @ApiOperation({ summary: '查询车票（余票查询）', description: '根据出发站、到达站、日期查询可用车次和余票' })
  @ApiResponse({ status: 200, type: SearchTicketResult, isArray: false })
  async search(@Query() dto: SearchTicketDto) {
    return this.ticketService.searchTickets(dto);
  }

  @Public()
  @Get('detail/:trainId')
  @ApiOperation({ summary: '查询车票详情' })
  @ApiParam({ name: 'trainId', description: '车次ID' })
  async getDetail(
    @Param('trainId') trainId: string,
    @Query('fromStationId') fromStationId: string,
    @Query('toStationId') toStationId: string,
  ) {
    return this.ticketService.getTicketDetail(trainId, fromStationId, toStationId);
  }
}

@ApiTags('锁票模块')
@Controller('locks')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class TicketLockController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '锁票（预占库存）', description: '下单前必须先锁票，锁票成功后需在有效期内完成下单和支付' })
  @ApiHeader({ name: 'X-Idempotency-Key', description: '幂等性Key，防止重复提交', required: false })
  @ApiResponse({ status: 200, type: LockTicketResult })
  async lockTickets(
    @CurrentUser('id') userId: string,
    @Body() dto: LockTicketDto,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ) {
    return this.inventoryService.lockInventory(
      userId,
      dto.trainId,
      dto.fromStationId,
      dto.toStationId,
      dto.seats.map((s) => ({
        seatTypeCode: s.seatTypeCode,
        quantity: s.quantity,
        price: s.price,
      })),
      idempotencyKey || dto.idempotencyKey,
    );
  }

  @Post('release')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '释放锁票', description: '主动取消锁票，释放库存' })
  async releaseLock(
    @CurrentUser('id') userId: string,
    @Body() dto: UnlockTicketDto,
  ) {
    return this.inventoryService.releaseLock(dto.lockBatchNo, userId);
  }

  @Get(':lockBatchNo')
  @ApiOperation({ summary: '查询锁票详情' })
  @ApiParam({ name: 'lockBatchNo', description: '锁票批次号' })
  async getLockDetail(@Param('lockBatchNo') lockBatchNo: string) {
    return this.inventoryService.getLockRecord(lockBatchNo);
  }
}
