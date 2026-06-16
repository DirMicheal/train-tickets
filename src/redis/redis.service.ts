import { Injectable, Inject, Logger } from '@nestjs/common';
import Redis from 'ioredis-mock';

@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);

  constructor(@Inject('REDIS_CLIENT') private readonly redis: InstanceType<typeof Redis>) {}

  getClient(): InstanceType<typeof Redis> {
    return this.redis;
  }

  async get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  async set(key: string, value: string, ttl?: number): Promise<'OK'> {
    if (ttl) {
      return this.redis.set(key, value, 'EX', ttl);
    }
    return this.redis.set(key, value);
  }

  async setnx(key: string, value: string, ttl?: number): Promise<boolean> {
    let result: any;
    if (ttl) {
      result = await this.redis.set(key, value, 'EX', ttl, 'NX');
    } else {
      result = await this.redis.setnx(key, value);
    }
    return result === 1 || result === 'OK' || result !== null;
  }

  async del(key: string): Promise<number> {
    return this.redis.del(key);
  }

  async exists(key: string): Promise<number> {
    return this.redis.exists(key);
  }

  async expire(key: string, seconds: number): Promise<number> {
    return this.redis.expire(key, seconds);
  }

  async ttl(key: string): Promise<number> {
    return this.redis.ttl(key);
  }

  async incr(key: string): Promise<number> {
    return this.redis.incr(key);
  }

  async decr(key: string): Promise<number> {
    return this.redis.decr(key);
  }

  async incrby(key: string, increment: number): Promise<number> {
    return this.redis.incrby(key, increment);
  }

  async decrby(key: string, decrement: number): Promise<number> {
    return this.redis.decrby(key, decrement);
  }

  async hget(key: string, field: string): Promise<string | null> {
    return this.redis.hget(key, field);
  }

  async hset(key: string, field: string, value: string): Promise<number> {
    return this.redis.hset(key, field, value);
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    return this.redis.hgetall(key);
  }

  async hdel(key: string, ...fields: string[]): Promise<number> {
    return this.redis.hdel(key, ...fields);
  }

  async lpush(key: string, ...values: string[]): Promise<number> {
    return this.redis.lpush(key, ...values);
  }

  async rpush(key: string, ...values: string[]): Promise<number> {
    return this.redis.rpush(key, ...values);
  }

  async lpop(key: string): Promise<string | null> {
    return this.redis.lpop(key);
  }

  async rpop(key: string): Promise<string | null> {
    return this.redis.rpop(key);
  }

  async llen(key: string): Promise<number> {
    return this.redis.llen(key);
  }

  async zadd(key: string, score: number, member: string): Promise<number> {
    return this.redis.zadd(key, score, member);
  }

  async zrange(key: string, start: number, stop: number): Promise<string[]> {
    return this.redis.zrange(key, start, stop);
  }

  async zrevrange(key: string, start: number, stop: number): Promise<string[]> {
    return this.redis.zrevrange(key, start, stop);
  }

  async zrem(key: string, ...members: string[]): Promise<number> {
    return this.redis.zrem(key, ...members);
  }

  async smembers(key: string): Promise<string[]> {
    return this.redis.smembers(key);
  }

  async sadd(key: string, ...members: string[]): Promise<number> {
    return this.redis.sadd(key, ...members);
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    return this.redis.srem(key, ...members);
  }

  async sismember(key: string, member: string): Promise<number> {
    return this.redis.sismember(key, member);
  }

  async mget(keys: string[]): Promise<(string | null)[]> {
    return this.redis.mget(...keys);
  }

  async keys(pattern: string): Promise<string[]> {
    return this.redis.keys(pattern);
  }

  async getJson<T = any>(key: string): Promise<T | null> {
    const value = await this.get(key);
    if (!value) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  async setJson<T = any>(key: string, value: T, ttl?: number): Promise<'OK'> {
    return this.set(key, JSON.stringify(value), ttl);
  }
}
