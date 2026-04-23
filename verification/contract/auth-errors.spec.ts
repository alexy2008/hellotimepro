/**
 * auth-errors.spec.ts · 契约测试（M0 占位）
 *
 * 覆盖：认证 / 授权 / 限流错误场景
 *
 * 断言要点：
 * - 无 Authorization header → 401 UNAUTHORIZED（非 403）
 * - Bearer 错字 / 过期 → 401 UNAUTHORIZED，不泄露具体原因
 * - 访问他人胶囊的"撤回"接口 → 403 FORBIDDEN
 * - 短时间内登录失败 5 次 → 429 RATE_LIMITED，retryAfter 字段
 * - 所有错误响应符合 ErrorEnvelope schema（errorCode 必填）
 */
import { test } from "node:test";

const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:29010";

test.skip("protected endpoint without token returns 401 UNAUTHORIZED", async () => {});
test.skip("protected endpoint with malformed token returns 401 UNAUTHORIZED", async () => {});
test.skip("protected endpoint with expired token returns 401 UNAUTHORIZED", async () => {});
test.skip("DELETE /me/capsules/{id} by non-owner returns 403 FORBIDDEN", async () => {});
test.skip("POST /auth/login rate-limits after 5 failures with 429 + retryAfter", async () => {});
test.skip("all error responses include success=false and errorCode", async () => {});
