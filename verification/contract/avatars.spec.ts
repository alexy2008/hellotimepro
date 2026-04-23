/**
 * avatars.spec.ts · 契约测试（M0 占位）
 *
 * 覆盖：GET /avatars
 *
 * 断言要点：
 * - 返回数组长度 === 10（当前内置头像数）
 * - 每项包含 id / name / primaryColor (#RRGGBB) / svgUrl / tagline
 * - id 唯一、svgUrl 可被 HEAD 成功（另行在 UI smoke 中验证）
 * - 响应头 Cache-Control: public, max-age >= 300（头像极少变化）
 */
import { test } from "node:test";

const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:29010";

test.skip("GET /avatars returns 10 built-in avatars", async () => {});
test.skip("each avatar has id, name, primaryColor, svgUrl, tagline", async () => {});
test.skip("avatar ids are unique", async () => {});
test.skip("primaryColor is a valid #RRGGBB hex", async () => {});
test.skip("response includes Cache-Control with reasonable max-age", async () => {});
