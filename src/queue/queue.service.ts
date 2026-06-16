import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis-mock';
import { Inject } from '@nestjs/common';
import { QueueMessage, QueueHandler } from './queue.module';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private handlers: Map<string, QueueHandler[]> = new Map();
  private processing: Set<string> = new Set();
  private concurrency: number;
  private running = true;
  private pollInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly configService: ConfigService,
    @Inject('REDIS_CLIENT') private readonly redis: InstanceType<typeof Redis>,
  ) {
    this.concurrency = parseInt(this.configService.get('MQ_CONCURRENCY', '5'));
  }

  onModuleInit() {
    this.logger.log(`本地消息队列已启动，并发处理数: ${this.concurrency}`);
    this.startPolling();
  }

  onModuleDestroy() {
    this.running = false;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
    this.logger.log('本地消息队列已停止');
  }

  private startPolling() {
    this.pollInterval = setInterval(() => {
      if (!this.running) return;
      this.processMessages();
    }, 100);
  }

  private getQueueKey(topic: string): string {
    return `queue:${topic}`;
  }

  private getProcessingKey(topic: string): string {
    return `queue:${topic}:processing`;
  }

  async publish<T = any>(
    topic: string,
    data: T,
    options: { maxRetries?: number; delay?: number } = {},
  ): Promise<string> {
    const message: QueueMessage<T> = {
      id: uuidv4(),
      topic,
      data,
      createdAt: Date.now(),
      retryCount: 0,
      maxRetries: options.maxRetries || 3,
    };

    const queueKey = this.getQueueKey(topic);
    const messageKey = `queue:message:${message.id}`;

    await this.redis.set(messageKey, JSON.stringify(message));
    const score = Date.now() + (options.delay || 0);
    await this.redis.zadd(queueKey, score, message.id);

    this.logger.debug(`消息已发布到队列 [${topic}] id=${message.id}`);
    return message.id;
  }

  private async processMessages() {
    for (const topic of this.handlers.keys()) {
      if (this.processing.size >= this.concurrency) break;
      await this.processTopicMessages(topic);
    }
  }

  private async processTopicMessages(topic: string) {
    const queueKey = this.getQueueKey(topic);

    const now = Date.now();
    const messageIds = await this.redis.zrangebyscore(queueKey, 0, now, 'LIMIT', 0, 1);

    for (const messageId of messageIds) {
      if (this.processing.size >= this.concurrency) break;
      if (this.processing.has(messageId)) continue;

      const removed = await this.redis.zrem(queueKey, messageId);
      if (removed === 0) continue;

      this.processing.add(messageId);
      this.handleMessage(topic, messageId).finally(() => {
        this.processing.delete(messageId);
      });
    }
  }

  private async handleMessage(topic: string, messageId: string) {
    const messageKey = `queue:message:${messageId}`;
    const messageStr = await this.redis.get(messageKey);

    if (!messageStr) return;

    let message: QueueMessage;
    try {
      message = JSON.parse(messageStr);
    } catch {
      await this.redis.del(messageKey);
      return;
    }

    const topicHandlers = this.handlers.get(topic) || [];
    if (topicHandlers.length === 0) {
      await this.redis.del(messageKey);
      return;
    }

    for (const handler of topicHandlers) {
      try {
        await handler(message);
      } catch (error) {
        this.logger.error(
          `处理消息失败 [${topic}] id=${message.id}, 重试次数: ${message.retryCount}/${message.maxRetries}`,
          error instanceof Error ? error.stack : '',
        );

        if (message.retryCount < message.maxRetries) {
          message.retryCount++;
          const delay = Math.min(1000 * Math.pow(2, message.retryCount), 60000);
          await this.redis.set(messageKey, JSON.stringify(message));
          const queueKey = this.getQueueKey(topic);
          await this.redis.zadd(queueKey, Date.now() + delay, message.id);
        } else {
          this.logger.error(
            `消息已达到最大重试次数，丢弃 [${topic}] id=${message.id}`,
          );
          await this.redis.del(messageKey);
        }
        return;
      }
    }

    await this.redis.del(messageKey);
    this.logger.debug(`消息处理完成 [${topic}] id=${message.id}`);
  }

  subscribe<T = any>(topic: string, handler: QueueHandler<T>): void {
    if (!this.handlers.has(topic)) {
      this.handlers.set(topic, []);
    }
    this.handlers.get(topic)!.push(handler as QueueHandler);
    this.logger.log(`已订阅消息队列 [${topic}]`);
  }

  async unsubscribe(topic: string): Promise<void> {
    this.handlers.delete(topic);
    this.logger.log(`已取消订阅消息队列 [${topic}]`);
  }

  async pendingCount(topic: string): Promise<number> {
    const queueKey = this.getQueueKey(topic);
    return this.redis.zcard(queueKey);
  }

  async getPendingMessages(topic: string): Promise<QueueMessage[]> {
    const queueKey = this.getQueueKey(topic);
    const messageIds = await this.redis.zrange(queueKey, 0, -1);
    const messages: QueueMessage[] = [];

    for (const id of messageIds) {
      const msg = await this.redis.get(`queue:message:${id}`);
      if (msg) {
        try {
          messages.push(JSON.parse(msg));
        } catch {}
      }
    }

    return messages;
  }
}
