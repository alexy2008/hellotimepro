// 运行时 store 与页面状态类的单元测试：
// - 草稿「属于写它的人」：登出、换账号清空；同一个人刷新资料不清
// - 注册表单：重名（409）才标「已被占用」；请求途中改了昵称，结果不再标在新昵称上；改昵称收起错误
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushSync } from "svelte";
import { api } from "@/api/client";
import { authStore } from "@/stores/auth.svelte.ts";
import { draft } from "@/stores/draft.svelte.ts";
import { RegisterForm } from "@/state/account.svelte.ts";
import { ApiError, type AuthTokens, type User } from "@/types";

const user = (id: string): User => ({ id, email: `${id}@x.dev`, nickname: id, avatarId: "neo", createdAt: "2026-01-01T00:00:00Z" });
const tokens = (id: string): AuthTokens => ({ accessToken: `a-${id}`, refreshToken: `r-${id}`, accessTokenExpiresIn: 900, user: user(id) });

beforeEach(() => {
  localStorage.clear();
  authStore.dropFromAuthLost();
  flushSync();
  draft.reset();
});
afterEach(() => vi.restoreAllMocks());

describe("草稿跟着账号走", () => {
  it("登出后草稿清空", async () => {
    authStore.setTokens(tokens("alice"));
    flushSync();
    draft.patch({ title: "给明年的自己", content: "还没写完", preset: null });
    await authStore.logout(false);
    flushSync();
    expect(draft.title).toBe("");
    expect(draft.content).toBe("");
    expect(draft.preset).toBe("1y");
  });

  it("换了另一个账号也清空", () => {
    authStore.setTokens(tokens("alice"));
    flushSync();
    draft.patch({ title: "alice 的信" });
    authStore.setTokens(tokens("bob"));
    flushSync();
    expect(draft.title).toBe("");
  });

  it("同一个人刷新资料不清草稿", () => {
    authStore.setTokens(tokens("alice"));
    flushSync();
    draft.patch({ title: "还在写" });
    authStore.user = { ...user("alice"), nickname: "alice2" };
    flushSync();
    expect(draft.title).toBe("还在写");
  });

  it("每次改动版本号加一（封存成功时据此判断草稿是否又被改过）", () => {
    const r = draft.revision;
    draft.patch({ title: "a" });
    draft.patch({ content: "b" });
    expect(draft.revision).toBe(r + 2);
  });
});

describe("注册表单的昵称错误", () => {
  const fill = (f: RegisterForm) => {
    f.email = "new@x.dev";
    f.nickname = "新人_01";
    f.password = "abc12345";
  };

  it("409 才标「已被占用」，422 只是格式不对", async () => {
    const f = new RegisterForm();
    fill(f);
    vi.spyOn(api, "register").mockRejectedValueOnce(
      new ApiError("昵称已被占用", 409, "CONFLICT", [{ field: "nickname", message: "昵称已被占用" }]),
    );
    await f.submit();
    expect(f.nick.state).toBe("taken");

    vi.spyOn(api, "register").mockRejectedValueOnce(
      new ApiError("参数不合法", 422, "VALIDATION_ERROR", [{ field: "nickname", message: "昵称格式不对" }]),
    );
    await f.submit();
    expect(f.nick.state).toBe("invalid");
  });

  it("改了昵称就收起昵称上的错误", async () => {
    const f = new RegisterForm();
    fill(f);
    vi.spyOn(api, "register").mockRejectedValueOnce(
      new ApiError("昵称已被占用", 409, "CONFLICT", [{ field: "nickname", message: "昵称已被占用" }]),
    );
    await f.submit();
    f.nickname = "另一个名字";
    expect(f.errors.nickname).toBeUndefined();
    expect(f.nick.state).toBe("valid");
  });

  it("请求途中改了昵称：返回的昵称错误不再标到新昵称上", async () => {
    const f = new RegisterForm();
    fill(f);
    let reject!: (e: unknown) => void;
    vi.spyOn(api, "register").mockReturnValueOnce(new Promise((_, r) => (reject = r)));
    const p = f.submit();
    f.nickname = "改过了";
    reject(new ApiError("昵称已被占用", 409, "CONFLICT", [{ field: "nickname", message: "昵称已被占用" }]));
    await p;
    expect(f.errors.nickname).toBeUndefined();
    expect(f.nick.state).toBe("valid");
  });
});
