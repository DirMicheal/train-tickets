import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryService } from './inventory.service';
import { Inventory } from './inventory.entity';
import { TicketLock } from './ticket-lock.entity';
import { Train } from '../train/train.entity';
import { TrainModule } from '../train/train.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Inventory, TicketLock, Train]),
    TrainModule,
  ],
  providers: [InventoryService],
  exports: [InventoryService, TypeOrmModule],
})
export class InventoryModule {}
