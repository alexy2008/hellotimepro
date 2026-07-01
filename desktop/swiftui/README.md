# HelloTime Pro · SwiftUI 原生 macOS 桌面端

用 **SwiftUI** 把 HelloTime Pro 重建为 **纯原生 macOS 桌面应用**。与 `desktop/electron`、`desktop/tauri` 同属「桌面客户端」类目，但走的是**完全不同的路**。

## 与 electron / tauri 的根本区别

electron 和 tauri 是同一类答案——**都是 Web 壳**，把既有前端（React / Svelte）的 webview 装进原生窗口，区别只在「自带引擎 vs 借系统 WebView」「JS 壳 vs Rust 壳」。本实现是质变的第三个答案：

| 维度 | **SwiftUI（本实现）** | electron | tauri |
|---|---|---|---|
| 渲染 | **AppKit/SwiftUI 原生绘制** | 自带 Chromium | 系统 WebView |
| UI 来源 | **声明式重写一遍** | 内嵌 React | 内嵌 Svelte |
| webview | **无** | 有 | 有 |
| 语言 | **Swift** | Node.js | Rust |
| dev server 端口 | **无**（URLSession 直连） | 7190（Vite） | 7191（Vite） |

它是 roadmap 里 **M5.2（Web 背书）→ M5.3（纯原生）** 的转折点，与 `backends/vapor`（Swift 后端）呼应，形成 Swift 三角（再加未来的 `mobile/ios`）。

## 架构

- **纯 API 消费者**：不持有 `/api/v1`，复用已绿的 10 套后端。
- **直连后端，不走代理**：原生 app 没有 Vite，也不需要 `/api` 代理 —— `URLSession` 直接打 `http://127.0.0.1:9080`（`hello switch <backend>` 切后端照样生效），原生请求无 CORS 限制。可经环境变量覆盖：

  ```bash
  BACKEND_PROXY=http://127.0.0.1:29010 ./run   # 直连某后端
  ```
- **分层**（对齐 Web 前端 idiom，用 Swift 惯用法）：

  ```
  Theme/       Tokens.swift —— 从 spec/styles/tokens.css + palette.css 镜像（深色主题）
  Models/      Codable 结构体，对齐 spec/api schema
  Networking/  APIClient（URLSession + async/await，Envelope 解码）
  Stores/      AppStore（@Observable + @MainActor，对位 Signals/Runes/Hooks）
  Views/       SwiftUI 视图树（顶部 nav 多列宽屏，对标 ui-prototype 桌面布局）
  ```
- **质感**：SF 系统字、`.regularMaterial` / `.ultraThinMaterial` 毛玻璃、品牌渐变标题。

## 工程形态：纯 SwiftPM（无 .xcodeproj）

呼应 `backends/vapor` 的 SwiftPM 做法，与仓库 CLI 驱动风格一致：`swift build` / `swift run` 即可，无需 Xcode GUI。`run` 脚本构建后会**组装一个最小 `.app` bundle**（`Resources/Info.plist` + 二进制）再执行——裸可执行文件没有 bundle id，Dock 名/图标缺失、也无法被系统正确识别；放进 `.app/Contents/MacOS` 后 macOS 即按 CFBundle 赋予应用身份（`pro.hellotime.swiftui`）。

## 功能范围（对齐 React 参考实现）

与 `frontends/react-ts` **功能对齐**（非像素级复刻）：

- **匿名可用**：广场浏览（排序 hot/new、过滤 all/opened/unopened、关键词搜索 300ms 防抖、分页）、凭 8 位码开启、关于页，全部对未登录开放；创建 / 我的 / 收藏需登录（点击走门禁，登录后回跳）。
- **胶囊卡片**：显示 8 位码、整卡点开详情、未开启卡每秒实时倒计时、已开启显示正文预览。
- **胶囊详情**：翻页时钟倒计时（`contentTransition(.numericText)` 数字滚动）、到期自动开启轮询、复制 8 位码 / 分享、收藏、广场公开/未开启提示。
- **创建**：标题 + AI 生成正文/标题、AI 推荐灵感（换一批）、正文计数、**可键盘直接输入的日期选择器 + 图形日历 + 快捷预设**、可见性开关。
- **账户**：注册（真实头像 SVG 选择）、登录、登出、改昵称/头像、改密码（成功后自动登出）、我创建的（撤回）、我收藏的。
- **关于 / 页脚**：后端在线指示点 + 技术栈图标（桌面端 SwiftUI/Swift + 后端 from `/health`，图标取后端 `/static/icons`）。
- **主题**：深色 / 浅色切换并持久化。
- **原生菜单**：系统菜单栏「前往 / 视图」命令（导航、主题、返回，带快捷键）——纯 Web 壳做不到的原生表达。

## 鉴权（完整版，对齐 React）

access token 内存；refresh token + user 持久化到 **UserDefaults**（macOS 上 localStorage 的等价物，对应 docs/02-design §7.2 的"更简单方案"）。启动 hydrate，有 refresh token 则拉 `/me` 校验；401 自动 refresh + 单飞重放。原生是唯一客户端，无 electron/tauri 那种壳层与内嵌前端共享 token 的轮换误登出问题。

## 运行

```bash
./scripts/hello switch fastapi   # 先把 :9080 指向某后端
./scripts/hello start swiftui    # 或：cd desktop/swiftui && ./run
./scripts/hello stop swiftui
```

> `swiftui` 在 `hello` 里登记为 `port: None`（纯原生，无 dev server 端口）：`hello` 跳过端口探测，改以进程存活判就绪，`status` 端口列显示 `native`。
>
> 首次运行 `swift build` 需编译数秒；之后增量很快。

## 构建 / 校验

```bash
./build      # swift build 编译校验
```

### 生产打包（超出 dev MVP）

出可分发 `.app` / `.dmg` 需补图标资源（Asset Catalog / `.icns`）、`codesign` 签名与（可选）公证。dev MVP 的 `run` 只组装未签名的本地 `.app`。

## 验证

桌面是原生窗口，Playwright 够不着；按 M5 验证分层走「核心旅程 + 连通性留证」：

- `./build`（`swift build`）编译通过。
- 端到端连通性：app 启动后后端日志出现其真实请求 ——
  `GET /api/v1/health 200`、`GET /api/v1/plaza/capsules?...&pageSize=15 200`、
  `GET /static/icons/{swift,fastapi,python,postgresql}.svg 200`（技术栈图标渲染）、
  持久化 refresh token 自动恢复登录态。

原生 E2E（XCUITest）力争对齐 25 smoke，列为后续。
