/**
 * auth-errors.spec.ts · 鉴权 / 授权 / 限流错误
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { api, createCapsule, register, uniqueEmail } from "./_helpers.ts";

test("受保护端点缺 token → 401 UNAUTHORIZED", async () => {
  const r = await api("GET", "/api/v1/me");
  assert.equal(r.status, 401);
  assert.equal(r.body.success, false);
  assert.equal(r.body.errorCode, "UNAUTHORIZED");
});

test("受保护端点 token 格式非法 → 401", async () => {
  const r = await api("GET", "/api/v1/me", { token: "not-a-jwt" });
  assert.equal(r.status, 401);
  assert.equal(r.body.errorCode, "UNAUTHORIZED");
});

test("非 Bearer 前缀的 Authorization → 401", async () => {
  const r = await api("GET", "/api/v1/me", { headers: { Authorization: "Basic aGk6aGk=" } });
  assert.equal(r.status, 401);
});

test("DELETE /me/capsules/{id} 非所有者 → 403 FORBIDDEN", async () => {
  const alice = await register();
  const bob = await register();
  const cap = await createCapsule(alice.accessToken, { title: "alice-own" });
  const r = await api("DELETE", `/api/v1/me/capsules/${cap.id}`, { token: bob.accessToken });
  assert.equal(r.status, 403);
  assert.equal(r.body.errorCode, "FORBIDDEN");
});

test("POST /auth/login 高频失败触发 429 RATE_LIMITED", async () => {
  const email = uniqueEmail();
  // 预先注册，确保账号存在，排除 401 原因
  await register({ email });
  let rateLimited = false;
  for (let i = 0; i < 20; i++) {
    const r = await api("POST", "/api/v1/auth/login", {
      json: { email, password: `wrong-${i}-password` },
    });
    if (r.status === 429) {
      assert.equal(r.body.errorCode, "RATE_LIMITED");
      rateLimited = true;
      break;
    }
  }
  assert.ok(rateLimited, "20 次错误密码后未触发限流");
});

test("所有错误响应符合 ErrorEnvelope 形状", async () => {
  const r = await api("GET", "/api/v1/me");
  assert.equal(r.status, 401);
  assert.equal(r.body.success, false);
  assert.equal(r.body.data, null);
  assert.ok(typeof r.body.message === "string" && r.body.message.length > 0);
  assert.ok(typeof r.body.errorCode === "string");
});
