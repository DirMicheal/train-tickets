import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TrainController } from './train.controller';
import { TrainService } from './train.service';
import { SeatType } from './seat-type.entity';
import { Train } from './train.entity';
import { RouteModule } from '../route/route.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SeatType, Train]),
    RouteModule,
  ],
  controllers: [TrainController],
  providers: [TrainService],
  exports: [TrainService, TypeOrmModule],
})
export class TrainModule {}
