import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, of, tap } from 'rxjs';
import { Reflector } from '@nestjs/core';
import { IDEMPOTENT_KEY } from '../decorators/index.decorator';
import { RedisService } from '../../redis/redis.service';
import { IdempotentException } from '../exceptions/business.exception';

@Injectable()
export class IdempotentInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly redisService: RedisService,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const ttl = this.reflector.getAllAndOverride<number>(IDEMPOTENT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!ttl) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const idempotencyKey =
      request.headers['x-idempotency-key'] ||
      request.headers['idempotency-key'];

    if (!idempotencyKey) {
      return next.handle();
    }

    const key = `idempotent:${idempotencyKey}`;
    const cached = await this.redisService.get(key);

    if (cached) {
      try {
        const result = JSON.parse(cached);
        return of(result);
      } catch {
        throw new IdempotentException();
      }
    }

    const locked = await this.redisService.setnx(key, 'PROCESSING', ttl);
    if (!locked) {
      throw new IdempotentException();
    }

    return next.handle().pipe(
      tap(async (response) => {
        if (response && response.success) {
          await this.redisService.set(key, JSON.stringify(response), ttl);
        } else {
          await this.redisService.del(key);
        }
      }),
    );
  }
}
