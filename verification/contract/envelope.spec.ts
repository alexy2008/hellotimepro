/**
 * envelope.spec.ts · 契约测试（M0 占位）
 *
 * 覆盖：统一响应壳（docs/02-design.md §6.3）
 *
 * 所有业务端点的成功响应必须是：
 *   { success: true,  data: <payload>, message?: string }
 * 所有业务端点的失败响应必须是：
 *   { success: false, errorCode: string, message: string, details?: any }
 *
 * 例外：
 * - 204 No Content 允许无 body
 * - 静态资源（/static/*）不走 envelope（直接返回文件）
 *
 * 断言要点：
 * - 至少抽查 5 个端点的成功 / 失败两路响应
 * - data 字段在成功响应中必须存在（允许 null / {} / [])
 * - errorCode 在失败响应中必须存在
 * - success 字段是 boolean，不是 "true"/"false" 字符串
 * - Content-Type: application/json; charset=utf-8
 */
import { test } from "node:test";

const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:29010";

test.skip("successful responses include success=true and data", async () => {});
test.skip("error responses include success=false, errorCode, message", async () => {});
test.skip("success field is boolean (not string)", async () => {});
test.skip("Content-Type on all JSON responses is application/json; charset=utf-8", async () => {});
test.skip("204 responses have no body", async () => {});
