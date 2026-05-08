/**
 * UI 冒烟测试 · 主流程
 *
 * 流程：
 *   1. 注册 → 跳到 /create → 再到广场，验证可看到自己创建的胶囊
 *   2. 用户 B 收藏用户 A 的胶囊 → 出现在"我收藏的"
 *   3. 登出后访问受保护页跳到 /login
 *
 * 前置条件（由 verify-ui-smoke.sh 保证）：
 *   - 目标前端运行在 FRONTEND_URL
 *   - 后端已启动，并由默认代理入口（通常 :9080）转发
 */
import { test, expect, type Page } from "@playwright/test";
import { randomBytes } from "node:crypto";

function rand(n = 6): string {
  return randomBytes(n).toString("hex").slice(0, n);
}

/** 注册新用户，成功后停在 /create */
async function register(
  page: Page,
  opts: { email: string; password: string; nickname: string },
) {
  await page.goto("/register");
  await page.locator("#email").fill(opts.email);
  await page.locator("#nick").fill(opts.nickname);
  await page.locator("#pwd").fill(opts.password);

  // 等头像加载完再选（avatars 从 API 拉取）
  await page.locator('[role="radiogroup"] button').first().waitFor({ timeout: 5000 });
  await page.locator('[role="radiogroup"] button').first().click();

  await page.getByRole("button", { name: /创建账号/ }).click();
  // 注册成功后跳到 /create
  await expect(page).toHaveURL("/create", { timeout: 8000 });
}

/** 在 /create 页创建一颗胶囊，成功后 URL 变化 */
async function createCapsule(page: Page, title: string) {
  await page.goto("/create");
  await page.locator("#title").fill(title);
  await page.locator("#content").fill("这是一颗冒烟测试胶囊。");
  // 用预设按钮"1 分钟后（测试）"，满足 >60s 的限制
  await page.getByRole("button", { name: "1 分钟后（测试）" }).click();
  await page.getByRole("button", { name: /上锁封存/ }).click();
  // 提交后 URL 离开 /create
  await page.waitForURL((url) => !url.pathname.endsWith("/create"), { timeout: 8000 });
}

// ── 测试 1：注册后可到广场 ────────────────────────────────────────────────────

test("注册并进入广场", async ({ page }) => {
  const s = rand();
  await register(page, {
    email: `smoke_${s}@ui-smoke.hellotimepro.dev`,
    password: "Test1234!",
    nickname: `烟雾${s}`,
  });
  // 注册后在 /create，手动导到广场
  await page.goto("/");
  await expect(page.locator("h1, .cy-page-title")).toBeVisible({ timeout: 5000 });
});

// ── 测试 2：创建胶囊 → 广场可见 ──────────────────────────────────────────────

test("创建胶囊后广场可见", async ({ page }) => {
  const s = rand();
  const title = `冒烟胶囊_${s}`;

  await register(page, {
    email: `creator_${s}@ui-smoke.hellotimepro.dev`,
    password: "Test1234!",
    nickname: `创建者${s}`,
  });
  await createCapsule(page, title);

  // 回广场找该胶囊
  await page.goto("/");
  await page.waitForTimeout(500);
  await expect(page.locator(`text=${title}`)).toBeVisible({ timeout: 8000 });
});

// ── 测试 3：用户 B 收藏用户 A 的胶囊 ─────────────────────────────────────────

test("用户 B 收藏用户 A 的胶囊", async ({ browser }) => {
  const s = rand();
  const title = `fav_cap_${s}`;

  // 用户 A：注册 + 创建胶囊
  const ctxA = await browser.newContext();
  const pageA = await ctxA.newPage();
  await register(pageA, {
    email: `ua_${s}@ui-smoke.hellotimepro.dev`,
    password: "Test1234!",
    nickname: `甲${s}`,
  });
  await createCapsule(pageA, title);
  await ctxA.close();

  // 用户 B：注册 → 广场看到胶囊 → 收藏
  const ctxB = await browser.newContext();
  const pageB = await ctxB.newPage();
  await register(pageB, {
    email: `ub_${s}@ui-smoke.hellotimepro.dev`,
    password: "Test1234!",
    nickname: `乙${s}`,
  });
  await pageB.goto("/");
  await pageB.waitForTimeout(500);

  // 找到目标胶囊卡片
  const capsuleTitle = pageB.locator(`text=${title}`).first();
  await expect(capsuleTitle).toBeVisible({ timeout: 8000 });

  // 找最近的 .cy-capsule__fav 按钮并点击
  const article = pageB.locator("article.cy-capsule", { has: pageB.locator(`text=${title}`) }).first();
  await article.locator(".cy-capsule__fav").click();
  await pageB.waitForTimeout(800);

  // 验证"我收藏的"有该胶囊
  await pageB.goto("/me/favorites");
  await expect(pageB.locator(`text=${title}`)).toBeVisible({ timeout: 8000 });

  await ctxB.close();
});

// ── 测试 4：登出后访问受保护页跳到 /login ────────────────────────────────────

test("登出后访问受保护页跳转到登录", async ({ page }) => {
  const s = rand();
  await register(page, {
    email: `lo_${s}@ui-smoke.hellotimepro.dev`,
    password: "Test1234!",
    nickname: `登出${s}`,
  });

  // 先到广场页，确保 header 完全渲染
  await page.goto("/");
  await page.locator(".cy-user-chip--button").waitFor({ timeout: 5000 });
  await page.locator(".cy-user-chip--button").click();
  // 等下拉菜单出现
  const logoutBtn = page.getByRole("menuitem", { name: "登出" });
  await logoutBtn.waitFor({ timeout: 3000 });
  await logoutBtn.click();
  await expect(page.getByRole("link", { name: "登录" })).toBeVisible({ timeout: 8000 });

  // 访问受保护页 → 应跳 /login
  await page.goto("/create");
  await expect(page).toHaveURL(/login/, { timeout: 5000 });
});
