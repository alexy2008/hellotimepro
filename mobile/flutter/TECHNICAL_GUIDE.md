# HelloTime Pro Flutter 移动端技术手册 —— 一码多端如何落地

本文面向想了解 **Flutter「一份代码，桌面 + 移动双投影」** 如何工程化的读者。读完你应能回答：

- `desktop/flutter` 与 `mobile/flutter` 到底是不是同一份代码，怎么做到不复制。
- 同一批页面，怎么在宽屏渲染桌面 IA、窄屏渲染移动 IA，且**桌面零回归**。
- 加 iOS/Android 目标要动哪些平台文件、踩哪些坑。

> 逻辑层（Riverpod stores / APIClient / go_router 路由树 / 令牌 codegen）的深度导读见
> [`../../desktop/flutter/TECHNICAL_GUIDE.md`](../../desktop/flutter/TECHNICAL_GUIDE.md)——本端**就是同一份**，本文只讲移动差异。

## 1. 「同源」的物理形态

物理工程唯一，位于 `desktop/flutter`。`mobile/flutter` 是**独立的移动入口目录**，只含：

```text
mobile/flutter/
├── run       # cd ../../desktop/flutter && flutter run -d <iPhone 模拟器>
├── build     # cd ../../desktop/flutter && flutter build ios --simulator
├── README.md
└── TECHNICAL_GUIDE.md（本文）
```

`hello` 里 `flutter`（desktop 类目，`./run` = `flutter run -d macos`）与 `flutter-mobile`（mobile 类目，`./run` = 跑 iOS）
是**同一工程的两个运行目标**，`lib/` 不复制。这就是 roadmap 说的「软链或目录指针」——这里用「入口目录 + 相对 cd 指向工程」实现，比整目录软链更可控（避免 `./run` 被解析成桌面启动）。

## 2. 宽窄分支：一批页面，两套 IA

关键只有一个常量和三个外壳文件（都在 `desktop/flutter/lib/widgets/`）：

```dart
// mobile_shell.dart
const double kWideBreakpoint = 740;   // >= 桌面外壳，否则移动外壳
```

- **`MainLayout`**：`width < kWideBreakpoint` → `MobileShell(child)`；否则 = 现状（顶部 `AppHeader` + 滚动 + `AppFooter`）。
- **`MeLayout`**：窄屏 → `MobileShell(subHeader: 分段头, child)`（侧栏导航降级为内容顶部横向分段 + 登出）；否则 = 现状（左侧栏）。
- **`MobileShell`**（新增）：`Scaffold` + 精简 `AppBar`（品牌 / 主题切换 / 关于）+ 底部 `NavigationBar`（广场·开启·创建·我的，`context.go` 切路由）。受保护 tab 未登录点击，由既有 go_router `redirect` 自动跳登录——**与桌面同一套守卫**。

**go_router 路由树完全没动**——移动 IA 全部由外壳层的 `MediaQuery` 分支实现，所以桌面行为零回归。这是本端的核心设计：不为移动重构路由，只在「外壳」这一层做响应式投影。

页面级响应式（同样按 `kWideBreakpoint` 分支）：

- `CapsuleGrid`：本就 `LayoutBuilder` 响应式（宽 3 / 中 2 / 窄 1 列），移动端自动单列，未改。
- `plaza_page` hero：窄屏缩小标题字号（`fs5xl`→`fs3xl`）、padding、紫光半径，防溢出。
- `PlazaToolbar`：窄屏竖排（排序+过滤横向可滚 / 全宽搜索），对齐 mobile/ios、react-native。
- `Container2`（居中容器）：窄屏统一收紧边距，一处改惠及所有页。

## 3. 加 iOS/Android 目标

```bash
flutter create --platforms=ios,android --org pro.hellotime --project-name hellotime_flutter .
```

只补 `ios/` `android/` 平台脚手架，**不动 `lib/`**（bundle 与 macOS 一致：`pro.hellotime.hellotimeFlutter`）。坑：

- **iOS ATS**：`ios/Runner/Info.plist` 加 `NSAppTransportSecurity` 本地明文例外，否则 Dart http 到 `:9080` 被静默拦、后端零日志（iOS 版「沙箱拦网」，同 mobile/ios、desktop/flutter 的 macOS network.client）。
- **SVG `<filter>`**：`flutter_svg` 不支持滤镜元素，渲染头像时打印 `unhandled element <filter/>`，良性（图形仍出，仅忽略滤镜）。
- **Android**：脚手架已就位，本机无 Android SDK 故 `flutter build apk` 待 SDK；代码层无移动分支之外的额外工作（同一 `lib/`）。

## 4. 运行与验证（无 computer-use）

```bash
cd mobile/flutter && ./build      # flutter analyze + build ios --simulator
./scripts/hello start flutter-mobile   # flutter run -d iPhone 模拟器（前台附着判活）
```

验证靠**编译 + 模拟器 + 后端日志**：`hello start flutter-mobile` 后 fastapi 日志出现
`GET /api/v1/plaza/capsules?...&pageSize=15 200`、`GET /static/avatars/*.svg 200`、`GET /api/v1/health 200`，
佐证 Dart http → `:9080` 全链路；`hello stop` 干净停。核心旅程 E2E（`integration_test`）：后续。

## 5. 常见改动指南

- **调宽窄阈值**：改 `mobile_shell.dart` 的 `kWideBreakpoint`。
- **改移动底部 tab**：`MobileShell._tabs`。
- **加一屏**：加 `lib/pages/` + go_router 路由（桌面移动共用）；若需移动专属外观，在页面内按 `MediaQuery.sizeOf(context).width < kWideBreakpoint` 分支。
- **令牌**：改 `spec/tokens/tokens.json` 后 `node scripts/gen-tokens-flutter`（桌面移动共享 `lib/theme/tokens.dart`）。
