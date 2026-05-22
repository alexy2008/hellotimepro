import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { badRequest, notFound } from '../common/api.exception';
import { AppConfig } from '../config/configuration';
import { Capsule } from '../entities/capsule.entity';
import { Favorite } from '../entities/favorite.entity';

@Injectable()
export class FavoritesService {
  constructor(
    @InjectRepository(Favorite)
    private readonly favoriteRepo: Repository<Favorite>,
    @InjectRepository(Capsule)
    private readonly capsuleRepo: Repository<Capsule>,
    private readonly config: ConfigService<AppConfig>,
  ) {}

  async addFavorite(userId: string, capsuleId: string) {
    const capsule = await this.capsuleRepo.findOne({ where: { id: capsuleId } });
    if (!capsule || !capsule.inPlaza) throw notFound('胶囊不存在');
    if (capsule.ownerId === userId) throw badRequest('不能收藏自己创建的胶囊');

    const existing = await this.favoriteRepo.findOne({
      where: { userId, capsuleId },
    });
    if (existing) {
      return {
        capsuleId: capsule.id,
        favoriteCount: capsule.favoriteCount,
        favoritedAt: existing.createdAt,
      };
    }

    const now = new Date();
    const fav = this.favoriteRepo.create({ userId, capsuleId, createdAt: now });
    await this.favoriteRepo.save(fav);

    await this.capsuleRepo
      .createQueryBuilder()
      .update()
      .set({ favoriteCount: () => 'favorite_count + 1' })
      .where('id = :id', { id: capsuleId })
      .execute();

    await this.capsuleRepo.increment({ id: capsuleId }, 'favoriteCount', 0); // refresh
    const updated = await this.capsuleRepo.findOne({ where: { id: capsuleId } });

    return {
      capsuleId: capsule.id,
      favoriteCount: updated?.favoriteCount ?? capsule.favoriteCount + 1,
      favoritedAt: now,
    };
  }

  async removeFavorite(userId: string, capsuleId: string): Promise<void> {
    const capsule = await this.capsuleRepo.findOne({ where: { id: capsuleId } });
    if (!capsule) return;

    const existing = await this.favoriteRepo.findOne({ where: { userId, capsuleId } });
    if (!existing) return;

    await this.favoriteRepo.remove(existing);
    await this.capsuleRepo
      .createQueryBuilder()
      .update()
      .set({ favoriteCount: () => 'CASE WHEN favorite_count > 0 THEN favorite_count - 1 ELSE 0 END' })
      .where('id = :id', { id: capsuleId })
      .execute();
  }
}
