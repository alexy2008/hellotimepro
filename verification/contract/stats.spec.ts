/**
 * stats.spec.ts · 2.0.0 新增的两个统计接口
 *
 * - GET /api/v1/plaza/stats：counts 与列表同口径（受 q 影响），farthestOpenAt / nextOpenAt 不受 q 影响
 * - GET /api/v1/me/stats：当前用户的胶囊与收藏统计
 *
 * 契约测试按文件并行运行，广场上的全局数字随时在变：
 * 需要精确相等的断言一律用「本测试独有的 q」把范围收窄到自己创建的胶囊。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { api, createCapsule, rand, register } from "./_helpers.ts";

type PlazaStats = {
  counts: { all: number; opened: number; unopened: number };
  farthestOpenAt: string | null;
  nextOpenAt: string | null;
};
type MyStats = {
  created: number;
  opened: number;
  unopened: number;
  inPlaza: number;
  favoritesReceived: number;
  favoritesGiven: number;
};

const TEN_YEARS_MINUS_A_DAY = 3600 * 24 * (365 * 10 - 1);

async function plazaTotal(q: string, filter: string): Promise<number> {
  const r = await api<{ pagination: { total: number } }>(
    "GET",
    `/api/v1/plaza/capsules?q=${encodeURIComponent(q)}&filter=${filter}&pageSize=1`,
  );
  return r.body.data!.pagination.total;
}

test("GET /api/v1/plaza/stats 公开可访问，形状正确且 all = opened + unopened", async () => {
  const r = await api<PlazaStats>("GET", "/api/v1/plaza/stats");
  assert.equal(r.status, 200);
  assert.equal(r.body.success, true);
  const d = r.body.data!;
  for (const k of ["all", "opened", "unopened"] as const) {
    assert.ok(Number.isInteger(d.counts[k]) && d.counts[k] >= 0, `counts.${k}`);
  }
  assert.equal(d.counts.all, d.counts.opened + d.counts.unopened);
  for (const k of ["farthestOpenAt", "nextOpenAt"] as const) {
    assert.ok(d[k] === null || !Number.isNaN(new Date(d[k]!).getTime()), k);
  }
});

test("GET /api/v1/plaza/stats?q= 只统计匹配的公开胶囊，与三种 filter 下列表的 total 一致", async () => {
  const u = await register();
  const tag = `stq${rand(8)}`;
  await createCapsule(u.accessToken, { title: `${tag} 一` });
  await createCapsule(u.accessToken, { title: `${tag} 二` });
  await createCapsule(u.accessToken, { title: `${tag} 私`, inPlaza: false });

  const r = await api<PlazaStats>("GET", `/api/v1/plaza/stats?q=${tag}`);
  assert.equal(r.status, 200);
  const c = r.body.data!.counts;
  assert.deepEqual(c, { all: 2, opened: 0, unopened: 2 }, "未公开的不计入；新建的都未开启");
  assert.equal(c.all, await plazaTotal(tag, "all"));
  assert.equal(c.opened, await plazaTotal(tag, "opened"));
  assert.equal(c.unopened, await plazaTotal(tag, "unopened"));
});

test("GET /api/v1/plaza/stats?q= 大小写不敏感、匹配昵称、前后空白 trim", async () => {
  const tag = `nk${rand(6)}`;
  const u = await register({ nickname: `${tag}Name` });
  await createCapsule(u.accessToken, { title: `title-${rand(6)}` });
  const r = await api<PlazaStats>(
    "GET",
    `/api/v1/plaza/stats?q=${encodeURIComponent(`  ${tag.toUpperCase()}NAME  `)}`,
  );
  assert.equal(r.status, 200);
  assert.equal(r.body.data!.counts.all, 1);
});

test("GET /api/v1/plaza/stats farthestOpenAt / nextOpenAt 不受 q 影响，且覆盖新建的胶囊", async () => {
  const u = await register();
  const tag = `far${rand(8)}`;
  const far = await createCapsule(u.accessToken, { title: tag, openAtSeconds: TEN_YEARS_MINUS_A_DAY });
  const farAt = new Date(far.openAt).getTime();

  const all = (await api<PlazaStats>("GET", "/api/v1/plaza/stats")).body.data!;
  const scoped = (await api<PlazaStats>("GET", `/api/v1/plaza/stats?q=${tag}`)).body.data!;
  assert.ok(all.farthestOpenAt !== null);
  assert.ok(new Date(all.farthestOpenAt!).getTime() >= farAt - 1000, "最远一枚不早于刚建的十年胶囊");
  assert.ok(all.nextOpenAt !== null);
  assert.ok(new Date(all.nextOpenAt!).getTime() > Date.now() - 1000, "nextOpenAt 在未来");
  assert.ok(new Date(all.nextOpenAt!).getTime() <= farAt + 1000);
  // q 只收窄 counts：两个时刻与不带 q 时一致（并行用例可能恰在两次请求之间新建胶囊，只要求不早于）
  assert.equal(scoped.counts.all, 1);
  assert.ok(new Date(scoped.farthestOpenAt!).getTime() >= new Date(all.farthestOpenAt!).getTime() - 1000);
});

test("GET /api/v1/plaza/stats q 超长（51 字符）→ 422 VALIDATION_ERROR", async () => {
  const r = await api("GET", `/api/v1/plaza/stats?q=${"x".repeat(51)}`);
  assert.equal(r.status, 422);
  assert.equal(r.body.errorCode, "VALIDATION_ERROR");
});

test("GET /api/v1/me/stats 未登录 → 401", async () => {
  const r = await api("GET", "/api/v1/me/stats");
  assert.equal(r.status, 401);
  assert.equal(r.body.errorCode, "UNAUTHORIZED");
});

test("GET /api/v1/me/stats 新用户全为 0", async () => {
  const u = await register();
  const r = await api<MyStats>("GET", "/api/v1/me/stats", { token: u.accessToken });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.data, {
    created: 0,
    opened: 0,
    unopened: 0,
    inPlaza: 0,
    favoritesReceived: 0,
    favoritesGiven: 0,
  });
});

test("GET /api/v1/me/stats 计入未公开的胶囊与自己的收藏，并与列表 total 一致", async () => {
  const me = await register();
  const fan = await register();
  const pub = await createCapsule(me.accessToken);
  const priv = await createCapsule(me.accessToken, { inPlaza: false });
  const theirs = await createCapsule(fan.accessToken);
  const fav = (token: string, id: string) =>
    api("POST", "/api/v1/me/favorites", { token, json: { capsuleId: id } });
  await fav(fan.accessToken, pub.id); // 我的胶囊被别人收藏
  await fav(me.accessToken, priv.id); // 收藏自己的未公开胶囊
  await fav(me.accessToken, theirs.id); // 收藏别人的

  const r = await api<MyStats>("GET", "/api/v1/me/stats", { token: me.accessToken });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.data, {
    created: 2,
    opened: 0,
    unopened: 2,
    inPlaza: 1,
    favoritesReceived: 2,
    favoritesGiven: 2,
  });

  const created = await api<{ pagination: { total: number } }>("GET", "/api/v1/me/capsules", {
    token: me.accessToken,
  });
  const favs = await api<{ pagination: { total: number } }>("GET", "/api/v1/me/favorites", {
    token: me.accessToken,
  });
  assert.equal(r.body.data!.created, created.body.data!.pagination.total);
  assert.equal(r.body.data!.favoritesGiven, favs.body.data!.pagination.total);
});

test("GET /api/v1/me/stats 删除胶囊后同步减少（含被收藏数）", async () => {
  const me = await register();
  const fan = await register();
  const cap = await createCapsule(me.accessToken);
  await api("POST", "/api/v1/me/favorites", { token: fan.accessToken, json: { capsuleId: cap.id } });
  await api("DELETE", `/api/v1/me/capsules/${cap.id}`, { token: me.accessToken });

  const mine = await api<MyStats>("GET", "/api/v1/me/stats", { token: me.accessToken });
  assert.equal(mine.body.data!.created, 0);
  assert.equal(mine.body.data!.favoritesReceived, 0);
  const theirs = await api<MyStats>("GET", "/api/v1/me/stats", { token: fan.accessToken });
  assert.equal(theirs.body.data!.favoritesGiven, 0);
});

test("GET /api/v1/plaza/stats?q= 不影响 nextOpenAt：更早开启但不匹配的胶囊仍是「最近一枚」", async () => {
  const u = await register();
  const tag = `nx${rand(8)}`;
  const matched = await createCapsule(u.accessToken, { title: `${tag} 很晚才开`, openAtSeconds: 3600 * 24 * 30 });
  const sooner = await createCapsule(u.accessToken, { title: `早一点 ${rand(6)}`, openAtSeconds: 90 });

  const scoped = (await api<PlazaStats>("GET", `/api/v1/plaza/stats?q=${tag}`)).body.data!;
  assert.equal(scoped.counts.all, 1);
  assert.ok(scoped.nextOpenAt !== null);
  // 若实现错误地按 q 过滤，nextOpenAt 会等于 matched 的开启时间
  assert.ok(new Date(scoped.nextOpenAt!).getTime() <= new Date(sooner.openAt).getTime() + 1000, "nextOpenAt 不应受 q 影响");
  assert.ok(new Date(scoped.nextOpenAt!).getTime() < new Date(matched.openAt).getTime());
});

test("q 按字面匹配：% 与 _ 不是通配符（列表与统计一致）", async () => {
  const u = await register();
  const tag = `lt${rand(8)}`;
  await createCapsule(u.accessToken, { title: `${tag}x_y` });
  await createCapsule(u.accessToken, { title: `${tag}xzy` });

  const under = (await api<PlazaStats>("GET", `/api/v1/plaza/stats?q=${encodeURIComponent(`${tag}x_y`)}`)).body.data!;
  assert.equal(under.counts.all, 1, "_ 只匹配字面下划线，不匹配 xzy");
  assert.equal(await plazaTotal(`${tag}x_y`, "all"), 1);

  const pct = (await api<PlazaStats>("GET", `/api/v1/plaza/stats?q=${encodeURIComponent(`${tag}%`)}`)).body.data!;
  assert.equal(pct.counts.all, 0, "% 只匹配字面百分号");
  assert.equal(await plazaTotal(`${tag}%`, "all"), 0);
});
