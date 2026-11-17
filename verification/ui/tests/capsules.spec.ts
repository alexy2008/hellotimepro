// 胶囊：创建（含长按封缄 / 按钮）、开启页、就地输码、详情、AI 推荐与代笔
import { expect, test, type Page } from "@playwright/test";
import {
  apiCreateCapsule,
  apiRegister,
  capsulePath,
  cardOf,
  createCapsuleViaUi,
  enterCode,
  loginViaUi,
  registerViaUi,
  searchPlaza,
  tid,
  uniqueNickname,
} from "./_helpers";

test("UI 创建胶囊后出现回执，并可在广场按标题检索到", async ({ page }) => {
  await registerViaUi(page, { nickname: uniqueNickname("创建") });
  const cap = await createCapsuleViaUi(page);
  await expect(tid(page, "receipt-view")).toHaveAttribute("href", capsulePath(cap.code));
  await searchPlaza(page, cap.title);
  await expect(cardOf(page, cap.code)).toBeVisible({ timeout: 10_000 });
});

test("创建页校验：标题为空时提示并不提交", async ({ page }) => {
  await registerViaUi(page, { nickname: uniqueNickname("校验") });
  await tid(page, "create-submit").focus();
  await tid(page, "create-submit").press("Space", { delay: 1500 });
  await expect(page.locator('[data-testid="field-error"][data-field="title"]')).toBeVisible();
  await expect(tid(page, "sealed-receipt")).toHaveCount(0);
});

test("未公开的胶囊不出现在广场，但可凭码打开", async ({ page }) => {
  await registerViaUi(page, { nickname: uniqueNickname("私密") });
  const cap = await createCapsuleViaUi(page, { inPlaza: false });
  await searchPlaza(page, cap.title);
  await expect(tid(page, "list-empty")).toBeVisible({ timeout: 10_000 });
  await page.goto(capsulePath(cap.code));
  await expect(tid(page, "capsule-detail")).toHaveAttribute("data-in-plaza", "false", { timeout: 10_000 });
});

test("开启页一次填入 8 位码，自动跳转到胶囊详情", async ({ page, request }) => {
  const user = await apiRegister(request, { nickname: uniqueNickname("开启") });
  const cap = await apiCreateCapsule(request, user.accessToken);
  await page.goto("/open");
  await enterCode(page, cap.code.toLowerCase());
  await expect(page).toHaveURL(new RegExp(`/capsules/${cap.code}$`), { timeout: 10_000 });
});

test("首页就地输码：错码就地提示，对的码跳到详情", async ({ page, request }) => {
  const user = await apiRegister(request, { nickname: uniqueNickname("就地") });
  const cap = await apiCreateCapsule(request, user.accessToken);
  await page.goto("/");
  await enterCode(page, "ZZZZ0000");
  await expect(tid(page, "open-error")).toBeVisible({ timeout: 10_000 });
  await enterCode(page, cap.code);
  await expect(page).toHaveURL(new RegExp(`/capsules/${cap.code}$`), { timeout: 10_000 });
});

test("未开启详情页隐藏正文并显示倒计时", async ({ page, request }) => {
  const user = await apiRegister(request, { nickname: uniqueNickname("封存") });
  const cap = await apiCreateCapsule(request, user.accessToken, { openAtSeconds: 7200 });
  await page.goto(capsulePath(cap.code));
  const detail = tid(page, "capsule-detail");
  await expect(detail).toHaveAttribute("data-state", "sealed", { timeout: 10_000 });
  await expect(tid(page, "countdown")).toBeVisible();
  await expect(tid(page, "detail-content")).toHaveCount(0);
  await expect(tid(page, "detail-title")).toHaveText(cap.title);
});

test("不存在的码显示查无此胶囊", async ({ page }) => {
  await page.goto(capsulePath("NOSUCH99"));
  await expect(tid(page, "detail-not-found")).toBeVisible({ timeout: 10_000 });
});

test("「我封存过的胶囊」出现在开启页", async ({ page, request }) => {
  const user = await apiRegister(request, { nickname: uniqueNickname("封过") });
  const cap = await apiCreateCapsule(request, user.accessToken);
  await loginViaUi(page, user);
  await page.goto("/open");
  await expect(page.locator(`[data-testid="my-sealed-item"][data-code="${cap.code}"]`)).toBeVisible({ timeout: 10_000 });
});

// ---------------------------------------------------------------- AI：路由 mock 保证确定性

function envelope(data: unknown): string {
  return JSON.stringify({ success: true, data, message: null, errorCode: null });
}

const MOCK_RECOS = [
  { title: "猜猜下届世界杯冠军", hint: "把你押注的球队写下来", openInDays: 365 },
  { title: "五年后的我在哪座城市", hint: "替现在的我看看风景", openInDays: 1825 },
  { title: "下个月想完成的小事", hint: "立个温柔的 flag", openInDays: 30 },
];

async function mockRecommendations(page: Page, items: typeof MOCK_RECOS) {
  await page.route("**/api/v1/capsule-recommendations**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: envelope({ items, generatedBy: items.length ? "mock" : "none", cached: false }),
    }),
  );
}

async function mockSuggestion(page: Page, data: { title?: string; content: string }) {
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
  await registerViaUi(page, { nickname: uniqueNickname("灵感") });
  await expect(tid(page, "ai-reco")).toBeVisible({ timeout: 10_000 });
  await expect(tid(page, "reco-chip")).toHaveCount(MOCK_RECOS.length);
});

test("AI 推荐返回空时不显示推荐区（静默失败）", async ({ page }) => {
  await mockRecommendations(page, []);
  await registerViaUi(page, { nickname: uniqueNickname("空荐") });
  await expect(tid(page, "create-title")).toBeVisible();
  await expect(tid(page, "ai-reco")).toHaveCount(0);
  await expect(tid(page, "reco-chip")).toHaveCount(0);
});

test("点击推荐主题自动填入标题与正文", async ({ page }) => {
  await mockRecommendations(page, MOCK_RECOS);
  await mockSuggestion(page, { content: "这是为该主题生成的胶囊正文。" });
  await registerViaUi(page, { nickname: uniqueNickname("点选") });
  await tid(page, "reco-chip").first().click();
  await expect(tid(page, "create-title")).toHaveValue(MOCK_RECOS[0].title, { timeout: 10_000 });
  await expect(tid(page, "create-content")).toHaveValue("这是为该主题生成的胶囊正文。", { timeout: 10_000 });
});

test("空标题直接 AI 生成会同时补全标题与正文并可封存", async ({ page }) => {
  await mockRecommendations(page, []);
  await mockSuggestion(page, { title: "AI 生成的标题", content: "AI 生成的正文内容。" });
  await registerViaUi(page, { nickname: uniqueNickname("起题") });
  await tid(page, "ai-generate").click();
  await expect(tid(page, "create-title")).toHaveValue("AI 生成的标题", { timeout: 10_000 });
  await expect(tid(page, "create-content")).toHaveValue("AI 生成的正文内容。", { timeout: 10_000 });
  await tid(page, "create-submit").focus();
  await tid(page, "create-submit").press("Space", { delay: 1500 });
  await expect(tid(page, "sealed-receipt")).toBeVisible({ timeout: 10_000 });
});

test("推荐区换一批按钮可用且不报错", async ({ page }) => {
  await mockRecommendations(page, MOCK_RECOS);
  await registerViaUi(page, { nickname: uniqueNickname("换批") });
  await expect(tid(page, "reco-chip").first()).toBeVisible({ timeout: 10_000 });
  await tid(page, "reco-refresh").click();
  await expect(tid(page, "reco-chip").first()).toBeVisible({ timeout: 10_000 });
});
