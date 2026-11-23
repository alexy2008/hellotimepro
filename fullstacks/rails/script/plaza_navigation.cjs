const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { createRequire } = require("node:module");
const { resolve } = require("node:path");
const { before, after, test } = require("node:test");

const requireUi = createRequire(resolve(__dirname, "../../../verification/ui/package.json"));
const { chromium, expect } = requireUi("@playwright/test");
const baseURL = process.env.FRONTEND_URL ?? "http://127.0.0.1:7181";
const origin = new URL(baseURL).origin;

let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser?.close(); });

for (const skin of ["paper", "amber"]) {
  for (const search of [false, true]) {
    test(`${skin} · ${search ? "搜索后" : "首屏"}点击卡片进入整页详情`, async () => {
      const page = await browser.newPage({
        baseURL,
        reducedMotion: "reduce",
        storageState: {
          cookies: [],
          origins: [{ origin, localStorage: [{ name: "hellotime.skin", value: skin }] }]
        }
      });

      try {
        await page.goto("/");
        await expect(page.locator("html")).toHaveAttribute("data-skin", skin);
        const first = page.getByTestId("capsule-card").first();
        await expect(first).toBeVisible();
        const code = await first.getAttribute("data-code");
        assert.match(code, /^[A-Z0-9]{8}$/);
        const title = (await first.getByTestId("card-title").innerText()).trim();

        if (search) {
          const input = page.getByTestId("plaza-search");
          await input.fill(randomUUID());
          await expect(page.getByTestId("list-empty")).toBeVisible();
          await input.fill([...title].slice(0, 40).join(""));
        }

        const card = page.locator(`[data-testid="capsule-card"][data-code="${code}"]`);
        await card.getByTestId("card-open").click();
        await expect(page).toHaveURL(new URL(`/capsules/${code}`, baseURL).href);
        await expect(page.getByTestId("capsule-detail")).toHaveAttribute("data-code", code);
        await expect(page.getByTestId("detail-title")).toHaveText(title);
      } finally {
        await page.close();
      }
    });
  }
}
