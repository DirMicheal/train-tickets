import { HttpException, HttpStatus } from '@nestjs/common';

export class BusinessException extends HttpException {
  constructor(message: string, code: number = 400) {
    super(
      {
        success: false,
        code,
        message,
        data: null,
      },
      HttpStatus.OK,
    );
  }
}

export class NotFoundException extends BusinessException {
  constructor(resource = '资源') {
    super(`${resource}不存在`, 404);
  }
}

export class UnauthorizedException extends BusinessException {
  constructor(message = '未授权访问') {
    super(message, 401);
  }
}

export class ForbiddenException extends BusinessException {
  constructor(message = '无权限访问') {
    super(message, 403);
  }
}

export class BadRequestException extends BusinessException {
  constructor(message = '请求参数错误') {
    super(message, 400);
  }
}

export class ConflictException extends BusinessException {
  constructor(message = '资源冲突') {
    super(message, 409);
  }
}

export class LockAcquireException extends BusinessException {
  constructor(message = '获取分布式锁失败，请稍后重试') {
    super(message, 423);
  }
}

export class TicketSoldOutException extends BusinessException {
  constructor(message = '车票已售罄') {
    super(message, 410);
  }
}

export class TicketLockTimeoutException extends BusinessException {
  constructor(message = '锁票已过期，请重新下单') {
    super(message, 408);
  }
}

export class OrderExpiredException extends BusinessException {
  constructor(message = '订单已过期，请重新下单') {
    super(message, 408);
  }
}

export class IdempotentException extends BusinessException {
  constructor(message = '重复请求') {
    super(message, 425);
  }
}
