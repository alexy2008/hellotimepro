/**
 * auth.spec.ts · 契约测试（M0 占位）
 *
 * 覆盖：POST /auth/register, /auth/login, /auth/refresh, /auth/logout
 *
 * 断言要点：
 * - register: 创建后立即返回 accessToken + refreshToken，昵称唯一
 * - login:    旧密码登录成功 → 新密码登录失败
 * - refresh:  旧 refreshToken 使用一次后失效（token family）
 * - logout:   吊销该 refresh family 的所有 token
 * - accessToken 为有效 JWT，HS256，payload 含 sub（userId）、exp、iat
 */
import { test } from "node:test";

const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:29010";

test.skip("POST /auth/register creates user and issues token pair", async () => {});
test.skip("POST /auth/register rejects duplicate email with CONFLICT", async () => {});
test.skip("POST /auth/register rejects duplicate nickname with CONFLICT", async () => {});
test.skip("POST /auth/register rejects password < 8 chars with VALIDATION_ERROR", async () => {});
test.skip("POST /auth/login rejects wrong password with UNAUTHORIZED", async () => {});
test.skip("POST /auth/login returns fresh token pair on success", async () => {});
test.skip("POST /auth/refresh rotates refresh token (old one invalidated)", async () => {});
test.skip("POST /auth/refresh with revoked token returns UNAUTHORIZED", async () => {});
test.skip("POST /auth/logout revokes entire refresh token family", async () => {});
test.skip("JWT payload contains sub, exp, iat and uses HS256", async () => {});
