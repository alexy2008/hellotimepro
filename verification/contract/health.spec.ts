/**
 * health.spec.ts · 契约测试（M0 占位）
 *
 * 覆盖：GET /health, GET /stack
 *
 * 断言要点：
 * - HTTP 200、envelope.success === true
 * - /health data 包含 status, uptime, dbDriver
 * - /stack data 包含 backend.name / version, runtime.name, database.name
 * - Cache-Control: no-store
 *
 * 真实实现将在 M1 完成。此文件目前仅作清单，运行时会被跳过：
 *    it.skip(...)  — 保证 node --test 报告里显示"已登记但未实现"。
 */
import { test } from "node:test";

const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:29010";

test.skip("GET /health returns 200 with envelope + status/uptime/dbDriver", async () => {});
test.skip("GET /health sets Cache-Control: no-store", async () => {});
test.skip("GET /stack returns 200 with backend/runtime/database identity", async () => {});
test.skip("GET /stack includes iconUrl for all entries (or explicit null)", async () => {});
