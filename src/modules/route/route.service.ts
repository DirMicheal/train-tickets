import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Route, RouteStatus, RouteStationInfo } from './route.entity';
import { CreateRouteDto, UpdateRouteDto, QueryRouteDto } from './dto/route.dto';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '../../common/exceptions/business.exception';

@Injectable()
export class RouteService {
  private readonly logger = new Logger(RouteService.name);

  constructor(
    @InjectRepository(Route)
    private readonly routeRepository: Repository<Route>,
  ) {}

  private calculateDuration(stations: { arriveTime: string; departTime: string }[]): number {
    if (stations.length < 2) return 0;
    const first = stations[0].departTime.split(':').map(Number);
    const last = stations[stations.length - 1].arriveTime.split(':').map(Number);
    let minutes = (last[0] - first[0]) * 60 + (last[1] - first[1]);
    if (minutes < 0) minutes += 24 * 60;
    return minutes;
  }

  async create(dto: CreateRouteDto): Promise<Route> {
    const existing = await this.routeRepository.findOne({
      where: [{ name: dto.name }, { code: dto.code }],
    });
    if (existing) {
      throw new ConflictException('线路名称或编号已存在');
    }

    if (dto.stations.length < 2) {
      throw new BadRequestException('线路至少需要2个站点');
    }

    const stations = dto.stations as RouteStationInfo[];
    const totalDistance = dto.totalDistance ?? stations[stations.length - 1].distanceFromOrigin;
    const durationMinutes = dto.durationMinutes ?? this.calculateDuration(dto.stations);

    const route = this.routeRepository.create({
      name: dto.name,
      code: dto.code,
      originStationId: dto.originStationId,
      originStationName: dto.originStationName,
      terminalStationId: dto.terminalStationId,
      terminalStationName: dto.terminalStationName,
      stationsJson: JSON.stringify(stations),
      totalDistance,
      durationMinutes,
      routeType: dto.routeType || '高铁',
      status: RouteStatus.ACTIVE,
      remark: dto.remark,
    });

    await this.routeRepository.save(route);
    this.logger.log(`创建线路成功: ${route.name} (${route.code})`);
    return route;
  }

  async findById(id: string): Promise<Route & { stations: RouteStationInfo[] }> {
    const route = await this.routeRepository.findOne({ where: { id } });
    if (!route) {
      throw new NotFoundException('线路');
    }

    let stations: RouteStationInfo[] = [];
    try {
      stations = JSON.parse(route.stationsJson);
    } catch {}

    return { ...route, stations };
  }

  async findByCode(code: string): Promise<Route & { stations: RouteStationInfo[] }> {
    const route = await this.routeRepository.findOne({ where: { code } });
    if (!route) {
      throw new NotFoundException('线路');
    }

    let stations: RouteStationInfo[] = [];
    try {
      stations = JSON.parse(route.stationsJson);
    } catch {}

    return { ...route, stations };
  }

  async findAll(dto: QueryRouteDto): Promise<{
    list: (Route & { stations: RouteStationInfo[] })[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const page = dto.page || 1;
    const pageSize = dto.pageSize || 10;
    const skip = (page - 1) * pageSize;

    const queryBuilder = this.routeRepository.createQueryBuilder('route');

    if (dto.keyword) {
      queryBuilder.andWhere(
        '(route.name LIKE :keyword OR route.code LIKE :keyword OR route.originStationName LIKE :keyword OR route.terminalStationName LIKE :keyword)',
        { keyword: `%${dto.keyword}%` },
      );
    }

    if (dto.status) {
      queryBuilder.andWhere('route.status = :status', { status: dto.status });
    }
    if (dto.originStationId) {
      queryBuilder.andWhere('route.originStationId = :originStationId', {
        originStationId: dto.originStationId,
      });
    }
    if (dto.terminalStationId) {
      queryBuilder.andWhere('route.terminalStationId = :terminalStationId', {
        terminalStationId: dto.terminalStationId,
      });
    }
    if (dto.routeType) {
      queryBuilder.andWhere('route.routeType = :routeType', { routeType: dto.routeType });
    }

    const sortBy = dto.sortBy || 'createdAt';
    const orderBy = dto.orderBy || 'DESC';
    queryBuilder.orderBy(`route.${sortBy}`, orderBy as any);

    const [routes, total] = await queryBuilder
      .skip(skip)
      .take(pageSize)
      .getManyAndCount();

    const list = routes.map((route) => {
      let stations: RouteStationInfo[] = [];
      try {
        stations = JSON.parse(route.stationsJson);
      } catch {}
      return { ...route, stations };
    });

    const totalPages = Math.ceil(total / pageSize);
    return { list, total, page, pageSize, totalPages };
  }

  async findAllActive(): Promise<(Route & { stations: RouteStationInfo[] })[]> {
    const routes = await this.routeRepository.find({
      where: { status: RouteStatus.ACTIVE },
      order: { createdAt: 'DESC' },
    });

    return routes.map((route) => {
      let stations: RouteStationInfo[] = [];
      try {
        stations = JSON.parse(route.stationsJson);
      } catch {}
      return { ...route, stations };
    });
  }

  async update(id: string, dto: UpdateRouteDto): Promise<Route> {
    const route = await this.findById(id);

    if (dto.name && dto.name !== route.name) {
      const existing = await this.routeRepository.findOne({
        where: { name: dto.name },
      });
      if (existing) {
        throw new ConflictException('线路名称已存在');
      }
    }

    if (dto.code && dto.code !== route.code) {
      const existing = await this.routeRepository.findOne({
        where: { code: dto.code },
      });
      if (existing) {
        throw new ConflictException('线路编号已存在');
      }
    }

    const stations = dto.stations as RouteStationInfo[];
    const totalDistance = dto.totalDistance ?? stations[stations.length - 1]?.distanceFromOrigin ?? 0;
    const durationMinutes = dto.durationMinutes ?? this.calculateDuration(dto.stations);

    const updateData: Partial<Route> = {
      name: dto.name,
      code: dto.code,
      originStationId: dto.originStationId,
      originStationName: dto.originStationName,
      terminalStationId: dto.terminalStationId,
      terminalStationName: dto.terminalStationName,
      stationsJson: JSON.stringify(stations),
      totalDistance,
      durationMinutes,
      routeType: dto.routeType,
      remark: dto.remark,
    };

    if (dto.status) {
      updateData.status = dto.status;
    }

    await this.routeRepository.update(id, updateData);
    this.logger.log(`更新线路成功: ${dto.name}`);
    return this.findById(id);
  }

  async delete(id: string): Promise<void> {
    const route = await this.findById(id);
    await this.routeRepository.remove(route);
    this.logger.log(`删除线路成功: ${route.name}`);
  }
}
