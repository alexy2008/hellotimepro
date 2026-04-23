/**
 * plaza.spec.ts · 契约测试（M0 占位）
 *
 * 覆盖：GET /api/v1/plaza/capsules
 *
 * 断言要点：
 * - 支持参数：sort（hot|new）、filter（all|opened|unopened）、q（模糊搜索）、page、pageSize
 * - sort=new：按 createdAt DESC；sort=hot：按 favoriteCount DESC，tie-breaker createdAt DESC
 * - filter=opened：openAt <= now；filter=unopened：openAt > now；filter=all（默认）：不过滤
 * - q：大小写不敏感子串匹配 title 或 creator.nickname；trim 后为空视为未传；超 50 字返回 VALIDATION_ERROR
 * - 仅返回 inPlaza=true 的胶囊（无论已/未开启）
 * - 每项 schema 为 CapsuleList（不含 content），包含 creator{nickname,avatarId}、isOpened、favoritedByMe
 * - 响应包含 pagination{page, pageSize, total, totalPages}
 * - pageSize 最大 50，超出返回 VALIDATION_ERROR
 */
import { test } from "node:test";

const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:29010";

test.skip("GET /plaza default sort=new returns inPlaza=true capsules by createdAt DESC", async () => {});
test.skip("GET /plaza?sort=hot orders by favoriteCount DESC, createdAt DESC as tie-breaker", async () => {});
test.skip("GET /plaza shows both opened and unopened capsules by default", async () => {});
test.skip("GET /plaza hides inPlaza=false capsules", async () => {});
test.skip("GET /plaza items are CapsuleList schema (no content field)", async () => {});
test.skip("GET /plaza items include creator{nickname,avatarId}, isOpened, favoritedByMe", async () => {});
test.skip("GET /plaza pagination uses page + pageSize; max pageSize=50", async () => {});
test.skip("GET /plaza?pageSize>50 returns VALIDATION_ERROR", async () => {});
test.skip("GET /plaza response includes pagination{page,pageSize,total,totalPages}", async () => {});

// ---------- filter=all|opened|unopened ----------
test.skip("GET /plaza?filter=opened returns only openAt<=now", async () => {});
test.skip("GET /plaza?filter=unopened returns only openAt>now", async () => {});
test.skip("GET /plaza?filter=all (default) returns both opened+unopened", async () => {});
test.skip("GET /plaza?filter=xxx returns VALIDATION_ERROR", async () => {});

// ---------- q 模糊搜索 ----------
test.skip("GET /plaza?q=abc matches title substring case-insensitive", async () => {});
test.skip("GET /plaza?q=abc matches creator.nickname substring case-insensitive", async () => {});
test.skip("GET /plaza?q trims whitespace; trimmed-empty treated as absent", async () => {});
test.skip("GET /plaza?q (length > 50) returns VALIDATION_ERROR", async () => {});
test.skip("GET /plaza?q combines with sort + filter (filter → search → sort → page)", async () => {});
test.skip("GET /plaza?q pagination.total reflects filtered result count", async () => {});
