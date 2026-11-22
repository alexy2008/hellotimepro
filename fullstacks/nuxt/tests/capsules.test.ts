import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import Database from "better-sqlite3";
import { addCalendarYears } from "../lib/fmt";
import { createCapsuleSchema, registerSchema } from "../lib/validation/schemas";
import { createCapsule, deleteOwnCapsule, getPlazaDetail } from "../server/services/capsules";
import { addFavorite, removeFavorite } from "../server/services/favorites";
import { myCapsules, myFavorites, myStats, plazaList, plazaStats } from "../server/services/plaza";

test("日历年上限在 UTC 闰日回退到月底", () => {
  const leapDay = Date.parse("2028-02-29T23:59:59.999Z");
  assert.equal(new Date(addCalendarYears(leapDay, 10)).toISOString(), "2038-02-28T23:59:59.999Z");
  assert.equal(new Date(addCalendarYears(leapDay, 4)).toISOString(), "2032-02-29T23:59:59.999Z");
});

test("标题、正文、昵称按 Unicode 码点校验", () => {
  const draft = { title: "🚲".repeat(60), content: "𠮷".repeat(5000), openAt: "2030-01-01T00:00:00Z" };
  assert.equal(createCapsuleSchema.safeParse(draft).success, true);
  assert.equal(createCapsuleSchema.safeParse({ ...draft, title: draft.title + "字" }).success, false);
  const account = { email: "test@example.test", password: "abc12345", avatarId: "neo" };
  assert.equal(registerSchema.safeParse({ ...account, nickname: "𠮷".repeat(20) }).success, true);
  assert.equal(registerSchema.safeParse({ ...account, nickname: "𠮷".repeat(21) }).success, false);
});

test("SQLite 收藏与统计兼容种子格式，关闭外键也会显式删除收藏", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "hellotime-nuxt-test-"));
  const path = join(root, "capsules.sqlite");
  const oldDriver = process.env.DB_DRIVER;
  const oldUrl = process.env.DB_URL;
  process.env.DB_DRIVER = "sqlite";
  process.env.DB_URL = `sqlite:///${path}`;
  const sqlite = new Database(path);
  t.after(() => {
    sqlite.close();
    rmSync(root, { recursive: true, force: true });
    if (oldDriver === undefined) delete process.env.DB_DRIVER;
    else process.env.DB_DRIVER = oldDriver;
    if (oldUrl === undefined) delete process.env.DB_URL;
    else process.env.DB_URL = oldUrl;
  });

  const schema = readFileSync(new URL("../drizzle/sqlite/0001_init.sql", import.meta.url), "utf8");
  sqlite.exec(schema);
  const pragma = Database.prototype.pragma;
  // 让服务使用关闭外键的连接，验证删除无需依赖 ON DELETE CASCADE。
  t.mock.method(Database.prototype, "pragma", function (this: Database.Database, source: string, options?: Database.PragmaOptions) {
    return pragma.call(this, source === "foreign_keys = ON" ? "foreign_keys = OFF" : source, options);
  });

  const rawOwner = "11111111111111111111111111111111";
  const rawCapsule = "22222222222222222222222222222222";
  const id = "22222222-2222-2222-2222-222222222222";
  const past = "2020-03-01T03:04:05.000000+00:00";
  const future = new Date(Date.now() + 3_600_000).toISOString();
  sqlite.prepare("INSERT INTO users VALUES (?, ?, ?, ?, 'neo', ?, ?)")
    .run(rawOwner, "test@example.test", "unused", "Étoile", past, past);
  const seed = sqlite.prepare(
    "INSERT INTO capsules (id, owner_id, code, title, content, open_at, in_plaza, created_at, updated_at) VALUES (?, ?, ?, ?, '正文', ?, ?, ?, ?)",
  );
  seed.run(rawCapsule, rawOwner, "TEST0001", "百分号 %_\\", past, 1, past, past);

  await t.test("列表与统计共享字面搜索，最远和最近开启时刻独立计算", async () => {
    const next = await createCapsule(rawOwner, { title: "未来", content: "未来正文", openAt: future });
    const found = await plazaList({ sort: "new", filter: "all", q: "%_\\", page: 1, pageSize: 20, viewerId: null });
    assert.deepEqual(found.items.map((item) => item.id), [id]);
    const stats = await plazaStats("%_\\");
    assert.deepEqual(stats.counts, { all: 1, opened: 1, unopened: 0 });
    assert.deepEqual(await plazaStats("éTOILE"), { ...stats, counts: { all: 2, opened: 1, unopened: 1 } });
    assert.equal(stats.nextOpenAt, next.openAt);
    assert.equal(stats.farthestOpenAt, next.openAt);
  });

  await t.test("无效路径 UUID 与不存在的标准 UUID 返回不同结果", async () => {
    const invalid = { code: "VALIDATION_ERROR", status: 422 };
    await assert.rejects(getPlazaDetail("bad-id", null), invalid);
    await assert.rejects(deleteOwnCapsule(rawOwner, "bad-id"), invalid);
    await assert.rejects(removeFavorite(rawOwner, "bad-id"), invalid);
    const absent = "ffffffff-ffff-ffff-ffff-ffffffffffff";
    await assert.rejects(getPlazaDetail(absent, null), { status: 404 });
    await removeFavorite(rawOwner, absent);
  });

  await t.test("并发重复收藏幂等，私密胶囊可以收藏且删除后无残留", async () => {
    sqlite.prepare("UPDATE capsules SET in_plaza = 0 WHERE id = ?").run(rawCapsule);
    const results = await Promise.all(Array.from({ length: 6 }, () => addFavorite(rawOwner, id)));
    assert.deepEqual(results.map((result) => result.favoriteCount), [1, 1, 1, 1, 1, 1]);
    assert.equal(new Set(results.map((result) => result.favoritedAt)).size, 1);
    assert.equal(results[0].capsuleId, id);

    const opts = { userId: rawOwner, page: 1, pageSize: 20 };
    const created = await myCapsules(opts);
    assert.equal(created.items.find((item) => item.id === id)?.favoritedByMe, true);
    const favorites = await myFavorites(opts);
    assert.equal(favorites.items[0].inPlaza, false);
    const stats = await myStats(rawOwner);
    assert.equal(stats.favoritesGiven, 1);
    assert.equal(stats.favoritesReceived, 1);

    await deleteOwnCapsule(rawOwner, id);
    assert.equal((await myFavorites(opts)).pagination.total, 0);
    assert.equal((await myStats(rawOwner)).favoritesReceived, 0);
    assert.equal((await plazaStats("%_\\")).counts.all, 0);
  });
});
