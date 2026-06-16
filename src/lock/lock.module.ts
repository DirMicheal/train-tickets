import { Module, Global } from '@nestjs/common';
import { LockService } from './lock.service';

@Global()
@Module({
  providers: [LockService],
  exports: [LockService],
})
export class LockModule {}

export interface LockOptions {
  ttl?: number;
  retryCount?: number;
  retryDelay?: number;
}

export interface Lock {
  key: string;
  value: string;
  unlock: () => Promise<void>;
}
