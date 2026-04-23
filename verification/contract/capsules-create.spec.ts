/**
 * capsules-create.spec.ts · 契约测试（M0 占位）
 *
 * 覆盖：POST /capsules, GET /c/{code}
 *
 * 断言要点：
 * - 创建成功返回 201，包含 id / code / openAt / status="sealed"
 * - code 格式匹配 /^[A-Z0-9]{8}$/
 * - openAt ≤ now + 60s 被拒绝（VALIDATION_ERROR）
 * - title > 80 字符被拒绝
 * - content > 4000 字符被拒绝
 * - inPlaza=true 且 sealed 时，GET /c/{code} 可访问（未登录也行）
 * - GET /c/{code} 大小写不敏感（/c/abc12345 与 /c/ABC12345 同义）
 * - 匿名创建被拒绝（401）
 */
import { test } from "node:test";

const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:29010";

test.skip("POST /capsules creates capsule with 8-char [A-Z0-9] code", async () => {});
test.skip("POST /capsules rejects openAt within 60s with VALIDATION_ERROR", async () => {});
test.skip("POST /capsules rejects title > 80 chars", async () => {});
test.skip("POST /capsules rejects content > 4000 chars", async () => {});
test.skip("POST /capsules requires authentication (401 otherwise)", async () => {});
test.skip("GET /c/{code} returns capsule summary for sealed public capsule", async () => {});
test.skip("GET /c/{code} is case-insensitive on code segment", async () => {});
test.skip("GET /c/{code} on unknown code returns 404 NOT_FOUND", async () => {});
test.skip("newly created sealed capsule hides content field in response", async () => {});
