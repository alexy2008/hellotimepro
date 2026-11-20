import 'reflect-metadata';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DataSource } from 'typeorm';
import { validateOpenAt } from '../capsules/capsule-rules';
import type { CapsulesService } from '../capsules/capsules.service';
import type { User } from '../entities/user.entity';
import type { FavoritesService } from '../favorites/favorites.service';
import type { PlazaService } from './plaza.service';

let dataSource: DataSource;
let capsules: CapsulesService;
let favorites: FavoritesService;
let plaza: PlazaService;
const previousDriver = process.env.DB_DRIVER;

beforeAll(async () => {
  process.env.DB_DRIVER = 'sqlite';
  const { Capsule } = await import('../entities/capsule.entity');
  const { Favorite } = await import('../entities/favorite.entity');
  const { User } = await import('../entities/user.entity');
  const { CapsulesService } = await import('../capsules/capsules.service');
  const { FavoritesService } = await import('../favorites/favorites.service');
  const { PlazaService } = await import('./plaza.service');
  dataSource = await new DataSource({
    type: 'better-sqlite3',
    database: ':memory:',
    entities: [Capsule, Favorite, User],
  }).initialize();
  const schema = readFileSync(resolve(__dirname, '../../../../spec/db/schema.sqlite.sql'), 'utf8');
  for (const statement of schema.split(';').map((part) => part.trim()).filter(Boolean)) {
    await dataSource.query(statement);
  }
  await dataSource.query('PRAGMA foreign_keys = OFF');
  const capsuleRepo = dataSource.getRepository(Capsule);
  const favoriteRepo = dataSource.getRepository(Favorite);
  capsules = new CapsulesService(capsuleRepo, favoriteRepo, dataSource.getRepository(User));
  favorites = new FavoritesService(dataSource);
  plaza = new PlazaService(capsuleRepo, favoriteRepo);
});

afterAll(async () => {
  if (previousDriver === undefined) delete process.env.DB_DRIVER;
  else process.env.DB_DRIVER = previousDriver;
  if (dataSource?.isInitialized) await dataSource.destroy();
});

beforeEach(async () => {
  for (const table of ['favorites', 'capsules', 'users']) await dataSource.query('DELETE FROM ' + table);
});

async function addUser(id: string, nickname: string): Promise<User> {
  const user = {
    id, nickname, email: nickname.toLowerCase() + '@example.test', avatarId: 'neo',
    passwordHash: 'test', createdAt: new Date(), updatedAt: new Date(),
  };
  await dataSource.getRepository<User>('User').save(user);
  return user;
}

describe('胶囊 2.0 规则', () => {
  it('广场统计与列表使用同一套字面搜索，开启时刻仍覆盖整个广场', async () => {
    expect(await plaza.plazaStats(undefined)).toEqual({
      counts: { all: 0, opened: 0, unopened: 0 }, farthestOpenAt: null, nextOpenAt: null,
    });
    const author = await addUser('550e8400-e29b-41d4-a716-446655440000', 'Writer_One');
    const other = await addUser('550e8400-e29b-41d4-a716-446655440001', 'WriterXOne');
    const now = Date.now();
    const next = new Date(now + 3_600_000);
    const farthest = new Date(now + 7_200_000);
    await capsules.create(author, { title: 'Report%_\\', content: 'test', openAt: next.toISOString() });
    await capsules.create(other, { title: 'ReportXYZ', content: 'test', openAt: farthest.toISOString() });
    await capsules.create(author, {
      title: 'Report%_\\', content: 'test', openAt: new Date(now + 10_800_000).toISOString(), inPlaza: false,
    });
    for (const q of ['  REPORT%_\\  ', '\\', '%', '_', 'WRITER_ONE']) {
      expect(await plaza.plazaStats(q)).toEqual({
        counts: { all: 1, opened: 0, unopened: 1 }, farthestOpenAt: farthest, nextOpenAt: next,
      });
      for (const [filter, total] of [['all', 1], ['opened', 0], ['unopened', 1]] as const) {
        const page = await plaza.plazaList({ sort: 'new', filter, q, page: 1, pageSize: 20, viewerId: null });
        expect(page.pagination.total).toBe(total);
        expect(page.items).toHaveLength(total);
      }
    }
    await expect(plaza.plazaStats('字'.repeat(51))).rejects.toMatchObject({ errorCode: 'VALIDATION_ERROR' });
  });

  it('可收藏自己未公开的胶囊，且无需外键级联就能清理所有收藏', async () => {
    const owner = await addUser('550e8400-e29b-41d4-a716-446655440002', 'Owner');
    const viewer = await addUser('550e8400-e29b-41d4-a716-446655440003', 'Viewer');
    const id = '550e8400-e29b-41d4-a716-446655440004';
    const now = Date.now();
    await dataSource.query(
      'INSERT INTO capsules (id, owner_id, code, title, content, open_at, in_plaza, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)',
      [id.replace(/-/g, ''), owner.id, 'TEST0001', 'Private', 'test',
        new Date(now + 3_600_000).toISOString(), new Date(now).toISOString(), new Date(now).toISOString()],
    );
    await expect(favorites.addFavorite(owner.id, 'not-a-uuid')).rejects.toMatchObject({ errorCode: 'VALIDATION_ERROR' });
    const first = await favorites.addFavorite(owner.id, id);
    expect(first).toMatchObject({ capsuleId: id, favoriteCount: 1 });
    expect(await favorites.addFavorite(owner.id, id)).toEqual(first);
    await favorites.addFavorite(viewer.id, id);
    expect((await plaza.myCapsules(owner.id, 1, 20)).items[0]).toMatchObject({
      id, favoritedByMe: true, favoritedAt: null,
    });
    expect((await plaza.myFavorites(viewer.id, 1, 20)).items[0]).toMatchObject({ id, inPlaza: false });
    expect(await plaza.myStats(owner.id)).toEqual({
      created: 1, opened: 0, unopened: 1, inPlaza: 0, favoritesReceived: 2, favoritesGiven: 1,
    });
    await capsules.deleteOwn(owner, id);
    expect(await dataSource.query('SELECT * FROM favorites')).toEqual([]);
    for (const user of [owner, viewer]) {
      expect(await plaza.myStats(user.id)).toEqual({
        created: 0, opened: 0, unopened: 0, inPlaza: 0, favoritesReceived: 0, favoritesGiven: 0,
      });
    }
  });

  it('按 UTC 日历年封顶，2 月 29 日回退到 2 月末', () => {
    const now = new Date('2028-03-01T01:30:45.123+08:00');
    const limit = new Date('2038-02-28T17:30:45.123Z');
    expect(() => validateOpenAt(new Date(now.getTime() + 60_000).toISOString(), now)).toThrow();
    expect(validateOpenAt(new Date(now.getTime() + 60_001).toISOString(), now).getTime()).toBe(now.getTime() + 60_001);
    expect(validateOpenAt(limit.toISOString(), now)).toEqual(limit);
    expect(() => validateOpenAt(new Date(limit.getTime() + 1).toISOString(), now)).toThrow();
  });
});
