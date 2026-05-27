import { expect, test } from "@playwright/test";
import { apiRegister, uniqueNickname } from "./_helpers";

test("公开主页面、开启页、关于页可渲染", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".cy-brand")).toBeVisible();
  await expect(page.locator(".cy-nav").getByRole("link", { name: "开启", exact: true })).toBeVisible();
  await expect(page.locator(".cy-search__input")).toBeVisible();

  await page.goto("/open");
  await expect(page.getByRole("heading", { name: /8 位|密钥/ })).toBeVisible();
  await expect(page.locator(".cy-code-input input")).toHaveCount(8);

  await page.goto("/about");
  await expect(page.getByRole("heading", { name: /关于/ })).toBeVisible();
  await expect(page.getByText("前端技术栈")).toBeVisible();
});

test("注册页头像选择器从后端加载", async ({ page }) => {
  await page.goto("/register");
  await expect(page.locator('[role="radiogroup"] button')).toHaveCount(10, { timeout: 8000 });
});

test("匿名访问受保护页面会跳转登录", async ({ page }) => {
  await page.goto("/create");
  await expect(page).toHaveURL(/\/login/, { timeout: 8000 });

  await page.goto("/me/favorites");
  await expect(page).toHaveURL(/\/login/, { timeout: 8000 });
});

test("登录后访问注册页不会破坏当前会话", async ({ page, request }) => {
  const user = await apiRegister(request, { nickname: uniqueNickname("会话") });
  await page.goto("/login");
  await page.locator("#email").fill(user.email);
  await page.locator("#pwd").fill(user.password);
  await page.getByRole("button", { name: /^登录$/ }).click();
  await page.waitForURL((url) => !url.pathname.endsWith("/login"), { timeout: 10_000 });

  await page.goto("/register");
  await page.goto("/");
  await expect(page.locator(".cy-user-chip--button")).toBeVisible({ timeout: 8000 });
});
