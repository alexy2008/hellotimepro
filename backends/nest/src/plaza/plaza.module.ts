import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Capsule } from '../entities/capsule.entity';
import { Favorite } from '../entities/favorite.entity';
import { PlazaController } from './plaza.controller';
import { PlazaService } from './plaza.service';

@Module({
  imports: [TypeOrmModule.forFeature([Capsule, Favorite]), AuthModule],
  controllers: [PlazaController],
  providers: [PlazaService],
})
export class PlazaModule {}
