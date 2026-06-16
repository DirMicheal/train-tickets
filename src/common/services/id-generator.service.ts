import { Injectable } from '@nestjs/common';

@Injectable()
export class IdGeneratorService {
  private workerId = 1;
  private datacenterId = 1;
  private sequence = 0;
  private lastTimestamp = -1;

  private readonly workerIdBits = 5;
  private readonly datacenterIdBits = 5;
  private readonly sequenceBits = 12;

  private readonly maxWorkerId = -1 ^ (-1 << this.workerIdBits);
  private readonly maxDatacenterId = -1 ^ (-1 << this.datacenterIdBits);

  private readonly workerIdShift = this.sequenceBits;
  private readonly datacenterIdShift = this.sequenceBits + this.workerIdBits;
  private readonly timestampLeftShift =
    this.sequenceBits + this.workerIdBits + this.datacenterIdBits;
  private readonly sequenceMask = -1 ^ (-1 << this.sequenceBits);

  private twepoch = 1609459200000;

  nextId(): string {
    let timestamp = this.timeGen();

    if (timestamp < this.lastTimestamp) {
      throw new Error(
        `Clock moved backwards. Refusing to generate id for ${this.lastTimestamp - timestamp} milliseconds`,
      );
    }

    if (this.lastTimestamp === timestamp) {
      this.sequence = (this.sequence + 1) & this.sequenceMask;
      if (this.sequence === 0) {
        timestamp = this.tilNextMillis(this.lastTimestamp);
      }
    } else {
      this.sequence = 0;
    }

    this.lastTimestamp = timestamp;

    const id =
      ((timestamp - this.twepoch) << this.timestampLeftShift) |
      (this.datacenterId << this.datacenterIdShift) |
      (this.workerId << this.workerIdShift) |
      this.sequence;

    return (id >>> 0).toString();
  }

  private tilNextMillis(lastTimestamp: number): number {
    let timestamp = this.timeGen();
    while (timestamp <= lastTimestamp) {
      timestamp = this.timeGen();
    }
    return timestamp;
  }

  private timeGen(): number {
    return Date.now();
  }

  shortId(prefix = ''): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `${prefix}${timestamp}${random}`;
  }

  uuid(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}
