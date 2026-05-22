import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { MeModule } from './me/me.module';
import { CapsulesModule } from './capsules/capsules.module';
import { PlazaModule } from './plaza/plaza.module';
import { FavoritesModule } from './favorites/favorites.module';
import { CapsuleSuggestionModule } from './capsule-suggestion/capsule-suggestion.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    DatabaseModule,
    AuthModule,
    HealthModule,
    MeModule,
    CapsulesModule,
    PlazaModule,
    FavoritesModule,
    CapsuleSuggestionModule,
  ],
})
export class AppModule {}
