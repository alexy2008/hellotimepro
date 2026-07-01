# HelloTime Pro · iOS 原生（SwiftUI）

M5 移动客户端之一,**纯原生、零 webview**:用 **SwiftUI** 重建整套界面,跑在 iOS 模拟器/真机。
与 `desktop/swiftui`（macOS）**共享逻辑层**(模型/APIClient/会话/主题,拷贝改写),仅视图层按移动 IA 重建——
底部 **Tab Bar**（广场/开启/创建/我的）替代桌面顶部导航。`URLSession` 直连 `:9080` 复用 `/api/v1` 契约。

## 运行

```bash
./scripts/hello start ios          # 编译 + 启模拟器 + 装 + 前台启动（port:None → status 显示 native）
./scripts/hello stop ios
# 或直接：
cd mobile/ios && ./run             # = ./run（默认 iPhone）；IOS_SIM="iPhone 17" ./run 指定机型
./build                            # xcodegen + xcodebuild（iphonesimulator，仅编译校验）
```

后端默认 `http://127.0.0.1:9080`（`BACKEND_PROXY` 可覆盖,经 `HT_API_BASE` 构建设置注入 Info.plist 的 `APIBase`）。
模拟器与宿主共享网络,`127.0.0.1:9080` 直达;真机需用局域网 IP。

## 工程形态

- **XcodeGen**:提交 `project.yml`,`xcodegen generate` 生成 `.xcodeproj`（gitignored）。iOS app 不能纯 SwiftPM。
- 依赖 **SVGView**（SwiftPM）——iOS 的 `UIImage` 不像 macOS `NSImage` 那样原生认 SVG,用它渲染后端头像/图标。
- 结构:`Sources/{Models,Networking,Stores,Theme,Views}/` + `Resources/Info.plist`。

## 与 desktop/swiftui 的共享

| 层 | 来源 | 处理 |
|---|---|---|
| `Models.swift` / `DateUtil.swift` | desktop/swiftui | 逐字搬 |
| `APIClient.swift` | desktop/swiftui | 逐字搬（仅 `resolveBaseURL` 改读 Info.plist `APIBase`,因模拟器不继承宿主环境变量） |
| `Stores/AppStore.swift` | desktop/swiftui | 鉴权/主题/持久化逻辑复用;导航从 Route 栈改为 Tab + 登录 sheet |
| `Theme/Tokens.swift` | desktop/swiftui | 手抄,`NSColor`→`UIColor` 动态色 |
| `Theme/Components.swift` | desktop/swiftui | 纯 SwiftUI,零改 |
| Views | **重建** | 底部 TabView + NavigationStack;`NSImage`→SVGView;`NSPasteboard`→`UIPasteboard`;自定义日期选择器→iOS 原生 `DatePicker` |

## 已知点 / iOS 特有坑

- **ATS 默认拦明文 HTTP** → `Resources/Info.plist` 开 `NSAppTransportSecurity`（本地网络例外）,否则 URLSession 到 `http://:9080` 被拦、后端零日志。
- **UIImage 不认 SVG** → 加 SVGView 依赖渲染头像。
- 自定义 DerivedData 路径 → `run` 用 `xcodebuild -showBuildSettings` 动态取 `TARGET_BUILD_DIR` 找 `.app`。
- 头像/技术栈图标渲染时 SVGView 可能打印滤镜相关警告,良性。

## 验证（无 computer-use,编译 + 模拟器 + 后端日志）

- `./build`:xcodegen + xcodebuild（iphonesimulator）编译通过。
- `hello start ios`:编译 → 启模拟器 → 装 → 启动;status `ready`/`native`;后端日志出现该 app 的
  `GET /api/v1/plaza/capsules?...&pageSize=15 200`、`GET /static/avatars/*.svg 200`（SVGView 渲染真实头像）;`hello stop` 干净停。
- 核心旅程 E2E（XCUITest）:后续。
