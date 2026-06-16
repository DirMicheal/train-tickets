import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request } from 'express';
import { User, UserStatus } from '../../user/user.entity';
import { UnauthorizedException } from '../../../common/exceptions/business.exception';
import { RedisService } from '../../../redis/redis.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly redisService: RedisService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET', 'default-secret'),
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: any) {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.replace('Bearer ', '');
    if (token) {
      const isBlacklisted = await this.redisService.exists(`blacklist:${token}`);
      if (isBlacklisted) {
        throw new UnauthorizedException('Token已失效，请重新登录');
      }
    }

    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    if (user.status === UserStatus.DISABLED) {
      throw new UnauthorizedException('账号已被禁用');
    }

    if (user.status === UserStatus.LOCKED) {
      throw new UnauthorizedException('账号已被锁定');
    }

    return {
      id: user.id,
      username: user.username,
      phone: user.phone,
      email: user.email,
      role: user.role,
      realName: user.realName,
    };
  }
}
