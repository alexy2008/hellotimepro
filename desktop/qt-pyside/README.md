# HelloTime Pro · Qt Quick/QML + PySide6 桌面端

M5 桌面客户端之一。**纯原生、零 webview**：视图层用声明式 **QML** 重建，业务逻辑/状态用
**Python**（QObject store 经 context property 暴露给 QML），HTTP 直连反代 `:9080` 复用同一套
`/api/v1` 契约。与 electron/tauri（Web 壳内嵌前端）根本不同；与 swiftui（macOS 系统原生）、
flutter（Dart 自绘引擎）同属纯原生，但范式各异——Qt 是「成熟 C++ 引擎 + 脚本语言逻辑 + QML 声明式标记」，
一套代码跨 Linux/mac/Win。

## 架构（QML 视图 + Python 逻辑）

```
app/
├── main.py            # QGuiApplication + QQmlApplicationEngine；注册 context property；QQuickStyle=Basic
├── api_client.py      # 同步 HTTP（urllib）+ refresh 单飞（处理轮换竞态）+ 401 重放（= React api/client.ts）
├── worker.py          # QThreadPool：把同步 api 调用丢线程跑，结果经信号回主线程
├── bridge.py          # ApiBridge：QML 直调的一次性请求（按码取详情/AI/头像/创建/health/改资料）+ 剪贴板
├── stores/            # QObject store（Property/Signal/Slot）= React zustand
│   ├── theme.py  auth.py  plaza.py  capsule.py
├── theme/palette.py   # ← codegen 产物（勿手改）
├── assets/logo.svg
└── qml/
    ├── Main.qml             # ApplicationWindow + StackView 路由 + 守卫（= router + AuthGate）
    ├── fmt.js               # 倒计时/日期/距离（= utils/format）
    ├── components/          # HtButton/Avatar/Badge/HtAlert/AppHeader/AppFooter/CapsuleCard/
    │                        # PlazaToolbar/Segmented/Pagination/FavoriteButton/CapsuleCodeInput/
    │                        # FlipClock/DateTimePicker/RecommendationStrip/AvatarPicker/MeSidebar/NavLink
    └── pages/               # Plaza/Open/CapsuleDetail/Create/Login/Register/MeCreated/MeFavorites/MeProfile/About/NotFound
```

QML 经 context property 读取后端状态与主题：`Theme.colors.surface0`、`Theme.sizes.s4`、
`Theme.gradients.cyberFlow`、`Auth.user`、`Plaza.items`、`Capsules.fetchMine(1)`、`Api.capsuleByCode(code)`。
跨文件导航用 `ApplicationWindow.window.go(route)` / `.push(route, props)`（QML 跨文件 id 作用域隔离，
故走根窗口的附加属性）。

## 设计令牌 codegen

`scripts/gen-tokens-qt` 读 `spec/tokens/tokens.json` → 生成 `app/theme/palette.py`：
- 颜色 → QML 可用字符串（`#rrggbb`；rgba/辉光 → `#AARRGGBB`，alpha 在前）
- rem→px int；渐变 → 停靠色列表
两套主题（dark/light）经 `ThemeStore.colors` 暴露，QML `color: Theme.colors.X` 绑定，切换即时刷新。
`run`/`build` 启动前自动重生成，保证与令牌源同步不漂移。

## 运行

```bash
./scripts/hello start qt-pyside      # 原生窗口（port:None → status 显示 native）
./scripts/hello stop qt-pyside
# 或直接：
cd desktop/qt-pyside && ./run        # uv sync + codegen + python app/main.py（API_BASE→:9080）
./build                              # codegen + uv sync + 字节编译 + 导入校验 + qmllint
```

依赖经 `uv`（同 backends/fastapi）：`pyproject.toml` 声明 `PySide6`，`uv sync` 装入 `.venv`。

## 环境与已知点

- **Qt Quick Controls 样式必须设为 Basic**：macOS 默认原生样式不允许自定义 Button 的
  `background`/`contentItem`，`main.py` 里 `QQuickStyle.setStyle("Basic")`。
- `logo.svg` 含 `<filter>` 滤镜，QtSvg 渲染时仅取矢量主体（与 swiftui/flutter 同）。
- 技术栈图标 `qt.svg`/`python.svg` 已在 `spec/icons` 与当前后端 `static/icons`；
  切到未拷贝的后端时缺失会优雅降级（只显示名称）。
- 退出时控制台可能打印若干 `TypeError: Cannot read property '...' of null`——这是 PySide6
  在关闭时**先销毁 context property（Theme/Auth）再销毁 QML item** 的 teardown 顺序噪声，
  非运行期错误，不影响功能。

## 验证（无 computer-use，遵循「编译 + 后端日志」约定）

- `./build`：令牌 codegen + `compileall` + 模块导入 + `qmllint`（零 Error 级问题）。
- 路由巡航：启动后程序化遍历全部 11 路由，运行期无 QML 错误（teardown 噪声除外）。
- 连通性：`hello start qt-pyside` 后 fastapi 日志出现 `/api/v1/health`、
  `/api/v1/plaza/capsules?...pageSize=15`、`/static/{avatars,icons}/*.svg` 等 200，佐证 Python→`:9080` 全流程。
