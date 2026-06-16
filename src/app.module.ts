import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';

import { CommonModule } from './common/common.module';
import { RedisModule } from './redis/redis.module';
import { QueueModule } from './queue/queue.module';
import { LockModule } from './lock/lock.module';

import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { StationModule } from './modules/station/station.module';
import { RouteModule } from './modules/route/route.module';
import { TrainModule } from './modules/train/train.module';
import { TicketModule } from './modules/ticket/ticket.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { OrderModule } from './modules/order/order.module';
import { PaymentModule } from './modules/payment/payment.module';
import { InitModule } from './init/init.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const path = require('path');
        const initSqlJs = await import('sql.js');
        const SQL = await initSqlJs.default({
          locateFile: (file: string) =>
            path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', file),
        });

        return {
          type: 'sqljs',
          driver: SQL,
          autoSave: true,
          location: configService.get('DB_DATABASE', './data/train_ticket.db'),
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          synchronize: configService.get('DB_SYNCHRONIZE', 'true') === 'true',
          logging: configService.get('DB_LOGGING', 'false') === 'true',
        };
      },
    }),

    ScheduleModule.forRoot(),

    CommonModule,
    RedisModule,
    QueueModule,
    LockModule,

    AuthModule,
    UserModule,
    StationModule,
    RouteModule,
    TrainModule,
    TicketModule,
    InventoryModule,
    OrderModule,
    PaymentModule,
    InitModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
  }
}
