/**
 * capsule-suggestion.spec.ts · AI 生成胶囊建议（含空标题模式）
 *
 * 黑盒：该端点公开（无需鉴权），LLM 未启用时返回本地兜底（generatedBy=local-template）。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { api } from "./_helpers.ts";

type Suggestion = {
  title?: string | null;
  content: string;
  openInDays: number;
  openAt: string;
  generatedBy: string;
  cached: boolean;
};

test("POST /api/v1/capsule-suggestion 带标题 → 200，返回正文与开启建议", async () => {
  const r = await api<Suggestion>("POST", "/api/v1/capsule-suggestion", {
    json: { title: "写给三年后的我" },
  });
  assert.equal(r.status, 200);
  const d = r.body.data!;
  assert.ok(d.content.length >= 1);
  assert.ok(d.openInDays >= 1 && d.openInDays <= 3650);
  assert.ok(typeof d.openAt === "string" && d.openAt.length > 0);
  assert.ok(typeof d.generatedBy === "string" && d.generatedBy.length > 0);
  assert.equal(d.cached, false);
});

test("POST /api/v1/capsule-suggestion 不传 title → 200，AI 同时返回 title", async () => {
  const r = await api<Suggestion>("POST", "/api/v1/capsule-suggestion", {
    json: {},
  });
  assert.equal(r.status, 200);
  const d = r.body.data!;
  assert.ok(typeof d.title === "string" && d.title!.trim().length >= 1, "空标题模式必须返回非空 title");
  assert.ok(d.title!.length <= 60);
  assert.ok(d.content.length >= 1);
  assert.ok(d.openInDays >= 1 && d.openInDays <= 3650);
});

test("POST /api/v1/capsule-suggestion title 为空串 → 与不传等价（返回 title）", async () => {
  const r = await api<Suggestion>("POST", "/api/v1/capsule-suggestion", {
    json: { title: "   " },
  });
  assert.equal(r.status, 200);
  const d = r.body.data!;
  assert.ok(typeof d.title === "string" && d.title!.trim().length >= 1);
  assert.ok(d.content.length >= 1);
});

test("POST /api/v1/capsule-suggestion title > 60 → 422", async () => {
  const r = await api("POST", "/api/v1/capsule-suggestion", {
    json: { title: "x".repeat(61) },
  });
  assert.equal(r.status, 422);
  assert.equal(r.body.errorCode, "VALIDATION_ERROR");
});

test("POST /api/v1/capsule-suggestion locale 任意 → 200", async () => {
  const r = await api<Suggestion>("POST", "/api/v1/capsule-suggestion", {
    json: { title: "夏天的约定", locale: "en-US" },
  });
  assert.equal(r.status, 200);
  assert.ok(r.body.data!.content.length >= 1);
});

test("POST /api/v1/capsule-suggestion 连续两次 cached 均为 false", async () => {
  const a = await api<Suggestion>("POST", "/api/v1/capsule-suggestion", {
    json: { title: "下个月的小目标" },
  });
  const b = await api<Suggestion>("POST", "/api/v1/capsule-suggestion", {
    json: { title: "下个月的小目标" },
  });
  assert.equal(a.body.data!.cached, false);
  assert.equal(b.body.data!.cached, false);
});
