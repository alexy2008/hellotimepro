/**
 * favorites.spec.ts · 契约测试（M0 占位）
 *
 * 覆盖：POST / DELETE / GET /capsules/{id}/favorite
 *
 * 断言要点：
 * - POST 首次收藏 → 201 + { favoriteCount: n+1, favorited: true }
 * - POST 重复收藏 → 200（幂等，不报错），favoriteCount 不变
 * - DELETE 首次取消 → 200 + { favorited: false }
 * - DELETE 未收藏即取消 → 204 No Content（幂等）
 * - GET 查询当前收藏态 → 200 + { favorited: bool, favoriteCount: n }
 * - 匿名访问 POST/DELETE → 401 UNAUTHORIZED
 * - 对未开启 + inPlaza=false 的他人胶囊操作 → 404 NOT_FOUND（访问不到）
 * - 收藏自己的胶囊 → 422 VALIDATION_ERROR
 */
import { test } from "node:test";

const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:29010";

test.skip("POST favorite first time returns 201 with incremented count", async () => {});
test.skip("POST favorite twice is idempotent (returns 200, count unchanged)", async () => {});
test.skip("DELETE favorite first time returns 200 with decremented count", async () => {});
test.skip("DELETE favorite when not favorited returns 204", async () => {});
test.skip("GET favorite returns { favorited, favoriteCount }", async () => {});
test.skip("POST favorite unauthenticated returns 401", async () => {});
test.skip("POST favorite on own capsule returns 422", async () => {});
test.skip("POST favorite on non-visible capsule returns 404", async () => {});
