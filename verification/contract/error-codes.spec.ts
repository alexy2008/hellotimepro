/**
 * error-codes.spec.ts · 契约测试（M0 占位）
 *
 * 覆盖：错误码枚举与 HTTP 状态码的对应（见 spec/api/openapi.yaml#/components/schemas/ErrorCode）
 *
 * 允许的 errorCode：
 *   VALIDATION_ERROR   → 422
 *   UNAUTHORIZED       → 401
 *   FORBIDDEN          → 403
 *   NOT_FOUND          → 404
 *   CONFLICT           → 409
 *   RATE_LIMITED       → 429
 *   BAD_REQUEST        → 400
 *   INTERNAL_ERROR     → 500
 *
 * 断言要点：
 * - 服务端返回的 errorCode 只能来自上述枚举
 * - 每个 errorCode 的 HTTP 状态码必须严格匹配
 * - VALIDATION_ERROR 的 details 必须包含 field / rule（如 `[{ field: "password", rule: "min_length" }]`）
 */
import { test } from "node:test";

const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:29010";

test.skip("VALIDATION_ERROR always returns HTTP 422 with details[field, rule]", async () => {});
test.skip("UNAUTHORIZED always returns HTTP 401", async () => {});
test.skip("FORBIDDEN always returns HTTP 403", async () => {});
test.skip("NOT_FOUND always returns HTTP 404", async () => {});
test.skip("CONFLICT always returns HTTP 409", async () => {});
test.skip("RATE_LIMITED always returns HTTP 429 with Retry-After header", async () => {});
test.skip("no errorCode outside the allowed enum is ever returned", async () => {});
