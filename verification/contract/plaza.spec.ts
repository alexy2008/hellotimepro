/**
 * plaza.spec.ts · 广场列表 & 详情
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { api, createCapsule, register, rand } from "./_helpers.ts";

test("GET /api/v1/plaza/capsules 默认 sort=new 按 createdAt DESC", async () => {
  const u = await register();
  const c1 = await createCapsule(u.accessToken, { title: "first" });
  await new Promise((r) => setTimeout(r, 20));
  const c2 = await createCapsule(u.accessToken, { title: "second" });
  const r = await api<{
    items: Array<{ id: string }>;
    pagination: { page: number; pageSize: number; total: number; totalPages: number };
  }>("GET", "/api/v1/plaza/capsules?sort=new&pageSize=50");
  assert.equal(r.status, 200);
  const idx1 = r.body.data!.items.findIndex((i) => i.id === c1.id);
  const idx2 = r.body.data!.items.findIndex((i) => i.id === c2.id);
  assert.ok(idx1 >= 0 && idx2 >= 0);
  assert.ok(idx2 < idx1, "更晚创建的应排在前面");
});

test("GET /api/v1/plaza/capsules?sort=hot 按 favoriteCount DESC", async () => {
  const owner = await register();
  const fan = await register();
  const c1 = await createCapsule(owner.accessToken, { title: `hot-${rand(3)}` });
  const c2 = await createCapsule(owner.accessToken, { title: `hot-${rand(3)}` });
  // 给 c2 点赞
  const fav = await api("POST", "/api/v1/me/favorites", {
    token: fan.accessToken,
    json: { capsuleId: c2.id },
  });
  assert.equal(fav.status, 200);

  const r = await api<{ items: Array<{ id: string; favoriteCount: number }> }>(
    "GET",
    "/api/v1/plaza/capsules?sort=hot&pageSize=50",
  );
  const idx1 = r.body.data!.items.findIndex((i) => i.id === c1.id);
  const idx2 = r.body.data!.items.findIndex((i) => i.id === c2.id);
  assert.ok(idx2 < idx1, "favoriteCount 高的在前");
});

test("GET /api/v1/plaza/capsules 仅返回 inPlaza=true", async () => {
  const u = await register();
  const privy = await createCapsule(u.accessToken, { inPlaza: false });
  const r = await api<{ items: Array<{ id: string }> }>(
    "GET",
    "/api/v1/plaza/capsules?pageSize=50",
  );
  assert.ok(!r.body.data!.items.some((i) => i.id === privy.id));
});

test("GET /api/v1/plaza/capsules 列表项形状：不含 content，含 creator/isOpened/favoritedByMe", async () => {
  const u = await register();
  await createCapsule(u.accessToken);
  const r = await api<{
    items: Array<
      Record<string, unknown> & {
        creator: { nickname: string; avatarId: string };
        isOpened: boolean;
        favoritedByMe: boolean;
      }
    >;
  }>("GET", "/api/v1/plaza/capsules?pageSize=50");
  assert.ok(r.body.data!.items.length >= 1);
  for (const it of r.body.data!.items) {
    assert.ok(!("content" in it), "列表项不应含 content");
    assert.ok(typeof it.creator.nickname === "string");
    assert.ok(typeof it.creator.avatarId === "string");
    assert.equal(typeof it.isOpened, "boolean");
    assert.equal(typeof it.favoritedByMe, "boolean");
  }
});

test("GET /api/v1/plaza/capsules 匿名时 favoritedByMe 恒 false", async () => {
  const u = await register();
  await createCapsule(u.accessToken);
  const r = await api<{ items: Array<{ favoritedByMe: boolean }> }>(
    "GET",
    "/api/v1/plaza/capsules?pageSize=50",
  );
  assert.ok(r.body.data!.items.every((i) => i.favoritedByMe === false));
});

test("pagination：pageSize 最大 50，超出 → 422", async () => {
  const r = await api("GET", "/api/v1/plaza/capsules?pageSize=51");
  assert.equal(r.status, 422);
  assert.equal(r.body.errorCode, "VALIDATION_ERROR");
});

test("pagination：响应含 page/pageSize/total/totalPages", async () => {
  const u = await register();
  await createCapsule(u.accessToken);
  const r = await api<{
    pagination: { page: number; pageSize: number; total: number; totalPages: number };
  }>("GET", "/api/v1/plaza/capsules?page=1&pageSize=5");
  assert.equal(r.body.data!.pagination.page, 1);
  assert.equal(r.body.data!.pagination.pageSize, 5);
  assert.ok(Number.isInteger(r.body.data!.pagination.total));
  assert.ok(Number.isInteger(r.body.data!.pagination.totalPages));
});

test("filter=xxx 非法值 → 422", async () => {
  const r = await api("GET", "/api/v1/plaza/capsules?filter=garbage");
  assert.equal(r.status, 422);
});

test("sort=xxx 非法值 → 422", async () => {
  const r = await api("GET", "/api/v1/plaza/capsules?sort=garbage");
  assert.equal(r.status, 422);
});

test("q 模糊搜索：title 大小写不敏感", async () => {
  const u = await register();
  const keyword = `Needle${rand(4)}`;
  const cap = await createCapsule(u.accessToken, { title: `prefix ${keyword} suffix` });
  const r = await api<{ items: Array<{ id: string }> }>(
    "GET",
    `/api/v1/plaza/capsules?q=${encodeURIComponent(keyword.toLowerCase())}&pageSize=50`,
  );
  assert.ok(r.body.data!.items.some((i) => i.id === cap.id));
});

test("q 模糊搜索：creator.nickname", async () => {
  const u = await register();
  const cap = await createCapsule(u.accessToken);
  const r = await api<{ items: Array<{ id: string }> }>(
    "GET",
    `/api/v1/plaza/capsules?q=${encodeURIComponent(u.nickname)}&pageSize=50`,
  );
  assert.ok(r.body.data!.items.some((i) => i.id === cap.id));
});

test("q trim 后为空视为未传（返回全部）", async () => {
  const u = await register();
  await createCapsule(u.accessToken);
  const r1 = await api<{ pagination: { total: number } }>(
    "GET",
    "/api/v1/plaza/capsules?q=%20%20&pageSize=50",
  );
  const r2 = await api<{ pagination: { total: number } }>(
    "GET",
    "/api/v1/plaza/capsules?pageSize=50",
  );
  assert.equal(r1.body.data!.pagination.total, r2.body.data!.pagination.total);
});

test("q 超长（51 字符）→ 422", async () => {
  const r = await api("GET", `/api/v1/plaza/capsules?q=${"x".repeat(51)}`);
  assert.equal(r.status, 422);
});

test("GET /api/v1/plaza/capsules/{id} 返回 CapsuleDetail", async () => {
  const u = await register();
  const cap = await createCapsule(u.accessToken);
  const r = await api<{ id: string; content: string | null; code: string }>(
    "GET",
    `/api/v1/plaza/capsules/${cap.id}`,
  );
  assert.equal(r.status, 200);
  assert.equal(r.body.data!.id, cap.id);
  assert.equal(r.body.data!.code, cap.code);
});
