import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let message: string;
    let code: number;
    let data: any = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object') {
        const resp = exceptionResponse as any;
        message = resp.message || exception.message;
        code = resp.code || status;
        data = resp.data || null;
      } else {
        message = exceptionResponse as string;
        code = status;
      }
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = exception instanceof Error ? exception.message : 'Internal Server Error';
      code = HttpStatus.INTERNAL_SERVER_ERROR;
      this.logger.error(`[${request.method}] ${request.url}`, exception instanceof Error ? exception.stack : '');
    }

    const requestId = (request as any).requestId || 'unknown';

    const responseBody = {
      success: false,
      code,
      message: Array.isArray(message) ? message.join('; ') : message,
      data,
      timestamp: new Date().toISOString(),
      path: request.url,
      requestId,
    };

    response.status(status).json(responseBody);
  }
}
