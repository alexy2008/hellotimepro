// 账号：注册、登录、错误密码、登出、登录回跳
import { expect, test } from "@playwright/test";
import { apiRegister, loginViaUi, logoutViaUi, registerViaUi, tid, uniqueNickname } from "./_helpers";

test("用户可通过 UI 注册并进入创建页", async ({ page }) => {
  const user = await registerViaUi(page, { nickname: uniqueNickname("注册") });
  await expect(tid(page, "user-menu")).toHaveAttribute("data-nickname", user.nickname, { timeout: 8000 });
  await expect(tid(page, "create-title")).toBeVisible();
});

test("API 准备的账号可通过 UI 登录，默认进入「我创建的」", async ({ page, request }) => {
  const user = await apiRegister(request, { nickname: uniqueNickname("登录") });
  await loginViaUi(page, user);
  await expect(page).toHaveURL(/\/me\/created$/);
  await expect(tid(page, "user-menu")).toHaveAttribute("data-nickname", user.nickname);
});

test("错误密码停留在登录页并显示错误", async ({ page, request }) => {
  const user = await apiRegister(request, { nickname: uniqueNickname("错密") });
  await page.goto("/login");
  await tid(page, "login-email").fill(user.email);
  await tid(page, "login-password").fill("Wrong-password-1");
  await tid(page, "login-submit").click();
  await expect(tid(page, "login-error")).toBeVisible({ timeout: 8000 });
  await expect(page).toHaveURL(/\/login/);
});

test("登出后访问受保护页跳转登录，并带上 redirect", async ({ page, request }) => {
  const user = await apiRegister(request, { nickname: uniqueNickname("登出") });
  await loginViaUi(page, user);
  await logoutViaUi(page);
  await page.goto("/me/favorites");
  await expect(page).toHaveURL(/\/login\?redirect=%2Fme%2Ffavorites/, { timeout: 8000 });
});

test("登录后回到 redirect 指向的页面；外站地址不会被跳转", async ({ page, request }) => {
  const user = await apiRegister(request, { nickname: uniqueNickname("回跳") });
  await page.goto("/login?redirect=%2Fabout");
  await tid(page, "login-email").fill(user.email);
  await tid(page, "login-password").fill(user.password);
  await tid(page, "login-submit").click();
  await expect(page).toHaveURL(/\/about$/, { timeout: 10_000 });

  await logoutViaUi(page);
  await page.goto("/login?redirect=%2F%2Fevil.example.com");
  await tid(page, "login-email").fill(user.email);
  await tid(page, "login-password").fill(user.password);
  await tid(page, "login-submit").click();
  await page.waitForURL((u) => !u.pathname.endsWith("/login"), { timeout: 10_000 });
  expect(page.url()).not.toContain("evil.example.com");
});
