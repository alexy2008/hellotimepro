/**
 * capsules-opened.spec.ts · 契约测试（M0 占位）
 *
 * 覆盖：已开启胶囊的行为一致性
 *
 * 断言要点：
 * - 触发开启的机制：openAt <= now 且首次被访问时切换 status="opened"
 *   （惰性转换，不依赖定时任务）—— 各实现必须一致
 * - 已开启 GET /c/{code}：返回 content 字段（完整正文）
 * - 广场列表出现在其中（inPlaza=true 的）
 * - favoriteCount 与 favorites 表实际行数相等
 * - 已开启的胶囊不能再被作者删除（返回 FORBIDDEN 或 VALIDATION_ERROR）
 * - status 字段值只能是 "sealed" | "opened"
 */
import { test } from "node:test";

const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:29010";

test.skip("capsule becomes opened when accessed at/after openAt", async () => {});
test.skip("opened GET /c/{code} returns full content", async () => {});
test.skip("opened capsule with inPlaza=true appears in GET /plaza", async () => {});
test.skip("opened capsule with inPlaza=false does NOT appear in /plaza but /c/{code} works", async () => {});
test.skip("opened capsule favoriteCount equals actual favorites row count", async () => {});
test.skip("DELETE /me/capsules/{id} on opened capsule returns FORBIDDEN", async () => {});
test.skip("status field is strictly \"sealed\" or \"opened\"", async () => {});
