# HelloTime Pro · Flutter 移动端（iOS / Android）

M5 移动客户端之一。**核心命题：一码多端。**

本端与 [`desktop/flutter`](../../desktop/flutter) 是**同一份工程**（代码不复制）——本目录只提供移动运行入口（`run`/`build`）与文档，
Dart 代码物理位于 `../../desktop/flutter/lib/`。桌面跑 `flutter run -d macos`，移动跑 `flutter run -d <iPhone/Android>`，
共享**同一 `lib/`**，仅靠 `MediaQuery` 宽窄断点分出两套 IA：

| | 宽屏（桌面） | 窄屏（手机） |
|---|---|---|
| 外壳 | 顶部 `AppHeader`（品牌+nav+主题+用户菜单）+ Footer | `MobileShell`：精简顶部 bar + 底部 `NavigationBar`（广场/开启/创建/我的） |
| 广场 | 多列网格 + 大 hero | 单列 + 紧凑 hero |
| 「我的」 | 左侧栏导航 | 内容顶部横向分段 + 登出 |

断点 `kWideBreakpoint = 740`（`lib/widgets/mobile_shell.dart`）：手机竖屏走移动、常规桌面窗口与 iPad 竖屏走桌面。

## 运行

```bash
./scripts/hello start flutter-mobile     # = flutter run -d iPhone 模拟器（port:None → status 显示 native）
./scripts/hello stop flutter-mobile
# 或直接：
cd mobile/flutter && ./run               # 默认 iPhone 17 Pro Max；IOS_SIM="iPhone 16" ./run 指定机型
./build                                   # flutter analyze + build ios --simulator（iOS 编译校验）
```

后端默认 `http://127.0.0.1:9080`（`BACKEND_PROXY` 覆盖，经 `--dart-define=API_BASE` 注入）。

## 平台状态

- **iOS**：✅ 已落地并验证（编译 + 模拟器 + 后端日志）。Xcode + CocoaPods 就绪。
- **Android**：平台脚手架已生成（`../../desktop/flutter/android/`），但**本机暂无 Android SDK**，`flutter build apk` 待 SDK 安装后启用。

## iOS 平台适配

- **ATS**：`../../desktop/flutter/ios/Runner/Info.plist` 开 `NSAppTransportSecurity` 本地明文例外，否则 Dart http 到 `http://127.0.0.1:9080` 被拦、后端零日志（同 mobile/ios）。
- **SVG 头像**：`flutter_svg` 渲染后端 SVG；含 `<filter>` 的图标会打印 `unhandled element <filter/>` 警告，良性（忽略滤镜，图形仍渲染）。

## 与 desktop/flutter 的关系

同一 Riverpod stores / go_router 路由树 / APIClient / 设计令牌（codegen）。**路由树未因移动端重构**——移动 IA 完全由外壳层（`MainLayout`/`MeLayout`/`MobileShell`）的响应式分支实现，桌面零改动。逻辑层深度导读见 [`desktop/flutter/TECHNICAL_GUIDE.md`](../../desktop/flutter/TECHNICAL_GUIDE.md)；本端一码多端实现见 [`TECHNICAL_GUIDE.md`](TECHNICAL_GUIDE.md)。
