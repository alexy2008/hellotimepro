// ============================================================
// API 客户端：统一拼接 URL、解响应包装、自动 refresh。
// 移植自 frontends/react-ts/src/api/client.ts（与 mobile/react-native 同源）。
//
// 平台差异（Web fetch → 小程序 wx.request）：
//   - fetch(url,{...}) → wx.request({url,method,header,data,success,fail})，
//     包一层 Promise（wxRequest）抹平回调；
//   - res.status → res.statusCode；res.json() → res.data（小程序自动解 JSON）；
//   - BASE 从 ""（Web 走 Vite 代理）改为 API_BASE（小程序直连 :9080）。
// 其余（refresh 单飞 + 401 重放 + Envelope 解包 + 端点封装）逐字保留。
//
// - access token 存内存（auth store）；refresh token 存 store + wx.storage
// - access token 缺失 / 过期时，会触发一次 refresh + 重放
// ============================================================

const { API_BASE } = require("../config");

const BASE = API_BASE;

// ApiError：把响应包装失败映射成异常，便于上层 try/catch
class ApiError extends Error {
  constructor(message, status, errorCode, details) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errorCode = errorCode;
    this.details = details;
  }
}

// wx.request → Promise（statusCode / data 直出）
function wxRequest({ url, method, header, data }) {
  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method: method || "GET",
      header,
      data,
      // 让后端总走 JSON 分支；空 body 时不设 content-type
      dataType: "json",
      responseType: "text",
      success: resolve,
      fail: reject,
    });
  });
}

// 这些回调由 auth store 注册，避免循环依赖
let getAccessToken = () => null;
let getRefreshToken = () => null;
let onTokensRefreshed = () => {};
let onAuthLost = () => {};

function configureApi(opts) {
  getAccessToken = opts.getAccessToken;
  getRefreshToken = opts.getRefreshToken;
  onTokensRefreshed = opts.onTokensRefreshed;
  onAuthLost = opts.onAuthLost;
}

let refreshing = null;

async function tryRefresh() {
  if (refreshing) return refreshing;
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  refreshing = (async () => {
    try {
      const res = await wxRequest({
        url: `${BASE}/api/v1/auth/refresh`,
        method: "POST",
        header: { "Content-Type": "application/json" },
        data: { refreshToken },
      });
      const env = res.data || {};
      const ok = res.statusCode >= 200 && res.statusCode < 300;
      if (!ok || !env.success || !env.data) {
        onAuthLost();
        return null;
      }
      onTokensRefreshed(env.data.accessToken, env.data.refreshToken);
      return env.data.accessToken;
    } catch (e) {
      onAuthLost();
      return null;
    } finally {
      refreshing = null;
    }
  })();

  return refreshing;
}

async function accessTokenForRequest(useAuth) {
  if (!useAuth) return null;
  const accessToken = getAccessToken();
  if (accessToken) return accessToken;
  return tryRefresh();
}

function shouldTryRefresh(res, env, useAuth, retry) {
  return (
    res.statusCode === 401 &&
    env.errorCode === "UNAUTHORIZED" &&
    useAuth &&
    !retry &&
    !!getRefreshToken()
  );
}

async function request(path, opts = {}) {
  const header = Object.assign(
    { Accept: "application/json" },
    opts.header || {},
  );
  const hasBody = opts.body !== undefined;
  if (hasBody) header["Content-Type"] = "application/json";

  const useAuth = opts.auth !== undefined ? opts.auth : true;
  const accessToken = await accessTokenForRequest(useAuth);
  if (accessToken) header["Authorization"] = `Bearer ${accessToken}`;

  const res = await wxRequest({
    url: `${BASE}${path}`,
    method: opts.method || "GET",
    header,
    data: hasBody ? opts.body : undefined,
  });

  if (res.statusCode === 204) return undefined;

  const env = res.data;
  if (!env || typeof env !== "object") {
    throw new ApiError("响应解析失败", res.statusCode, "INTERNAL_ERROR");
  }

  const ok = res.statusCode >= 200 && res.statusCode < 300;
  if (!ok || !env.success) {
    // 401 → 自动 refresh + 重放。覆盖 access token 过期、缺失、无效等恢复场景。
    if (shouldTryRefresh(res, env, useAuth, opts._retry)) {
      const newAt = await tryRefresh();
      if (newAt) {
        return request(path, Object.assign({}, opts, { _retry: true }));
      }
    }
    throw new ApiError(
      env.message || "请求失败",
      res.statusCode,
      env.errorCode,
      env.details,
    );
  }

  return env.data;
}

// URLSearchParams 在小程序无内置，手搓一个 query 拼接。
function qs(params) {
  const parts = [];
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  }
  return parts.length ? `?${parts.join("&")}` : "";
}

// ---------- 端点封装（对齐 react-native/src/api/client.ts） ----------
const api = {
  health: () => request("/api/v1/health", { auth: false }),

  suggestCapsule: (body) =>
    request("/api/v1/capsule-suggestion", { method: "POST", body, auth: false }),

  capsuleRecommendations: (params = {}) =>
    request(
      `/api/v1/capsule-recommendations${qs({
        count: params.count,
        locale: params.locale,
      })}`,
      { auth: false },
    ),

  avatars: () => request("/api/v1/avatars", { auth: false }),

  // ---- 鉴权
  register: (body) =>
    request("/api/v1/auth/register", { method: "POST", body, auth: false }),
  login: (body) =>
    request("/api/v1/auth/login", { method: "POST", body, auth: false }),
  logout: (refreshToken) =>
    request("/api/v1/auth/logout", {
      method: "POST",
      body: refreshToken ? { refreshToken } : {},
      auth: false,
    }),

  // ---- 当前用户
  me: () => request("/api/v1/me"),
  updateProfile: (body) => request("/api/v1/me", { method: "PATCH", body }),
  changePassword: (body) =>
    request("/api/v1/me/password", { method: "POST", body }),

  // ---- 胶囊
  createCapsule: (body) =>
    request("/api/v1/capsules", { method: "POST", body }),
  capsuleByCode: (code) =>
    request(`/api/v1/capsules/${encodeURIComponent(code)}`, { auth: true }),

  // ---- 广场
  plaza: (q = {}) =>
    request(
      `/api/v1/plaza/capsules${qs({
        sort: q.sort,
        filter: q.filter,
        q: q.q,
        page: q.page,
        pageSize: q.pageSize,
      })}`,
      { auth: true },
    ),

  // ---- 我创建的
  myCapsules: (page = 1, pageSize = 20) =>
    request(`/api/v1/me/capsules?page=${page}&pageSize=${pageSize}`),
  deleteMyCapsule: (id) =>
    request(`/api/v1/me/capsules/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),

  // ---- 收藏
  myFavorites: (page = 1, pageSize = 20) =>
    request(`/api/v1/me/favorites?page=${page}&pageSize=${pageSize}`),
  favorite: (capsuleId) =>
    request("/api/v1/me/favorites", { method: "POST", body: { capsuleId } }),
  unfavorite: (capsuleId) =>
    request(`/api/v1/me/favorites/${encodeURIComponent(capsuleId)}`, {
      method: "DELETE",
    }),
};

module.exports = { api, ApiError, configureApi };
