"""鉴权 store：access token 内存；refresh token + user 持久化（QSettings）。
经回调把 token 存取/失效接到 ApiClient（= React stores/auth.ts + configureApi）。
"""
from __future__ import annotations

import json
from typing import Optional

from PySide6.QtCore import Property, QObject, QSettings, Signal, Slot

from api_client import ApiClient
from worker import run_async

_KEY = "auth"


class AuthStore(QObject):
    changed = Signal()
    # 登录/注册成功后 QML 据此跳转；带 from 路径
    loginSucceeded = Signal(str)
    errorOccurred = Signal(str)

    def __init__(self, api: ApiClient):
        super().__init__()
        self._api = api
        self._settings = QSettings("HelloTimePro", "qt-pyside")
        self._user: Optional[dict] = None
        self._access: Optional[str] = None
        self._refresh: Optional[str] = None
        self._hydrated = False
        self._busy = False
        self._pending_from = "/me/created"

        # 水合（user + refreshToken；access 不持久化，靠 refresh 取）
        raw = self._settings.value(_KEY)
        if raw:
            try:
                data = json.loads(raw)
                self._user = data.get("user")
                self._refresh = data.get("refreshToken")
            except Exception:
                pass
        self._hydrated = True

        # 接线到 api（worker 线程读取，GIL 下原子）
        api.get_access_token = lambda: self._access
        api.get_refresh_token = lambda: self._refresh
        api.on_tokens_refreshed = self._on_refreshed
        api.on_auth_lost = self._clear

    # ---------- Properties ----------
    @Property("QVariant", notify=changed)
    def user(self):
        return self._user

    @Property(bool, notify=changed)
    def isAuthenticated(self):
        return self._user is not None

    @Property(bool, notify=changed)
    def canAccessProtected(self):
        # 守卫放行：有 user，或仅有 refreshToken（刷新页未拿到 access）——接口会自动 refresh
        return self._user is not None or self._refresh is not None

    @Property(bool, notify=changed)
    def hydrated(self):
        return self._hydrated

    @Property(bool, notify=changed)
    def busy(self):
        return self._busy

    # ---------- 持久化 ----------
    def _persist(self):
        if self._refresh is None and self._user is None:
            self._settings.remove(_KEY)
        else:
            self._settings.setValue(_KEY, json.dumps({"user": self._user, "refreshToken": self._refresh}))

    def _on_refreshed(self, access: str, refresh: str):
        # 由 worker 线程调用：仅原子赋值 + 持久化（QSettings 可重入）
        self._access = access
        self._refresh = refresh
        QSettings("HelloTimePro", "qt-pyside").setValue(
            _KEY, json.dumps({"user": self._user, "refreshToken": self._refresh})
        )

    def _clear(self):
        self._access = None
        self._refresh = None
        self._user = None
        self._persist()
        self.changed.emit()

    def _set_busy(self, b: bool):
        self._busy = b
        self.changed.emit()

    def _apply_tokens(self, tokens: dict):
        self._user = tokens["user"]
        self._access = tokens["accessToken"]
        self._refresh = tokens["refreshToken"]
        self._persist()
        self.changed.emit()

    # ---------- QML 调用 ----------
    @Slot(str, str, result=bool)
    def login(self, email: str, password: str) -> bool:
        self._set_busy(True)

        def ok(tokens):
            self._apply_tokens(tokens)
            self._set_busy(False)
            self.loginSucceeded.emit(self._pending_from)

        def err(e):
            self._set_busy(False)
            self.errorOccurred.emit(getattr(e, "message", "登录失败"))

        run_async(self._api.login, ok, err, {"email": email.strip(), "password": password})
        return True

    @Slot(str, str, str, str)
    def register(self, email: str, password: str, nickname: str, avatar_id: str):
        self._set_busy(True)

        def ok(tokens):
            self._apply_tokens(tokens)
            self._set_busy(False)
            self.loginSucceeded.emit("/create")

        def err(e):
            self._set_busy(False)
            self.errorOccurred.emit(getattr(e, "message", "注册失败"))

        run_async(
            self._api.register, ok, err,
            {"email": email.strip(), "password": password, "nickname": nickname.strip(), "avatarId": avatar_id},
        )

    @Slot(str)
    def setPendingFrom(self, path: str):
        self._pending_from = path or "/me/created"

    @Slot()
    def logout(self):
        rt = self._refresh
        self._clear()
        if rt:
            run_async(self._api.logout, None, None, rt)

    @Slot()
    def bootstrap(self):
        if not self._refresh:
            return
        run_async(self._api.me, lambda u: self._set_user(u), None)

    def _set_user(self, u):
        self._user = u
        self._persist()
        self.changed.emit()

    @Slot()
    def refreshMe(self):
        run_async(self._api.me, lambda u: self._set_user(u), None)
