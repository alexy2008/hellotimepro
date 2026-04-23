/**
 * capsules-sealed.spec.ts · 契约测试（M0 占位）
 *
 * 覆盖：未开启胶囊的行为一致性
 *
 * 断言要点：
 * - 广场列表（GET /plaza）不返回未开启胶囊（无论 inPlaza 值）
 * - 未开启胶囊 GET /c/{code}：返回 title, code, openAt, creator, favoriteCount；
 *   不返回 content 字段（严格不泄露）
 * - 任何用户（包括作者）在 openAt 之前访问，都是 sealed 视图
 * - 未开启胶囊 remainingSeconds 字段 > 0，且为整数
 * - 作者可收藏自己的未开启胶囊 —— ❌ 业务约束：禁止收藏自己的胶囊（422）
 * - 其他用户可收藏未开启胶囊（收藏计数在开启后可见即时生效）
 */
import { test } from "node:test";

const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:29010";

test.skip("GET /plaza never returns sealed capsules", async () => {});
test.skip("sealed GET /c/{code} hides content field", async () => {});
test.skip("sealed GET /c/{code} returns positive integer remainingSeconds", async () => {});
test.skip("owner sees same sealed view before openAt (no privileged content peek)", async () => {});
test.skip("author cannot favorite own capsule (422 VALIDATION_ERROR)", async () => {});
test.skip("other user can favorite sealed capsule", async () => {});
