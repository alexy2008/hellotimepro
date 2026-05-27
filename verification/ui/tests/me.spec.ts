import { expect, test } from "@playwright/test";
import { apiRegister, expectUserMenuTitle, loginViaUi, uniqueNickname } from "./_helpers";

test("资料页可修改昵称并同步到用户菜单", async ({ page, request }) => {
  const user = await apiRegister(request, { nickname: uniqueNickname("旧名") });
  const nextNickname = uniqueNickname("新名");

  await loginViaUi(page, user);
  await page.getByRole("link", { name: /账号设置/ }).click();
  await expect(page).toHaveURL(/\/me\/profile/);
  await expect(page.locator("#nick")).toHaveValue(user.nickname, { timeout: 8000 });
  await page.waitForLoadState("networkidle");
  await page.locator("#nick").fill(nextNickname);
  await expect(page.locator("#nick")).toHaveValue(nextNickname);
  await Promise.all([
    page.waitForResponse(
      (res) => res.url().includes("/api/v1/me") && res.request().method() === "PATCH",
    ),
    page.getByRole("button", { name: /保存更改/ }).click(),
  ]);

  await expect(page.getByText("已保存")).toBeVisible({ timeout: 8000 });
  await page.goto("/");
  await expectUserMenuTitle(page, nextNickname);
});

test("资料页无改动保存会显示提示", async ({ page, request }) => {
  const user = await apiRegister(request, { nickname: uniqueNickname("无改") });

  await loginViaUi(page, user);
  await page.getByRole("link", { name: /账号设置/ }).click();
  await expect(page).toHaveURL(/\/me\/profile/);
  await page.getByRole("button", { name: /保存更改/ }).click();

  await expect(page.getByText("没有改动")).toBeVisible({ timeout: 8000 });
});

test("修改密码时两次新密码不一致会被前端拦截", async ({ page, request }) => {
  const user = await apiRegister(request, { nickname: uniqueNickname("密码") });

  await loginViaUi(page, user);
  await page.getByRole("link", { name: /账号设置/ }).click();
  await expect(page).toHaveURL(/\/me\/profile/);
  await page.locator("#oldPwd").fill(user.password);
  await page.locator("#newPwd").fill("Next1234!");
  await page.locator("#confirmPwd").fill("Mismatch1234!");
  await page.getByRole("button", { name: /更新密码/ }).click();

  await expect(page.getByText("两次输入的新密码不一致")).toBeVisible({ timeout: 8000 });
  await expect(page).toHaveURL(/\/me\/profile/);
});

test("个人中心导航可在创建和收藏页面间切换", async ({ page, request }) => {
  const user = await apiRegister(request, { nickname: uniqueNickname("导航") });

  await loginViaUi(page, user);
  await expect(page.getByRole("heading", { name: /我创建的胶囊/ })).toBeVisible();

  await page.getByRole("link", { name: /我收藏的/ }).first().click();
  await expect(page).toHaveURL(/\/me\/favorites/);
  await expect(page.getByRole("heading", { name: /我收藏的胶囊/ })).toBeVisible();
});
