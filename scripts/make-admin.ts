import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { User, UserRole } from '../src/modules/user/user.entity';
import { Station } from '../src/modules/station/station.entity';
import { Route } from '../src/modules/route/route.entity';
import { Train } from '../src/modules/train/train.entity';
import { SeatType } from '../src/modules/train/seat-type.entity';
import { Inventory } from '../src/modules/inventory/inventory.entity';
import { TicketLock } from '../src/modules/inventory/ticket-lock.entity';
import { Order } from '../src/modules/order/order.entity';
import { Payment } from '../src/modules/payment/payment.entity';
import initSqlJs from 'sql.js';
import * as path from 'path';

async function main() {
  const SQL = await initSqlJs({
    locateFile: (file: string) =>
      path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', file),
  });

  const dataSource = new DataSource({
    type: 'sqljs',
    driver: SQL,
    autoSave: true,
    location: './data/train_ticket.db',
    entities: [User, Station, Route, Train, SeatType, Inventory, TicketLock, Order, Payment],
    synchronize: true,
  });

  await dataSource.initialize();
  console.log('数据源已连接');

  const userRepo = dataSource.getRepository(User);
  const users = await userRepo.find();
  console.log('当前用户数:', users.length);
  
  for (const u of users) {
    console.log(` - ${u.username} [${u.role}] ${u.phone}`);
  }

  // 升级第一个用户为admin
  if (users.length > 0) {
    users[0].role = UserRole.ADMIN;
    await userRepo.save(users[0]);
    console.log('已升级用户:', users[0].username, '-> ADMIN');
  }

  await dataSource.destroy();
  console.log('完成');
}

main().catch(console.error);
