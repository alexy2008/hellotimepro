// Pinia store 的单元测试：草稿与账号表单「属于写它的人」——换了账号或登出就清空
import { beforeEach, describe, expect, it } from "vitest";
import { nextTick } from "vue";
import { createPinia, setActivePinia } from "pinia";
import { useAuthStore } from "./auth";
import { useDraftStore } from "./draft";
import { useFormsStore } from "./forms";
import type { AuthTokens, User } from "@/types";

const user = (id: string): User => ({ id, email: `${id}@x.dev`, nickname: id, avatarId: "neo", createdAt: "2026-01-01T00:00:00Z" });
const tokens = (id: string): AuthTokens => ({ accessToken: `a-${id}`, refreshToken: `r-${id}`, accessTokenExpiresIn: 900, user: user(id) });

describe("草稿与表单跟着账号走", () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it("登出后草稿清空", async () => {
    const auth = useAuthStore();
    auth.setTokens(tokens("alice"));
    const draft = useDraftStore();
    draft.title = "给明年的自己";
    draft.content = "还没写完";
    await auth.logout(false);
    await nextTick();
    expect(draft.title).toBe("");
    expect(draft.content).toBe("");
    expect(draft.preset).toBe("1y");
  });

  it("换了另一个账号，表单全部清空", async () => {
    const auth = useAuthStore();
    auth.setTokens(tokens("alice"));
    const forms = useFormsStore();
    forms.pwd.current = "secret123";
    forms.profile.nickname = "改到一半";
    auth.setTokens(tokens("bob"));
    await nextTick();
    expect(forms.pwd.current).toBe("");
    expect(forms.profile.nickname).toBe("");
  });

  it("同一个人刷新资料（refreshMe）不清草稿", async () => {
    const auth = useAuthStore();
    auth.setTokens(tokens("alice"));
    const draft = useDraftStore();
    draft.title = "还在写";
    auth.user = { ...user("alice"), nickname: "alice2" };
    await nextTick();
    expect(draft.title).toBe("还在写");
  });

  it("clear 只清指定的表单", () => {
    const forms = useFormsStore();
    forms.login.email = "a@b.c";
    forms.register.nickname = "新人";
    forms.clear("login");
    expect(forms.login.email).toBe("");
    expect(forms.register.nickname).toBe("新人");
  });
});
