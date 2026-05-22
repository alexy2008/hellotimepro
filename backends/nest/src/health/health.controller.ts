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
      driver === 'sqlite'
        ? 'NestJS 11 + TypeORM 后端，class-validator 请求验证，Passport JWT 双令牌鉴权，SQLite 轻量存储。'
        : 'NestJS 11 + TypeORM 后端，class-validator 请求验证，Passport JWT 双令牌鉴权，PostgreSQL 承载业务数据。';

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
