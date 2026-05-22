import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { notFound, validationError } from '../common/api.exception';
import { Capsule } from '../entities/capsule.entity';
import { Favorite } from '../entities/favorite.entity';
import { User } from '../entities/user.entity';

function isOpened(openAt: Date): boolean {
  return openAt <= new Date();
}

function contentPreview(content: string, opened: boolean): string | null {
  if (!opened) return null;
  const raw = content.trim();
  return raw.length > 80 ? raw.slice(0, 80) + '…' : raw;
}

@Injectable()
export class PlazaService {
  constructor(
    @InjectRepository(Capsule)
    private readonly capsuleRepo: Repository<Capsule>,
    @InjectRepository(Favorite)
    private readonly favoriteRepo: Repository<Favorite>,
  ) {}

  private async getFavoriteIds(capsuleIds: string[], viewerId: string | null): Promise<Set<string>> {
    if (!viewerId || capsuleIds.length === 0) return new Set();
    const rows = await this.favoriteRepo
      .createQueryBuilder('f')
      .select('f.capsuleId', 'capsuleId')
      .where('f.userId = :uid', { uid: viewerId })
      .andWhere('f.capsuleId IN (:...ids)', { ids: capsuleIds })
      .getRawMany();
    return new Set(rows.map((r) => r.f_capsuleId ?? r.capsuleId));
  }

  private toListItem(c: Capsule, owner: User, favoritedByMe: boolean, favoritedAt?: Date) {
    const opened = isOpened(c.openAt);
    return {
      id: c.id,
      code: c.code,
      title: c.title,
      creator: { nickname: owner.nickname, avatarId: owner.avatarId },
      openAt: c.openAt,
      createdAt: c.createdAt,
      inPlaza: c.inPlaza,
      favoriteCount: c.favoriteCount,
      isOpened: opened,
      favoritedByMe,
      favoritedAt: favoritedAt ?? null,
      contentPreview: contentPreview(c.content, opened),
    };
  }

  async plazaList(params: {
    sort: string;
    filter: string;
    q: string | undefined;
    page: number;
    pageSize: number;
    viewerId: string | null;
  }) {
    const { sort, filter, q, page, pageSize, viewerId } = params;

    if (!['hot', 'new'].includes(sort)) {
      throw validationError('sort 仅支持 hot/new', 'sort');
    }
    if (!['all', 'opened', 'unopened'].includes(filter)) {
      throw validationError('filter 仅支持 all/opened/unopened', 'filter');
    }
    if (page < 1) throw validationError('page 必须 >= 1', 'page');
    if (pageSize < 1 || pageSize > 50) throw validationError('pageSize 范围 1-50', 'pageSize');
    if (q && q.trim().length > 50) throw validationError('q 长度不得超过 50', 'q');

    const now = new Date();

    let qb = this.capsuleRepo
      .createQueryBuilder('c')
      .innerJoinAndSelect('c.owner', 'u')
      .where('c.inPlaza = :plaza', { plaza: true });

    if (filter === 'opened') qb = qb.andWhere('c.openAt <= :now', { now });
    else if (filter === 'unopened') qb = qb.andWhere('c.openAt > :now', { now });

    if (q?.trim()) {
      const pattern = `%${q.trim().toLowerCase()}%`;
      qb = qb.andWhere(
        '(LOWER(c.title) LIKE :pattern OR LOWER(u.nickname) LIKE :pattern)',
        { pattern },
      );
    }

    const total = await qb.getCount();

    if (sort === 'hot') {
      qb = qb.orderBy('c.favoriteCount', 'DESC').addOrderBy('c.createdAt', 'DESC');
    } else {
      qb = qb.orderBy('c.createdAt', 'DESC');
    }

    const rows = await qb.skip((page - 1) * pageSize).take(pageSize).getMany();
    const capsuleIds = rows.map((c) => c.id);
    const faved = await this.getFavoriteIds(capsuleIds, viewerId);

    const items = rows.map((c) => this.toListItem(c, c.owner, faved.has(c.id)));
    const totalPages = Math.ceil(total / pageSize);

    return {
      items,
      pagination: { page, pageSize, total, totalPages },
    };
  }

  async plazaDetail(capsuleId: string, viewerId: string | null) {
    const capsule = await this.capsuleRepo.findOne({
      where: { id: capsuleId, inPlaza: true },
      relations: ['owner'],
    });
    if (!capsule) throw notFound('胶囊不存在');

    const faved = await this.getFavoriteIds([capsule.id], viewerId);
    const opened = isOpened(capsule.openAt);
    return {
      id: capsule.id,
      code: capsule.code,
      title: capsule.title,
      creator: { nickname: capsule.owner.nickname, avatarId: capsule.owner.avatarId },
      openAt: capsule.openAt,
      createdAt: capsule.createdAt,
      inPlaza: capsule.inPlaza,
      favoriteCount: capsule.favoriteCount,
      isOpened: opened,
      content: opened ? capsule.content : null,
      favoritedByMe: faved.has(capsule.id),
    };
  }

  async myCapsules(userId: string, page: number, pageSize: number) {
    if (page < 1) throw validationError('page 必须 >= 1', 'page');
    if (pageSize < 1 || pageSize > 50) throw validationError('pageSize 范围 1-50', 'pageSize');

    const [rows, total] = await this.capsuleRepo.findAndCount({
      where: { ownerId: userId },
      relations: ['owner'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    const items = rows.map((c) => this.toListItem(c, c.owner, false));
    return {
      items,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  async myFavorites(userId: string, page: number, pageSize: number) {
    if (page < 1) throw validationError('page 必须 >= 1', 'page');
    if (pageSize < 1 || pageSize > 50) throw validationError('pageSize 范围 1-50', 'pageSize');

    const total = await this.favoriteRepo.count({ where: { userId } });
    const favRows = await this.favoriteRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    const capsuleIds = favRows.map((f) => f.capsuleId);
    if (capsuleIds.length === 0) {
      return { items: [], pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
    }

    const capsules = await this.capsuleRepo.find({
      where: capsuleIds.map((id) => ({ id })),
      relations: ['owner'],
    });
    const capsuleMap = new Map(capsules.map((c) => [c.id, c]));

    const items = favRows.map((f) => {
      const c = capsuleMap.get(f.capsuleId);
      if (!c) return null;
      return this.toListItem(c, c.owner, true, f.createdAt);
    }).filter(Boolean);

    return {
      items,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }
}
