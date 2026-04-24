/**
 * capsules-create.spec.ts · 创建胶囊与按 code 查询
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { api, createCapsule, isoFuture, register } from "./_helpers.ts";

test("POST /api/v1/capsules 创建成功 201，返回完整 CapsuleDetail", async () => {
  const u = await register();
  const r = await api<{
    id: string;
    code: string;
    title: string;
    content: string | null;
    openAt: string;
    inPlaza: boolean;
    favoriteCount: number;
    isOpened: boolean;
    creator: { nickname: string; avatarId: string };
  }>("POST", "/api/v1/capsules", {
    token: u.accessToken,
    json: {
      title: "Hello",
      content: "secret",
      openAt: isoFuture(3600),
      inPlaza: true,
    },
  });
  assert.equal(r.status, 201);
  const d = r.body.data!;
  assert.match(d.code, /^[A-Z0-9]{8}$/);
  assert.equal(d.title, "Hello");
  assert.equal(d.content, null, "未开启胶囊 content 必为 null");
  assert.equal(d.isOpened, false);
  assert.equal(d.inPlaza, true);
  assert.equal(d.favoriteCount, 0);
  assert.equal(d.creator.nickname, u.nickname);
  assert.equal(d.creator.avatarId, u.avatarId);
});

test("POST /api/v1/capsules openAt ≤ now+60s → 422", async () => {
  const u = await register();
  const r = await api("POST", "/api/v1/capsules", {
    token: u.accessToken,
    json: { title: "t", content: "c", openAt: isoFuture(10) },
  });
  assert.equal(r.status, 422);
  assert.equal(r.body.errorCode, "VALIDATION_ERROR");
});

test("POST /api/v1/capsules openAt > now+10 年 → 422", async () => {
  const u = await register();
  const eleven_years = 11 * 365 * 24 * 3600;
  const r = await api("POST", "/api/v1/capsules", {
    token: u.accessToken,
    json: { title: "t", content: "c", openAt: isoFuture(eleven_years) },
  });
  assert.equal(r.status, 422);
});

test("POST /api/v1/capsules title > 60 → 422", async () => {
  const u = await register();
  const r = await api("POST", "/api/v1/capsules", {
    token: u.accessToken,
    json: { title: "x".repeat(61), content: "c", openAt: isoFuture(3600) },
  });
  assert.equal(r.status, 422);
});

test("POST /api/v1/capsules content > 5000 → 422", async () => {
  const u = await register();
  const r = await api("POST", "/api/v1/capsules", {
    token: u.accessToken,
    json: { title: "t", content: "x".repeat(5001), openAt: isoFuture(3600) },
  });
  assert.equal(r.status, 422);
});

test("POST /api/v1/capsules 无 token → 401", async () => {
  const r = await api("POST", "/api/v1/capsules", {
    json: { title: "t", content: "c", openAt: isoFuture(3600) },
  });
  assert.equal(r.status, 401);
  assert.equal(r.body.errorCode, "UNAUTHORIZED");
});

test("GET /api/v1/capsules/{code} 未开启 → content = null", async () => {
  const u = await register();
  const cap = await createCapsule(u.accessToken, { openAtSeconds: 3600 });
  const r = await api<{ content: string | null; code: string }>(
    "GET",
    `/api/v1/capsules/${cap.code}`,
  );
  assert.equal(r.status, 200);
  assert.equal(r.body.data!.code, cap.code);
  assert.equal(r.body.data!.content, null);
});

test("GET /api/v1/capsules/{code} 大小写不敏感", async () => {
  const u = await register();
  const cap = await createCapsule(u.accessToken, { openAtSeconds: 3600 });
  const r = await api<{ code: string }>(
    "GET",
    `/api/v1/capsules/${cap.code.toLowerCase()}`,
  );
  assert.equal(r.status, 200);
  assert.equal(r.body.data!.code, cap.code);
});

test("GET /api/v1/capsules/{code} 不存在 → 404", async () => {
  const r = await api("GET", "/api/v1/capsules/ZZZZZZZZ");
  assert.equal(r.status, 404);
  assert.equal(r.body.errorCode, "NOT_FOUND");
});

test("GET /api/v1/capsules/{code} code 格式错误（非 8 位）→ 422", async () => {
  const r = await api("GET", "/api/v1/capsules/abc");
  assert.equal(r.status, 422);
});
