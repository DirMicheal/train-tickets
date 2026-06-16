import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { RequestIdMiddlewareFunc } from './common/middleware/request-id.middleware';

async function bootstrap() {
  const dataDir = path.resolve(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      forbidNonWhitelisted: false,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.use(RequestIdMiddlewareFunc);

  app.setGlobalPrefix('/api/v1');

  const config = new DocumentBuilder()
    .setTitle('火车票购票服务 API')
    .setDescription('高并发火车票购票系统 RESTful API 文档，支持查询、锁票、下单、支付、改签、退票全流程')
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: '输入 JWT Token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('认证模块', '用户注册、登录、Token刷新')
    .addTag('用户模块', '用户信息管理')
    .addTag('站点管理', '火车站点 CRUD')
    .addTag('线路管理', '运行线路 CRUD')
    .addTag('车次管理', '列车车次 CRUD、库存初始化')
    .addTag('车票查询', '余票查询、车次详情')
    .addTag('锁票模块', '分布式锁票、释放锁票')
    .addTag('订单模块', '下单、改签、退票、订单查询')
    .addTag('支付模块', '订单支付、支付回调')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  const port = process.env.APP_PORT ? parseInt(process.env.APP_PORT) : 3000;
  const host = process.env.APP_HOST || '0.0.0.0';

  await app.listen(port, host);

  const logger = new Logger('Bootstrap');
  logger.log(`火车票购票服务已启动: http://${host}:${port}`);
  logger.log(`Swagger 文档地址: http://${host}:${port}/api/docs`);
  logger.log(`API 基础路径: http://${host}:${port}/api/v1`);
}

bootstrap();
