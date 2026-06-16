import { Module, Global, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis-mock';
import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [
    RedisService,
    {
      provide: 'REDIS_CLIENT',
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const logger = new Logger('RedisModule');
        const redis = new Redis({
          host: configService.get('REDIS_HOST', '127.0.0.1'),
          port: parseInt(configService.get('REDIS_PORT', '6379')),
          password: configService.get('REDIS_PASSWORD') || undefined,
          lazyConnect: false,
          maxRetriesPerRequest: null,
          enableReadyCheck: false,
        });

        logger.log('Redis(ioredis-mock) 内存模式已初始化 - 无需独立Redis服务');
        return redis;
      },
    },
  ],
  exports: ['REDIS_CLIENT', RedisService],
})
export class RedisModule {}

export type RedisClient = InstanceType<typeof Redis>;
