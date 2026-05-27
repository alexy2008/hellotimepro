import { expect, test } from "@playwright/test";
import {
  apiCreateCapsule,
  apiFavorite,
  apiRegister,
  capsuleCard,
  loginViaUi,
  searchPlaza,
  uniqueNickname,
} from "./_helpers";

test("广场搜索标题会过滤列表", async ({ page, request }) => {
  const user = await apiRegister(request, { nickname: uniqueNickname("搜索") });
  const suffix = Date.now();
  const hit = await apiCreateCapsule(request, user.accessToken, {
    title: `搜索命中 ${suffix}`,
    openAtSeconds: 3600,
  });
  const miss = await apiCreateCapsule(request, user.accessToken, {
    title: `搜索排除 ${suffix}`,
    openAtSeconds: 3600,
  });

  await searchPlaza(page, hit.title);

  await expect(capsuleCard(page, hit.title)).toBeVisible({ timeout: 10_000 });
  await expect(page.locator("article.cy-capsule").filter({ hasText: miss.title })).toHaveCount(0);
});

test("已登录用户在广场收藏后会出现在我收藏的", async ({ page, request }) => {
  const owner = await apiRegister(request, { nickname: uniqueNickname("作者") });
  const fan = await apiRegister(request, { nickname: uniqueNickname("粉丝") });
  const capsule = await apiCreateCapsule(request, owner.accessToken, {
    title: `收藏目标 ${Date.now()}`,
    openAtSeconds: 3600,
  });

  await loginViaUi(page, fan);
  await searchPlaza(page, capsule.title);
  const card = capsuleCard(page, capsule.title);
  await expect(card).toBeVisible({ timeout: 10_000 });
  await card.locator(".cy-capsule__fav").click();

  await page.goto("/me/favorites");
  await expect(capsuleCard(page, capsule.title)).toBeVisible({ timeout: 10_000 });
});

test("匿名用户点击收藏会确认并前往登录", async ({ page, request }) => {
  const owner = await apiRegister(request, { nickname: uniqueNickname("匿名") });
  const capsule = await apiCreateCapsule(request, owner.accessToken, {
    title: `匿名收藏 ${Date.now()}`,
    openAtSeconds: 3600,
  });

  await searchPlaza(page, capsule.title);
  const card = capsuleCard(page, capsule.title);
  await expect(card).toBeVisible({ timeout: 10_000 });

  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain("登录后才能收藏");
    await dialog.accept();
  });
  await card.locator(".cy-capsule__fav").click();

  await expect(page).toHaveURL(/\/login/, { timeout: 8000 });
});

test("我收藏的页面展示 API 预置收藏", async ({ page, request }) => {
  const owner = await apiRegister(request, { nickname: uniqueNickname("被藏") });
  const fan = await apiRegister(request, { nickname: uniqueNickname("藏家") });
  const capsule = await apiCreateCapsule(request, owner.accessToken, {
    title: `预置收藏 ${Date.now()}`,
    openAtSeconds: 3600,
  });
  await apiFavorite(request, fan.accessToken, capsule.id);

  await loginViaUi(page, fan);
  await page.goto("/me/favorites");

  await expect(capsuleCard(page, capsule.title)).toBeVisible({ timeout: 10_000 });
});
