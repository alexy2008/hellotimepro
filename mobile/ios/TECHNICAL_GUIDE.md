# HelloTime Pro iOS 原生（SwiftUI）技术手册与代码导读

本文面向熟悉一门现代语言、想了解 **iOS 原生开发 / SwiftUI / 与 macOS SwiftUI 如何共享代码** 的读者。读完后你应能回答:

- 一个 iOS SwiftUI app 从 `@main` 到看到广场页,代码按什么顺序跑。
- 它与 `desktop/swiftui`（macOS）是什么关系——哪些逻辑**逐字共享**、哪些视图按移动 IA **重建**。
- iOS 特有的几个坑（ATS 拦 HTTP、UIImage 不认 SVG、工程必须是 Xcode 工程）怎么解决。
- 想加一个屏 / 接口 / 状态,改哪些文件。

> 核心叙事:本端是「**macOS SwiftUI vs iOS SwiftUI**」的对照——同一种声明式 UI + Swift Concurrency + Observation,**逻辑层从 `desktop/swiftui` 拷贝改写**(深度导读见 `desktop/swiftui/TECHNICAL_GUIDE.md`),本文重点讲**不同的地方**:工程形态、移动 IA、iOS 平台适配。

## 1. 技术选型与设计特色

* **SwiftUI 原生、零 webview**:与 electron/tauri(Web 壳)、flutter(自绘引擎)不同,iOS 用系统原生渲染,SF 字体、材质模糊,辉光/暗色视觉贴合 iOS 审美。
* **与 macOS 端共享逻辑**:`desktop/swiftui` 已实现一套 macOS SwiftUI;本端把它的**逻辑层**(模型/网络/会话/主题)拷过来做平台适配,**视图层**按移动 IA 重建。类比 `mobile/react-native` 之于 `frontends/react-ts`。
* **纯 API 消费者**:`URLSession` async/await 直连 `:9080` 复用 `/api/v1` 契约,不新增后端代码。
* **响应式状态**:`@Observable` 的 `AppStore` 驱动 UI,改状态即重渲染。

## 2. 先建立整体地图

```text
mobile/ios/
├── project.yml                # XcodeGen 声明 → 生成 .xcodeproj（gitignored）
├── run                        # xcodegen + xcodebuild + simctl 启模拟器（前台）
├── build                      # xcodegen + xcodebuild（仅编译校验）
├── Resources/Info.plist        # ATS 例外（开本地 HTTP）+ APIBase 注入
└── Sources/
    ├── HelloTimeApp.swift      # @main App + RootView（TabView + splash + 登录 sheet）
    ├── Models/{Models,DateUtil}.swift     # ← 逐字搬自 desktop/swiftui
    ├── Networking/APIClient.swift          # ← 逐字搬（仅 resolveBaseURL 改读 Info.plist）
    ├── Stores/AppStore.swift               # 鉴权/主题复用；导航改 Tab + sheet
    ├── Theme/{Tokens,Components}.swift      # Tokens 手抄(NSColor→UIColor)；Components 零改
    └── Views/                              # 视图层（移动 IA 重建）
        ├── RemoteImage.swift   # SVGView 渲染头像（iOS UIImage 不认 SVG）
        ├── PlazaView/OpenView/CapsuleDetailView/CreateView/MeView/AboutView/AuthSheet …
        └── CapsuleCard/FavoriteButton/Pagination/CapsuleCodeInput/RecommendationStrip/AvatarPicker …
```

一次「打开广场」的流向:

```text
@main HelloTimeApp → RootView：TabView(广场/开启/创建/我的) + splash
  │ .task { store.bootstrap() }（有 refreshToken 拉 /me）
  ▼
PlazaView（广场 Tab，自带 NavigationStack）.task → store.api.plaza(...)
  │ URLSession 直打 :9080（ATS 例外放行 http）
  ▼
后端 JSON → @State items 更新 → LazyVStack 卡片重渲染
  │ 卡片头像 AvatarView → SVGView 渲染 /static/avatars/<id>.svg
  ▼
点卡片 → NavigationLink(value: code) → navigationDestination → CapsuleDetailView 压栈
```

## 3. 如何运行和验证

```bash
./scripts/hello start ios          # 编译 + 启模拟器 + 装 + 前台启动
cd mobile/ios && ./run             # 同上（IOS_SIM 指定机型）
./build                            # 仅编译校验（iphonesimulator）
```

`run`:`xcodegen generate` → `xcodebuild`(模拟器 SDK,注入 `HT_API_BASE`)→ `simctl boot/install/launch --console-pty`(前台附着,`hello` 据 run 进程判活)。

## 4. 入口与移动 IA

- `HelloTimeApp`(`@main`)→ `RootView`:`TabView(selection:)` 四个 Tab,每个 Tab 自带 `NavigationStack`(独立导航,可程序化压栈详情)。splash 启动页淡出;`.sheet(isPresented: store.showAuthSheet)` 弹登录/注册。
- **Tab 选择拦截**:`store.selectTab(t)` 对受保护 Tab(创建/我的)未登录时记下目标 + 弹登录 sheet;登录成功 `apply` 置 `showAuthSheet=false` 并切到目标 Tab。这替代了桌面的「路由守卫 + 回跳」。

## 5. 与 desktop/swiftui 的共享（核心）

| 层 | 处理 | 说明 |
|---|---|---|
| `Models` / `DateUtil` | **逐字** | 纯 Swift,平台无关 |
| `APIClient` | **逐字**（一处改） | `resolveBaseURL` 从 ProcessInfo 环境变量改读 `Bundle` 的 `APIBase`——iOS 模拟器不继承宿主环境变量 |
| `AppStore` | 复用鉴权/主题/持久化 | 导航从 `Route` 栈 → `Tab` + 登录 sheet（移动 IA） |
| `Tokens` | 手抄,`NSColor`→`UIColor` | 动态色用 `UIColor { traitCollection in … }` |
| `Components` | **零改** | 纯 SwiftUI（按钮/Alert/字段样式） |

逻辑层的深度导读(APIClient 的 refresh 单飞 + 401 重放、AppStore 的会话持久化)见 `desktop/swiftui/TECHNICAL_GUIDE.md`——本端这些**就是同一份代码**。

## 6. 视图层:macOS → iOS 的关键适配

| macOS（desktop/swiftui） | iOS（本实现） |
|---|---|
| 顶部 nav + 多列 `LazyVGrid` + `Container` 居中宽屏 | 底部 `TabView` + 单列 `LazyVStack` + 安全区 |
| 自定义导航栈（`AppStore.path`） | 每 Tab `NavigationStack` + `NavigationLink(value:)` |
| `NSImage` 渲染 SVG（系统免费） | **SVGView**（SwiftPM）渲染（UIImage 不认 SVG） |
| `NSPasteboard` | `UIPasteboard` |
| 自定义键盘日期选择器（`onKeyPress`） | iOS 原生 `DatePicker(.compact)` |
| `.help()` 悬停提示 | 无（移动无悬停） |
| 8 位码逐格 + `onKeyPress(.delete)` | 隐藏 TextField 承接键盘 + 8 格显示（软键盘退格天然可用） |

## 7. 工程与 iOS 平台坑

- **必须 Xcode 工程**:iOS app 不能纯 SwiftPM 在模拟器跑 → **XcodeGen**(`project.yml` → `.xcodeproj`,提交 yml)。
- **ATS 拦明文 HTTP**:`Info.plist` 的 `NSAppTransportSecurity` 开本地网络例外,否则 `http://127.0.0.1:9080` 被静默拦截、后端零日志（iOS 版的「沙箱拦网」）。
- **SVGView 依赖**:渲染后端 SVG 头像/图标。
- **DerivedData 路径**:本机配了自定义 build location,`run` 用 `xcodebuild -showBuildSettings` 动态取 `TARGET_BUILD_DIR` 定位 `.app`。
- **`hello` 登记**:`MOBILE` 表 `ios`(`port: None` → status `native`),`run` 前台 `simctl launch --console-pty`,据进程存活判就绪（同 swiftui 桌面端）。

## 8. 常见改动指南

- **加一屏**:`Sources/Views/` 新建 → 在对应 Tab 的 `NavigationStack` 用 `NavigationLink(value:)` + `navigationDestination` 接入。
- **加接口 / 状态**:`APIClient.swift` 加方法（多数可对照 desktop/swiftui 直接搬）→ 在视图 `.task` 或 `AppStore` 调用。
- **改令牌**:改 `spec/styles/tokens.css`(源)后手动同步 `Theme/Tokens.swift`（与 desktop swiftui 一样手抄,未上 codegen）。

## 9. 验证（无 computer-use，编译 + 模拟器 + 后端日志）

- `./build`:xcodegen + xcodebuild（iphonesimulator）编译通过。
- `hello start ios` 后 fastapi 日志出现该 app 的 `GET /api/v1/plaza/capsules?...&pageSize=15 200`、`GET /static/avatars/*.svg 200`（SVGView 渲染真实头像）,佐证 URLSession → `:9080` 全流程;`hello stop` 干净停。
- 核心旅程 E2E（XCUITest，登录→建胶囊→开启→收藏）:后续。
