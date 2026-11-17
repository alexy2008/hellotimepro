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

// ---------------------------------------------------------------- 只用测试钩子的 UI 操作
// spec/ui/testids.md：不读类名、不依赖按钮文案；两套皮肤同一份写法

export const tid = (page: Page, id: string) => page.getByTestId(id);

export function capsulePath(code: string): string {
  return `/capsules/${code}`;
}

/** 广场上某枚胶囊的卡片（按码定位） */
export function cardOf(page: Page, code: string) {
  return page.locator(`[data-testid="capsule-card"][data-code="${code}"]`);
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
  await tid(page, "register-email").fill(user.email);
  await tid(page, "register-nickname").fill(user.nickname);
  await tid(page, "register-password").fill(user.password);
  await expect(tid(page, "avatar-option")).toHaveCount(10, { timeout: 8000 });
  await tid(page, "avatar-option").nth(2).click();
  await tid(page, "register-submit").click();
  await expect(page).toHaveURL(/\/create$/, { timeout: 10_000 });
  return user;
}

export async function loginViaUi(page: Page, user: Pick<UiUser, "email" | "password">) {
  await page.goto("/login");
  await tid(page, "login-email").fill(user.email);
  await tid(page, "login-password").fill(user.password);
  await tid(page, "login-submit").click();
  await page.waitForURL((url) => !url.pathname.endsWith("/login"), { timeout: 10_000 });
  await expect(tid(page, "user-menu")).toBeVisible({ timeout: 8000 });
}

export async function logoutViaUi(page: Page) {
  await tid(page, "user-menu").click();
  await tid(page, "logout").click();
  await expect(tid(page, "nav-login")).toBeVisible({ timeout: 8000 });
}

/**
 * 在创建页写一枚胶囊并封存，返回回执上的胶囊码。
 * 提交控件可能是长按（时笺）也可能是按钮（琥珀）：契约 X2 统一用按住空格 1.5 秒触发。
 */
export async function createCapsuleViaUi(
  page: Page,
  overrides: Partial<{ title: string; content: string; preset: string; inPlaza: boolean }> = {},
): Promise<Capsule> {
  const title = overrides.title ?? `UI 创建 ${rand(6)}`;
  const content = overrides.content ?? `UI create content ${rand(8)}`;
  if (!new URL(page.url()).pathname.endsWith("/create")) await page.goto("/create");
  await tid(page, "create-title").fill(title);
  await tid(page, "create-content").fill(content);
  await page.locator(`[data-testid="openat-preset"][data-value="${overrides.preset ?? "tm"}"]`).click();
  if (overrides.inPlaza === false) await tid(page, "create-in-plaza").setChecked(false, { force: true });
  await tid(page, "create-submit").focus();
  await tid(page, "create-submit").press("Space", { delay: 1500 });
  const receipt = tid(page, "sealed-receipt");
  await expect(receipt).toBeVisible({ timeout: 10_000 });
  const code = (await receipt.getAttribute("data-code")) ?? "";
  expect(code).toMatch(/^[A-Z0-9]{8}$/);
  return { id: "", code, title, content, openAt: "" };
}

export async function gotoPlaza(page: Page) {
  await page.goto("/");
  await expect(tid(page, "plaza-search")).toBeVisible({ timeout: 8000 });
}

export async function searchPlaza(page: Page, query: string) {
  await gotoPlaza(page);
  await tid(page, "plaza-search").fill(query);
}

/** 排序：分段按钮（sort-option）或下拉框（plaza-sort），两者择一（契约 §3.2） */
export async function setSort(page: Page, value: "new" | "hot") {
  const select = tid(page, "plaza-sort");
  if (await select.count()) await select.selectOption(value);
  else await page.locator(`[data-testid="sort-option"][data-value="${value}"]`).click();
}

/** 输码：对 code-input 一次填入整码（契约 X3） */
export async function enterCode(page: Page, code: string) {
  await tid(page, "code-input").fill(code);
}
