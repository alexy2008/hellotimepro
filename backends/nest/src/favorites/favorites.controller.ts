import { Body, Controller, Delete, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { Matches } from 'class-validator';
import { CAPSULE_ID } from '../capsules/capsule-rules';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { FavoritesService } from './favorites.service';

class AddFavoriteDto {
  @Matches(CAPSULE_ID)
  capsuleId: string;
}

@Controller('api/v1/me/favorites')
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Post()
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  addFavorite(@CurrentUser() jwtUser: JwtPayload, @Body() dto: AddFavoriteDto) {
    return this.favoritesService.addFavorite(jwtUser.sub, dto.capsuleId);
  }

  @Delete(':capsuleId')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  async removeFavorite(@CurrentUser() jwtUser: JwtPayload, @Param('capsuleId') capsuleId: string) {
    await this.favoritesService.removeFavorite(jwtUser.sub, capsuleId);
  }
}
