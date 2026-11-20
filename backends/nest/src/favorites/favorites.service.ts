import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { findLockedCapsule } from '../capsules/capsule-queries';
import { canonicalCapsuleId } from '../capsules/capsule-rules';
import { notFound } from '../common/api.exception';
import { Capsule } from '../entities/capsule.entity';
import { Favorite } from '../entities/favorite.entity';

@Injectable()
export class FavoritesService {
  constructor(private readonly dataSource: DataSource) {}

  async addFavorite(userId: string, requestedId: string) {
    return this.dataSource.transaction(async (manager) => {
      const capsules = manager.getRepository(Capsule);
      const favorites = manager.getRepository(Favorite);
      const capsule = await findLockedCapsule(manager, requestedId);
      if (!capsule) throw notFound('胶囊不存在');
      const capsuleId = capsule.id;

      const existing = await favorites.findOne({ where: { userId, capsuleId } });
      if (existing) {
        return {
          capsuleId: canonicalCapsuleId(capsuleId),
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
        capsuleId: canonicalCapsuleId(capsuleId),
        favoriteCount: updated?.favoriteCount ?? capsule.favoriteCount + 1,
        favoritedAt: now,
      };
    });
  }

  async removeFavorite(userId: string, requestedId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const capsules = manager.getRepository(Capsule);
      const favorites = manager.getRepository(Favorite);
      const capsule = await findLockedCapsule(manager, requestedId);
      if (!capsule) return;
      const capsuleId = capsule.id;

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
