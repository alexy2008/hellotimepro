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

// 推荐区行为现在依赖 LLM（失败则静默不显示），为保证冒烟稳定，
// 用路由 mock 固定推荐 / 建议接口的响应，专注验证前端的展示与交互。
function envelope(data: unknown): string {
  return JSON.stringify({ success: true, data, message: null, errorCode: null });
}

const MOCK_RECOS = [
  { title: "猜猜下届世界杯冠军", hint: "把你押注的球队写下来", openInDays: 365 },
  { title: "五年后的我在哪座城市", hint: "替现在的我看看风景", openInDays: 1825 },
  { title: "下个月想完成的小事", hint: "立个温柔的 flag", openInDays: 30 },
];

async function mockRecommendations(page: import("@playwright/test").Page, items: typeof MOCK_RECOS) {
  await page.route("**/api/v1/capsule-recommendations**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: envelope({ items, generatedBy: items.length ? "mock" : "none", cached: false }),
    }),
  );
}

async function mockSuggestion(
  page: import("@playwright/test").Page,
  data: { title?: string; content: string },
) {
  await page.route("**/api/v1/capsule-suggestion", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: envelope({
        title: data.title,
        content: data.content,
        openInDays: 30,
        openAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
        generatedBy: "mock",
        cached: false,
      }),
    }),
  );
}

test("进入创建页后异步加载并显示 AI 推荐主题", async ({ page }) => {
  await mockRecommendations(page, MOCK_RECOS);
  // registerViaUi 注册后会落在 /create，推荐区在 mount 时异步拉取
  await registerViaUi(page, { nickname: uniqueNickname("灵感") });

  const chips = page.getByTestId("reco-chip");
  await expect(chips.first()).toBeVisible({ timeout: 10_000 });
  expect(await chips.count()).toBe(MOCK_RECOS.length);
});

test("AI 推荐返回空时不显示推荐区（静默失败）", async ({ page }) => {
  await mockRecommendations(page, []);
  await registerViaUi(page, { nickname: uniqueNickname("空荐") });

  // 标题字段渲染后，仍不应出现推荐标签或"换一批"
  await expect(page.locator("#title")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("reco-chip")).toHaveCount(0);
  await expect(page.getByTestId("reco-refresh")).toHaveCount(0);
  await expect(page.getByText("没有头绪？")).toHaveCount(0);
});

test("点击推荐主题自动填入标题与正文", async ({ page }) => {
  await mockRecommendations(page, MOCK_RECOS);
  await mockSuggestion(page, { content: "这是为该主题生成的胶囊正文。" });
  await registerViaUi(page, { nickname: uniqueNickname("点选") });

  const chips = page.getByTestId("reco-chip");
  await expect(chips.first()).toBeVisible({ timeout: 10_000 });
  const chipText = (await chips.first().innerText()).trim();

  await chips.first().click();

  // 正文被填入；标题等于被点击的推荐文字
  await expect(page.locator("#content")).not.toHaveValue("", { timeout: 10_000 });
  await expect(page.locator("#title")).toHaveValue(chipText);
});

test("空标题直接 AI 生成会同时补全标题与正文并可提交", async ({ page }) => {
  await mockRecommendations(page, []); // 不让推荐区干扰本用例
  await mockSuggestion(page, { title: "AI 生成的标题", content: "AI 生成的正文内容。" });
  await registerViaUi(page, { nickname: uniqueNickname("起题") });

  // 标题留空时按钮文案为"AI 生成"
  await page.getByRole("button", { name: "✨ AI 生成" }).click();

  await expect(page.locator("#title")).toHaveValue("AI 生成的标题", { timeout: 10_000 });
  await expect(page.locator("#content")).not.toHaveValue("", { timeout: 10_000 });

  // 生成后可继续封存并跳转到胶囊详情（创建走真实接口）
  await page.getByRole("button", { name: "1 分钟后（测试）" }).click();
  await page.getByRole("button", { name: /上锁封存/ }).click();
  await page.waitForURL(
    (url) => url.pathname.includes("/c/"),
    { timeout: 10_000 },
  );
});

test("推荐区换一批按钮可用且不报错", async ({ page }) => {
  await mockRecommendations(page, MOCK_RECOS);
  await registerViaUi(page, { nickname: uniqueNickname("换批") });

  await expect(page.getByTestId("reco-chip").first()).toBeVisible({ timeout: 10_000 });
  await page.getByTestId("reco-refresh").click();

  // 换一批后推荐仍然可见
  await expect(page.getByTestId("reco-chip").first()).toBeVisible({ timeout: 10_000 });
});
