import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthService } from '../auth/auth.service';
import { ChangePasswordDto } from '../auth/dto/change-password.dto';
import { ApiException } from '../common/api.exception';
import { conflict, notFound, validationError } from '../common/api.exception';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CapsulesService } from '../capsules/capsules.service';
import { User } from '../entities/user.entity';
import { ALLOWED_AVATAR_IDS } from '../health/avatar.service';
import { IsOptional, IsString, Length, Matches } from 'class-validator';

class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @Length(2, 20)
  nickname?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9_-]+$/)
  avatarId?: string;
}

@Controller('api/v1/me')
export class MeController {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly authService: AuthService,
    private readonly capsulesService: CapsulesService,
  ) {}

  private toOut(user: User) {
    return {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      avatarId: user.avatarId,
      createdAt: user.createdAt,
    };
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() jwtUser: JwtPayload) {
    const user = await this.userRepo.findOne({ where: { id: jwtUser.sub } });
    if (!user) throw notFound('用户不存在');
    return this.toOut(user);
  }

  @Patch()
  @UseGuards(JwtAuthGuard)
  async patchMe(@CurrentUser() jwtUser: JwtPayload, @Body() dto: UpdateProfileDto) {
    if (dto.nickname === undefined && dto.avatarId === undefined) {
      throw validationError('nickname 或 avatarId 至少提供一个', 'nickname');
    }
    const user = await this.userRepo.findOne({ where: { id: jwtUser.sub } });
    if (!user) throw notFound('用户不存在');

    if (dto.nickname !== undefined && dto.nickname !== user.nickname) {
      const exists = await this.userRepo.findOne({
        where: { nickname: dto.nickname },
      });
      if (exists && exists.id !== user.id) throw conflict('昵称已被使用', 'nickname');
      user.nickname = dto.nickname;
    }

    if (dto.avatarId !== undefined) {
      if (!ALLOWED_AVATAR_IDS.has(dto.avatarId)) {
        throw validationError('头像 ID 不存在', 'avatarId');
      }
      user.avatarId = dto.avatarId;
    }

    user.updatedAt = new Date();
    try {
      await this.userRepo.save(user);
    } catch (e: any) {
      const msg = (e?.message ?? '').toLowerCase();
      if (msg.includes('nickname')) throw conflict('昵称已被使用', 'nickname');
      throw e;
    }

    return this.toOut(user);
  }

  @Post('password')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  async changePassword(@CurrentUser() jwtUser: JwtPayload, @Body() dto: ChangePasswordDto) {
    const user = await this.userRepo.findOne({ where: { id: jwtUser.sub } });
    if (!user) throw new ApiException('UNAUTHORIZED', '用户不存在');
    await this.authService.changePassword(user, dto);
  }

  @Delete('capsules/:id')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  async deleteCapsule(@CurrentUser() jwtUser: JwtPayload, @Param('id') id: string) {
    const user = await this.userRepo.findOne({ where: { id: jwtUser.sub } });
    if (!user) throw notFound('用户不存在');
    await this.capsulesService.deleteOwn(user, id);
  }
}
