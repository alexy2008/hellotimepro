// 「我的」：统计、页签、删除、资料、密码
import { expect, test } from "@playwright/test";
import { apiCreateCapsule, apiFavorite, apiRegister, loginViaUi, rand, tid, uniqueNickname } from "./_helpers";

test("页头统计与页签数量来自 /me/stats", async ({ page, request }) => {
  const me = await apiRegister(request, { nickname: uniqueNickname("统计") });
  const fan = await apiRegister(request, { nickname: uniqueNickname("来藏") });
  const a = await apiCreateCapsule(request, me.accessToken);
  await apiCreateCapsule(request, me.accessToken, { inPlaza: false });
  await apiFavorite(request, fan.accessToken, a.id);

  await loginViaUi(page, me);
  await page.goto("/me/created");
  await expect(page.locator('[data-testid="me-stat"][data-key="created"]')).toHaveAttribute("data-value", "2", { timeout: 10_000 });
  await expect(page.locator('[data-testid="me-stat"][data-key="unopened"]')).toHaveAttribute("data-value", "2");
  await expect(page.locator('[data-testid="me-stat"][data-key="favoritesReceived"]')).toHaveAttribute("data-value", "1");
  await expect(tid(page, "me-tab-created")).toHaveAttribute("data-count", "2");
  await expect(tid(page, "my-capsule")).toHaveCount(2);
});

test("删除胶囊：确认后从列表消失，统计同步减少", async ({ page, request }) => {
  const me = await apiRegister(request, { nickname: uniqueNickname("删除") });
  const cap = await apiCreateCapsule(request, me.accessToken, { title: `要删除 ${rand(6)}` });
  await apiCreateCapsule(request, me.accessToken, { title: `留下 ${rand(6)}` });

  await loginViaUi(page, me);
  await page.goto("/me/created");
  const row = page.locator(`[data-testid="my-capsule"][data-code="${cap.code}"]`);
  await row.getByTestId("delete-capsule").click();
  await expect(tid(page, "confirm-dialog")).toBeVisible();
  await tid(page, "confirm-cancel").click();
  await expect(row).toHaveCount(1);

  await row.getByTestId("delete-capsule").click();
  await tid(page, "confirm-ok").click();
  await expect(row).toHaveCount(0, { timeout: 10_000 });
  await expect(page.locator('[data-testid="me-stat"][data-key="created"]')).toHaveAttribute("data-value", "1", { timeout: 10_000 });

  await page.goto(`/capsules/${cap.code}`);
  await expect(tid(page, "detail-not-found")).toBeVisible({ timeout: 10_000 });
});

test("资料页可修改昵称并同步到用户菜单", async ({ page, request }) => {
  const me = await apiRegister(request, { nickname: uniqueNickname("改名") });
  await loginViaUi(page, me);
  await page.goto("/me/profile");
  const next = uniqueNickname("新名");
  await tid(page, "profile-nickname").fill(next);
  await tid(page, "profile-save").click();
  await expect(tid(page, "user-menu")).toHaveAttribute("data-nickname", next, { timeout: 10_000 });
});

test("资料页无改动保存会显示提示", async ({ page, request }) => {
  const me = await apiRegister(request, { nickname: uniqueNickname("无改") });
  await loginViaUi(page, me);
  await page.goto("/me/profile");
  await tid(page, "profile-save").click();
  await expect(page.locator('[data-testid="toast"][data-tone="info"]')).toBeVisible({ timeout: 8000 });
});

test("修改密码时两次新密码不一致会被前端拦截", async ({ page, request }) => {
  const me = await apiRegister(request, { nickname: uniqueNickname("改密") });
  await loginViaUi(page, me);
  await page.goto("/me/profile");
  let called = false;
  page.on("request", (r) => {
    if (r.url().includes("/api/v1/me/password")) called = true;
  });
  await tid(page, "pwd-current").fill(me.password);
  await tid(page, "pwd-new").fill("NewPass123");
  await tid(page, "pwd-confirm").fill("NewPass124");
  await tid(page, "pwd-submit").click();
  await expect(page.locator('[data-testid="field-error"][data-field="confirm"]')).toBeVisible();
  expect(called).toBe(false);
});

test("个人中心页签可在三页之间切换", async ({ page, request }) => {
  const me = await apiRegister(request, { nickname: uniqueNickname("切页") });
  await loginViaUi(page, me);
  await page.goto("/me/created");
  await tid(page, "me-tab-favorites").click();
  await expect(page).toHaveURL(/\/me\/favorites$/);
  await expect(tid(page, "me-tab-favorites")).toHaveAttribute("aria-current", "page");
  await tid(page, "me-tab-profile").click();
  await expect(tid(page, "profile-nickname")).toBeVisible();
  await tid(page, "user-menu").click();
  await tid(page, "menu-created").click();
  await expect(page).toHaveURL(/\/me\/created$/);
});

test("「我创建的」超过一页时可以加载更多，直到看到全部", async ({ page, request }) => {
  const me = await apiRegister(request, { nickname: uniqueNickname("多页") });
  const N = 21;
  for (let i = 0; i < N; i++) await apiCreateCapsule(request, me.accessToken, { title: `第 ${i + 1} 枚 ${rand(4)}` });

  await loginViaUi(page, me);
  await page.goto("/me/created");
  await expect(tid(page, "my-capsule").first()).toBeVisible({ timeout: 10_000 });
  for (let round = 0; round < 10 && (await tid(page, "list-next").count()); round++) {
    const before = await tid(page, "my-capsule").count();
    await tid(page, "list-next").click();
    await expect.poll(() => tid(page, "my-capsule").count(), { timeout: 10_000 }).toBeGreaterThan(before);
  }
  await expect(tid(page, "my-capsule")).toHaveCount(N);
  await expect(tid(page, "list-next")).toHaveCount(0);
  await expect(tid(page, "me-tab-created")).toHaveAttribute("data-count", String(N));
});
