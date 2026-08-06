import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager } from 'typeorm';
import { badRequest, notFound } from '../common/api.exception';
import { AppConfig } from '../config/configuration';
import { Capsule } from '../entities/capsule.entity';
import { Favorite } from '../entities/favorite.entity';

@Injectable()
export class FavoritesService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService<AppConfig>,
  ) {}

  private async lockedCapsule(manager: EntityManager, capsuleId: string): Promise<Capsule | null> {
    const query = manager.getRepository(Capsule).createQueryBuilder('c').where('c.id = :id', {
      id: capsuleId,
    });
    if ((this.config.get('dbDriver', { infer: true }) ?? 'postgres') === 'postgres') {
      query.setLock('pessimistic_write');
    }
    return query.getOne();
  }

  async addFavorite(userId: string, capsuleId: string) {
    return this.dataSource.transaction(async (manager) => {
      const capsules = manager.getRepository(Capsule);
      const favorites = manager.getRepository(Favorite);
      const capsule = await this.lockedCapsule(manager, capsuleId);
      if (!capsule || !capsule.inPlaza) throw notFound('胶囊不存在');
      if (capsule.ownerId === userId) throw badRequest('不能收藏自己创建的胶囊');

      const existing = await favorites.findOne({ where: { userId, capsuleId } });
      if (existing) {
        return {
          capsuleId: capsule.id,
          favoriteCount: capsule.favoriteCount,
          favoritedAt: existing.createdAt,
        };
      }

      const now = new Date();
      await favorites.save(favorites.create({ userId, capsuleId, createdAt: now }));
      await capsules
        .createQueryBuilder()
        .update()
        .set({ favoriteCount: () => 'favorite_count + 1' })
        .where('id = :id', { id: capsuleId })
        .execute();
      const updated = await capsules.findOne({ where: { id: capsuleId } });

      return {
        capsuleId: capsule.id,
        favoriteCount: updated?.favoriteCount ?? capsule.favoriteCount + 1,
        favoritedAt: now,
      };
    });
  }

  async removeFavorite(userId: string, capsuleId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const capsules = manager.getRepository(Capsule);
      const favorites = manager.getRepository(Favorite);
      const capsule = await this.lockedCapsule(manager, capsuleId);
      if (!capsule) return;

      const existing = await favorites.findOne({ where: { userId, capsuleId } });
      if (!existing) return;

      await favorites.remove(existing);
      await capsules
        .createQueryBuilder()
        .update()
        .set({ favoriteCount: () => 'CASE WHEN favorite_count > 0 THEN favorite_count - 1 ELSE 0 END' })
        .where('id = :id', { id: capsuleId })
        .execute();
    });
  }
}
