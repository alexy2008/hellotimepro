/**
 * capsules-sealed.spec.ts · 未开启胶囊的行为
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { api, createCapsule, register } from "./_helpers.ts";

test("未开启胶囊：byCode 查询 content=null, isOpened=false, openAt 在未来", async () => {
  const u = await register();
  const cap = await createCapsule(u.accessToken, { openAtSeconds: 7200 });
  const r = await api<{
    content: string | null;
    isOpened: boolean;
    openAt: string;
    favoriteCount: number;
  }>("GET", `/api/v1/capsules/${cap.code}`);
  assert.equal(r.status, 200);
  assert.equal(r.body.data!.content, null);
  assert.equal(r.body.data!.isOpened, false);
  assert.ok(new Date(r.body.data!.openAt).getTime() > Date.now());
});

test("未开启胶囊：inPlaza=true 出现在广场列表，列表项不含 content", async () => {
  const u = await register();
  const cap = await createCapsule(u.accessToken, { openAtSeconds: 3600 });
  const r = await api<{ items: Array<{ id: string; isOpened: boolean } & Record<string, unknown>> }>(
    "GET",
    "/api/v1/plaza/capsules?sort=new&pageSize=50",
  );
  assert.equal(r.status, 200);
  const found = r.body.data!.items.find((i) => i.id === cap.id);
  assert.ok(found, "未开启 public 胶囊应出现在广场");
  assert.equal(found!.isOpened, false);
  assert.ok(!("content" in found!), "列表项不应含 content");
});

test("未开启胶囊：作者视角同样看到 content=null（无特权预览）", async () => {
  const u = await register();
  const cap = await createCapsule(u.accessToken, { openAtSeconds: 3600 });
  const r = await api<{ content: string | null }>(
    "GET",
    `/api/v1/plaza/capsules/${cap.id}`,
    { token: u.accessToken },
  );
  assert.equal(r.status, 200);
  assert.equal(r.body.data!.content, null);
});

test("未开启胶囊：inPlaza=false 不在广场列表，但 byCode 仍可见", async () => {
  const u = await register();
  const cap = await createCapsule(u.accessToken, { openAtSeconds: 3600, inPlaza: false });
  const list = await api<{ items: Array<{ id: string }> }>(
    "GET",
    "/api/v1/plaza/capsules?sort=new&pageSize=50",
  );
  assert.ok(!list.body.data!.items.some((i) => i.id === cap.id));

  const byCode = await api("GET", `/api/v1/capsules/${cap.code}`);
  assert.equal(byCode.status, 200);
});

test("inPlaza=false 走广场详情 → 404", async () => {
  const u = await register();
  const cap = await createCapsule(u.accessToken, { openAtSeconds: 3600, inPlaza: false });
  const r = await api("GET", `/api/v1/plaza/capsules/${cap.id}`);
  assert.equal(r.status, 404);
  assert.equal(r.body.errorCode, "NOT_FOUND");
});
