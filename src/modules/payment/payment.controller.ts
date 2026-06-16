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
  Res,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiHeader,
} from '@nestjs/swagger';
import { Response } from 'express';
import { PaymentService } from './payment.service';
import { Payment } from './payment.entity';
import {
  CreatePaymentDto,
  ProcessPaymentDto,
  PaymentCallbackDto,
  QueryPaymentDto,
} from './dto/payment.dto';
import { CurrentUser, Public, Roles } from '../../common/decorators/index.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UserRole } from '../user/user.entity';

@ApiTags('支付模块')
@Controller('payments')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '创建支付单', description: '为待支付订单创建支付单，返回支付链接' })
  @ApiHeader({ name: 'X-Idempotency-Key', description: '幂等性Key', required: false })
  async createPayment(
    @CurrentUser('id') userId: string,
    @Body() dto: CreatePaymentDto,
    @Headers('x-idempotency-key') idemKey?: string,
  ) {
    if (idemKey && !dto.idempotencyKey) {
      dto.idempotencyKey = idemKey;
    }
    return this.paymentService.createPayment(userId, dto);
  }

  @Public()
  @Post('mock')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '模拟支付', description: '使用Mock支付方式完成支付，无需真实支付' })
  async mockPay(@Body() dto: ProcessPaymentDto) {
    return this.paymentService.processMockPayment(dto);
  }

  @Public()
  @Get('mock-pay')
  @ApiOperation({
    summary: '模拟支付页面跳转',
    description: '通过URL传入paymentNo，自动完成Mock支付并返回结果',
  })
  async mockPayPage(
    @Query('paymentNo') paymentNo: string,
    @Res() res: Response,
  ) {
    try {
      const result = await this.paymentService.processMockPayment({
        paymentNo,
        success: true,
      });
      res.json({
        success: true,
        code: 200,
        message: 'Mock支付成功',
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        code: 400,
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  @Public()
  @Post('callback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '支付回调接口', description: '第三方支付平台回调通知' })
  async paymentCallback(@Body() dto: PaymentCallbackDto) {
    return this.paymentService.handlePaymentCallback(dto);
  }

  @Get('my')
  @ApiOperation({ summary: '查询我的支付记录' })
  async getUserPayments(
    @CurrentUser('id') userId: string,
    @Query() dto: QueryPaymentDto,
  ) {
    return this.paymentService.getUserPayments(userId, dto);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '查询所有支付记录（管理员）' })
  async getAllPayments(@Query() dto: QueryPaymentDto) {
    return this.paymentService.getAllPayments(dto);
  }

  @Get(':paymentNo')
  @ApiOperation({ summary: '查询支付详情' })
  @ApiParam({ name: 'paymentNo', description: '支付单号' })
  async getPaymentDetail(
    @Param('paymentNo') paymentNo: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.paymentService.getPaymentDetail(
      paymentNo,
      role === UserRole.ADMIN ? undefined : userId,
    );
  }

  @Get('order/:orderNo')
  @ApiOperation({ summary: '查询订单的支付记录' })
  @ApiParam({ name: 'orderNo', description: '订单号' })
  async getPaymentsByOrder(
    @Param('orderNo') orderNo: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.paymentService.getPaymentsByOrder(
      orderNo,
      role === UserRole.ADMIN ? undefined : userId,
    );
  }
}
