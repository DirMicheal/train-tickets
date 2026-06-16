import { Module, Global } from '@nestjs/common';
import { QueueService } from './queue.service';

export interface QueueMessage<T = any> {
  id: string;
  topic: string;
  data: T;
  createdAt: number;
  retryCount: number;
  maxRetries: number;
}

export type QueueHandler<T = any> = (message: QueueMessage<T>) => Promise<void>;

export const QUEUE_HANDLERS = 'QUEUE_HANDLERS';

@Global()
@Module({
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}
