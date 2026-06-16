import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Train, TrainStatus, TrainSeatInfo } from '../train/train.entity';
import { Inventory } from '../inventory/inventory.entity';
import {
  SearchTicketDto,
  SearchTicketResult,
  TicketInfoItem,
  StationInfoItem,
} from './dto/ticket.dto';
import { InventoryService } from '../inventory/inventory.service';
import { TrainService } from '../train/train.service';
import { RouteStationInfo } from '../route/route.entity';

@Injectable()
export class TicketService {
  private readonly logger = new Logger(TicketService.name);

  constructor(
    @InjectRepository(Train)
    private readonly trainRepository: Repository<Train>,
    private readonly inventoryService: InventoryService,
    private readonly trainService: TrainService,
  ) {}

  async searchTickets(
    dto: SearchTicketDto,
  ): Promise<{
    list: SearchTicketResult[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const page = dto.page || 1;
    const pageSize = dto.pageSize || 10;

    const queryBuilder = this.trainRepository.createQueryBuilder('train');

    queryBuilder
      .andWhere('train.travelDate = :travelDate', {
        travelDate: dto.travelDate,
      })
      .andWhere('train.status IN (:...statuses)', {
        statuses: [TrainStatus.AVAILABLE, TrainStatus.DELAYED],
      });

    queryBuilder.andWhere(
      `(
        EXISTS (
          SELECT 1 FROM json_each(train.stationsJson)
          WHERE json_extract(json_each.value, '$.stationId') = :fromStationId
        )
        AND EXISTS (
          SELECT 1 FROM json_each(train.stationsJson)
          WHERE json_extract(json_each.value, '$.stationId') = :toStationId
        )
      )`,
      { fromStationId: dto.fromStationId, toStationId: dto.toStationId },
    );

    if (dto.trainType) {
      queryBuilder.andWhere('train.trainType = :trainType', {
        trainType: dto.trainType,
      });
    }

    if (dto.keyword) {
      queryBuilder.andWhere(
        '(train.trainNo LIKE :keyword OR train.routeName LIKE :keyword)',
        { keyword: `%${dto.keyword}%` },
      );
    }

    queryBuilder.orderBy('train.departTime', 'ASC');

    const allTrains = await queryBuilder.getMany();

    const results: SearchTicketResult[] = [];
    for (const train of allTrains) {
      let stations: RouteStationInfo[] = [];
      try {
        stations = JSON.parse(train.stationsJson || '[]');
      } catch {}

      const fromIdx = stations.findIndex(
        (s) => s.stationId === dto.fromStationId,
      );
      const toIdx = stations.findIndex(
        (s) => s.stationId === dto.toStationId,
      );

      if (fromIdx === -1 || toIdx === -1 || fromIdx >= toIdx) continue;

      const fromStation = stations[fromIdx];
      const toStation = stations[toIdx];

      if (dto.departTimeStart) {
        if (fromStation.departTime < dto.departTimeStart) continue;
      }
      if (dto.departTimeEnd) {
        if (fromStation.departTime > dto.departTimeEnd) continue;
      }

      let seatTypes: TrainSeatInfo[] = [];
      try {
        seatTypes = JSON.parse(train.seatTypesJson || '[]');
      } catch {}

      let inventories: Inventory[] = [];
      if (train.inventoryInitialized) {
        inventories = await this.inventoryService.getAllInventories(train.id);
      }

      const seatResults: TicketInfoItem[] = [];
      for (const seat of seatTypes) {
        const inv = inventories.find((i) => i.seatTypeCode === seat.code);
        if (inv) {
          seat.availableCount = inv.availableCount;
          seat.soldCount = inv.soldCount;
          seat.lockedCount = inv.lockedCount;
        }

        if (dto.seatTypeCode && seat.code !== dto.seatTypeCode) continue;

        seatResults.push({
          code: seat.code,
          name: seat.name,
          totalCount: seat.totalCount,
          soldCount: seat.soldCount,
          lockedCount: seat.lockedCount,
          availableCount: seat.availableCount,
          price: seat.price,
        });
      }

      if (dto.onlyAvailable) {
        const hasAvailable = seatResults.some((s) => s.availableCount > 0);
        if (!hasAvailable) continue;
      }

      const distance = toStation.distanceFromOrigin - fromStation.distanceFromOrigin;
      const duration = this.calculateDuration(
        fromStation.departTime,
        toStation.arriveTime,
      );

      results.push({
        trainId: train.id,
        trainNo: train.trainNo,
        travelDate: train.travelDate,
        fromStation: {
          stationId: fromStation.stationId,
          stationName: fromStation.stationName,
          stationIndex: fromIdx,
          arriveTime: fromStation.arriveTime,
          departTime: fromStation.departTime,
        },
        toStation: {
          stationId: toStation.stationId,
          stationName: toStation.stationName,
          stationIndex: toIdx,
          arriveTime: toStation.arriveTime,
          departTime: toStation.departTime,
        },
        durationMinutes: duration,
        distance,
        trainType: train.trainType,
        status: train.status,
        seatTypes: seatResults,
      });
    }

    const total = results.length;
    const totalPages = Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize;
    const list = results.slice(start, start + pageSize);

    this.logger.log(
      `车票查询: ${dto.fromStationId}->${dto.toStationId} @ ${dto.travelDate}, 找到 ${total} 个车次`,
    );

    return { list, total, page, pageSize, totalPages };
  }

  async getTicketDetail(
    trainId: string,
    fromStationId: string,
    toStationId: string,
  ): Promise<SearchTicketResult> {
    const trainDetail = await this.trainService.findTrainById(trainId);

    const fromIdx = trainDetail.stations.findIndex(
      (s) => s.stationId === fromStationId,
    );
    const toIdx = trainDetail.stations.findIndex(
      (s) => s.stationId === toStationId,
    );

    if (fromIdx === -1 || toIdx === -1 || fromIdx >= toIdx) {
      throw new Error('无效的站点选择');
    }

    const fromStation = trainDetail.stations[fromIdx];
    const toStation = trainDetail.stations[toIdx];

    let inventories: Inventory[] = [];
    if (trainDetail.inventoryInitialized) {
      inventories = await this.inventoryService.getAllInventories(trainId);
    }

    const seatResults: TicketInfoItem[] = trainDetail.seatTypes.map((seat) => {
      const inv = inventories.find((i) => i.seatTypeCode === seat.code);
      return {
        code: seat.code,
        name: seat.name,
        totalCount: seat.totalCount,
        soldCount: inv?.soldCount ?? seat.soldCount,
        lockedCount: inv?.lockedCount ?? seat.lockedCount,
        availableCount: inv?.availableCount ?? seat.availableCount,
        price: seat.price,
      };
    });

    const distance = toStation.distanceFromOrigin - fromStation.distanceFromOrigin;
    const duration = this.calculateDuration(
      fromStation.departTime,
      toStation.arriveTime,
    );

    return {
      trainId,
      trainNo: trainDetail.trainNo,
      travelDate: trainDetail.travelDate,
      fromStation: {
        stationId: fromStation.stationId,
        stationName: fromStation.stationName,
        stationIndex: fromIdx,
        arriveTime: fromStation.arriveTime,
        departTime: fromStation.departTime,
      },
      toStation: {
        stationId: toStation.stationId,
        stationName: toStation.stationName,
        stationIndex: toIdx,
        arriveTime: toStation.arriveTime,
        departTime: toStation.departTime,
      },
      durationMinutes: duration,
      distance,
      trainType: trainDetail.trainType,
      status: trainDetail.status,
      seatTypes: seatResults,
    };
  }

  private calculateDuration(departTime: string, arriveTime: string): number {
    const [dh, dm] = departTime.split(':').map(Number);
    const [ah, am] = arriveTime.split(':').map(Number);
    let minutes = (ah - dh) * 60 + (am - dm);
    if (minutes < 0) minutes += 24 * 60;
    return minutes;
  }
}
