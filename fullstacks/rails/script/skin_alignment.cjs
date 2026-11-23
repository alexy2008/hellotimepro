const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { createRequire } = require("node:module");
const { resolve } = require("node:path");
const { before, after, test } = require("node:test");

const requireUi = createRequire(resolve(__dirname, "../../../verification/ui/package.json"));
const { chromium, expect } = requireUi("@playwright/test");
const baseURL = process.env.FRONTEND_URL;
assert(baseURL, "请把 FRONTEND_URL 指向使用独立验证库的 Rails 服务。");

const origin = new URL(baseURL).origin;
const skins = ["paper", "amber"];
const password = "Stage1234!";
let browser;
let email;

before(async () => {
  const suffix = randomUUID().slice(0, 8);
  email = `ceremony-${suffix}@ui-smoke.hellotimepro.dev`;
  const response = await fetch(`${origin}/api/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, nickname: `仪式${suffix}`, avatarId: "neo" })
  });
  assert.equal(response.status, 201, await response.text());
  browser = await chromium.launch();
});

after(async () => { await browser?.close(); });

function newPage(skin, viewport) {
  return browser.newPage({
    baseURL,
    viewport,
    reducedMotion: "no-preference",
    storageState: {
      cookies: [],
      origins: [{ origin, localStorage: [{ name: "hellotime.skin", value: skin }] }]
    }
  });
}

test("桌面创作页切换皮肤时保留内容、可见范围和启封时间", async () => {
  const page = await newPage("paper", { width: 1280, height: 850 });
  try {
    await page.goto("/login?redirect=%2Fcreate");
    await page.getByTestId("login-email").fill(email);
    await page.getByTestId("login-password").fill(password);
    await page.getByTestId("login-submit").click();
    await expect(page).toHaveURL(/\/create$/);
    await expect(page.locator(".create__grid > .sheet")).toBeVisible();
    await expect(page.locator(".desk .panel--seal .envf")).toBeVisible();
    const ruler = page.getByRole("slider", { name: /开启时间标尺/ });
    const initialTime = await page.locator('input[name="openAt"]').inputValue();
    await expect(page.locator(".when__rel")).toHaveText("1 年后");
    await ruler.press("Home");
    await expect(page.locator('input[name="openAt"]')).not.toHaveValue(initialTime);
    const earliestTime = await page.locator('input[name="openAt"]').inputValue();
    await ruler.press("PageUp");
    await expect(page.locator('input[name="openAt"]')).not.toHaveValue(earliestTime);
    await page.getByRole("button", { name: "精确到分钟" }).click();
    await expect(page.getByRole("grid", { name: "日期" })).toBeVisible();
    await page.getByRole("gridcell", { selected: true }).press("ArrowRight");
    await expect(page.getByRole("gridcell", { selected: true })).toBeFocused();
    await page.getByTestId("create-title").fill("给下一次出发");
    await page.getByTestId("create-content").fill("这段话只给收到胶囊码的人。");
    await page.getByTestId("create-in-plaza").uncheck({ force: true });
    await page.locator('[data-testid="openat-preset"][data-value="tm"]').click();
    const date = await page.locator('input[name="openAt"]').inputValue();
    await page.locator('[data-testid="skin-option"][data-value="amber"]').click();
    await expect(page.locator(".create > .create__side .preview")).toBeVisible();
    await expect(page.locator(".preview__title")).toHaveText("给下一次出发");
    await expect(page.getByTestId("create-title")).toHaveCount(1);
    await expect(page.getByTestId("create-in-plaza")).not.toBeChecked();
    await expect(page.locator('input[name="openAt"]')).toHaveValue(date);
    await page.getByTestId("create-submit").click();
    await expect(page.locator(".sealed.is-in .tiles .tile")).toHaveCount(8);
    await expect(page.getByTestId("sealed-receipt")).toBeVisible();
    await page.getByTestId("receipt-view").click();
    await expect(page.locator(".vault .cd__digits").first()).toBeVisible();
    await expect(page.getByTestId("detail-content")).toHaveCount(0);
  } finally {
    await page.close();
  }
});

test("移动端时笺短按取消，长按封缄后依次盖印和显出回执", async () => {
  const page = await newPage("paper", { width: 390, height: 844 });
  try {
    await page.goto("/login?redirect=%2Fcreate");
    await page.getByTestId("login-email").fill(email);
    await page.getByTestId("login-password").fill(password);
    await page.getByTestId("login-submit").click();
    await page.getByTestId("create-title").fill("移动端封缄");
    await page.getByTestId("create-content").fill("等它自己打开。");
    const submit = page.getByTestId("create-submit");
    await submit.click();
    await expect(page.getByTestId("sealed-receipt")).toHaveCount(0);
    await submit.press("Space", { delay: 1200 });
    await expect(page.locator(".cer .env.is-open")).toBeVisible();
    await expect(page.locator(".cer.is-stamped")).toBeVisible();
    await expect(page.locator(".cer.is-done .rcpt__code span")).toHaveCount(8);
    await expect(page.getByTestId("copy-code")).toBeVisible();
    await page.getByTestId("receipt-view").click();
    await expect(page.locator(".stage .env")).toBeVisible();
    await expect(page.getByTestId("detail-content")).toHaveCount(0);
  } finally {
    await page.close();
  }
});

test("两个皮肤在正常动效下各自启封，最终显示同一封信", { timeout: 90_000 }, async () => {
  const login = await fetch(`${origin}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  const { data: session } = await login.json();
  assert(session?.accessToken);

  const content = "从倒计时到正文，不需要刷新页面。";
  const response = await fetch(`${origin}/api/v1/capsules`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.accessToken}` },
    body: JSON.stringify({ title: "启封仪式验证", content, openAt: new Date(Date.now() + 64_000).toISOString(), inPlaza: false })
  });
  const { data: capsule } = await response.json();
  assert(capsule?.code);

  const pages = await Promise.all(skins.map((skin) => newPage(skin, { width: 1280, height: 850 })));
  try {
    await Promise.all(pages.map(async (page, index) => {
      const paper = skins[index] === "paper";
      await page.goto(`/capsules/${capsule.code}`);
      await expect(page.getByTestId("countdown")).toBeVisible();
      await expect(page.getByTestId("detail-content")).toHaveCount(0);
      await expect(page.locator(paper ? ".env__seal.is-cracked" : ".opening.is-open")).toBeVisible({ timeout: 74_000 });
      await expect(page.getByTestId("capsule-detail")).toHaveAttribute("data-state", "opened");
      await expect(page.getByTestId("detail-content")).toHaveText(content);
    }));
  } finally {
    await Promise.all(pages.map((page) => page.close()));
  }
});
