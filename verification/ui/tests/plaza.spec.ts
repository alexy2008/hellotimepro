// 广场：搜索、筛选数量、排序、收藏（含自己的、匿名）、概览
import { expect, test } from "@playwright/test";
import {
  apiCreateCapsule,
  apiFavorite,
  apiRegister,
  cardOf,
  gotoPlaza,
  loginViaUi,
  rand,
  searchPlaza,
  setSort,
  tid,
  uniqueNickname,
} from "./_helpers";

test("广场搜索标题会过滤列表，筛选标签上的数量跟着变", async ({ page, request }) => {
  const user = await apiRegister(request, { nickname: uniqueNickname("搜索") });
  const tag = `搜${rand(6)}`;
  const hit = await apiCreateCapsule(request, user.accessToken, { title: `${tag} 命中` });
  const miss = await apiCreateCapsule(request, user.accessToken, { title: `排除 ${rand(6)}` });

  await searchPlaza(page, tag);
  await expect(cardOf(page, hit.code)).toBeVisible({ timeout: 10_000 });
  await expect(cardOf(page, miss.code)).toHaveCount(0);
  await expect(page.locator('[data-testid="filter-option"][data-value="all"]')).toHaveAttribute("data-count", "1", { timeout: 10_000 });
  await expect(page.locator('[data-testid="filter-option"][data-value="unopened"]')).toHaveAttribute("data-count", "1");
  await expect(page.locator('[data-testid="filter-option"][data-value="opened"]')).toHaveAttribute("data-count", "0");
});

test("筛选「已开启」后只剩已开启的卡片", async ({ page }) => {
  await gotoPlaza(page);
  await page.locator('[data-testid="filter-option"][data-value="opened"]').click();
  await expect(page.locator('[data-testid="filter-option"][data-value="opened"]')).toHaveAttribute("data-selected", "true");
  await expect(tid(page, "capsule-card").first()).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('[data-testid="capsule-card"][data-state="sealed"]')).toHaveCount(0);
});

test("最热排序下收藏数从高到低", async ({ page }) => {
  await gotoPlaza(page);
  await setSort(page, "hot");
  await expect(tid(page, "capsule-card").first()).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(600);
  const counts = await page.locator('[data-testid="capsule-card"] [data-testid="fav-button"]').evaluateAll((els) =>
    els.map((e) => Number(e.getAttribute("data-count"))),
  );
  expect(counts.length).toBeGreaterThan(1);
  expect([...counts].sort((a, b) => b - a)).toEqual(counts);
});

test("首页广场概览来自 /plaza/stats", async ({ page }) => {
  await gotoPlaza(page);
  const all = page.locator('[data-testid="stat"][data-key="all"]');
  await expect(all).toBeVisible({ timeout: 10_000 });
  const n = Number(await all.getAttribute("data-value"));
  const opened = Number(await page.locator('[data-testid="stat"][data-key="opened"]').getAttribute("data-value"));
  const unopened = Number(await page.locator('[data-testid="stat"][data-key="unopened"]').getAttribute("data-value"));
  expect(n).toBe(opened + unopened);
});

test("已登录用户在广场收藏后会出现在我收藏的", async ({ page, request }) => {
  const owner = await apiRegister(request, { nickname: uniqueNickname("作者") });
  const fan = await apiRegister(request, { nickname: uniqueNickname("粉丝") });
  const cap = await apiCreateCapsule(request, owner.accessToken, { title: `收藏目标 ${rand(6)}` });

  await loginViaUi(page, fan);
  await searchPlaza(page, cap.title);
  const fav = cardOf(page, cap.code).getByTestId("fav-button");
  await expect(fav).toHaveAttribute("aria-pressed", "false", { timeout: 10_000 });
  await fav.click();
  await expect(fav).toHaveAttribute("aria-pressed", "true");

  await page.goto("/me/favorites");
  await expect(page.locator(`[data-testid="fav-item"][data-code="${cap.code}"]`)).toBeVisible({ timeout: 10_000 });
});

test("2.0：可以收藏自己写的胶囊", async ({ page, request }) => {
  const me = await apiRegister(request, { nickname: uniqueNickname("自藏") });
  const cap = await apiCreateCapsule(request, me.accessToken, { title: `自己的 ${rand(6)}` });
  await loginViaUi(page, me);
  await searchPlaza(page, cap.title);
  const fav = cardOf(page, cap.code).getByTestId("fav-button");
  await fav.click();
  await expect(fav).toHaveAttribute("aria-pressed", "true", { timeout: 8000 });
  await expect(fav).toHaveAttribute("data-count", "1");
});

test("匿名用户点击收藏会先确认，再带着 redirect 去登录", async ({ page, request }) => {
  const owner = await apiRegister(request, { nickname: uniqueNickname("匿名") });
  const cap = await apiCreateCapsule(request, owner.accessToken, { title: `匿名收藏 ${rand(6)}` });
  await searchPlaza(page, cap.title);
  await cardOf(page, cap.code).getByTestId("fav-button").click();
  await expect(tid(page, "confirm-dialog")).toBeVisible({ timeout: 8000 });
  await tid(page, "confirm-ok").click();
  await expect(page).toHaveURL(/\/login\?redirect=/, { timeout: 8000 });
});

test("我收藏的页面展示 API 预置收藏（含未公开的胶囊）", async ({ page, request }) => {
  const owner = await apiRegister(request, { nickname: uniqueNickname("被藏") });
  const fan = await apiRegister(request, { nickname: uniqueNickname("藏家") });
  const pub = await apiCreateCapsule(request, owner.accessToken, { title: `预置收藏 ${rand(6)}` });
  const priv = await apiCreateCapsule(request, owner.accessToken, { title: `未公开 ${rand(6)}`, inPlaza: false });
  await apiFavorite(request, fan.accessToken, pub.id);
  await apiFavorite(request, fan.accessToken, priv.id);

  await loginViaUi(page, fan);
  await page.goto("/me/favorites");
  await expect(page.locator(`[data-testid="fav-item"][data-code="${pub.code}"]`)).toBeVisible({ timeout: 10_000 });
  const row = page.locator(`[data-testid="fav-item"][data-code="${priv.code}"]`);
  await expect(row).toHaveAttribute("data-in-plaza", "false");
  await expect(row.getByTestId("row-open")).toHaveAttribute("href", `/capsules/${priv.code}`);
});
