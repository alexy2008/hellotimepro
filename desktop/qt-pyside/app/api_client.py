"""API 客户端：拼 URL、解 Envelope、自动 refresh（单飞）+ 401 重放。

= React api/client.ts / Flutter api/client.dart。同步实现（urllib），由 worker 线程调用。
原生无 Vite 代理，直连反代 :9080；可用环境变量 API_BASE 覆盖。
token 存取/失效经回调注入，避免与 store 循环依赖。
"""
from __future__ import annotations

import json
import os
import threading
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Callable, Optional

API_BASE = os.environ.get("API_BASE", "http://127.0.0.1:9080")


class ApiError(Exception):
    def __init__(self, message: str, status: int, error_code: Optional[str] = None, details: Any = None):
        super().__init__(message)
        self.message = message
        self.status = status
        self.error_code = error_code
        self.details = details


class ApiClient:
    def __init__(self, base: str = API_BASE):
        self.base = base
        # 由 auth store 注册的回调
        self.get_access_token: Callable[[], Optional[str]] = lambda: None
        self.get_refresh_token: Callable[[], Optional[str]] = lambda: None
        self.on_tokens_refreshed: Callable[[str, str], None] = lambda a, r: None
        self.on_auth_lost: Callable[[], None] = lambda: None
        self._refresh_lock = threading.Lock()

    # ---------- 资源 URL ----------
    def avatar_url(self, avatar_id: str) -> str:
        return f"{self.base}/static/avatars/{avatar_id or 'neo'}.svg"

    def resolve_asset(self, url: str) -> str:
        if url.startswith("http://") or url.startswith("https://"):
            return url
        return f"{self.base}{'' if url.startswith('/') else '/'}{url}"

    # ---------- refresh 单飞（处理刷新令牌轮换竞态）----------
    def _try_refresh(self, prev_access: Optional[str]) -> Optional[str]:
        with self._refresh_lock:
            cur = self.get_access_token()
            if cur and cur != prev_access:
                return cur  # 其他线程已刷新
            rt = self.get_refresh_token()
            if not rt:
                return None
            try:
                data = self._raw("POST", "/api/v1/auth/refresh", {"refreshToken": rt}, auth=False)
                self.on_tokens_refreshed(data["accessToken"], data["refreshToken"])
                return data["accessToken"]
            except Exception:
                self.on_auth_lost()
                return None

    # ---------- 底层 HTTP（解 envelope）----------
    def _raw(self, method: str, path: str, body: Any, auth: bool, token: Optional[str] = None) -> Any:
        headers = {"Accept": "application/json"}
        if body is not None:
            headers["Content-Type"] = "application/json"
        if token:
            headers["Authorization"] = f"Bearer {token}"
        data = json.dumps(body).encode("utf-8") if body is not None else None
        req = urllib.request.Request(f"{self.base}{path}", data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                status = resp.status
                raw = resp.read()
        except urllib.error.HTTPError as e:
            status = e.code
            raw = e.read()
        except Exception as e:  # 网络/超时
            raise ApiError(f"网络错误：{e}", 0, "INTERNAL_ERROR")

        if status == 204 or not raw:
            return None
        try:
            env = json.loads(raw.decode("utf-8"))
        except Exception:
            raise ApiError("响应解析失败", status, "INTERNAL_ERROR")
        if status >= 400 or not env.get("success"):
            raise ApiError(env.get("message") or "请求失败", status, env.get("errorCode"), env.get("details"))
        return env.get("data")

    def _request(self, method: str, path: str, body: Any = None, auth: bool = True) -> Any:
        token = None
        if auth:
            token = self.get_access_token()
            if not token:
                token = self._try_refresh(None)
        try:
            return self._raw(method, path, body, auth, token)
        except ApiError as e:
            if (
                e.status == 401
                and e.error_code == "UNAUTHORIZED"
                and auth
                and self.get_refresh_token()
            ):
                new_token = self._try_refresh(token)
                if new_token:
                    return self._raw(method, path, body, auth, new_token)
            raise

    @staticmethod
    def _qs(params: dict) -> str:
        items = {k: v for k, v in params.items() if v not in (None, "")}
        return f"?{urllib.parse.urlencode(items)}" if items else ""

    # ---------- 端点（返回解包后的 data：dict / list / None）----------
    def health(self):
        return self._request("GET", "/api/v1/health", auth=False)

    def suggest_capsule(self, title: Optional[str] = None, locale: Optional[str] = None):
        body = {}
        if title:
            body["title"] = title
        if locale:
            body["locale"] = locale
        return self._request("POST", "/api/v1/capsule-suggestion", body=body, auth=False)

    def capsule_recommendations(self, count: Optional[int] = None, locale: Optional[str] = None):
        qs = self._qs({"count": count, "locale": locale})
        return self._request("GET", f"/api/v1/capsule-recommendations{qs}", auth=False)

    def avatars(self):
        return self._request("GET", "/api/v1/avatars", auth=False)

    def register(self, body: dict):
        return self._request("POST", "/api/v1/auth/register", body=body, auth=False)

    def login(self, body: dict):
        return self._request("POST", "/api/v1/auth/login", body=body, auth=False)

    def logout(self, refresh_token: Optional[str]):
        return self._request("POST", "/api/v1/auth/logout", body={"refreshToken": refresh_token} if refresh_token else {}, auth=False)

    def me(self):
        return self._request("GET", "/api/v1/me")

    def update_profile(self, body: dict):
        return self._request("PATCH", "/api/v1/me", body=body)

    def change_password(self, body: dict):
        return self._request("POST", "/api/v1/me/password", body=body)

    def create_capsule(self, body: dict):
        return self._request("POST", "/api/v1/capsules", body=body)

    def capsule_by_code(self, code: str):
        return self._request("GET", f"/api/v1/capsules/{urllib.parse.quote(code)}")

    def plaza(self, sort=None, filter=None, q=None, page=None, page_size=None):
        qs = self._qs({"sort": sort, "filter": filter, "q": q, "page": page, "pageSize": page_size})
        return self._request("GET", f"/api/v1/plaza/capsules{qs}")

    def my_capsules(self, page=1, page_size=20):
        return self._request("GET", f"/api/v1/me/capsules?page={page}&pageSize={page_size}")

    def delete_my_capsule(self, capsule_id: str):
        return self._request("DELETE", f"/api/v1/me/capsules/{urllib.parse.quote(capsule_id)}")

    def my_favorites(self, page=1, page_size=20):
        return self._request("GET", f"/api/v1/me/favorites?page={page}&pageSize={page_size}")

    def favorite(self, capsule_id: str):
        return self._request("POST", "/api/v1/me/favorites", body={"capsuleId": capsule_id})

    def unfavorite(self, capsule_id: str):
        return self._request("DELETE", f"/api/v1/me/favorites/{urllib.parse.quote(capsule_id)}")
