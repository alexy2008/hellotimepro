// 公共页面、守卫、皮肤与明暗切换
import { expect, test } from "@playwright/test";
import { apiRegister, loginViaUi, registerViaUi, tid, uniqueNickname } from "./_helpers";

test("公开主页面、开启页、关于页可渲染", async ({ page }) => {
  await page.goto("/");
  await expect(tid(page, "nav-plaza")).toBeVisible();
  await expect(tid(page, "plaza-search")).toBeVisible();
  await expect(tid(page, "plaza-stats")).toBeVisible();
  await expect(tid(page, "footer-stack")).toBeVisible();

  await page.goto("/open");
  await expect(tid(page, "code-input")).toBeVisible();
  await expect(page.locator("[data-code-cell]")).toHaveCount(8);

  await page.goto("/about");
  await expect(page.getByTestId("about-feature")).toHaveCount(6);
  await expect(page.getByTestId("about-tenet")).toHaveCount(4);
  await expect(tid(page, "about-stack").getByTestId("stack-item").first()).toBeVisible({ timeout: 10_000 });
});

test("当前皮肤来自预置的 localStorage", async ({ page }, info) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-skin", info.project.name);
  await expect(page.locator(`[data-testid="skin-option"][data-value="${info.project.name}"]`)).toHaveAttribute("data-selected", "true");
});

test("注册页头像选择器从后端加载", async ({ page }) => {
  await page.goto("/register");
  await expect(tid(page, "avatar-option")).toHaveCount(10, { timeout: 8000 });
});

test("匿名访问受保护页面会跳转登录", async ({ page }) => {
  await page.goto("/create");
  await expect(page).toHaveURL(/\/login\?redirect=%2Fcreate/, { timeout: 8000 });
  await page.goto("/me/favorites");
  await expect(page).toHaveURL(/\/login/, { timeout: 8000 });
});

test("登录后访问注册页不会破坏当前会话", async ({ page, request }) => {
  const user = await apiRegister(request, { nickname: uniqueNickname("会话") });
  await loginViaUi(page, user);
  await page.goto("/register");
  await expect(page).not.toHaveURL(/\/register$/, { timeout: 8000 });
  await expect(tid(page, "user-menu")).toHaveAttribute("data-nickname", user.nickname);
});

test("切换皮肤与明暗后，草稿与路由都还在", async ({ page }, info) => {
  await registerViaUi(page, { nickname: uniqueNickname("换肤") });
  await tid(page, "create-title").fill("切换皮肤也不丢的草稿");
  const other = info.project.name === "paper" ? "amber" : "paper";
  await page.locator(`[data-testid="skin-option"][data-value="${other}"]`).click();
  await expect(page.locator("html")).toHaveAttribute("data-skin", other, { timeout: 2000 });
  await expect(page).toHaveURL(/\/create$/);
  await expect(tid(page, "create-title")).toHaveValue("切换皮肤也不丢的草稿");

  const before = await page.locator("html").getAttribute("data-theme");
  await tid(page, "theme-toggle").click();
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", before ?? "", { timeout: 2000 });
  await expect(tid(page, "create-title")).toHaveValue("切换皮肤也不丢的草稿");
});

test("切换皮肤与明暗时，注册表单里填了一半的内容不丢", async ({ page }, info) => {
  await page.goto("/register");
  await tid(page, "register-email").fill("half-filled@ui-smoke.hellotimepro.dev");
  await tid(page, "register-nickname").fill("填了一半");
  await tid(page, "register-password").fill("abc12345");
  await expect(tid(page, "avatar-option")).toHaveCount(10, { timeout: 8000 });
  const pick = tid(page, "avatar-option").nth(3);
  const avatar = await pick.getAttribute("data-value");
  await pick.click();

  const check = async () => {
    await expect(page).toHaveURL(/\/register$/);
    await expect(tid(page, "register-email")).toHaveValue("half-filled@ui-smoke.hellotimepro.dev");
    await expect(tid(page, "register-nickname")).toHaveValue("填了一半");
    await expect(tid(page, "register-password")).toHaveValue("abc12345");
    await expect(page.locator(`[data-testid="avatar-option"][data-value="${avatar}"]`)).toHaveAttribute("data-selected", "true");
  };
  const other = info.project.name === "paper" ? "amber" : "paper";
  await page.locator(`[data-testid="skin-option"][data-value="${other}"]`).click();
  await expect(page.locator("html")).toHaveAttribute("data-skin", other, { timeout: 2000 });
  await check();
  const before = await page.locator("html").getAttribute("data-theme");
  await tid(page, "theme-toggle").click();
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", before ?? "", { timeout: 2000 });
  await check();
});

test("匿名点击创建入口会先确认，确认后带着 redirect 去登录", async ({ page }) => {
  await page.goto("/");
  await tid(page, "home-create").click();
  await expect(tid(page, "confirm-dialog")).toBeVisible({ timeout: 8000 });
  await tid(page, "confirm-cancel").click();
  await expect(tid(page, "confirm-dialog")).toHaveCount(0, { timeout: 8000 });
  await expect(page).toHaveURL(/\/$/);

  await tid(page, "nav-create").click();
  await expect(tid(page, "confirm-dialog")).toBeVisible({ timeout: 8000 });
  await tid(page, "confirm-ok").click();
  await expect(page).toHaveURL(/\/login\?redirect=%2Fcreate$/, { timeout: 8000 });
});

test("未知路径显示 404", async ({ page }) => {
  await page.goto("/no/such/page");
  await expect(tid(page, "not-found")).toBeVisible();
});
