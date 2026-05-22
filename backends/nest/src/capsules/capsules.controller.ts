import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OptionalJwtGuard } from '../common/guards/optional-jwt.guard';
import { AuthService } from '../auth/auth.service';
import { notFound } from '../common/api.exception';
import { CapsulesService } from './capsules.service';
import { CreateCapsuleDto } from './dto/create-capsule.dto';

@Controller('api/v1/capsules')
export class CapsulesController {
  constructor(
    private readonly capsulesService: CapsulesService,
    private readonly authService: AuthService,
  ) {}

  @Get(':code')
  @UseGuards(OptionalJwtGuard)
  getByCode(@Param('code') code: string, @CurrentUser() jwtUser: JwtPayload | null) {
    return this.capsulesService.getByCode(code, jwtUser?.sub ?? null);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@CurrentUser() jwtUser: JwtPayload, @Body() dto: CreateCapsuleDto) {
    const user = await this.authService.findUserById(jwtUser.sub);
    if (!user) throw notFound('用户不存在');
    return this.capsulesService.create(user, dto);
  }
}
