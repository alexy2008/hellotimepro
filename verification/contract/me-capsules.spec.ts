/**
 * me-capsules.spec.ts · 契约测试（M0 占位）
 *
 * 覆盖：GET /me/capsules, DELETE /me/capsules/{id}, GET /me/favorites
 *
 * 断言要点：
 * - GET /me/capsules 支持 ?status=sealed|opened|all（默认 all）
 * - 按 createdAt DESC，分页同 plaza（cursor + limit）
 * - DELETE /me/capsules/{id}：
 *   - 仅 sealed 状态可删（opened → 403 FORBIDDEN）
 *   - 非作者 → 403 FORBIDDEN
 *   - 成功 → 204，同时删除关联 favorites（级联）
 * - GET /me/favorites 只返回当前用户收藏的、仍可见的胶囊
 *   （被作者撤回/被管理员移除的胶囊不再出现，但原胶囊仍存在时保留）
 */
import { test } from "node:test";

const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:29010";

test.skip("GET /me/capsules?status=sealed lists only sealed capsules of current user", async () => {});
test.skip("GET /me/capsules?status=opened lists only opened capsules of current user", async () => {});
test.skip("GET /me/capsules default returns all, ordered by createdAt DESC", async () => {});
test.skip("DELETE /me/capsules/{id} on sealed capsule returns 204", async () => {});
test.skip("DELETE /me/capsules/{id} on opened capsule returns 403", async () => {});
test.skip("DELETE /me/capsules/{id} by non-owner returns 403", async () => {});
test.skip("DELETE cascades and removes related favorites rows", async () => {});
test.skip("GET /me/favorites lists favorited capsules only", async () => {});
