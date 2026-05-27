import { expect, type APIRequestContext, type APIResponse, type Page } from "@playwright/test";
import { randomBytes } from "node:crypto";

export const UI_DOMAIN = "ui-smoke.hellotimepro.dev";
export const PASSWORD = "Test1234!";

type Envelope<T> = {
  success: boolean;
  data: T | null;
  message: string | null;
  errorCode: string | null;
};

export type UiUser = {
  email: string;
  password: string;
  nickname: string;
  avatarId: string;
  accessToken: string;
  refreshToken: string;
  userId: string;
};

export type Capsule = {
  id: string;
  code: string;
  title: string;
  content: string;
  openAt: string;
};

function unwrap<T>(env: Envelope<T>, label: string): T {
  if (!env.success || !env.data) {
    throw new Error(`${label} 失败: ${env.errorCode ?? "UNKNOWN"} ${env.message ?? ""}`.trim());
  }
  return env.data;
}

async function readEnvelope<T>(res: APIResponse): Promise<{
  status: number;
  raw: string;
  body: Envelope<T>;
}> {
  const raw = await res.text();
  let body: Envelope<T>;
  try {
    body = JSON.parse(raw) as Envelope<T>;
  } catch {
    throw new Error(`非 JSON 响应 ${res.status()}: ${raw.slice(0, 200)}`);
  }
  return { status: res.status(), raw, body };
}

export function rand(n = 6): string {
  return randomBytes(n).toString("hex").slice(0, n);
}

export function uniqueEmail(prefix = "u"): string {
  return `${prefix}-${rand(8)}@${UI_DOMAIN}`;
}

export function uniqueNickname(prefix = "ui"): string {
  return `${prefix}${rand(6)}`;
}

export function capsulePath(code: string): string {
  return process.env.FRONTEND_TARGET === "svelte" ? `/capsules/${code}` : `/c/${code}`;
}

export function capsuleCard(page: Page, title: string) {
  return page.locator("article.cy-capsule").filter({ hasText: title }).first();
}

export async function expectUserMenuTitle(page: Page, nickname: string) {
  await expect(page.locator(".cy-user-chip--button")).toHaveAttribute("title", nickname, {
    timeout: 8000,
  });
}

export function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

export async function apiRegister(
  request: APIRequestContext,
  overrides: Partial<{ email: string; password: string; nickname: string; avatarId: string }> = {},
): Promise<UiUser> {
  const payload = {
    email: overrides.email ?? uniqueEmail("u"),
    password: overrides.password ?? PASSWORD,
    nickname: overrides.nickname ?? uniqueNickname("用户"),
    avatarId: overrides.avatarId ?? "neo",
  };
  const res = await request.post("/api/v1/auth/register", { data: payload });
  const { status, raw, body } = await readEnvelope<{
    accessToken: string;
    refreshToken: string;
    user: { id: string; nickname: string; avatarId: string };
  }>(res);
  expect(status, raw).toBe(201);
  const data = unwrap(body, "apiRegister");
  return {
    ...payload,
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    userId: data.user.id,
  };
}

export async function apiCreateCapsule(
  request: APIRequestContext,
  token: string,
  overrides: Partial<{ title: string; content: string; openAtSeconds: number; inPlaza: boolean }> = {},
): Promise<Capsule> {
  const payload = {
    title: overrides.title ?? `UI 胶囊 ${rand(6)}`,
    content: overrides.content ?? `UI smoke content ${rand(8)}`,
    openAt: new Date(Date.now() + (overrides.openAtSeconds ?? 3600) * 1000).toISOString(),
    inPlaza: overrides.inPlaza ?? true,
  };
  const res = await request.post("/api/v1/capsules", {
    data: payload,
    headers: authHeaders(token),
  });
  const { status, raw, body } = await readEnvelope<Omit<Capsule, "content">>(res);
  expect(status, raw).toBe(201);
  const data = unwrap(body, "apiCreateCapsule");
  return { ...data, content: payload.content };
}

export async function apiFavorite(
  request: APIRequestContext,
  token: string,
  capsuleId: string,
): Promise<void> {
  const res = await request.post("/api/v1/me/favorites", {
    data: { capsuleId },
    headers: authHeaders(token),
  });
  expect(res.status(), await res.text()).toBe(200);
}

export async function registerViaUi(
  page: Page,
  overrides: Partial<{ email: string; password: string; nickname: string }> = {},
) {
  const user = {
    email: overrides.email ?? uniqueEmail("reg"),
    password: overrides.password ?? PASSWORD,
    nickname: overrides.nickname ?? uniqueNickname("注册"),
  };

  await page.goto("/register");
  await page.locator("#email").fill(user.email);
  await page.locator("#nick").fill(user.nickname);
  await page.locator("#pwd").fill(user.password);
  await page.locator('[role="radiogroup"] button').first().waitFor({ timeout: 8000 });
  await page.locator('[role="radiogroup"] button').first().click();
  await page.getByRole("button", { name: /创建账号/ }).click();
  await expect(page).toHaveURL(/\/create$/, { timeout: 10_000 });
  return user;
}

export async function loginViaUi(page: Page, user: Pick<UiUser, "email" | "password">) {
  await page.goto("/login");
  await page.locator("#email").fill(user.email);
  await page.locator("#pwd").fill(user.password);
  await page.getByRole("button", { name: /^登录$/ }).click();
  await page.waitForURL((url) => !url.pathname.endsWith("/login"), { timeout: 10_000 });
  await expect(page.locator(".cy-user-chip--button")).toBeVisible({ timeout: 8000 });
}

export async function logoutViaUi(page: Page) {
  await expect(page.locator(".cy-user-chip--button")).toBeVisible({ timeout: 8000 });
  await page.locator(".cy-user-chip--button").click();
  const logout = page.getByRole("menuitem", { name: /登出/ });
  await logout.waitFor({ timeout: 5000 });
  await logout.click();
  await expect(page.getByRole("link", { name: "登录" })).toBeVisible({ timeout: 8000 });
}

export async function createCapsuleViaUi(
  page: Page,
  overrides: Partial<{ title: string; content: string }> = {},
): Promise<Capsule> {
  const title = overrides.title ?? `UI 创建 ${rand(6)}`;
  const content = overrides.content ?? `UI create content ${rand(8)}`;

  if (!new URL(page.url()).pathname.endsWith("/create")) {
    await page.goto("/create");
  }
  await page.locator("#title").fill(title);
  await page.locator("#content").fill(content);
  await page.getByRole("button", { name: "1 分钟后（测试）" }).click();
  await page.getByRole("button", { name: /上锁封存/ }).click();
  await page.waitForURL(
    (url) => url.pathname.includes("/c/") || url.pathname.includes("/capsules/"),
    { timeout: 10_000 },
  );
  const code = page.url().split("/").pop() ?? "";
  return { id: "", code, title, content, openAt: "" };
}

export async function gotoPlaza(page: Page) {
  const plazaLink = page.locator(".cy-nav").getByRole("link", { name: "广场", exact: true });
  if (page.url() !== "about:blank" && (await plazaLink.count()) > 0) {
    await plazaLink.click();
  } else {
    await page.goto("/");
  }
  await page.locator(".cy-search__input").waitFor({ timeout: 8000 });
}

export async function searchPlaza(page: Page, query: string) {
  await gotoPlaza(page);
  await page.locator(".cy-search__input").fill(query);
}

export async function enterCapsuleCode(page: Page, code: string) {
  await page.goto("/open");
  for (let i = 0; i < code.length; i += 1) {
    await page.getByLabel(`第 ${i + 1} 位`).fill(code[i]);
  }
}
