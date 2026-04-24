/**
 * health.spec.ts · 健康检查 + 栈身份
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { api } from "./_helpers.ts";

test("GET /api/v1/health 返回 envelope + HealthData", async () => {
  const r = await api<{
    status: string;
    service: string;
    version: string;
    uptimeSeconds: number;
    stack: { kind: string; items: Array<{ role: string; name: string; version: string }> };
  }>("GET", "/api/v1/health");
  assert.equal(r.status, 200);
  assert.equal(r.body.success, true);
  assert.equal(r.body.errorCode, null);
  const d = r.body.data!;
  assert.equal(d.status, "ok");
  assert.equal(d.service, "hellotime-pro");
  assert.ok(typeof d.version === "string" && d.version.length > 0);
  assert.ok(Number.isInteger(d.uptimeSeconds) && d.uptimeSeconds >= 0);
  assert.ok(["backend", "fullstack"].includes(d.stack.kind));
  assert.ok(Array.isArray(d.stack.items) && d.stack.items.length >= 1);
  for (const it of d.stack.items) {
    assert.ok(typeof it.role === "string" && it.role.length > 0);
    assert.ok(typeof it.name === "string" && it.name.length > 0);
    assert.ok(typeof it.version === "string" && it.version.length > 0);
  }
});
