import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  Put,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import {
  RegisterDto,
  LoginDto,
  RefreshTokenDto,
  LoginResponseDto,
  ChangePasswordDto,
} from './dto/auth.dto';
import { Public, CurrentUser } from '../../common/decorators/index.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Request } from 'express';

@ApiTags('认证模块')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '用户注册', description: '支持手机号、邮箱、用户名三种注册方式' })
  @ApiResponse({ status: 200, type: LoginResponseDto, description: '注册成功，返回Token' })
  async register(@Body() dto: RegisterDto, @Req() req: Request) {
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.ip;
    return this.authService.register(dto, clientIp);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '用户登录', description: '支持用户名/手机号/邮箱登录' })
  @ApiResponse({ status: 200, type: LoginResponseDto, description: '登录成功，返回Token' })
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.ip;
    return this.authService.login(dto, clientIp);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '刷新Token', description: '使用刷新令牌获取新的访问令牌' })
  @ApiResponse({ status: 200, type: LoginResponseDto, description: '刷新成功' })
  async refreshToken(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '用户登出', description: '将当前Token加入黑名单' })
  async logout(@CurrentUser('id') userId: string, @Req() req: Request) {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.replace('Bearer ', '');
    return this.authService.logout(userId, token || '');
  }

  @Put('password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '修改密码' })
  async changePassword(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(userId, dto);
  }
}
