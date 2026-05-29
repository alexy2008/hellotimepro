/**
 * capsule-recommendations.spec.ts · AI 推荐胶囊主题
 *
 * 黑盒：该端点公开。推荐为锦上添花——LLM 可用时返回若干项，
 * 不可用时返回空数组 items=[]（不做本地兜底）。断言对两种情况都成立。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { api } from "./_helpers.ts";

type Reco = { title: string; hint: string; openInDays: number };
type RecoList = { items: Reco[]; generatedBy: string; cached: boolean };

function assertItemShape(it: Reco) {
  assert.ok(typeof it.title === "string" && it.title.length >= 1 && it.title.length <= 60);
  assert.ok(typeof it.hint === "string" && it.hint.length >= 1 && it.hint.length <= 80);
  assert.ok(Number.isInteger(it.openInDays) && it.openInDays >= 1 && it.openInDays <= 3650);
}

test("GET /api/v1/capsule-recommendations 默认 → 200，items 为数组（≤8 项）且字段合法", async () => {
  const r = await api<RecoList>("GET", "/api/v1/capsule-recommendations");
  assert.equal(r.status, 200);
  const d = r.body.data!;
  assert.ok(Array.isArray(d.items) && d.items.length <= 8);
  d.items.forEach(assertItemShape);
  assert.ok(typeof d.generatedBy === "string" && d.generatedBy.length > 0);
  assert.equal(d.cached, false);
});

test("GET /api/v1/capsule-recommendations?count=3 → items ≤ 3", async () => {
  const r = await api<RecoList>("GET", "/api/v1/capsule-recommendations?count=3");
  assert.equal(r.status, 200);
  assert.ok(r.body.data!.items.length <= 3);
});

test("GET /api/v1/capsule-recommendations?count=20 越界 → 422", async () => {
  const r = await api("GET", "/api/v1/capsule-recommendations?count=20");
  assert.equal(r.status, 422);
  assert.equal(r.body.errorCode, "VALIDATION_ERROR");
});

test("GET /api/v1/capsule-recommendations?count=2 越界 → 422", async () => {
  const r = await api("GET", "/api/v1/capsule-recommendations?count=2");
  assert.equal(r.status, 422);
  assert.equal(r.body.errorCode, "VALIDATION_ERROR");
});

test("GET /api/v1/capsule-recommendations items title 互不相同", async () => {
  const r = await api<RecoList>("GET", "/api/v1/capsule-recommendations");
  assert.equal(r.status, 200);
  const titles = r.body.data!.items.map((i) => i.title);
  assert.equal(new Set(titles).size, titles.length, "推荐标题应去重");
});

test("GET /api/v1/capsule-recommendations cached 固定 false", async () => {
  const r = await api<RecoList>("GET", "/api/v1/capsule-recommendations");
  assert.equal(r.body.data!.cached, false);
});
