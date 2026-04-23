/**
 * favorites-count.spec.ts · 契约测试（M0 占位）
 *
 * 覆盖：favorite_count 与 favorites 表的一致性
 *
 * 断言要点（通过黑盒观察）：
 * - 同一胶囊 100 次 POST + 100 次 DELETE（不同用户交错）后，
 *   favoriteCount === 实际 favorites 表行数（由 /me/favorites 在各账号下交叉校验）
 * - 并发下仍收敛（允许最终一致，但 10s 后必须等同）
 * - 事务一致：中途中断不会留下 "favoriteCount - 1 比实际行数少 1" 这种漂移
 *
 * 这是设计上的硬约束（docs/02-design.md §5.3），所有后端实现必须通过此测试。
 */
import { test } from "node:test";

const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:29010";

test.skip("serial favorite+unfavorite cycles keep count in sync", async () => {});
test.skip("concurrent favorite ops converge to consistent count within 10s", async () => {});
test.skip("favoriteCount never drifts negative even under race conditions", async () => {});
test.skip("server crash mid-transaction leaves no orphaned favorites rows", async () => {});
