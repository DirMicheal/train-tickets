import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, ILike } from 'typeorm';
import { Station, StationStatus } from './station.entity';
import { CreateStationDto, UpdateStationDto, QueryStationDto } from './dto/station.dto';
import {
  NotFoundException,
  ConflictException,
} from '../../common/exceptions/business.exception';

@Injectable()
export class StationService {
  private readonly logger = new Logger(StationService.name);

  constructor(
    @InjectRepository(Station)
    private readonly stationRepository: Repository<Station>,
  ) {}

  async create(dto: CreateStationDto): Promise<Station> {
    const existing = await this.stationRepository.findOne({
      where: [{ name: dto.name }, { code: dto.code }],
    });
    if (existing) {
      throw new ConflictException('站点名称或代码已存在');
    }

    const station = this.stationRepository.create({
      ...dto,
      status: StationStatus.ACTIVE,
    });
    await this.stationRepository.save(station);
    this.logger.log(`创建站点成功: ${station.name} (${station.code})`);
    return station;
  }

  async findById(id: string): Promise<Station> {
    const station = await this.stationRepository.findOne({ where: { id } });
    if (!station) {
      throw new NotFoundException('站点');
    }
    return station;
  }

  async findByCode(code: string): Promise<Station> {
    const station = await this.stationRepository.findOne({ where: { code } });
    if (!station) {
      throw new NotFoundException('站点');
    }
    return station;
  }

  async findAll(dto: QueryStationDto): Promise<{
    list: Station[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const page = dto.page || 1;
    const pageSize = dto.pageSize || 10;
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (dto.status) where.status = dto.status;
    if (dto.province) where.province = dto.province;
    if (dto.city) where.city = dto.city;

    const queryBuilder = this.stationRepository.createQueryBuilder('station');

    if (dto.keyword) {
      queryBuilder.andWhere(
        '(station.name LIKE :keyword OR station.code LIKE :keyword OR station.pinyin LIKE :keyword)',
        { keyword: `%${dto.keyword}%` },
      );
    }

    Object.keys(where).forEach((key) => {
      queryBuilder.andWhere(`station.${key} = :${key}`, { [key]: where[key] });
    });

    const sortBy = dto.sortBy || 'sortOrder';
    const orderBy = dto.orderBy || 'ASC';
    queryBuilder.orderBy(`station.${sortBy}`, orderBy as any);

    const [list, total] = await queryBuilder
      .skip(skip)
      .take(pageSize)
      .getManyAndCount();

    const totalPages = Math.ceil(total / pageSize);
    return { list, total, page, pageSize, totalPages };
  }

  async findAllActive(): Promise<Station[]> {
    return this.stationRepository.find({
      where: { status: StationStatus.ACTIVE },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  async update(id: string, dto: UpdateStationDto): Promise<Station> {
    const station = await this.findById(id);

    if (dto.name && dto.name !== station.name) {
      const existing = await this.stationRepository.findOne({
        where: { name: dto.name },
      });
      if (existing) {
        throw new ConflictException('站点名称已存在');
      }
    }

    if (dto.code && dto.code !== station.code) {
      const existing = await this.stationRepository.findOne({
        where: { code: dto.code },
      });
      if (existing) {
        throw new ConflictException('站点代码已存在');
      }
    }

    Object.assign(station, dto);
    await this.stationRepository.save(station);
    this.logger.log(`更新站点成功: ${station.name}`);
    return station;
  }

  async delete(id: string): Promise<void> {
    const station = await this.findById(id);
    await this.stationRepository.remove(station);
    this.logger.log(`删除站点成功: ${station.name}`);
  }

  async batchCreate(stations: CreateStationDto[]): Promise<Station[]> {
    const result: Station[] = [];
    for (const dto of stations) {
      try {
        const station = await this.create(dto);
        result.push(station);
      } catch (e) {
        this.logger.warn(`跳过创建站点 ${dto.name}: ${e.message}`);
      }
    }
    return result;
  }
}
