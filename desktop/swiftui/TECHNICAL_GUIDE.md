# HelloTime Pro SwiftUI 桌面端技术手册与代码导读

本文面向熟悉一门现代语言、但没系统接触过 **Swift / SwiftUI / SwiftPM** 的读者。读完后你应能回答:

- 一个 SwiftUI app 从启动到看到广场页,代码按什么顺序跑。
- SwiftUI 的声明式视图、`@Observable`、`@MainActor`、`URLSession async/await` 各自在做什么。
- 这套客户端和 `frontends/react-ts` 是什么对应关系。
- 想加一个页面 / 状态 / 接口调用,改哪些文件。

> 阅读建议:第 1 节选型;第 2~4 节整体地图与入口链路;第 5 节 SwiftUI 核心概念;第 6~10 节分层细讲;第 11 节与 React 对应;第 12 节环境坑;第 13 节常见改动。

## 1. 技术选型与设计特色

本实现是 M5 **首个纯原生桌面端**,基于 **SwiftUI**(声明式 UI)+ **SwiftPM** 可执行包(无 `.xcodeproj`,呼应 `backends/vapor`)。设计特色:

* **零 webview、系统原生**:与 electron/tauri(内嵌浏览器)根本不同,也与 flutter(自绘引擎)不同——SwiftUI 用 macOS 原生 AppKit 渲染,SF 字体 + Material 模糊,是真正「贴系统」的外观。仅 Apple 平台。
* **`@Observable` + `@MainActor`**:状态用 Swift 的观察宏,UI 自动跟随;关键状态标 `@MainActor` 保证线程正确(Swift 6 严格并发对教学是过度仪式,故语言模式取 v5)。
* **纯 API 消费者**:`URLSession` async/await 直打 `:9080`(`BACKEND_PROXY` 可覆盖),原生请求无 CORS,复用 `/api/v1` 契约。
* **设计令牌手抄**:`Theme/Tokens.swift` 镜像 `spec/styles/tokens.css`+`palette.css` 的明暗主题(此端是手抄,RN/flutter/qt 才上 codegen 管线)。

## 2. 先建立整体地图

职责与 React 前端相同,视图层用 SwiftUI 重建,逻辑层与 React 一一对应。

```text
desktop/swiftui/
├── Package.swift              # SwiftPM 包：executableTarget + swiftLanguageMode(.v5)
├── run                        # swift build + 组装 .app bundle + 前台 exec
├── build                      # swift build（编译校验）
├── Resources/Info.plist        # CFBundle 身份 + 中文本地化声明
└── Sources/HelloTimeDesktop/
    ├── HelloTimeApp.swift      # @main 入口：WindowGroup + .commands 原生菜单 + bootstrap
    ├── Models/
    │   ├── Models.swift        # Codable，对齐 spec（= types/index.ts）
    │   └── DateUtil.swift       # 倒计时 / 格式化（= utils/format.ts）
    ├── Networking/APIClient.swift   # URLSession async/await + Envelope 解码 + 自动 refresh
    ├── Stores/AppStore.swift        # @Observable @MainActor：auth + 导航栈 + 主题（合一）
    ├── Theme/
    │   ├── Tokens.swift         # 明暗语义色 / 间距 / 渐变（手抄 tokens.css）
    │   └── Components.swift      # HTButtonStyle / HTAlert / AvatarBadge 等共享样式
    └── Views/                   # RootView + 各页面 + 组件（顶部 nav 多列宽屏）
```

一次「打开广场页」的流向:

```text
swift run（或 .app）
  │
  ▼
@main HelloTimeApp：WindowGroup { RootView().environment(store) }
  │ .onAppear → store.bootstrap()（有 refreshToken 就 refresh + 拉 /me）
  ▼
RootView：AppHeader + 路由内容（switch store.current）+ AppFooter
  │ store.current == .plaza → PlazaView()
  ▼
PlazaView .task → store.api.plaza(...)（URLSession 直打 :9080，pageSize=15）
  │
  ▼
后端 JSON → @Observable 状态更新 → SwiftUI 自动重渲染卡片
```

## 3. 如何运行和验证

```bash
./scripts/hello start swiftui      # 原生窗口（port:None → hello status 显示 native）
./scripts/hello stop swiftui
cd desktop/swiftui && ./run        # swift build + 组 .app + 前台运行
./build                            # swift build 编译校验
```

`run` 在 `swift build` 后把二进制塞进 `.build/HelloTime Pro.app/Contents/MacOS`(配 `Resources/Info.plist`,bundle id `pro.hellotime.swiftui`)再前台 exec——裸可执行文件无 bundle id(Dock 名/图标缺失),入 bundle 后 macOS 按 CFBundle 赋身份。

## 4. 入口链路：`HelloTimeApp.swift`

`@main struct HelloTimeApp: App` 的 `body` 返回 `WindowGroup { RootView().environment(store) }`:
- `store` 是单例 `AppStore`(`@State`),经 `.environment(...)` 注入,所有视图 `@Environment(AppStore.self)` 取用。
- `.onAppear { store.bootstrap() }` 启动恢复会话。
- `.commands { … }` 注入原生菜单栏「前往 / 视图」(导航 / 主题切换 / 返回 + ⌘ 快捷键)。
- `.preferredColorScheme(store.theme == .dark ? .dark : .light)` 驱动明暗。

## 5. SwiftUI 核心概念（最少必要）

* **声明式视图**:`var body: some View { ... }` 返回视图树;状态变了,SwiftUI 自动算 diff 重渲染。无人手动操作控件。
* **`@Observable`**(宏):标在 `AppStore` 上,其属性变化自动触发依赖它的视图刷新(对位 Zustand 的订阅)。`@MainActor` 保证它只在主线程改。
* **`@Environment` / `@State` / `@Binding`**:`@Environment(AppStore.self)` 取注入的全局状态;`@State` 视图私有状态;`@Binding` 双向绑定(传给子视图改父状态)。
* **布局**:`VStack`/`HStack`/`ZStack` + 修饰符链(`.padding()`/`.background()`/`.foregroundStyle()`)。
* **`.task { await … }`**:视图出现时跑异步(对位 React 的 `useEffect` + fetch)。

## 6. 数据层：`Networking/APIClient.swift`

`URLSession` async/await,逻辑镜像 React `api/client.ts`:
- 通用请求泛型解 `Envelope<T>`(Codable),失败抛 `APIError`。
- **自动 refresh 单飞**:access 缺失/401 时触发一次 `/auth/refresh`,用 `refreshing: Task?` 单例做单飞,刷新成功重放。
- token 存取/失效经回调(`getAccessToken`/`onTokensRefreshed`/`onAuthLost`)由 `AppStore` 注入。
- `avatarURL(id)` / `resolveAsset(_)` 拼后端静态资源。

## 7. 状态层：`Stores/AppStore.swift`

`@Observable @MainActor final class AppStore` 把 auth + 导航 + 主题合在一个 store(SwiftUI 单 environment 对象更顺手):
- **鉴权**:access 内存、refresh+user 持久化到 `UserDefaults`(localStorage 等价物);`bootstrap`/`setTokens`/`logout`/`refreshMe`;401 自动 refresh。
- **导航**:`Route` 枚举(plaza/open/create/login/…/capsule(code))+ `navStack` 实现压栈/返回;`navigate(to:)` 带门禁(create/me* 需登录 → 存 pendingRoute + 跳 login)。
- **主题**:`theme` + `toggleTheme()` + UserDefaults 持久化。

## 8. 路由与外壳：`Views/RootView.swift`

无第三方路由——`RootView` 用 `switch store.current` 在内容区切换页面(`store.navigate`/`push`/`goBack` 操作 `navStack`)。匿名可用:广场/开启/关于/凭码详情对未登录开放,创建/我的走门禁回跳——对齐 React `AuthGate`。`AppHeader` 顶部 nav + 用户菜单,`AppFooter` 版权 + 后端在线点 + 技术栈(from health)。

## 9. 页面 / 组件

`Views/` 下页面 + 组件与 React 一一对应。关键:
- `CapsuleCard`:渐变描边 + 辉光 + 每秒倒计时。
- `CapsuleDetailView`:翻页时钟(`contentTransition(.numericText)`)+ 到期自动开启轮询 + 复制码/分享。
- `DateTimePicker`:可键盘输入(分段直接打字)+ 图形日历 + 时钟表盘 + 预设,draft 模式。
- `CapsuleCodeInput`:8 位码逐格(自动前进/退格回退/整串粘贴)。
- `RemoteImage`/`AvatarView`:`NSImage` 渲染后端 SVG(macOS 14 原生认 SVG)。

## 10. 主题与样式：`Theme/`

`Tokens.swift` 手抄 `tokens.css` 的明暗语义色(`NSColor` dynamic provider 实现明暗自动切换)+ 间距/圆角/渐变。`Components.swift` 提供 `HTButtonStyle`(变体 primary=信号青 / success / ghost / hero*=流光渐变)、`HTAlert`、`FieldLabel` 等——对齐 `cyber.css`。注意:primary 是**信号青**不是品牌紫,紫色只用于标题/品牌点缀。

## 11. 与 React 参考实现的对应

| 层 | React | SwiftUI（本实现） |
|---|---|---|
| 类型 | `types/index.ts` | `Models/Models.swift`（Codable） |
| API | `api/client.ts` | `Networking/APIClient.swift` |
| 状态 | 4 个 Zustand store | `AppStore`（@Observable，合一） |
| 路由/守卫 | React Router + AuthGate | `Route` 枚举 + `navStack` + navigate 门禁 |
| 令牌 | `tokens.css` | `Tokens.swift`（手抄明暗） |
| 持久化 | localStorage | UserDefaults |
| 视图 | JSX | SwiftUI `body` |

## 12. 环境与已知点

- **仅 macOS**(Apple 平台);需 Swift 工具链(Xcode 或 CLT)。
- **SwiftPM 而非 Xcode 工程**:`swift build` / `swift run` 即可,无 `.xcodeproj`。
- **`.app` bundle**:`run` 自动组装(裸二进制无 bundle id);系统菜单中文化靠 `Info.plist` 的 `CFBundleLocalizations` + bundle 内 `zh-Hans.lproj`。
- `logo.svg`/头像 SVG 含滤镜,`NSImage` 渲染时打印 `CoreSVG` 良性告警,矢量主体正常。

## 13. 常见改动指南

- **加一个页面**:`Views/` 新建 → `AppStore.Route` 加枚举 → `RootView` 的 switch 加分支 → header/菜单加导航入口。
- **加一个接口**:`APIClient.swift` 加方法 → 在 `AppStore` 或视图 `.task` 里调用 → `@Observable` 状态驱动刷新。
- **改令牌**:改 `spec/styles/tokens.css`(源)后,手动同步 `Theme/Tokens.swift`(此端未上 codegen)。

## 14. 验证（无 computer-use，编译 + 后端日志）

- `./build`(`swift build`):26 个 Swift 文件编译通过、无 warning。
- 连通:`hello start swiftui` 后 fastapi 日志出现 `GET /api/v1/health 200`、`GET /api/v1/plaza/capsules?...&pageSize=15 200`、`GET /static/{avatars,icons}/*.svg 200`,refresh token 自动恢复登录态;`hello stop` 干净停。
- 待补:XCUITest 原生 E2E。
