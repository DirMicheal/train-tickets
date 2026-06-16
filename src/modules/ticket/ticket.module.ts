import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TicketQueryController, TicketLockController } from './ticket.controller';
import { TicketService } from './ticket.service';
import { Train } from '../train/train.entity';
import { TrainModule } from '../train/train.module';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Train]),
    TrainModule,
    InventoryModule,
  ],
  controllers: [TicketQueryController, TicketLockController],
  providers: [TicketService],
  exports: [TicketService],
})
export class TicketModule {}
