import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as path from 'path';
import { AppConfig } from '../config/configuration';
import { Capsule } from '../entities/capsule.entity';
import { Favorite } from '../entities/favorite.entity';
import { RefreshToken } from '../entities/refresh-token.entity';
import { User } from '../entities/user.entity';

function parseSqliteFile(dbUrl: string): string {
  // sqlite:///abs/path → /abs/path  (strip scheme, keep leading slash)
  return dbUrl.replace(/^sqlite:\/\//, '');
}

function parsePostgresUrl(dbUrl: string): object {
  try {
    const url = new URL(dbUrl);
    return {
      host: url.hostname,
      port: url.port ? parseInt(url.port) : 5432,
      username: url.username,
      password: url.password,
      database: url.pathname.replace(/^\//, ''),
    };
  } catch {
    return {};
  }
}

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig>) => {
        const driver = config.get('dbDriver', { infer: true }) ?? 'postgres';
        const dbUrl = config.get('dbUrl', { infer: true }) ?? '';
        const entities = [User, Capsule, Favorite, RefreshToken];

        const migrationDir =
          driver === 'sqlite'
            ? path.join(__dirname, 'migrations', 'sqlite')
            : path.join(__dirname, 'migrations', 'postgres');

        if (driver === 'sqlite') {
          const dbPath = parseSqliteFile(dbUrl);
          return {
            type: 'better-sqlite3',
            database: dbPath,
            entities,
            migrations: [`${migrationDir}/*.{ts,js}`],
            migrationsRun: true,
            synchronize: false,
            logging: false,
            prepareDatabase: (db: any) => {
              db.pragma('foreign_keys = ON');
              db.pragma('journal_mode = WAL');
            },
          } as any;
        }

        const pgOpts = parsePostgresUrl(dbUrl);
        return {
          type: 'postgres',
          ...pgOpts,
          ssl: false,
          entities,
          migrations: [`${migrationDir}/*.{ts,js}`],
          migrationsRun: true,
          synchronize: false,
          logging: false,
        } as any;
      },
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
