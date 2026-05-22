import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Capsule } from '../entities/capsule.entity';
import { Favorite } from '../entities/favorite.entity';
import { User } from '../entities/user.entity';
import { CapsulesController } from './capsules.controller';
import { CapsulesService } from './capsules.service';

@Module({
  imports: [TypeOrmModule.forFeature([Capsule, Favorite, User]), AuthModule],
  controllers: [CapsulesController],
  providers: [CapsulesService],
  exports: [CapsulesService],
})
export class CapsulesModule {}
