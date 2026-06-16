import {
  Controller,
  Get,
  Put,
  Body,
  Param,
  Delete,
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
import { UserService } from './user.service';
import { User, UserRole, UserStatus } from './user.entity';
import { UpdateUserDto, QueryUserDto, UpdateStatusDto, UpdateRoleDto } from './dto/user.dto';
import { CurrentUser, Roles } from '../../common/decorators/index.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('用户模块')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  @ApiOperation({ summary: '获取当前登录用户信息' })
  @ApiResponse({ status: 200, type: User })
  async getMe(@CurrentUser('id') userId: string) {
    return this.userService.findMe(userId);
  }

  @Put('me')
  @ApiOperation({ summary: '更新当前用户信息' })
  @ApiResponse({ status: 200, type: User })
  async updateMe(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.userService.update(userId, dto);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '获取用户列表（管理员）' })
  async findAll(@Query() dto: QueryUserDto) {
    return this.userService.findAll(dto);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '根据ID获取用户（管理员）' })
  @ApiParam({ name: 'id', description: '用户ID' })
  @ApiResponse({ status: 200, type: User })
  async findById(@Param('id') id: string) {
    return this.userService.findById(id);
  }

  @Put(':id/status')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '更新用户状态（管理员）' })
  @HttpCode(HttpStatus.OK)
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.userService.updateStatus(id, dto.status);
  }

  @Put(':id/role')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '更新用户角色（管理员）' })
  @HttpCode(HttpStatus.OK)
  async updateRole(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.userService.updateRole(id, dto.role);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '删除用户（管理员）' })
  @HttpCode(HttpStatus.OK)
  async delete(@Param('id') id: string) {
    return this.userService.delete(id);
  }
}
