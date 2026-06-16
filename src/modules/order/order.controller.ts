import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
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

import { OrderService } from './order.service';
import {
  CreateOrderDto,
  QueryOrderDto,
  CancelOrderDto,
  RequestRefundDto,
  ChangeOrderDto,
} from './dto/order.dto';
import { Order } from './order.entity';
import { CurrentUser, Roles } from '../../common/decorators/index.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UserRole } from '../user/user.entity';

@ApiTags('订单模块')
@Controller('orders')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '创建订单（下单）', description: '基于成功的锁票记录创建订单' })
  @ApiHeader({ name: 'X-Idempotency-Key', description: '幂等性Key，防止重复下单', required: false })
  @ApiResponse({ status: 200, type: Order })
  async createOrder(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateOrderDto,
    @Headers('x-idempotency-key') idemKey?: string,
  ) {
    if (idemKey && !dto.idempotencyKey) {
      dto.idempotencyKey = idemKey;
    }
    return this.orderService.createOrder(userId, dto);
  }

  @Get('my')
  @ApiOperation({ summary: '查询我的订单列表' })
  async getUserOrders(
    @CurrentUser('id') userId: string,
    @Query() dto: QueryOrderDto,
  ) {
    return this.orderService.getUserOrders(userId, dto);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '查询所有订单（管理员）' })
  async getAllOrders(@Query() dto: QueryOrderDto) {
    return this.orderService.getAllOrders(dto);
  }

  @Get(':orderNo')
  @ApiOperation({ summary: '查询订单详情' })
  @ApiParam({ name: 'orderNo', description: '订单号' })
  async getOrderDetail(
    @Param('orderNo') orderNo: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.orderService.getOrderDetail(
      orderNo,
      userId,
      role !== UserRole.ADMIN,
    );
  }

  @Post(':orderNo/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '取消订单', description: '待支付订单可取消' })
  async cancelOrder(
    @Param('orderNo') orderNo: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CancelOrderDto,
  ) {
    return this.orderService.cancelOrder(orderNo, userId, dto);
  }

  @Post(':orderNo/refund')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '申请退票', description: '已支付订单可申请退票' })
  async requestRefund(
    @Param('orderNo') orderNo: string,
    @CurrentUser('id') userId: string,
    @Body() dto: RequestRefundDto,
  ) {
    return this.orderService.requestRefund(orderNo, userId, dto);
  }

  @Post(':orderNo/change')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '改签', description: '已支付订单可改签' })
  async changeOrder(
    @Param('orderNo') orderNo: string,
    @CurrentUser('id') userId: string,
    @Body() dto: ChangeOrderDto,
  ) {
    return this.orderService.changeOrder(orderNo, userId, dto);
  }
}
