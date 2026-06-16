import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis-mock';
import { v4 as uuidv4 } from 'uuid';
import { Lock, LockOptions } from './lock.module';
import { LockAcquireException } from '../common/exceptions/business.exception';

@Injectable()
export class LockService {
  private readonly logger = new Logger(LockService.name);
  private readonly defaultTtl: number;
  private readonly defaultRetryCount: number;
  private readonly defaultRetryDelay: number;

  constructor(
    private readonly configService: ConfigService,
    @Inject('REDIS_CLIENT') private readonly redis: InstanceType<typeof Redis>,
  ) {
    this.defaultTtl = parseInt(this.configService.get('LOCK_TTL', '5000'));
    this.defaultRetryCount = parseInt(this.configService.get('LOCK_RETRY_COUNT', '3'));
    this.defaultRetryDelay = parseInt(this.configService.get('LOCK_RETRY_DELAY', '200'));
  }

  private getLockKey(resource: string): string {
    return `lock:${resource}`;
  }

  async acquire(
    resource: string,
    options: LockOptions = {},
  ): Promise<Lock> {
    const ttl = options.ttl ?? this.defaultTtl;
    const retryCount = options.retryCount ?? this.defaultRetryCount;
    const retryDelay = options.retryDelay ?? this.defaultRetryDelay;

    const lockKey = this.getLockKey(resource);
    const lockValue = uuidv4();

    for (let attempt = 0; attempt <= retryCount; attempt++) {
      const result: any = await this.redis.set(
        lockKey,
        lockValue,
        'PX',
        ttl,
        'NX',
      );

      if (result === 'OK' || result !== null) {
        this.logger.debug(`获取锁成功: ${resource}, value=${lockValue.substring(0, 8)}...`);

        const unlock = async (): Promise<void> => {
          const currentValue = await this.redis.get(lockKey);
          if (currentValue === lockValue) {
            await this.redis.del(lockKey);
            this.logger.debug(`释放锁成功: ${resource}`);
          }
        };

        return {
          key: lockKey,
          value: lockValue,
          unlock,
        };
      }

      if (attempt < retryCount) {
        this.logger.debug(`获取锁失败，重试中... 第${attempt + 1}次: ${resource}`);
        await this.sleep(retryDelay);
      }
    }

    this.logger.warn(`获取锁失败，已达到最大重试次数: ${resource}`);
    throw new LockAcquireException();
  }

  async tryAcquire(resource: string, ttl?: number): Promise<Lock | null> {
    const lockTtl = ttl ?? this.defaultTtl;
    const lockKey = this.getLockKey(resource);
    const lockValue = uuidv4();

    const result: any = await this.redis.set(lockKey, lockValue, 'PX', lockTtl, 'NX');

    if (result === 'OK' || result !== null) {
      const unlock = async (): Promise<void> => {
        const currentValue = await this.redis.get(lockKey);
        if (currentValue === lockValue) {
          await this.redis.del(lockKey);
        }
      };

      return { key: lockKey, value: lockValue, unlock };
    }

    return null;
  }

  async release(lock: Lock): Promise<void> {
    await lock.unlock();
  }

  async withLock<T>(
    resource: string,
    fn: () => Promise<T>,
    options: LockOptions = {},
  ): Promise<T> {
    const lock = await this.acquire(resource, options);
    try {
      return await fn();
    } finally {
      await lock.unlock();
    }
  }

  async isLocked(resource: string): Promise<boolean> {
    const lockKey = this.getLockKey(resource);
    const result = await this.redis.exists(lockKey);
    return result > 0;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
