# HelloTime Pro · Flutter 桌面端

M5 桌面客户端之一。**纯原生、零 webview**：整套 UI 用 Dart + Flutter 声明式重建，
Skia/Impeller 引擎自绘渲染，HTTP 直连反代 `:9080` 复用同一套 `/api/v1` 契约。
与 `desktop/electron`·`desktop/tauri`（Web 壳内嵌前端）根本不同；与 `desktop/swiftui`（macOS 系统原生）
同属纯原生，但渲染哲学相反——Flutter 自绘、不贴系统外观，一份代码可投影到桌面与移动。

## 与参考实现的对应

逐层对照 `frontends/react-ts`（参考前端）/ `desktop/swiftui`（已对齐的原生桌面）：

| 关注点 | React | Flutter（本实现） |
|---|---|---|
| 类型/模型 | `types/index.ts` | `lib/models/models.dart` |
| API 客户端 | `api/client.ts`（refresh 单飞 + 401 重放） | `lib/api/client.dart`（同语义） |
| 状态 | Zustand 4 store | **Riverpod 2** Notifier（`lib/stores/*`） |
| 路由/守卫 | React Router + AuthGate | **go_router** + redirect（`lib/router.dart`） |
| 设计令牌 | `tokens.css` | codegen → `lib/theme/tokens.dart`（见下） |
| 持久化 | localStorage | `shared_preferences` |
| 头像/图标 | `<img>` /static/*.svg | `flutter_svg`（`lib/widgets/remote_svg.dart`） |

页面与组件一一对应：广场（hero 渐变标题 + 紫光背景 + 流光描边卡片 + hover 呼吸）、
开启（8 位码逐格输入）、详情（翻页时钟倒计时 + 到期自动开启 + 复制码/分享/收藏）、
创建（AI 生成 + 推荐灵感 + 日期选择器 + 预设）、登录/注册（头像选择）、我的三页、关于页。

## 设计令牌 codegen

`scripts/gen-tokens-flutter` 读 `spec/tokens/tokens.json` → 生成 `lib/theme/tokens.dart`
（hex→`Color`、渐变→`LinearGradient`、辉光→`Color`+`Blur`、rem→px `double`）。
`run` / `build.sh` 启动前自动重生成，保证与令牌源同步不漂移。
两套主题语义色经 `ThemeExtension<AppColors>` 暴露，组件用 `context.colors` 读取。

## 运行

```bash
./scripts/hello start flutter      # 启动原生窗口（port:None → status 显示 native）
./scripts/hello stop flutter
# 或直接：
cd desktop/flutter && ./run        # flutter run -d macos --dart-define=API_BASE=:9080
./build.sh                         # 令牌 codegen + analyze + build macos（构建校验）
```

> **Flutter SDK 在 PATH 上**：本机经 `git clone` 安装到 `~/development/flutter`。
> `run`/`build.sh` 内部已 `export PATH`；若要让 `flutter` 命令与 `hello doctor` 全局可用，
> 在 `~/.zshrc` 追加 `export PATH="$HOME/development/flutter/bin:$PATH"`。

> **build 脚本叫 `build.sh`**：Flutter 强制把产物写入 `build/` 目录，与仓库惯例的 `./build` 同名冲突。

## 环境与已知点

- macOS 沙箱需 **`com.apple.security.network.client`** 才能出站 HTTP——已加入
  `macos/Runner/{DebugProfile,Release}.entitlements`，否则所有请求被静默拦截。
- `logo.svg` 含 `<filter>` 发光滤镜，flutter_svg 会打印一条 `unhandled element <filter/>` 警告——
  良性，矢量主体正常渲染（同 swiftui 的 CoreSVG 警告）。
- 技术栈图标 `flutter.svg`/`dart.svg` 已加入 `spec/icons` 与当前后端 `static/icons`；
  切到未拷贝的后端时图标缺失会优雅降级（只显示名称）。

## 验证（无 computer-use，遵循「编译 + 后端日志」约定）

- `./build.sh`：令牌 codegen + `flutter analyze`（零问题）+ `flutter build macos` 通过。
- `flutter test`：基础单测 3/3（倒计时 / 令牌）。
- 连通性：`hello start flutter` 后 fastapi 日志出现 `/api/v1/health`、
  `/api/v1/plaza/capsules?...pageSize=15`、`/static/avatars/*.svg` 等 200，佐证 Dart http → `:9080` 全流程。
- 核心旅程 E2E（`integration_test`，登录→建胶囊→开启→收藏）：后续补（需常驻后端 + 测试驱动）。
