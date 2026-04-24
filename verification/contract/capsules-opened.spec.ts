/**
 * capsules-opened.spec.ts · 已开启 / 删除语义
 *
 * 说明：契约创建约束 openAt > now+60s，无法在黑盒内构造"已开启"状态。
 * 因此这里覆盖：`isOpened` 字段的形态契约 + 删除永远允许（含作者删除）+ 非作者不可删。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { api, createCapsule, register } from "./_helpers.ts";

test("isOpened 字段严格为 boolean（byCode / 广场详情 / 列表均一致）", async () => {
  const u = await register();
  const cap = await createCapsule(u.accessToken);

  const byCode = await api<{ isOpened: unknown }>(
    "GET",
    `/api/v1/capsules/${cap.code}`,
  );
  const byId = await api<{ isOpened: unknown }>(
    "GET",
    `/api/v1/plaza/capsules/${cap.id}`,
  );
  const list = await api<{ items: Array<{ id: string; isOpened: unknown }> }>(
    "GET",
    "/api/v1/plaza/capsules?pageSize=50",
  );
  assert.equal(typeof byCode.body.data!.isOpened, "boolean");
  assert.equal(typeof byId.body.data!.isOpened, "boolean");
  const listed = list.body.data!.items.find((i) => i.id === cap.id)!;
  assert.equal(typeof listed.isOpened, "boolean");
});

test("DELETE /api/v1/me/capsules/{id} 作者可删（未开启也允许）→ 204", async () => {
  const u = await register();
  const cap = await createCapsule(u.accessToken);
  const r = await api("DELETE", `/api/v1/me/capsules/${cap.id}`, { token: u.accessToken });
  assert.equal(r.status, 204);

  // 删后 byCode 404
  const after = await api("GET", `/api/v1/capsules/${cap.code}`);
  assert.equal(after.status, 404);
});

test("DELETE /api/v1/me/capsules/{id} 非作者 → 403 FORBIDDEN", async () => {
  const owner = await register();
  const other = await register();
  const cap = await createCapsule(owner.accessToken);
  const r = await api("DELETE", `/api/v1/me/capsules/${cap.id}`, { token: other.accessToken });
  assert.equal(r.status, 403);
  assert.equal(r.body.errorCode, "FORBIDDEN");
});

test("DELETE /api/v1/me/capsules/{id} 不存在 → 404", async () => {
  const u = await register();
  const r = await api(
    "DELETE",
    "/api/v1/me/capsules/00000000-0000-0000-0000-000000000000",
    { token: u.accessToken },
  );
  assert.equal(r.status, 404);
  assert.equal(r.body.errorCode, "NOT_FOUND");
});
