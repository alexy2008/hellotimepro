import { expect, test } from "@playwright/test";
import {
  apiRegister,
  expectUserMenuTitle,
  loginViaUi,
  logoutViaUi,
  registerViaUi,
  uniqueNickname,
} from "./_helpers";

test("用户可通过 UI 注册并进入创建页", async ({ page }) => {
  const nickname = uniqueNickname("注册");
  await registerViaUi(page, { nickname });

  await expect(page.locator("#title")).toBeVisible();
  await page.goto("/");
  await expectUserMenuTitle(page, nickname);
});

test("API 准备的账号可通过 UI 登录", async ({ page, request }) => {
  const user = await apiRegister(request, { nickname: uniqueNickname("登录") });

  await loginViaUi(page, user);
  await expect(page.getByRole("heading", { name: /我创建的胶囊/ })).toBeVisible();
});

test("错误密码停留在登录页并显示错误", async ({ page, request }) => {
  const user = await apiRegister(request, { nickname: uniqueNickname("错密") });

  await page.goto("/login");
  await page.locator("#email").fill(user.email);
  await page.locator("#pwd").fill("Wrong1234!");
  await page.getByRole("button", { name: /^登录$/ }).click();

  await expect(page).toHaveURL(/\/login/, { timeout: 8000 });
  await expect(page.locator(".cy-alert--danger")).toBeVisible({ timeout: 8000 });
});

test("登出后访问受保护页跳转登录", async ({ page, request }) => {
  const user = await apiRegister(request, { nickname: uniqueNickname("登出") });

  await loginViaUi(page, user);
  await logoutViaUi(page);
  await page.goto("/create");

  await expect(page).toHaveURL(/\/login/, { timeout: 8000 });
});
