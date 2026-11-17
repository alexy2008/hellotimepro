/**
 * favorites.spec.ts · 收藏 / 取消 / 我的收藏
 *
 * 2.0.0：收藏不校验胶囊状态——自己的、inPlaza=false 的都能收藏，只要求胶囊存在。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { api, createCapsule, register } from "./_helpers.ts";

test("POST /api/v1/me/favorites 首次 → 200，返回 {capsuleId, favoriteCount, favoritedAt}", async () => {
  const owner = await register();
  const fan = await register();
  const cap = await createCapsule(owner.accessToken);
  const r = await api<{ capsuleId: string; favoriteCount: number; favoritedAt: string }>(
    "POST",
    "/api/v1/me/favorites",
    { token: fan.accessToken, json: { capsuleId: cap.id } },
  );
  assert.equal(r.status, 200);
  assert.equal(r.body.success, true);
  assert.equal(r.body.data!.capsuleId, cap.id);
  assert.equal(r.body.data!.favoriteCount, 1);
  assert.ok(!Number.isNaN(new Date(r.body.data!.favoritedAt).getTime()));
});

test("POST /api/v1/me/favorites 重复收藏幂等 → 200，count 不变", async () => {
  const owner = await register();
  const fan = await register();
  const cap = await createCapsule(owner.accessToken);
  await api("POST", "/api/v1/me/favorites", {
    token: fan.accessToken,
    json: { capsuleId: cap.id },
  });
  const r = await api<{ favoriteCount: number }>("POST", "/api/v1/me/favorites", {
    token: fan.accessToken,
    json: { capsuleId: cap.id },
  });
  assert.equal(r.status, 200);
  assert.equal(r.body.data!.favoriteCount, 1);
});

test("DELETE /api/v1/me/favorites/{id} 已收藏 → 204", async () => {
  const owner = await register();
  const fan = await register();
  const cap = await createCapsule(owner.accessToken);
  await api("POST", "/api/v1/me/favorites", {
    token: fan.accessToken,
    json: { capsuleId: cap.id },
  });
  const r = await api("DELETE", `/api/v1/me/favorites/${cap.id}`, {
    token: fan.accessToken,
  });
  assert.equal(r.status, 204);
  assert.equal(r.raw, "");

  // 广场应该看到 favoriteCount=0
  const plaza = await api<{ items: Array<{ id: string; favoriteCount: number }> }>(
    "GET",
    "/api/v1/plaza/capsules?pageSize=50",
  );
  const got = plaza.body.data!.items.find((i) => i.id === cap.id)!;
  assert.equal(got.favoriteCount, 0);
});

test("DELETE /api/v1/me/favorites/{id} 未收藏也 → 204（幂等）", async () => {
  const owner = await register();
  const fan = await register();
  const cap = await createCapsule(owner.accessToken);
  const r = await api("DELETE", `/api/v1/me/favorites/${cap.id}`, {
    token: fan.accessToken,
  });
  assert.equal(r.status, 204);
});

test("POST /api/v1/me/favorites 收藏自己的胶囊 → 200，「我创建的」里 favoritedByMe=true", async () => {
  const u = await register();
  const cap = await createCapsule(u.accessToken);
  const r = await api<{ favoriteCount: number }>("POST", "/api/v1/me/favorites", {
    token: u.accessToken,
    json: { capsuleId: cap.id },
  });
  assert.equal(r.status, 200);
  assert.equal(r.body.data!.favoriteCount, 1);

  const mine = await api<{ items: Array<{ id: string; favoritedByMe: boolean; favoriteCount: number }> }>(
    "GET",
    "/api/v1/me/capsules?pageSize=50",
    { token: u.accessToken },
  );
  const row = mine.body.data!.items.find((i) => i.id === cap.id)!;
  assert.equal(row.favoritedByMe, true);
  assert.equal(row.favoriteCount, 1);
});

test("POST /api/v1/me/favorites 未登录 → 401", async () => {
  const r = await api("POST", "/api/v1/me/favorites", {
    json: { capsuleId: "00000000-0000-0000-0000-000000000000" },
  });
  assert.equal(r.status, 401);
});

test("POST /api/v1/me/favorites 对不存在的胶囊 → 404", async () => {
  const u = await register();
  const r = await api("POST", "/api/v1/me/favorites", {
    token: u.accessToken,
    json: { capsuleId: "00000000-0000-0000-0000-000000000000" },
  });
  assert.equal(r.status, 404);
  assert.equal(r.body.errorCode, "NOT_FOUND");
});

test("POST /api/v1/me/favorites 对 inPlaza=false 的胶囊 → 200，并出现在「我收藏的」", async () => {
  const owner = await register();
  const fan = await register();
  const cap = await createCapsule(owner.accessToken, { inPlaza: false });
  // 收藏者凭码拿到 id：码即凭证
  const byCode = await api<{ id: string }>("GET", `/api/v1/capsules/${cap.code}`);
  assert.equal(byCode.body.data!.id, cap.id);

  const r = await api("POST", "/api/v1/me/favorites", {
    token: fan.accessToken,
    json: { capsuleId: cap.id },
  });
  assert.equal(r.status, 200);

  const list = await api<{ items: Array<{ id: string; code: string; inPlaza: boolean }> }>(
    "GET",
    "/api/v1/me/favorites?pageSize=50",
    { token: fan.accessToken },
  );
  const row = list.body.data!.items.find((i) => i.id === cap.id);
  assert.ok(row, "未公开的胶囊也应出现在我收藏的");
  assert.equal(row!.inPlaza, false);
  assert.equal(row!.code, cap.code);
});

test("POST /api/v1/me/favorites capsuleId 不是合法 UUID → 422 VALIDATION_ERROR", async () => {
  const u = await register();
  const r = await api("POST", "/api/v1/me/favorites", {
    token: u.accessToken,
    json: { capsuleId: "not-a-uuid" },
  });
  assert.equal(r.status, 422);
  assert.equal(r.body.errorCode, "VALIDATION_ERROR");
});

test("GET /api/v1/me/favorites 列表按收藏时间 DESC，含 favoritedAt", async () => {
  const owner = await register();
  const fan = await register();
  const c1 = await createCapsule(owner.accessToken);
  const c2 = await createCapsule(owner.accessToken);
  await api("POST", "/api/v1/me/favorites", {
    token: fan.accessToken,
    json: { capsuleId: c1.id },
  });
  await new Promise((r) => setTimeout(r, 20));
  await api("POST", "/api/v1/me/favorites", {
    token: fan.accessToken,
    json: { capsuleId: c2.id },
  });
  const r = await api<{
    items: Array<{ id: string; favoritedAt: string; favoritedByMe: boolean }>;
  }>("GET", "/api/v1/me/favorites?pageSize=50", { token: fan.accessToken });
  assert.equal(r.status, 200);
  assert.equal(r.body.data!.items.length, 2);
  assert.equal(r.body.data!.items[0].id, c2.id, "最新收藏在前");
  assert.ok(r.body.data!.items.every((i) => i.favoritedByMe === true));
  assert.ok(r.body.data!.items.every((i) => typeof i.favoritedAt === "string"));
});

test("GET /api/v1/me/favorites 未登录 → 401", async () => {
  const r = await api("GET", "/api/v1/me/favorites");
  assert.equal(r.status, 401);
});
