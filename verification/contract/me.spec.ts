/**
 * me.spec.ts · 契约测试（M0 占位）
 *
 * 覆盖：GET /me, PATCH /me, POST /me/password
 *
 * 断言要点：
 * - GET /me 返回当前登录用户（id / email / nickname / avatar）
 * - PATCH /me 修改昵称与头像，邮箱字段被忽略/拒绝
 * - PATCH /me 昵称冲突返回 409 CONFLICT
 * - POST /me/password 旧密码错误返回 401 UNAUTHORIZED
 * - POST /me/password 成功后吊销所有 refreshToken family，需要重新登录
 */
import { test } from "node:test";

const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:29010";

test.skip("GET /me returns current user profile", async () => {});
test.skip("PATCH /me updates nickname and avatarId", async () => {});
test.skip("PATCH /me ignores attempts to change email", async () => {});
test.skip("PATCH /me with duplicate nickname returns 409 CONFLICT", async () => {});
test.skip("POST /me/password with wrong old password returns 401", async () => {});
test.skip("POST /me/password revokes all refresh tokens", async () => {});
test.skip("POST /me/password with new password < 8 chars returns VALIDATION_ERROR", async () => {});
