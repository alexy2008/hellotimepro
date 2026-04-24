/**
 * auth.spec.ts · 注册 / 登录 / 刷新 / 登出
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { api, register, uniqueEmail, uniqueNickname } from "./_helpers.ts";

test("POST /auth/register 成功发 token 对，返回 user", async () => {
  const email = uniqueEmail();
  const nickname = uniqueNickname();
  const r = await api<{
    accessToken: string;
    refreshToken: string;
    accessTokenExpiresIn: number;
    user: { id: string; email: string; nickname: string; avatarId: string };
  }>("POST", "/api/v1/auth/register", {
    json: { email, password: "password1234", nickname, avatarId: "neo" },
  });
  assert.equal(r.status, 201);
  assert.equal(r.body.success, true);
  const d = r.body.data!;
  assert.ok(d.accessToken.split(".").length === 3, "access token 必须是 JWT");
  assert.ok(typeof d.refreshToken === "string" && d.refreshToken.length >= 32);
  assert.ok(Number.isInteger(d.accessTokenExpiresIn) && d.accessTokenExpiresIn >= 1);
  assert.equal(d.user.email, email.toLowerCase());
  assert.equal(d.user.nickname, nickname);
  assert.equal(d.user.avatarId, "neo");
  assert.match(d.user.id, /^[0-9a-f-]{32,36}$/);
});

test("POST /auth/register 重复 email → 409 CONFLICT", async () => {
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
  assert.equal(r.body.success, false);
  assert.equal(r.body.errorCode, "CONFLICT");
});

test("POST /auth/register 重复 nickname → 409 CONFLICT", async () => {
  const u = await register();
  const r = await api("POST", "/api/v1/auth/register", {
    json: {
      email: uniqueEmail(),
      password: "password1234",
      nickname: u.nickname,
      avatarId: "neo",
    },
  });
  assert.equal(r.status, 409);
  assert.equal(r.body.errorCode, "CONFLICT");
});

test("POST /auth/register 弱密码 → 422 VALIDATION_ERROR", async () => {
  const r = await api("POST", "/api/v1/auth/register", {
    json: {
      email: uniqueEmail(),
      password: "short",
      nickname: uniqueNickname(),
      avatarId: "neo",
    },
  });
  assert.equal(r.status, 422);
  assert.equal(r.body.errorCode, "VALIDATION_ERROR");
});

test("POST /auth/login 成功返回 token 对", async () => {
  const u = await register();
  const r = await api<{ accessToken: string; refreshToken: string; user: { email: string } }>(
    "POST",
    "/api/v1/auth/login",
    { json: { email: u.email, password: u.password } },
  );
  assert.equal(r.status, 200);
  assert.equal(r.body.success, true);
  assert.ok(r.body.data!.accessToken);
  assert.ok(r.body.data!.refreshToken);
  assert.equal(r.body.data!.user.email, u.email.toLowerCase());
});

test("POST /auth/login 邮箱大小写不敏感", async () => {
  const u = await register();
  const r = await api("POST", "/api/v1/auth/login", {
    json: { email: u.email.toUpperCase(), password: u.password },
  });
  assert.equal(r.status, 200);
});

test("POST /auth/login 错误密码 → 401 UNAUTHORIZED", async () => {
  const u = await register();
  const r = await api("POST", "/api/v1/auth/login", {
    json: { email: u.email, password: "wrongpassword1" },
  });
  assert.equal(r.status, 401);
  assert.equal(r.body.errorCode, "UNAUTHORIZED");
});

test("POST /auth/refresh 轮转 + 旧 token 复用整族作废", async () => {
  const u = await register();
  const r1 = await api<{ refreshToken: string; accessToken: string }>(
    "POST",
    "/api/v1/auth/refresh",
    { json: { refreshToken: u.refreshToken } },
  );
  assert.equal(r1.status, 200);
  const rt2 = r1.body.data!.refreshToken;
  assert.notEqual(rt2, u.refreshToken);

  // 旧 refreshToken 重用 → 401
  const r2 = await api("POST", "/api/v1/auth/refresh", {
    json: { refreshToken: u.refreshToken },
  });
  assert.equal(r2.status, 401);
  assert.equal(r2.body.errorCode, "UNAUTHORIZED");

  // 同族中的 rt2 也应失效
  const r3 = await api("POST", "/api/v1/auth/refresh", {
    json: { refreshToken: rt2 },
  });
  assert.equal(r3.status, 401);
});

test("POST /auth/logout 吊销当前 refresh token", async () => {
  const u = await register();
  const r = await api("POST", "/api/v1/auth/logout", {
    token: u.accessToken,
    json: { refreshToken: u.refreshToken },
  });
  assert.equal(r.status, 204);
  assert.equal(r.raw, "");

  const r2 = await api("POST", "/api/v1/auth/refresh", {
    json: { refreshToken: u.refreshToken },
  });
  assert.equal(r2.status, 401);
});

test("POST /auth/logout 无 body 亦合法（204）", async () => {
  const u = await register();
  const r = await api("POST", "/api/v1/auth/logout", { token: u.accessToken });
  assert.equal(r.status, 204);
});
