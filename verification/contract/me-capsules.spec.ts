/**
 * me-capsules.spec.ts · 我创建的胶囊
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { api, createCapsule, register } from "./_helpers.ts";

test("GET /api/v1/me/capsules 按 createdAt DESC 列出我的全部胶囊", async () => {
  const u = await register();
  const a = await createCapsule(u.accessToken, { title: "first" });
  await new Promise((r) => setTimeout(r, 20));
  const b = await createCapsule(u.accessToken, { title: "second", inPlaza: false });

  const r = await api<{
    items: Array<{ id: string; inPlaza: boolean }>;
    pagination: { total: number };
  }>("GET", "/api/v1/me/capsules?pageSize=50", { token: u.accessToken });
  assert.equal(r.status, 200);
  assert.equal(r.body.data!.pagination.total, 2);
  assert.equal(r.body.data!.items[0].id, b.id);
  assert.equal(r.body.data!.items[1].id, a.id);
  // inPlaza=false 也在列表中（是我创建的）
  assert.ok(r.body.data!.items.some((i) => !i.inPlaza));
});

test("GET /api/v1/me/capsules 未登录 → 401", async () => {
  const r = await api("GET", "/api/v1/me/capsules");
  assert.equal(r.status, 401);
});

test("GET /api/v1/me/capsules 分页 page/pageSize 生效", async () => {
  const u = await register();
  const created: string[] = [];
  for (let i = 0; i < 3; i++) {
    const c = await createCapsule(u.accessToken, { title: `p-${i}` });
    created.push(c.id);
    await new Promise((r) => setTimeout(r, 10));
  }
  const r = await api<{
    items: Array<{ id: string }>;
    pagination: { page: number; pageSize: number; total: number; totalPages: number };
  }>("GET", "/api/v1/me/capsules?page=2&pageSize=2", { token: u.accessToken });
  assert.equal(r.status, 200);
  assert.equal(r.body.data!.pagination.page, 2);
  assert.equal(r.body.data!.pagination.pageSize, 2);
  assert.equal(r.body.data!.pagination.total, 3);
  assert.equal(r.body.data!.pagination.totalPages, 2);
  assert.equal(r.body.data!.items.length, 1);
});

test("DELETE /api/v1/me/capsules/{id} 成功 204 + 级联删除收藏关系", async () => {
  const owner = await register();
  const fan = await register();
  const cap = await createCapsule(owner.accessToken);
  await api("POST", "/api/v1/me/favorites", {
    token: fan.accessToken,
    json: { capsuleId: cap.id },
  });

  const del = await api("DELETE", `/api/v1/me/capsules/${cap.id}`, {
    token: owner.accessToken,
  });
  assert.equal(del.status, 204);

  // fan 的 /me/favorites 不应再含此条
  const list = await api<{ items: Array<{ id: string }> }>(
    "GET",
    "/api/v1/me/favorites",
    { token: fan.accessToken },
  );
  assert.ok(!list.body.data!.items.some((i) => i.id === cap.id));
});
