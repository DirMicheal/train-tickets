import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  SeatType,
  DEFAULT_SEAT_TYPES,
  SeatTypeConfig,
} from './seat-type.entity';
import { Train, TrainStatus, TrainSeatInfo } from './train.entity';
import {
  CreateSeatTypeDto,
  UpdateSeatTypeDto,
  CreateTrainDto,
  UpdateTrainDto,
  QueryTrainDto,
  GenerateTrainsDto,
} from './dto/train.dto';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '../../common/exceptions/business.exception';
import { RouteService } from '../route/route.service';
import { RouteStationInfo } from '../route/route.entity';
import dayjs from 'dayjs';

@Injectable()
export class TrainService implements OnModuleInit {
  private readonly logger = new Logger(TrainService.name);

  constructor(
    @InjectRepository(SeatType)
    private readonly seatTypeRepository: Repository<SeatType>,
    @InjectRepository(Train)
    private readonly trainRepository: Repository<Train>,
    private readonly routeService: RouteService,
  ) {}

  async onModuleInit() {
    await this.initDefaultSeatTypes();
  }

  private async initDefaultSeatTypes() {
    const count = await this.seatTypeRepository.count();
    if (count > 0) return;

    this.logger.log('初始化默认座位类型...');
    for (const config of DEFAULT_SEAT_TYPES) {
      const seatType = this.seatTypeRepository.create({
        ...config,
        enabled: true,
      });
      await this.seatTypeRepository.save(seatType);
    }
    this.logger.log('默认座位类型初始化完成');
  }

  async createSeatType(dto: CreateSeatTypeDto): Promise<SeatType> {
    const existing = await this.seatTypeRepository.findOne({
      where: { code: dto.code },
    });
    if (existing) {
      throw new ConflictException('座位类型代码已存在');
    }

    const seatType = this.seatTypeRepository.create({
      ...dto,
      enabled: dto.enabled ?? true,
    });
    await this.seatTypeRepository.save(seatType);
    this.logger.log(`创建座位类型成功: ${seatType.name}`);
    return seatType;
  }

  async findAllSeatTypes(enabledOnly = false): Promise<SeatType[]> {
    const where: any = {};
    if (enabledOnly) where.enabled = true;
    return this.seatTypeRepository.find({
      where,
      order: { sortOrder: 'ASC' },
    });
  }

  async findSeatTypeByCode(code: string): Promise<SeatType> {
    const seatType = await this.seatTypeRepository.findOne({ where: { code } });
    if (!seatType) {
      throw new NotFoundException('座位类型');
    }
    return seatType;
  }

  async updateSeatType(id: string, dto: UpdateSeatTypeDto): Promise<SeatType> {
    const seatType = await this.seatTypeRepository.findOne({ where: { id } });
    if (!seatType) {
      throw new NotFoundException('座位类型');
    }

    if (dto.code && dto.code !== seatType.code) {
      const existing = await this.seatTypeRepository.findOne({
        where: { code: dto.code },
      });
      if (existing) {
        throw new ConflictException('座位类型代码已存在');
      }
    }

    Object.assign(seatType, dto);
    await this.seatTypeRepository.save(seatType);
    return seatType;
  }

  async deleteSeatType(id: string): Promise<void> {
    const seatType = await this.seatTypeRepository.findOne({ where: { id } });
    if (!seatType) {
      throw new NotFoundException('座位类型');
    }
    await this.seatTypeRepository.remove(seatType);
  }

  async createTrain(dto: CreateTrainDto): Promise<Train> {
    const route = await this.routeService.findById(dto.routeId);
    const stations: RouteStationInfo[] = route.stations;

    if (stations.length < 2) {
      throw new BadRequestException('线路站点配置异常');
    }

    const existing = await this.trainRepository.findOne({
      where: {
        trainNo: dto.trainNo,
        travelDate: dto.travelDate,
      },
    });
    if (existing) {
      throw new ConflictException('该日期相同车次已存在');
    }

    const originStation = stations[0];
    const terminalStation = stations[stations.length - 1];

    const seatTypes = await this.findAllSeatTypes(true);
    const trainSeatInfos: TrainSeatInfo[] = seatTypes.map((st) => {
      const totalCount = st.carriageCount * st.seatsPerCarriage;
      const seatPrices = originStation.seatPrices || {};
      const price = seatPrices[st.code] || Math.round(route.totalDistance * st.basePricePerKm);
      return {
        code: st.code,
        name: st.name,
        seatClass: st.seatClass,
        totalCount,
        soldCount: 0,
        lockedCount: 0,
        availableCount: totalCount,
        price: Math.max(price, 10),
      };
    });

    const train = this.trainRepository.create({
      trainNo: dto.trainNo,
      routeId: route.id,
      routeName: route.name,
      originStationId: originStation.stationId,
      originStationName: originStation.stationName,
      terminalStationId: terminalStation.stationId,
      terminalStationName: terminalStation.stationName,
      travelDate: dto.travelDate,
      departTime: originStation.departTime,
      arriveTime: terminalStation.arriveTime,
      durationMinutes: route.durationMinutes,
      totalDistance: route.totalDistance,
      trainType: dto.trainType || route.routeType || '高铁',
      status: TrainStatus.AVAILABLE,
      seatTypesJson: JSON.stringify(trainSeatInfos),
      stationsJson: JSON.stringify(stations),
      inventoryInitialized: false,
      delayMinutes: 0,
      remark: dto.remark,
    });

    await this.trainRepository.save(train);
    this.logger.log(`创建车次成功: ${train.trainNo} @ ${dto.travelDate}`);
    return train;
  }

  async findTrainById(id: string): Promise<Train & {
    stations: RouteStationInfo[];
    seatTypes: TrainSeatInfo[];
  }> {
    const train = await this.trainRepository.findOne({ where: { id } });
    if (!train) {
      throw new NotFoundException('车次');
    }

    let stations: RouteStationInfo[] = [];
    let seatTypes: TrainSeatInfo[] = [];
    try {
      if (train.stationsJson) stations = JSON.parse(train.stationsJson);
    } catch {}
    try {
      if (train.seatTypesJson) seatTypes = JSON.parse(train.seatTypesJson);
    } catch {}

    return { ...train, stations, seatTypes };
  }

  async findAllTrains(dto: QueryTrainDto): Promise<{
    list: (Train & { seatTypes: TrainSeatInfo[] })[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const page = dto.page || 1;
    const pageSize = dto.pageSize || 10;
    const skip = (page - 1) * pageSize;

    const queryBuilder = this.trainRepository.createQueryBuilder('train');

    if (dto.trainNo) {
      queryBuilder.andWhere('train.trainNo LIKE :trainNo', {
        trainNo: `%${dto.trainNo}%`,
      });
    }
    if (dto.travelDate) {
      queryBuilder.andWhere('train.travelDate = :travelDate', {
        travelDate: dto.travelDate,
      });
    }
    if (dto.originStationId) {
      queryBuilder.andWhere('train.originStationId = :originStationId', {
        originStationId: dto.originStationId,
      });
    }
    if (dto.terminalStationId) {
      queryBuilder.andWhere('train.terminalStationId = :terminalStationId', {
        terminalStationId: dto.terminalStationId,
      });
    }
    if (dto.originStationName) {
      queryBuilder.andWhere('train.originStationName LIKE :originStationName', {
        originStationName: `%${dto.originStationName}%`,
      });
    }
    if (dto.terminalStationName) {
      queryBuilder.andWhere('train.terminalStationName LIKE :terminalStationName', {
        terminalStationName: `%${dto.terminalStationName}%`,
      });
    }
    if (dto.status) {
      queryBuilder.andWhere('train.status = :status', { status: dto.status });
    }
    if (dto.trainType) {
      queryBuilder.andWhere('train.trainType = :trainType', {
        trainType: dto.trainType,
      });
    }

    if (dto.keyword) {
      queryBuilder.andWhere(
        '(train.trainNo LIKE :keyword OR train.routeName LIKE :keyword OR train.originStationName LIKE :keyword OR train.terminalStationName LIKE :keyword)',
        { keyword: `%${dto.keyword}%` },
      );
    }

    const sortBy = dto.sortBy || 'departTime';
    const orderBy = dto.orderBy || 'ASC';
    queryBuilder.orderBy(`train.travelDate`, 'ASC');
    queryBuilder.addOrderBy(`train.${sortBy}`, orderBy as any);

    const [trains, total] = await queryBuilder
      .skip(skip)
      .take(pageSize)
      .getManyAndCount();

    const list = trains.map((train) => {
      let seatTypes: TrainSeatInfo[] = [];
      try {
        if (train.seatTypesJson) seatTypes = JSON.parse(train.seatTypesJson);
      } catch {}
      return { ...train, seatTypes };
    });

    const totalPages = Math.ceil(total / pageSize);
    return { list, total, page, pageSize, totalPages };
  }

  async updateTrain(id: string, dto: UpdateTrainDto): Promise<Train> {
    const train = await this.trainRepository.findOne({ where: { id } });
    if (!train) {
      throw new NotFoundException('车次');
    }

    Object.assign(train, dto);
    await this.trainRepository.save(train);
    this.logger.log(`更新车次成功: ${train.trainNo}`);
    return train;
  }

  async markInventoryInitialized(id: string): Promise<void> {
    await this.trainRepository.update(id, { inventoryInitialized: true });
  }

  async updateTrainSeatTypes(id: string, seatInfos: TrainSeatInfo[]): Promise<void> {
    await this.trainRepository.update(id, {
      seatTypesJson: JSON.stringify(seatInfos),
    });
  }

  async deleteTrain(id: string): Promise<void> {
    const train = await this.trainRepository.findOne({ where: { id } });
    if (!train) {
      throw new NotFoundException('车次');
    }
    await this.trainRepository.remove(train);
    this.logger.log(`删除车次成功: ${train.trainNo}`);
  }

  async generateTrains(dto: GenerateTrainsDto): Promise<Train[]> {
    const startDate = dayjs(dto.startDate);
    const endDate = dayjs(dto.endDate);

    if (startDate.isAfter(endDate)) {
      throw new BadRequestException('开始日期不能晚于结束日期');
    }

    const dates: string[] = [];
    let current = startDate;
    while (!current.isAfter(endDate)) {
      dates.push(current.format('YYYY-MM-DD'));
      current = current.add(1, 'day');
    }

    const results: Train[] = [];
    for (const routeId of dto.routeIds) {
      const route = await this.routeService.findById(routeId);
      const trainNoBase = route.code.split('-')[0] || 'G' + Math.floor(Math.random() * 9000 + 1000);

      for (const date of dates) {
        try {
          const train = await this.createTrain({
            trainNo: trainNoBase + Math.floor(Math.random() * 90 + 10),
            routeId,
            travelDate: date,
            trainType: route.routeType,
          });
          results.push(train);
        } catch (e) {
          this.logger.warn(`跳过生成车次: routeId=${routeId}, date=${date}, error=${e.message}`);
        }
      }
    }

    this.logger.log(`批量生成车次完成，共生成 ${results.length} 个车次`);
    return results;
  }
}
