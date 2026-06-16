import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule } from '../common/common.module';
import { InventoryModule } from '../modules/inventory/inventory.module';
import { InitService } from './init.service';
import { User } from '../modules/user/user.entity';
import { Station } from '../modules/station/station.entity';
import { Route } from '../modules/route/route.entity';
import { Train } from '../modules/train/train.entity';
import { SeatType } from '../modules/train/seat-type.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Station, Route, Train, SeatType]),
    CommonModule,
    InventoryModule,
  ],
  providers: [InitService],
  exports: [],
})
export class InitModule {}
