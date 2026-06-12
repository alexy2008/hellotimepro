import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiService } from "./api.service";
import type { AuthTokens, Envelope, User } from "@/types";

// ApiService 无注入依赖，可直接实例化
function makeService() {
  return new ApiService();
}

function jsonEnvelope<T>(data: T, status = 200): Response {
  const body: Envelope<T> = {
    success: status >= 200 && status < 300,
    data,
    message: null,
    errorCode: null,
  };
  return new Response(JSON.stringify(body), { status });
}

function errorEnvelope(message: string, status = 401): Response {
  const body: Envelope<null> = {
    success: false,
    data: null,
    message,
    errorCode: "UNAUTHORIZED",
  };
  return new Response(JSON.stringify(body), { status });
}

function authPayload(accessToken: string, refreshToken: string, user: User): AuthTokens {
  return {
    accessToken,
    refreshToken,
    accessTokenExpiresIn: 900,
    refreshTokenExpiresIn: 604800,
    user,
  };
}

function testUser(): User {
  return {
    id: "user-1",
    email: "alice@example.com",
    nickname: "alice",
    avatarId: "neo",
    createdAt: "2026-04-25T00:00:00Z",
  };
}

function headersOf(init?: RequestInit): Record<string, string> {
  return init?.headers as Record<string, string>;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ApiService auth refresh", () => {
  it("先用 refresh token 恢复缺失的 access token，再发送鉴权请求", async () => {
    const service = makeService();
    const user = testUser();
    let accessToken: string | null = null;
    let refreshToken: string | null = "refresh-1";

    service.configure({
      getAccessToken: () => accessToken,
      getRefreshToken: () => refreshToken,
      onTokensRefreshed: (a, r) => { accessToken = a; refreshToken = r; },
      onAuthLost: vi.fn(),
    });

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/v1/auth/refresh") {
        expect(init?.body).toBe(JSON.stringify({ refreshToken: "refresh-1" }));
        return jsonEnvelope(authPayload("access-2", "refresh-2", user));
      }
      if (url === "/api/v1/me") {
        expect(headersOf(init)["Authorization"]).toBe("Bearer access-2");
        return jsonEnvelope(user);
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(service.me()).resolves.toEqual(user);
    expect(accessToken).toBe("access-2");
    expect(refreshToken).toBe("refresh-2");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("401 后刷新 token 并重放请求", async () => {
    const service = makeService();
    const user = testUser();
    let accessToken: string | null = "access-old";
    let refreshToken: string | null = "refresh-1";
    let meCalls = 0;

    service.configure({
      getAccessToken: () => accessToken,
      getRefreshToken: () => refreshToken,
      onTokensRefreshed: (a, r) => { accessToken = a; refreshToken = r; },
      onAuthLost: vi.fn(),
    });

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/v1/me") {
        meCalls += 1;
        if (meCalls === 1) {
          expect(headersOf(init)["Authorization"]).toBe("Bearer access-old");
          return errorEnvelope("access_token_expired");
        }
        expect(headersOf(init)["Authorization"]).toBe("Bearer access-new");
        return jsonEnvelope(user);
      }
      if (url === "/api/v1/auth/refresh") {
        return jsonEnvelope(authPayload("access-new", "refresh-new", user));
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(service.me()).resolves.toEqual(user);
    expect(meCalls).toBe(2);
    expect(accessToken).toBe("access-new");
    expect(refreshToken).toBe("refresh-new");
  });

  it("登出接口不触发 access token 刷新", async () => {
    const service = makeService();
    service.configure({
      getAccessToken: () => null,
      getRefreshToken: () => "refresh-1",
      onTokensRefreshed: vi.fn(),
      onAuthLost: vi.fn(),
    });

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("/api/v1/auth/logout");
      expect(init?.body).toBe(JSON.stringify({ refreshToken: "refresh-1" }));
      expect(headersOf(init)["Authorization"]).toBeUndefined();
      return new Response(null, { status: 204 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(service.logout("refresh-1")).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
