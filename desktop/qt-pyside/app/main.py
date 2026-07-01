"""HelloTime Pro · Qt Quick/QML + PySide6 桌面端入口。

纯 API 消费者：QtNetwork/urllib 直连反代 :9080（API_BASE 可覆盖），复用既有后端契约。
QML 视图层 + Python 逻辑/状态（QObject store 经 context property 暴露）。
"""
from __future__ import annotations

import sys
from pathlib import Path

from PySide6.QtCore import QUrl
from PySide6.QtGui import QGuiApplication
from PySide6.QtQml import QQmlApplicationEngine
from PySide6.QtQuickControls2 import QQuickStyle

APP_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(APP_DIR))

from api_client import ApiClient  # noqa: E402
from bridge import ApiBridge  # noqa: E402
from stores.auth import AuthStore  # noqa: E402
from stores.capsule import CapsuleStore  # noqa: E402
from stores.plaza import PlazaStore  # noqa: E402
from stores.theme import ThemeStore  # noqa: E402


def main() -> int:
    QGuiApplication.setApplicationName("HelloTime Pro")
    QGuiApplication.setOrganizationName("HelloTimePro")
    # 用 Basic 样式：macOS 原生样式不允许自定义 Button background/contentItem 等
    QQuickStyle.setStyle("Basic")
    app = QGuiApplication(sys.argv)

    api = ApiClient()
    theme = ThemeStore()
    auth = AuthStore(api)
    plaza = PlazaStore(api)
    capsule = CapsuleStore(api, plaza)
    bridge = ApiBridge(api)

    engine = QQmlApplicationEngine()
    ctx = engine.rootContext()
    ctx.setContextProperty("Theme", theme)
    ctx.setContextProperty("Auth", auth)
    ctx.setContextProperty("Plaza", plaza)
    ctx.setContextProperty("Capsules", capsule)
    ctx.setContextProperty("Api", bridge)
    ctx.setContextProperty("logoUrl", QUrl.fromLocalFile(str(APP_DIR / "assets" / "logo.svg")).toString())

    engine.load(QUrl.fromLocalFile(str(APP_DIR / "qml" / "Main.qml")))
    if not engine.rootObjects():
        return 1

    auth.bootstrap()
    return app.exec()


if __name__ == "__main__":
    sys.exit(main())
