import { defineConfig, devices } from "@playwright/test";

// ============================================================
// UI 冒烟（2.0）：同一套用例在「时笺」「琥珀」两套皮肤下各跑一遍。
// 皮肤通过预置 localStorage['hellotime.skin'] 指定；用例只依赖 spec/ui/testids.md 的测试钩子。
// SKINS=paper 或 SKINS=amber 可只跑一套。
// ============================================================

const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:7174";
const ORIGIN = new URL(FRONTEND_URL).origin;
const SKINS = (process.env.SKINS ?? "paper,amber").split(",").map((s) => s.trim()).filter(Boolean);

export default defineConfig({
  testDir: "./tests",
  timeout: 40_000,
  retries: 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never", outputFolder: "report" }]],

  use: {
    baseURL: FRONTEND_URL,
    headless: true,
    viewport: { width: 1280, height: 800 },
    locale: "zh-CN",
    // 测试钩子契约 X1：减少动效时仪式性动画须在 500ms 内结束
    reducedMotion: "reduce",
  },

  projects: SKINS.map((skin) => ({
    name: skin,
    use: {
      ...devices["Desktop Chrome"],
      viewport: { width: 1280, height: 800 },
      storageState: {
        cookies: [],
        origins: [{ origin: ORIGIN, localStorage: [{ name: "hellotime.skin", value: skin }] }],
      },
    },
  })),
});
