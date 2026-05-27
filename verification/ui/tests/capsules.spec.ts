import { expect, test } from "@playwright/test";
import {
  apiCreateCapsule,
  apiRegister,
  capsuleCard,
  capsulePath,
  createCapsuleViaUi,
  enterCapsuleCode,
  loginViaUi,
  registerViaUi,
  searchPlaza,
  uniqueNickname,
} from "./_helpers";

test("UI 创建胶囊后可在广场按标题检索到", async ({ page }) => {
  await registerViaUi(page, { nickname: uniqueNickname("作者") });
  const capsule = await createCapsuleViaUi(page);

  await searchPlaza(page, capsule.title);
  await expect(capsuleCard(page, capsule.title)).toBeVisible({ timeout: 10_000 });
});

test("开启页输入 8 位码跳转到胶囊详情", async ({ page, request }) => {
  const user = await apiRegister(request, { nickname: uniqueNickname("码主") });
  const capsule = await apiCreateCapsule(request, user.accessToken, {
    title: `开码 ${Date.now()}`,
    openAtSeconds: 3600,
  });

  await enterCapsuleCode(page, capsule.code);

  await expect(page).toHaveURL(new RegExp(`${capsulePath(capsule.code)}$`), { timeout: 10_000 });
  await expect(page.getByRole("heading", { name: capsule.title })).toBeVisible();
});

test("未开启详情页隐藏正文并显示未开启状态", async ({ page, request }) => {
  const user = await apiRegister(request, { nickname: uniqueNickname("封存") });
  const content = `不可提前看到 ${Date.now()}`;
  const capsule = await apiCreateCapsule(request, user.accessToken, {
    title: `未开启 ${Date.now()}`,
    content,
    openAtSeconds: 7200,
  });

  await page.goto(capsulePath(capsule.code));

  await expect(page.getByRole("heading", { name: capsule.title })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("未开启").first()).toBeVisible();
  await expect(page.getByText(content)).toHaveCount(0);
});

test("我创建的列表包含当前用户创建的胶囊", async ({ page, request }) => {
  const user = await apiRegister(request, { nickname: uniqueNickname("我的") });
  const capsule = await apiCreateCapsule(request, user.accessToken, {
    title: `我的胶囊 ${Date.now()}`,
    openAtSeconds: 3600,
  });

  await loginViaUi(page, user);

  await expect(capsuleCard(page, capsule.title)).toBeVisible({ timeout: 10_000 });
});
