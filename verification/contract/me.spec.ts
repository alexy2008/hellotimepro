/**
 * me.spec.ts · 当前用户资料与改密
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { api, register, uniqueNickname } from "./_helpers.ts";

test("GET /api/v1/me 返回当前用户资料", async () => {
  const u = await register();
  const r = await api<{ id: string; email: string; nickname: string; avatarId: string }>(
    "GET",
    "/api/v1/me",
    { token: u.accessToken },
  );
  assert.equal(r.status, 200);
  assert.equal(r.body.success, true);
  assert.equal(r.body.data!.email, u.email.toLowerCase());
  assert.equal(r.body.data!.nickname, u.nickname);
  assert.equal(r.body.data!.avatarId, u.avatarId);
});

test("PATCH /api/v1/me 更新昵称 + 头像", async () => {
  const u = await register();
  const newNick = uniqueNickname("up");
  const r = await api<{ nickname: string; avatarId: string }>("PATCH", "/api/v1/me", {
    token: u.accessToken,
    json: { nickname: newNick, avatarId: "specter" },
  });
  assert.equal(r.status, 200);
  assert.equal(r.body.data!.nickname, newNick);
  assert.equal(r.body.data!.avatarId, "specter");
});

test("PATCH /api/v1/me 仅更新一个字段也合法", async () => {
  const u = await register();
  const r = await api<{ avatarId: string; nickname: string }>("PATCH", "/api/v1/me", {
    token: u.accessToken,
    json: { avatarId: "glyph" },
  });
  assert.equal(r.status, 200);
  assert.equal(r.body.data!.avatarId, "glyph");
  assert.equal(r.body.data!.nickname, u.nickname);
});

test("PATCH /api/v1/me 昵称冲突 → 409 CONFLICT", async () => {
  const a = await register();
  const b = await register();
  const r = await api("PATCH", "/api/v1/me", {
    token: b.accessToken,
    json: { nickname: a.nickname },
  });
  assert.equal(r.status, 409);
  assert.equal(r.body.errorCode, "CONFLICT");
});

test("PATCH /api/v1/me 空 body / 仅 email → 422 VALIDATION_ERROR", async () => {
  const u = await register();
  const r = await api("PATCH", "/api/v1/me", { token: u.accessToken, json: {} });
  assert.equal(r.status, 422);
  assert.equal(r.body.errorCode, "VALIDATION_ERROR");
});

test("POST /api/v1/me/password 当前密码错 → 401", async () => {
  const u = await register();
  const r = await api("POST", "/api/v1/me/password", {
    token: u.accessToken,
    json: { currentPassword: "definitely-not1", newPassword: "newpass1234" },
  });
  assert.equal(r.status, 401);
  assert.equal(r.body.errorCode, "UNAUTHORIZED");
});

test("POST /api/v1/me/password 弱密码 → 422", async () => {
  const u = await register();
  const r = await api("POST", "/api/v1/me/password", {
    token: u.accessToken,
    json: { currentPassword: u.password, newPassword: "abc" },
  });
  assert.equal(r.status, 422);
  assert.equal(r.body.errorCode, "VALIDATION_ERROR");
});

test("POST /api/v1/me/password 成功 204 + refresh token 全族吊销", async () => {
  const u = await register();
  const r = await api("POST", "/api/v1/me/password", {
    token: u.accessToken,
    json: { currentPassword: u.password, newPassword: "newpass1234" },
  });
  assert.equal(r.status, 204);
  assert.equal(r.raw, "");

  const r2 = await api("POST", "/api/v1/auth/refresh", {
    json: { refreshToken: u.refreshToken },
  });
  assert.equal(r2.status, 401);

  // 新密码可登录
  const r3 = await api("POST", "/api/v1/auth/login", {
    json: { email: u.email, password: "newpass1234" },
  });
  assert.equal(r3.status, 200);
});
