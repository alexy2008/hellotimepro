/**
 * avatars.spec.ts · 头像目录
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { api } from "./_helpers.ts";

test("GET /api/v1/avatars 至少 10 个，字段齐全", async () => {
  const r = await api<Array<{ id: string; name: string; primaryColor: string; svgUrl?: string }>>(
    "GET",
    "/api/v1/avatars",
  );
  assert.equal(r.status, 200);
  assert.equal(r.body.success, true);
  const items = r.body.data!;
  assert.ok(Array.isArray(items) && items.length >= 10);
  const ids = new Set(items.map((i) => i.id));
  for (const required of ["neo", "specter", "glyph"]) {
    assert.ok(ids.has(required), `缺失头像 ${required}`);
  }
  for (const it of items) {
    assert.match(it.id, /^[a-z0-9-]{2,20}$/);
    assert.ok(typeof it.name === "string" && it.name.length > 0);
    assert.match(it.primaryColor, /^#[0-9a-fA-F]{6}$/);
  }
});
