/**
 * envelope.spec.ts · 统一响应壳 {success, data, message, errorCode}
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { api, register } from "./_helpers.ts";

test("成功响应：success=true, data 字段存在", async () => {
  const r = await api("GET", "/api/v1/health");
  assert.equal(r.status, 200);
  assert.equal(r.body.success, true);
  assert.ok("data" in r.body);
  assert.notEqual(r.body.data, undefined);
});

test("失败响应：success=false, errorCode + message 非空", async () => {
  const r = await api("GET", "/api/v1/me");
  assert.equal(r.status, 401);
  assert.equal(r.body.success, false);
  assert.ok(typeof r.body.errorCode === "string" && r.body.errorCode.length > 0);
  assert.ok(typeof r.body.message === "string" && r.body.message.length > 0);
});

test("success 字段是 boolean 不是字符串", async () => {
  const r = await api("GET", "/api/v1/health");
  assert.equal(typeof r.body.success, "boolean");
});

test("Content-Type 为 application/json", async () => {
  const r = await api("GET", "/api/v1/health");
  const ct = r.headers.get("content-type") ?? "";
  assert.ok(ct.includes("application/json"), `期望 JSON content-type，实得 ${ct}`);
});

test("204 响应无 body（logout）", async () => {
  const u = await register();
  const r = await api("POST", "/api/v1/auth/logout", { token: u.accessToken });
  assert.equal(r.status, 204);
  assert.equal(r.raw, "");
});

test("VALIDATION_ERROR 可附带 details 数组", async () => {
  const r = await api("POST", "/api/v1/auth/register", {
    json: { email: "not-email", password: "short", nickname: "!", avatarId: "neo" },
  });
  assert.equal(r.status, 422);
  assert.equal(r.body.errorCode, "VALIDATION_ERROR");
  if (r.body.details !== undefined) {
    assert.ok(Array.isArray(r.body.details));
    for (const d of r.body.details!) {
      assert.ok(typeof d.field === "string");
      assert.ok(typeof d.message === "string");
    }
  }
});
