/**
 * stack-narration.spec.ts · 技术组合融合解读
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { api } from "./_helpers.ts";

test("POST /api/v1/stack-narration 未配置 LLM 也返回可展示内容", async () => {
  const health = await api<{
    status: string;
    service: string;
    version: string;
    stack: { kind: "backend" | "fullstack"; items: Array<{ role: string; name: string; version: string }> };
  }>("GET", "/api/v1/health");
  assert.equal(health.status, 200);
  assert.ok(health.body.data);

  const r = await api<{
    title: string;
    narrative: string;
    generatedBy: string;
    cached: boolean;
  }>("POST", "/api/v1/stack-narration", {
    json: {
      frontend: {
        name: "React + TypeScript",
        items: [
          { role: "framework", name: "React", version: "19" },
          { role: "language", name: "TypeScript", version: "5" },
          { role: "styling", name: "Tailwind CSS", version: "4" },
        ],
      },
      backend: {
        kind: health.body.data.stack.kind,
        service: health.body.data.service,
        version: health.body.data.version,
        items: health.body.data.stack.items,
      },
      locale: "zh-CN",
    },
  });

  assert.equal(r.status, 200);
  assert.equal(r.body.success, true);
  assert.equal(r.body.errorCode, null);
  assert.ok(r.body.data);
  assert.ok(r.body.data.title.length > 0);
  assert.ok(r.body.data.narrative.length > 0);
  assert.equal(typeof r.body.data.generatedBy, "string");
  assert.equal(typeof r.body.data.cached, "boolean");
});
