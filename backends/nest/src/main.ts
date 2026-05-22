import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import * as path from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';
import { EnvelopeInterceptor } from './common/interceptors/envelope.interceptor';
import { AppConfig } from './config/configuration';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: ['warn', 'error'] });

  app.enableCors({ origin: '*' });

  // Serve spec static assets (avatars, icons)
  const repoRoot = process.env.REPO_ROOT || path.resolve(__dirname, '../../..');
  app.useStaticAssets(path.join(repoRoot, 'spec'), { prefix: '/static' });

  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalInterceptors(new EnvelopeInterceptor());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  const config = app.get(ConfigService<AppConfig>);
  const port = config.get('port', { infer: true }) ?? 29040;
  const host = process.env.HOST || '0.0.0.0';

  await app.listen(port, host);
  console.log(`NestJS backend running on http://${host}:${port}`);
}

bootstrap();
