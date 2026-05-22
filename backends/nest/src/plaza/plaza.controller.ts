import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';
import { OptionalJwtGuard } from '../common/guards/optional-jwt.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PlazaService } from './plaza.service';

@Controller('api/v1')
export class PlazaController {
  constructor(private readonly plazaService: PlazaService) {}

  @Get('plaza/capsules')
  @UseGuards(OptionalJwtGuard)
  plazaList(
    @CurrentUser() jwtUser: JwtPayload | null,
    @Query('sort') sort = 'new',
    @Query('filter') filter = 'all',
    @Query('q') q: string | undefined,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
  ) {
    return this.plazaService.plazaList({
      sort,
      filter,
      q,
      page: parseInt(page, 10) || 1,
      pageSize: parseInt(pageSize, 10) || 20,
      viewerId: jwtUser?.sub ?? null,
    });
  }

  @Get('plaza/capsules/:id')
  @UseGuards(OptionalJwtGuard)
  plazaDetail(
    @Param('id') id: string,
    @CurrentUser() jwtUser: JwtPayload | null,
  ) {
    return this.plazaService.plazaDetail(id, jwtUser?.sub ?? null);
  }

  @Get('me/capsules')
  @UseGuards(JwtAuthGuard)
  myCapsules(
    @CurrentUser() jwtUser: JwtPayload,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
  ) {
    return this.plazaService.myCapsules(
      jwtUser.sub,
      parseInt(page, 10) || 1,
      parseInt(pageSize, 10) || 20,
    );
  }

  @Get('me/favorites')
  @UseGuards(JwtAuthGuard)
  myFavorites(
    @CurrentUser() jwtUser: JwtPayload,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
  ) {
    return this.plazaService.myFavorites(
      jwtUser.sub,
      parseInt(page, 10) || 1,
      parseInt(pageSize, 10) || 20,
    );
  }
}
