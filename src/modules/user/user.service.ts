import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole, UserStatus } from './user.entity';
import { UpdateUserDto } from './dto/user.dto';
import { PaginationDto } from '../../common/dto/common.dto';
import {
  NotFoundException,
  BadRequestException,
} from '../../common/exceptions/business.exception';
import { UtilService } from '../../common/services/util.service';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly utilService: UtilService,
  ) {}

  async findById(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('用户');
    }
    return user;
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { username } });
  }

  async findByPhone(phone: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { phone } });
  }

  async findMe(userId: string): Promise<User> {
    return this.findById(userId);
  }

  async update(userId: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.findById(userId);

    if (dto.email && dto.email !== user.email) {
      const existing = await this.userRepository.findOne({
        where: { email: dto.email },
      });
      if (existing) {
        throw new BadRequestException('邮箱已被使用');
      }
    }

    Object.assign(user, dto);
    await this.userRepository.save(user);
    this.logger.log(`用户信息更新成功: ${user.username} (${user.id})`);
    return user;
  }

  async findAll(dto: PaginationDto): Promise<{
    list: User[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const page = dto.page || 1;
    const pageSize = dto.pageSize || 10;
    const skip = (page - 1) * pageSize;

    const queryBuilder = this.userRepository.createQueryBuilder('user');

    if (dto.keyword) {
      queryBuilder.andWhere(
        'user.username LIKE :keyword OR user.phone LIKE :keyword OR user.email LIKE :keyword OR user.realName LIKE :keyword',
        { keyword: `%${dto.keyword}%` },
      );
    }

    const sortBy = dto.sortBy || 'createdAt';
    const orderBy = dto.orderBy || 'DESC';
    queryBuilder.orderBy(`user.${sortBy}`, orderBy as any);

    const [list, total] = await queryBuilder
      .skip(skip)
      .take(pageSize)
      .getManyAndCount();

    const totalPages = Math.ceil(total / pageSize);

    return { list, total, page, pageSize, totalPages };
  }

  async updateStatus(
    userId: string,
    status: UserStatus,
  ): Promise<User> {
    const user = await this.findById(userId);
    user.status = status;
    await this.userRepository.save(user);
    this.logger.log(`用户状态更新: ${user.username} -> ${status}`);
    return user;
  }

  async updateRole(userId: string, role: UserRole): Promise<User> {
    const user = await this.findById(userId);
    user.role = role;
    await this.userRepository.save(user);
    this.logger.log(`用户角色更新: ${user.username} -> ${role}`);
    return user;
  }

  async delete(userId: string): Promise<void> {
    const user = await this.findById(userId);
    await this.userRepository.remove(user);
    this.logger.log(`用户删除: ${user.username} (${userId})`);
  }
}
