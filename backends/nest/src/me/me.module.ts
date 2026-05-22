import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { CapsulesModule } from '../capsules/capsules.module';
import { User } from '../entities/user.entity';
import { MeController } from './me.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User]), AuthModule, CapsulesModule],
  controllers: [MeController],
})
export class MeModule {}
