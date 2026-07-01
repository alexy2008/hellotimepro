"""ApiBridge：QML 直接调用的一组异步入口，结果经信号回主线程。
覆盖那些不归 store 管的一次性请求（按码取详情、AI 建议/推荐、头像、创建、health、改资料/密码）。
图片 URL（头像/图标/logo）由 avatarUrl / resolveAsset 同步返回，QML 用 Image 加载。
"""
from __future__ import annotations

from typing import Optional

from PySide6.QtCore import QObject, Signal, Slot
from PySide6.QtGui import QGuiApplication

from api_client import ApiClient
from worker import run_async


def _msg(e) -> str:
    return getattr(e, "message", str(e))


class ApiBridge(QObject):
    capsuleLoaded = Signal("QVariant")
    capsuleError = Signal(str)
    suggestionReady = Signal("QVariant")
    suggestError = Signal(str)
    recommendationsReady = Signal("QVariant")
    avatarsReady = Signal("QVariant")
    capsuleCreated = Signal("QVariant")
    createError = Signal(str)
    healthReady = Signal("QVariant")
    healthError = Signal()
    profileSaved = Signal("QVariant")
    profileError = Signal(str)
    passwordChanged = Signal()
    passwordError = Signal(str)

    def __init__(self, api: ApiClient):
        super().__init__()
        self._api = api

    @Slot(str, result=str)
    def avatarUrl(self, avatar_id: str) -> str:
        return self._api.avatar_url(avatar_id)

    @Slot(str, result=str)
    def resolveAsset(self, url: str) -> str:
        return self._api.resolve_asset(url)

    @Slot(result=str)
    def clipboardText(self) -> str:
        cb = QGuiApplication.clipboard()
        return cb.text() if cb else ""

    @Slot(str)
    def setClipboard(self, text: str):
        cb = QGuiApplication.clipboard()
        if cb:
            cb.setText(text)

    @Slot(str)
    def capsuleByCode(self, code: str):
        run_async(self._api.capsule_by_code,
                  lambda c: self.capsuleLoaded.emit(c),
                  lambda e: self.capsuleError.emit(_msg(e)),
                  code.upper())

    @Slot(str)
    def suggest(self, title: str):
        run_async(self._api.suggest_capsule,
                  lambda s: self.suggestionReady.emit(s),
                  lambda e: self.suggestError.emit(_msg(e)),
                  (title.strip() or None))

    @Slot(int)
    def recommendations(self, count: int):
        run_async(self._api.capsule_recommendations,
                  lambda r: self.recommendationsReady.emit(r),
                  None, count)

    @Slot()
    def avatars(self):
        run_async(self._api.avatars, lambda a: self.avatarsReady.emit(a), None)

    @Slot(str, str, str, bool)
    def createCapsule(self, title: str, content: str, open_at_iso: str, in_plaza: bool):
        run_async(self._api.create_capsule,
                  lambda c: self.capsuleCreated.emit(c),
                  lambda e: self.createError.emit(_msg(e)),
                  {"title": title.strip(), "content": content, "openAt": open_at_iso, "inPlaza": in_plaza})

    @Slot()
    def health(self):
        run_async(self._api.health,
                  lambda h: self.healthReady.emit(h),
                  lambda e: self.healthError.emit())

    @Slot(str, str)
    def updateProfile(self, nickname: Optional[str], avatar_id: Optional[str]):
        body = {}
        if nickname:
            body["nickname"] = nickname.strip()
        if avatar_id:
            body["avatarId"] = avatar_id
        run_async(self._api.update_profile,
                  lambda u: self.profileSaved.emit(u),
                  lambda e: self.profileError.emit(_msg(e)),
                  body)

    @Slot(str, str)
    def changePassword(self, current: str, new: str):
        run_async(self._api.change_password,
                  lambda _: self.passwordChanged.emit(),
                  lambda e: self.passwordError.emit(_msg(e)),
                  {"currentPassword": current, "newPassword": new})
