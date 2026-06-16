import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole, UserStatus } from '../user/user.entity';
import {
  RegisterDto,
  LoginDto,
  RefreshTokenDto,
  LoginResponseDto,
  ChangePasswordDto,
  RegisterType,
} from './dto/auth.dto';
import { UtilService } from '../../common/services/util.service';
import { IdGeneratorService } from '../../common/services/id-generator.service';
import { RedisService } from '../../redis/redis.service';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '../../common/exceptions/business.exception';
import dayjs from 'dayjs';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly utilService: UtilService,
    private readonly idGeneratorService: IdGeneratorService,
    private readonly redisService: RedisService,
  ) {}

  async register(dto: RegisterDto, clientIp?: string): Promise<LoginResponseDto> {
    if (dto.confirmPassword && dto.password !== dto.confirmPassword) {
      throw new BadRequestException('两次密码不一致');
    }

    let username = dto.username;
    let phone = dto.phone;
    let email = dto.email;

    switch (dto.type) {
      case RegisterType.PHONE:
        if (!phone) {
          throw new BadRequestException('手机号不能为空');
        }
        username = username || `user_${phone.substring(phone.length - 6)}`;
        break;
      case RegisterType.EMAIL:
        if (!email) {
          throw new BadRequestException('邮箱不能为空');
        }
        username = username || email.split('@')[0];
        break;
      case RegisterType.USERNAME:
        if (!username) {
          throw new BadRequestException('用户名不能为空');
        }
        break;
    }

    if (username) {
      const existUsername = await this.userRepository.findOne({
        where: { username },
      });
      if (existUsername) {
        throw new ConflictException('用户名已被注册');
      }
    }

    if (phone) {
      const existPhone = await this.userRepository.findOne({
        where: { phone },
      });
      if (existPhone) {
        throw new ConflictException('手机号已被注册');
      }
    }

    if (email) {
      const existEmail = await this.userRepository.findOne({
        where: { email },
      });
      if (existEmail) {
        throw new ConflictException('邮箱已被注册');
      }
    }

    const user = this.userRepository.create({
      username,
      phone: phone || null,
      email: email || null,
      password: await this.utilService.hashPassword(dto.password),
      realName: dto.realName,
      idCard: dto.idCard,
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
      lastLoginAt: new Date(),
      lastLoginIp: clientIp,
    });

    await this.userRepository.save(user);
    this.logger.log(`用户注册成功: ${user.username} (${user.id})`);

    return this.generateTokenResponse(user);
  }

  async login(dto: LoginDto, clientIp?: string): Promise<LoginResponseDto> {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.username = :account OR user.phone = :account OR user.email = :account', {
        account: dto.account,
      })
      .getOne();

    if (!user) {
      throw new UnauthorizedException('账号或密码错误');
    }

    const isPasswordValid = await this.utilService.comparePassword(
      dto.password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('账号或密码错误');
    }

    if (user.status === UserStatus.DISABLED) {
      throw new UnauthorizedException('账号已被禁用');
    }

    if (user.status === UserStatus.LOCKED) {
      throw new UnauthorizedException('账号已被锁定');
    }

    user.lastLoginAt = new Date();
    user.lastLoginIp = clientIp;
    await this.userRepository.save(user);

    this.logger.log(`用户登录成功: ${user.username} (${user.id})`);

    return this.generateTokenResponse(user);
  }

  async refreshToken(dto: RefreshTokenDto): Promise<LoginResponseDto> {
    try {
      const payload = this.jwtService.verify(dto.refreshToken, {
        secret: this.configService.get('JWT_SECRET') + '_refresh',
      });

      const user = await this.userRepository.findOne({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new UnauthorizedException('刷新令牌无效');
      }

      const tokenKey = `refresh_token:${user.id}:${payload.jti}`;
      const exists = await this.redisService.exists(tokenKey);
      if (!exists) {
        throw new UnauthorizedException('刷新令牌已失效');
      }

      await this.redisService.del(tokenKey);

      return this.generateTokenResponse(user);
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('刷新令牌无效或已过期');
    }
  }

  async logout(userId: string, token: string): Promise<void> {
    try {
      const decoded = this.jwtService.decode(token) as any;
      if (decoded && decoded.exp) {
        const ttl = Math.max(0, decoded.exp - Math.floor(Date.now() / 1000));
        await this.redisService.set(`blacklist:${token}`, '1', ttl);
      }
    } catch (e) {
    }
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.id = :userId', { userId })
      .getOne();

    if (!user) {
      throw new NotFoundException('用户');
    }

    const isPasswordValid = await this.utilService.comparePassword(
      dto.oldPassword,
      user.password,
    );

    if (!isPasswordValid) {
      throw new BadRequestException('旧密码错误');
    }

    user.password = await this.utilService.hashPassword(dto.newPassword);
    await this.userRepository.save(user);

    this.logger.log(`用户修改密码成功: ${user.username} (${user.id})`);
  }

  private async generateTokenResponse(user: User): Promise<LoginResponseDto> {
    const jwtSecret = this.configService.get('JWT_SECRET', 'default-secret');
    const expiresIn = parseInt(
      this.configService.get('JWT_EXPIRES_IN', '7d').replace('d', '')
    ) * 24 * 60 * 60;
    const refreshExpiresIn = parseInt(
      this.configService.get('JWT_REFRESH_EXPIRES_IN', '30d').replace('d', '')
    ) * 24 * 60 * 60;

    const jti = this.idGeneratorService.uuid();

    const payload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      jti,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: jwtSecret,
      expiresIn: `${Math.floor(expiresIn)}s`,
    });

    const refreshJti = this.idGeneratorService.uuid();
    const refreshToken = this.jwtService.sign(
      { sub: user.id, jti: refreshJti },
      {
        secret: jwtSecret + '_refresh',
        expiresIn: `${refreshExpiresIn}s`,
      },
    );

    await this.redisService.set(
      `refresh_token:${user.id}:${refreshJti}`,
      '1',
      refreshExpiresIn,
    );

    const { password, ...userInfo } = user;

    return {
      accessToken,
      refreshToken,
      expiresIn,
      tokenType: 'Bearer',
      user: userInfo,
    };
  }
}
