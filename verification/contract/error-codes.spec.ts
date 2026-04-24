/**
 * error-codes.spec.ts · errorCode ↔ HTTP 状态码严格映射
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { api, createCapsule, isoFuture, register, uniqueEmail, uniqueNickname } from "./_helpers.ts";

const ALLOWED = new Set([
  "VALIDATION_ERROR",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "RATE_LIMITED",
  "BAD_REQUEST",
  "INTERNAL_ERROR",
]);

test("VALIDATION_ERROR → 422，details[*].field/message", async () => {
  const r = await api<unknown>("POST", "/api/v1/auth/register", {
    json: {
      email: "not-email",
      password: "short",
      nickname: uniqueNickname(),
      avatarId: "neo",
    },
  });
  assert.equal(r.status, 422);
  assert.equal(r.body.errorCode, "VALIDATION_ERROR");
  if (r.body.details) {
    for (const d of r.body.details) {
      assert.ok(typeof d.field === "string");
      assert.ok(typeof d.message === "string");
    }
  }
});

test("UNAUTHORIZED → 401", async () => {
  const r = await api("GET", "/api/v1/me");
  assert.equal(r.status, 401);
  assert.equal(r.body.errorCode, "UNAUTHORIZED");
});

test("FORBIDDEN → 403（删他人胶囊）", async () => {
  const a = await register();
  const b = await register();
  const cap = await createCapsule(a.accessToken);
  const r = await api("DELETE", `/api/v1/me/capsules/${cap.id}`, { token: b.accessToken });
  assert.equal(r.status, 403);
  assert.equal(r.body.errorCode, "FORBIDDEN");
});

test("NOT_FOUND → 404", async () => {
  const r = await api("GET", "/api/v1/capsules/ZZZZZZZZ");
  assert.equal(r.status, 404);
  assert.equal(r.body.errorCode, "NOT_FOUND");
});

test("CONFLICT → 409（重复邮箱）", async () => {
  const u = await register();
  const r = await api("POST", "/api/v1/auth/register", {
    json: {
      email: u.email,
      password: "password1234",
      nickname: uniqueNickname(),
      avatarId: "neo",
    },
  });
  assert.equal(r.status, 409);
  assert.equal(r.body.errorCode, "CONFLICT");
});

test("BAD_REQUEST → 400（收藏自己）", async () => {
  const u = await register();
  const cap = await createCapsule(u.accessToken);
  const r = await api("POST", "/api/v1/me/favorites", {
    token: u.accessToken,
    json: { capsuleId: cap.id },
  });
  assert.equal(r.status, 400);
  assert.equal(r.body.errorCode, "BAD_REQUEST");
});

test("RATE_LIMITED → 429（登录高频失败）", async () => {
  const email = uniqueEmail();
  await register({ email });
  let hit = false;
  for (let i = 0; i < 20; i++) {
    const r = await api("POST", "/api/v1/auth/login", {
      json: { email, password: `wrong-${i}-password` },
    });
    if (r.status === 429) {
      assert.equal(r.body.errorCode, "RATE_LIMITED");
      hit = true;
      break;
    }
  }
  assert.ok(hit);
});

test("所有错误端点返回的 errorCode 都在允许枚举内", async () => {
  // 抽样若干已知错误场景
  const cases: Array<Promise<{ status: number; body: { errorCode: string | null } }>> = [
    api("GET", "/api/v1/me"), // 401
    api("GET", "/api/v1/capsules/ZZZZZZZZ"), // 404
    api("POST", "/api/v1/auth/register", {
      json: { email: "x", password: "x", nickname: "x", avatarId: "neo" },
    }), // 422
  ];
  const results = await Promise.all(cases);
  for (const r of results) {
    assert.ok(ALLOWED.has(r.body.errorCode as string), `未知 errorCode: ${r.body.errorCode}`);
  }
});

test("openAt 不合法 → VALIDATION_ERROR", async () => {
  const u = await register();
  const r = await api("POST", "/api/v1/capsules", {
    token: u.accessToken,
    json: { title: "t", content: "c", openAt: isoFuture(10) },
  });
  assert.equal(r.status, 422);
  assert.equal(r.body.errorCode, "VALIDATION_ERROR");
});
