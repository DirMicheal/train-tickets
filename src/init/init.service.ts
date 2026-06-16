import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../modules/user/user.entity';
import { Station } from '../modules/station/station.entity';
import { Route, RouteStatus } from '../modules/route/route.entity';
import { Train, TrainStatus } from '../modules/train/train.entity';
import { DEFAULT_SEAT_TYPES, SeatType } from '../modules/train/seat-type.entity';
import { UtilService } from '../common/services/util.service';
import { InventoryService } from '../modules/inventory/inventory.service';

@Injectable()
export class InitService implements OnModuleInit {
  private readonly logger = new Logger(InitService.name);

  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Station) private readonly stationRepo: Repository<Station>,
    @InjectRepository(Route) private readonly routeRepo: Repository<Route>,
    @InjectRepository(Train) private readonly trainRepo: Repository<Train>,
    @InjectRepository(SeatType) private readonly seatTypeRepo: Repository<SeatType>,
    private readonly utilService: UtilService,
    private readonly inventoryService: InventoryService,
  ) {}

  async onModuleInit() {
    await this.initAdminUser();
    await this.initDemoData();
  }

  private async initAdminUser() {
    const count = await this.userRepo.count();
    if (count > 0) return;

    const admin = this.userRepo.create({
      username: 'admin',
      phone: '13900000000',
      email: 'admin@trains.local',
      password: await this.utilService.hashPassword('Admin@123'),
      role: UserRole.ADMIN,
      status: 'active' as any,
      realName: '系统管理员',
    });
    await this.userRepo.save(admin);
    this.logger.log('初始化默认管理员账号: admin / Admin@123 (手机: 13900000000)');
  }

  private async initDemoData() {
    const stationCount = await this.stationRepo.count();
    if (stationCount > 0) return;

    this.logger.log('初始化演示站点/线路/车次数据...');

    const stationsData: Partial<Station>[] = [
      { code: 'BJP', name: '北京', province: '北京', city: '北京', level: 1, sortOrder: 1 },
      { code: 'TJP', name: '天津', province: '天津', city: '天津', level: 2, sortOrder: 2 },
      { code: 'JNN', name: '济南', province: '山东', city: '济南', level: 2, sortOrder: 3 },
      { code: 'XZ', name: '徐州', province: '江苏', city: '徐州', level: 2, sortOrder: 4 },
      { code: 'NJH', name: '南京', province: '江苏', city: '南京', level: 2, sortOrder: 5 },
      { code: 'SZH', name: '苏州', province: '江苏', city: '苏州', level: 2, sortOrder: 6 },
      { code: 'SHH', name: '上海', province: '上海', city: '上海', level: 1, sortOrder: 7 },
      { code: 'WH', name: '武汉', province: '湖北', city: '武汉', level: 2, sortOrder: 8 },
      { code: 'CS', name: '长沙', province: '湖南', city: '长沙', level: 2, sortOrder: 9 },
      { code: 'GZQ', name: '广州', province: '广东', city: '广州', level: 1, sortOrder: 10 },
      { code: 'SZX', name: '深圳', province: '广东', city: '深圳', level: 1, sortOrder: 11 },
      { code: 'CD', name: '成都', province: '四川', city: '成都', level: 1, sortOrder: 12 },
      { code: 'CQ', name: '重庆', province: '重庆', city: '重庆', level: 2, sortOrder: 13 },
      { code: 'XAN', name: '西安', province: '陕西', city: '西安', level: 2, sortOrder: 14 },
      { code: 'ZZ', name: '郑州', province: '河南', city: '郑州', level: 2, sortOrder: 15 },
      { code: 'HF', name: '合肥', province: '安徽', city: '合肥', level: 2, sortOrder: 16 },
    ];
    const stations = await this.stationRepo.save(this.stationRepo.create(stationsData));
    this.logger.log(`已创建 ${stations.length} 个站点`);

    const stMap = new Map<string, Station>();
    for (const s of stations) stMap.set(s.code, s);

    const bj = stMap.get('BJP')!;
    const tj = stMap.get('TJP')!;
    const jn = stMap.get('JNN')!;
    const xz = stMap.get('XZ')!;
    const nj = stMap.get('NJH')!;
    const su = stMap.get('SZH')!;
    const sh = stMap.get('SHH')!;
    const wh = stMap.get('WH')!;
    const cs = stMap.get('CS')!;
    const gz = stMap.get('GZQ')!;
    const szx = stMap.get('SZX')!;
    const xa = stMap.get('XAN')!;
    const zz = stMap.get('ZZ')!;

    const jinghuStations = [
      { stationId: bj.id, stationCode: 'BJP', stationName: '北京', arriveTime: '00:00', departTime: '06:30', distance: 0, price: 0 },
      { stationId: tj.id, stationCode: 'TJP', stationName: '天津', arriveTime: '07:05', departTime: '07:07', distance: 120, price: 60 },
      { stationId: jn.id, stationCode: 'JNN', stationName: '济南', arriveTime: '08:55', departTime: '08:57', distance: 406, price: 200 },
      { stationId: xz.id, stationCode: 'XZ', stationName: '徐州', arriveTime: '10:15', departTime: '10:17', distance: 692, price: 340 },
      { stationId: nj.id, stationCode: 'NJH', stationName: '南京', arriveTime: '11:35', departTime: '11:37', distance: 1023, price: 490 },
      { stationId: su.id, stationCode: 'SZH', stationName: '苏州', arriveTime: '12:25', departTime: '12:27', distance: 1230, price: 580 },
      { stationId: sh.id, stationCode: 'SHH', stationName: '上海', arriveTime: '13:00', departTime: '00:00', distance: 1318, price: 650 },
    ];
    const jingguangStations = [
      { stationId: bj.id, stationCode: 'BJP', stationName: '北京', arriveTime: '00:00', departTime: '08:00', distance: 0, price: 0 },
      { stationId: zz.id, stationCode: 'ZZ', stationName: '郑州', arriveTime: '11:20', departTime: '11:23', distance: 693, price: 330 },
      { stationId: wh.id, stationCode: 'WH', stationName: '武汉', arriveTime: '13:35', departTime: '13:38', distance: 1229, price: 580 },
      { stationId: cs.id, stationCode: 'CS', stationName: '长沙', arriveTime: '15:15', departTime: '15:18', distance: 1600, price: 750 },
      { stationId: gz.id, stationCode: 'GZQ', stationName: '广州', arriveTime: '17:35', departTime: '00:00', distance: 2298, price: 1050 },
    ];
    const guangshenStations = [
      { stationId: gz.id, stationCode: 'GZQ', stationName: '广州', arriveTime: '00:00', departTime: '07:00', distance: 0, price: 0 },
      { stationId: szx.id, stationCode: 'SZX', stationName: '深圳', arriveTime: '07:55', departTime: '00:00', distance: 147, price: 80 },
    ];

    const routeDataList: Partial<Route>[] = [
      {
        code: 'JINGHU',
        name: '京沪高铁',
        originStationId: bj.id,
        originStationName: '北京',
        terminalStationId: sh.id,
        terminalStationName: '上海',
        stationsJson: JSON.stringify(jinghuStations),
        totalDistance: 1318,
        durationMinutes: 390,
        routeType: '高铁',
        status: RouteStatus.ACTIVE,
        remark: '北京→上海',
      },
      {
        code: 'GUANGZHAO',
        name: '广深城际',
        originStationId: gz.id,
        originStationName: '广州',
        terminalStationId: szx.id,
        terminalStationName: '深圳',
        stationsJson: JSON.stringify(guangshenStations),
        totalDistance: 147,
        durationMinutes: 55,
        routeType: '城际',
        status: RouteStatus.ACTIVE,
        remark: '广州→深圳',
      },
      {
        code: 'JINGGUANG',
        name: '京广高铁',
        originStationId: bj.id,
        originStationName: '北京',
        terminalStationId: gz.id,
        terminalStationName: '广州',
        stationsJson: JSON.stringify(jingguangStations),
        totalDistance: 2298,
        durationMinutes: 575,
        routeType: '高铁',
        status: RouteStatus.ACTIVE,
        remark: '北京→广州',
      },
    ];
    const routes = await this.routeRepo.save(this.routeRepo.create(routeDataList));
    this.logger.log(`已创建 ${routes.length} 条线路`);
    const rMap = new Map<string, Route>();
    for (const r of routes) rMap.set(r.code, r);

    const allSeatTypes = await this.seatTypeRepo.find();
    if (allSeatTypes.length === 0) {
      await this.seatTypeRepo.save(this.seatTypeRepo.create(DEFAULT_SEAT_TYPES as any[]));
    }

    const today = new Date();
    const toDateStr = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const seatTypesForTrain: any[] = (DEFAULT_SEAT_TYPES as any[]).map((st: any) => {
      const total = (st.carriageCount || 1) * (st.seatsPerCarriage || 50);
      return {
        code: st.code,
        name: st.name,
        seatClass: st.seatClass,
        totalCount: total,
        soldCount: 0,
        lockedCount: 0,
        availableCount: total,
        price: Math.round((st.basePricePerKm || 0.5) * 500),
      };
    });

    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const d = new Date(today);
      d.setDate(d.getDate() + dayOffset);
      const dateStr = toDateStr(d);
      const jinghu = rMap.get('JINGHU')!;
      const jingguang = rMap.get('JINGGUANG')!;
      const guangshen = rMap.get('GUANGZHAO')!;

      const trainList: Partial<Train>[] = [
        {
          trainNo: `G1${10 + dayOffset}`,
          routeId: jinghu.id,
          routeName: '京沪高铁',
          originStationId: jinghu.originStationId,
          originStationName: jinghu.originStationName,
          terminalStationId: jinghu.terminalStationId,
          terminalStationName: jinghu.terminalStationName,
          travelDate: dateStr,
          departTime: '06:30',
          arriveTime: '13:00',
          durationMinutes: 390,
          totalDistance: 1318,
          trainType: '高铁',
          status: TrainStatus.AVAILABLE,
          seatTypesJson: JSON.stringify(seatTypesForTrain),
          stationsJson: jinghu.stationsJson,
          inventoryInitialized: false,
          delayMinutes: 0,
        },
        {
          trainNo: `G2${10 + dayOffset}`,
          routeId: jinghu.id,
          routeName: '京沪高铁',
          originStationId: jinghu.terminalStationId,
          originStationName: jinghu.terminalStationName,
          terminalStationId: jinghu.originStationId,
          terminalStationName: jinghu.originStationName,
          travelDate: dateStr,
          departTime: '07:00',
          arriveTime: '13:20',
          durationMinutes: 380,
          totalDistance: 1318,
          trainType: '高铁',
          status: TrainStatus.AVAILABLE,
          seatTypesJson: JSON.stringify(seatTypesForTrain),
          stationsJson: JSON.stringify([...jinghuStations].reverse().map((s, i, arr) => ({
            ...s,
            stationId: arr[arr.length - 1 - i].stationId,
            stationCode: arr[arr.length - 1 - i].stationCode,
            stationName: arr[arr.length - 1 - i].stationName,
          }))),
          inventoryInitialized: false,
          delayMinutes: 0,
        },
        {
          trainNo: `G6${20 + dayOffset}`,
          routeId: jingguang.id,
          routeName: '京广高铁',
          originStationId: jingguang.originStationId,
          originStationName: jingguang.originStationName,
          terminalStationId: jingguang.terminalStationId,
          terminalStationName: jingguang.terminalStationName,
          travelDate: dateStr,
          departTime: '08:00',
          arriveTime: '17:35',
          durationMinutes: 575,
          totalDistance: 2298,
          trainType: '高铁',
          status: TrainStatus.AVAILABLE,
          seatTypesJson: JSON.stringify(seatTypesForTrain),
          stationsJson: jingguang.stationsJson,
          inventoryInitialized: false,
          delayMinutes: 0,
        },
        {
          trainNo: `C7${50 + dayOffset}`,
          routeId: guangshen.id,
          routeName: '广深城际',
          originStationId: guangshen.originStationId,
          originStationName: guangshen.originStationName,
          terminalStationId: guangshen.terminalStationId,
          terminalStationName: guangshen.terminalStationName,
          travelDate: dateStr,
          departTime: '07:00',
          arriveTime: '07:55',
          durationMinutes: 55,
          totalDistance: 147,
          trainType: '城际',
          status: TrainStatus.AVAILABLE,
          seatTypesJson: JSON.stringify(seatTypesForTrain),
          stationsJson: guangshen.stationsJson,
          inventoryInitialized: false,
          delayMinutes: 0,
        },
      ];

      const saved = await this.trainRepo.save(this.trainRepo.create(trainList));
      for (const t of saved) {
        try {
          await this.inventoryService.initInventoryForTrain(t.id);
        } catch (e: any) {
          this.logger.warn(`初始化库存失败: ${t.trainNo} ${e?.message}`);
        }
      }
      this.logger.log(`日期 ${dateStr} 创建 ${saved.length} 趟车次及库存`);
    }

    this.logger.log('演示数据初始化完成');
    this.logger.log('================================================');
    this.logger.log(' 管理员账号: admin / Admin@123 (手机号: 13900000000)');
    this.logger.log(' 示例线路: 京沪高铁(G)、京广高铁(G)、广深城际(C)');
    this.logger.log(' 示例车次: 未来7天 每天4趟 (28趟 + 座位库存)');
    this.logger.log(' API文档: http://127.0.0.1:3001/api/docs');
    this.logger.log(' 测试流程: 登录admin→查询车票→锁票→下单→支付→改签/退票');
    this.logger.log('================================================');
  }
}
