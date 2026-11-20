import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { canonicalCapsuleId, capsuleLookupIds } from '../capsules/capsule-rules';
import { notFound, validationError } from '../common/api.exception';
import { formatSqliteTimestamp } from '../database/column-helpers';
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

type Counter = number | string;

@Injectable()
export class PlazaService {
  constructor(
    @InjectRepository(Capsule)
    private readonly capsuleRepo: Repository<Capsule>,
    @InjectRepository(Favorite)
    private readonly favoriteRepo: Repository<Favorite>,
  ) {}

  private get isSqlite() {
    return this.capsuleRepo.manager.connection.options.type === 'better-sqlite3';
  }

  private timestampParam(now: Date) {
    return this.isSqlite ? formatSqliteTimestamp(now) : now;
  }

  private publicCapsules() {
    return this.capsuleRepo.createQueryBuilder('c').where('c.inPlaza = :plaza', { plaza: true });
  }

  private plazaQuery(q: string | undefined) {
    if (q !== undefined && typeof q !== 'string') throw validationError('q 必须是字符串', 'q');
    const trimmed = q?.trim() ?? '';
    if ([...trimmed].length > 50) throw validationError('q 长度不得超过 50', 'q');

    const query = this.publicCapsules().innerJoinAndSelect('c.owner', 'u');
    if (!trimmed) return query;

    const literal = trimmed.toLowerCase().replace(/[\\%_]/g, '\\$&');
    return query.andWhere(
      "(LOWER(c.title) LIKE :pattern ESCAPE '\\' OR LOWER(u.nickname) LIKE :pattern ESCAPE '\\')",
      { pattern: '%' + literal + '%' },
    );
  }

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
      id: canonicalCapsuleId(c.id),
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
    const now = this.timestampParam(new Date());
    let qb = this.plazaQuery(q);
    if (filter === 'opened') qb = qb.andWhere('c.openAt <= :now', { now });
    else if (filter === 'unopened') qb = qb.andWhere('c.openAt > :now', { now });

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

  async plazaStats(q: string | undefined) {
    const now = this.timestampParam(new Date());
    const counts = await this.plazaQuery(q)
      .select('COUNT(*)', 'total')
      .addSelect('COUNT(CASE WHEN c.openAt <= :now THEN 1 END)', 'opened')
      .addSelect('COUNT(CASE WHEN c.openAt > :now THEN 1 END)', 'unopened')
      .setParameter('now', now)
      .getRawOne<{ total: Counter; opened: Counter; unopened: Counter }>();

    const farthest = await this.publicCapsules().select('c.openAt').orderBy('c.openAt', 'DESC').limit(1).getOne();
    const next = await this.publicCapsules().select('c.openAt').andWhere('c.openAt > :now', { now })
      .orderBy('c.openAt', 'ASC').limit(1).getOne();
    return {
      counts: {
        all: Number(counts?.total ?? 0),
        opened: Number(counts?.opened ?? 0),
        unopened: Number(counts?.unopened ?? 0),
      },
      farthestOpenAt: farthest?.openAt ?? null,
      nextOpenAt: next?.openAt ?? null,
    };
  }

  async myStats(userId: string) {
    const now = this.timestampParam(new Date());
    const counts = await this.capsuleRepo.createQueryBuilder('c')
      .select('COUNT(*)', 'created')
      .addSelect('COUNT(CASE WHEN c.openAt <= :now THEN 1 END)', 'opened')
      .addSelect('COUNT(CASE WHEN c.openAt > :now THEN 1 END)', 'unopened')
      .addSelect('COUNT(CASE WHEN c.inPlaza THEN 1 END)', 'inPlaza')
      .addSelect('COALESCE(SUM(c.favoriteCount), 0)', 'favoritesReceived')
      .where('c.ownerId = :userId', { userId })
      .setParameter('now', now)
      .getRawOne<{ created: Counter; opened: Counter; unopened: Counter; inPlaza: Counter; favoritesReceived: Counter }>();
    return {
      created: Number(counts?.created ?? 0),
      opened: Number(counts?.opened ?? 0),
      unopened: Number(counts?.unopened ?? 0),
      inPlaza: Number(counts?.inPlaza ?? 0),
      favoritesReceived: Number(counts?.favoritesReceived ?? 0),
      favoritesGiven: await this.favoriteRepo.countBy({ userId }),
    };
  }

  async plazaDetail(capsuleId: string, viewerId: string | null) {
    const capsule = await this.capsuleRepo.findOne({
      where: { id: In(capsuleLookupIds(capsuleId, this.isSqlite, 'id')), inPlaza: true },
      relations: ['owner'],
    });
    if (!capsule) throw notFound('胶囊不存在');

    const faved = await this.getFavoriteIds([capsule.id], viewerId);
    const opened = isOpened(capsule.openAt);
    return {
      id: canonicalCapsuleId(capsule.id),
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

    const faved = await this.getFavoriteIds(rows.map((c) => c.id), userId);
    const items = rows.map((c) => this.toListItem(c, c.owner, faved.has(c.id)));
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
