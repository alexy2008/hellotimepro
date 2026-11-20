import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { env, specRoot } from "../config";
import { closeDb, query } from "../db";
import { dbTimestamp } from "../types";
import { createCapsule, deleteOwnCapsule, validateOpenAt } from "./capsules";
import { addFavorite, removeFavorite } from "./favorites";
import { myCapsules, myFavorites, myStats, plazaList, plazaStats } from "./plaza";

const previous = { dbDriver: env.dbDriver, dbUrl: env.dbUrl };

describe("胶囊 2.0 规则", () => {
  beforeAll(async () => {
    env.dbDriver = "sqlite";
    env.dbUrl = ":memory:";
    const schema = await Bun.file(join(specRoot, "db", "schema.sqlite.sql")).text();
    for (const statement of schema.split(";").map((part) => part.trim()).filter(Boolean)) {
      await query(statement);
    }
    await query("PRAGMA foreign_keys = OFF");
  });

  beforeEach(async () => {
    for (const table of ["favorites", "capsules", "users"]) await query("DELETE FROM " + table);
  });

  afterAll(async () => {
    await closeDb();
    Object.assign(env, previous);
  });

  async function addUser(nickname: string) {
    const id = crypto.randomUUID();
    const now = dbTimestamp(new Date());
    await query(
      `INSERT INTO users (id, email, nickname, password_hash, avatar_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, nickname.toLowerCase() + "@example.test", nickname, "test", "neo", now, now],
    );
    return id;
  }

  test("广场计数与列表的字面搜索一致，时刻不受搜索影响", async () => {
    expect(await plazaStats(null)).toEqual({
      counts: { all: 0, opened: 0, unopened: 0 },
      farthestOpenAt: null,
      nextOpenAt: null,
    });
    const author = await addUser("Writer_One");
    const other = await addUser("WriterXOne");
    const now = Date.now();
    const next = new Date(now + 3_600_000).toISOString();
    const farthest = new Date(now + 7_200_000).toISOString();
    await createCapsule(author, { title: "Report%_\\", content: "test", openAt: next });
    await createCapsule(other, { title: "ReportXYZ", content: "test", openAt: farthest });
    await createCapsule(author, {
      title: "Report%_\\", content: "test", openAt: new Date(now + 10_800_000).toISOString(), inPlaza: false,
    });
    for (const search of ["  REPORT%_\\  ", "\\", "%", "_", "WRITER_ONE"]) {
      expect(await plazaStats(search)).toEqual({
        counts: { all: 1, opened: 0, unopened: 1 },
        farthestOpenAt: farthest,
        nextOpenAt: next,
      });
      for (const [filter, total] of [["all", 1], ["opened", 0], ["unopened", 1]] as const) {
        const page = await plazaList({ sort: "new", filter, q: search, page: 1, pageSize: 20, viewerId: null });
        expect(page.pagination.total).toBe(total);
        expect(page.items).toHaveLength(total);
      }
    }
    await expect(plazaStats("字".repeat(51))).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  test("可收藏自己未公开的胶囊，写入实际主键并显式清理收藏", async () => {
    const owner = await addUser("Owner");
    const viewer = await addUser("Viewer");
    const id = crypto.randomUUID();
    const now = new Date();
    await query(
      `INSERT INTO capsules (id, owner_id, code, title, content, open_at, in_plaza, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      [id.replace(/-/g, ""), owner, "TEST0001", "Private", "test", dbTimestamp(new Date(now.getTime() + 3_600_000)),
        dbTimestamp(now), dbTimestamp(now)],
    );
    await expect(addFavorite(owner, "not-a-uuid")).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    const first = await addFavorite(owner, id);
    expect(first).toMatchObject({ capsuleId: id, favoriteCount: 1 });
    expect(await addFavorite(owner, id)).toEqual(first);
    await addFavorite(viewer, id);
    expect((await myCapsules(owner, 1, 20)).items[0]).toMatchObject({ id, favoritedByMe: true, favoritedAt: null });
    expect((await myFavorites(viewer, 1, 20)).items[0]).toMatchObject({ id, inPlaza: false });
    expect(await myStats(owner)).toEqual({
      created: 1, opened: 0, unopened: 1, inPlaza: 0, favoritesReceived: 2, favoritesGiven: 1,
    });
    await removeFavorite(viewer, id);
    await removeFavorite(viewer, id);
    expect((await addFavorite(viewer, id)).favoriteCount).toBe(2);
    await deleteOwnCapsule(owner, id);
    expect(await query("SELECT * FROM favorites")).toEqual([]);
    for (const user of [owner, viewer]) {
      expect(await myStats(user)).toEqual({
        created: 0, opened: 0, unopened: 0, inPlaza: 0, favoritesReceived: 0, favoritesGiven: 0,
      });
    }
  });

  test("按 UTC 日历年封顶，2 月 29 日回退到 2 月末", () => {
    const now = new Date("2028-03-01T01:30:45.123+08:00");
    const limit = new Date("2038-02-28T17:30:45.123Z");
    expect(() => validateOpenAt(new Date(now.getTime() + 60_000).toISOString(), now)).toThrow();
    expect(validateOpenAt(new Date(now.getTime() + 60_001).toISOString(), now).getTime()).toBe(now.getTime() + 60_001);
    expect(validateOpenAt(limit.toISOString(), now)).toEqual(limit);
    expect(() => validateOpenAt(new Date(limit.getTime() + 1).toISOString(), now)).toThrow();
  });
});
