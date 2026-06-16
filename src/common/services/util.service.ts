import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import dayjs from 'dayjs';

@Injectable()
export class UtilService {
  async hashPassword(password: string, saltRounds = 10): Promise<string> {
    return bcrypt.hash(password, saltRounds);
  }

  async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  generateOrderNo(prefix = 'T'): string {
    const now = dayjs();
    const timestamp = now.format('YYYYMMDDHHmmssSSS');
    const random = Math.floor(Math.random() * 9000 + 1000);
    return `${prefix}${timestamp}${random}`;
  }

  generateIdempotencyKey(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  maskPhone(phone: string): string {
    if (!phone || phone.length < 7) return phone;
    return phone.substring(0, 3) + '****' + phone.substring(phone.length - 4);
  }

  maskIdCard(idCard: string): string {
    if (!idCard || idCard.length < 10) return idCard;
    return idCard.substring(0, 4) + '**********' + idCard.substring(idCard.length - 4);
  }

  async retry<T>(
    fn: () => Promise<T>,
    retries = 3,
    delay = 200,
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (retries <= 0) throw error;
      await this.sleep(delay);
      return this.retry(fn, retries - 1, delay * 2);
    }
  }

  paginate<T>(
    list: T[],
    page = 1,
    pageSize = 10,
  ): {
    list: T[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  } {
    const total = list.length;
    const totalPages = Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return {
      list: list.slice(start, end),
      total,
      page,
      pageSize,
      totalPages,
    };
  }
}
