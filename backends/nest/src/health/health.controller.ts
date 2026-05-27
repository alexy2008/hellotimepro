import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../config/configuration';
import { loadAvatars } from './avatar.service';

const startedAt = Date.now();

@Controller('api/v1')
export class HealthController {
  constructor(private readonly config: ConfigService<AppConfig>) {}

  @Get('health')
  health() {
    const driver = this.config.get('dbDriver', { infer: true });
    const serviceName = this.config.get('serviceName', { infer: true });
    const version = this.config.get('serviceVersion', { infer: true });

    const dbName = driver === 'postgres' ? 'PostgreSQL' : 'SQLite';
    const dbVer = driver === 'postgres' ? '16' : '3';

    const summary =
      '基于 Node.js + NestJS + TypeScript 核心骨架，选用 TypeORM 作为数据库对象关系映射工具，' +
      'Passport 进行 JWT 身份验证，class-validator 驱动声明式数据校验，' +
      '同时支持 PostgreSQL 与 SQLite 双数据库驱动切换。' +
      '采用 TypeScript 强类型约束和面向对象元数据设计，' +
      '借助 NestJS 的依赖注入容器与模块系统，为 Node.js 环境提供企业级架构标准。' +
      'TypeORM 创新设计了跨库列类型辅助机制，在 PostgreSQL 和 SQLite 间自动适配类型，' +
      '服务启动过程只负责连接已准备好的数据库，schema 由仓库级 scripts/db 维护。' +
      '通过 DTO 属性装饰器完成请求边界声明，' +
      '全局 ValidationPipe 拦截非法请求并过滤多余字段，在请求抵达业务层前构筑类型安全边界。' +
      '高度遵循 NestJS 标准的 AOP 生命周期，' +
      'Passport JWT Strategy 配合守卫实现鉴权拦截、拦截器完成统一响应包装、' +
      '全局过滤器捕获异常并映射为契约约定的错误响应。';

    return {
      status: 'ok',
      service: serviceName,
      version,
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
      stack: {
        kind: 'backend',
        summary,
        items: [
          { role: 'language', name: 'TypeScript', version: '5.x', iconUrl: '/static/icons/typescript.svg' },
          { role: 'framework', name: 'NestJS', version: '11.x', iconUrl: '/static/icons/nestjs.svg' },
          { role: 'database', name: dbName, version: dbVer, iconUrl: `/static/icons/${dbName.toLowerCase()}.svg` },
        ],
      },
    };
  }

  @Get('avatars')
  avatars() {
    return loadAvatars();
  }
}
