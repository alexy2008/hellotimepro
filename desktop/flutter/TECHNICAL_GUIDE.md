# HelloTime Pro Flutter 桌面端技术手册与代码导读

本文面向已经熟悉 HTML/CSS/JS（或任一前端框架）、但还没系统接触过 **Flutter / Dart / 声明式自绘 UI** 的读者。读完后你应能回答：

- 一个 Flutter 桌面 app 从 `main()` 到看到广场页，代码按什么顺序跑。
- Widget、StatefulWidget、Riverpod、go_router 各自在做什么。
- 这套客户端和 `frontends/react-ts`（参考前端）是什么对应关系——哪些逐字搬、哪些重写。
- 想加一个页面 / 状态 / 接口调用，改哪些文件。

> 阅读建议：第 1 节技术选型；第 2~4 节整体地图与入口链路；第 5 节 Flutter 核心概念（Widget / build / 状态）；第 6 节 Riverpod；第 7~11 节按「打开一个页面」的生命周期分层细讲；第 12 节环境坑；第 13 节常见改动清单。

## 1. 技术选型与设计特色

本实现是 M5 桌面客户端之一,基于 **Flutter + Dart**,状态管理用 **Riverpod 2**,路由用 **go_router**,HTTP 用 `http` 包手写客户端。设计特色:

* **零 webview、自绘引擎**:与 `desktop/electron`、`desktop/tauri`(内嵌浏览器跑 Web 前端)根本不同——Flutter 用 Dart 写 UI,由 **Skia/Impeller** 引擎自己把每个像素画出来,不调用任何系统控件。所以它在 macOS / Linux / Windows 上长得一模一样。
* **一份代码多端投影**:同一套 Dart 代码可同时跑桌面与移动(本实现先做 macOS 桌面),仅布局按屏幕断点分叉。这是选 Flutter 的核心教学点。
* **纯 API 消费者**:不新增任何后端/数据库代码,直连反向代理 `:9080` 复用既有 `/api/v1` 契约。原生无 Vite 代理,`http` 直接打 `:9080`(`--dart-define=API_BASE=` 可覆盖)。
* **声明式 + 响应式状态**:UI 是「状态的函数」——你改 Riverpod 里的 state,订阅它的 widget 自动重建,没有人手动操作控件。这点和 React 一致。
* **设计令牌 codegen**:后端的设计令牌(颜色/间距/圆角)由 `scripts/gen-tokens-flutter` 从 `spec/tokens/tokens.json` 生成 `lib/theme/tokens.dart`,保证与其它端同源不漂移。

## 2. 先建立整体地图

Flutter 桌面端的职责与 React 前端完全相同(渲染所有页面、调后端、维护登录/主题/广场状态、守卫受保护路由),区别只在**视图层用 Flutter 重建**。逻辑层(模型/网络/状态)与 React 参考实现一一对应。

核心目录:

```text
desktop/flutter/
├── pubspec.yaml               # 依赖与资源声明（= package.json）
├── run                        # flutter run -d macos --dart-define=API_BASE=:9080
├── build.sh                   # 构建校验：codegen + analyze + build macos（注：非 ./build，见 §12）
├── macos/ linux/ windows/     # flutter create 生成的各平台 runner（含沙箱 entitlements）
├── assets/logo.svg            # 品牌图标
└── lib/
    ├── main.dart              # 入口：ProviderScope + MaterialApp.router + 启动 bootstrap
    ├── router.dart            # go_router 路由表 + AuthGate 重定向（= router.tsx）
    ├── models/models.dart     # 与 spec/api/openapi.yaml 对齐的 Dart 模型（= types/index.ts）
    ├── api/client.dart        # http 封装 + 解 Envelope + 自动 refresh（= api/client.ts）
    ├── stores/                # Riverpod：providers · auth · plaza · capsule · theme
    ├── theme/
    │   ├── tokens.dart        # ← codegen 产物（勿手改）
    │   ├── app_theme.dart     # ThemeData 明/暗 + ThemeExtension<AppColors> + 复合渐变
    │   └── components.dart     # 共享样式：HtButton / HtAlert / 输入框 / 卡片装饰
    ├── utils/format.dart       # 倒计时 / 时间格式化 / 距离文案（纯函数，= utils/format.ts）
    ├── widgets/                # 可复用 widget（AppHeader、CapsuleCard、DateTimePicker…）
    └── pages/                  # 路由对应页面（plaza/open/detail/create/login/register/me/*/about）
```

一次「打开广场页」的流向:

```text
flutter run -d macos
  │
  ▼
main(): WidgetsFlutterBinding.ensureInitialized()
  │ 加载 SharedPreferences（持久化的 refreshToken + user + theme）
  ▼
runApp(ProviderScope(overrides:[prefs], child: HelloTimeApp))
  │ ProviderScope = Riverpod 的根容器
  ▼
HelloTimeApp.build(): MaterialApp.router(theme/darkTheme/themeMode, routerConfig)
  │ initState 里 addPostFrameCallback → auth.bootstrap()（有 refreshToken 就拉 /me）
  ▼
go_router 按初始路由 "/" 匹配 → MainLayout(child: PlazaPage)
  │
  ▼
PlazaPage initState → addPostFrameCallback → ref.read(plazaProvider.notifier).fetch()
  │
  ▼
ApiClient.plaza(...) → http GET :9080/api/v1/plaza/capsules?...&pageSize=15
  │
  ▼
后端返回 JSON → PlazaNotifier.state 更新 → watch 它的 PlazaPage 重建 → 卡片网格出现
```

反方向同理:点收藏 → `FavoriteButton` 调 `capsuleProvider.notifier.toggleFavorite` → 改 state → 卡片重建。**只有 state 变更触发重建,没人手动操作控件**。

## 3. 如何运行和验证

```bash
./scripts/hello start flutter      # 原生窗口（port:None → hello status 显示 native）
./scripts/hello stop flutter
# 或直接：
cd desktop/flutter && ./run        # 见下
./build.sh                         # 构建校验
```

`./run` 做的事:① 确保 Flutter SDK 在 PATH(本机 git clone 在 `~/development/flutter`,脚本内部 export);② 跑 `scripts/gen-tokens-flutter` 重生成 `tokens.dart`;③ `flutter run -d macos --dart-define=API_BASE=$BACKEND_PROXY`(默认 `:9080`)。这是前台进程,关窗即退出,`hello` 据进程存活判就绪。

`./build.sh`:codegen + `flutter analyze`(静态检查,应零问题) + `flutter build macos`(真编译)。`flutter test` 跑基础单测。

> macOS 构建需 Xcode + CocoaPods(`shared_preferences` 的 macOS 插件要 pod install)。

## 4. 入口链路：`main.dart`

```dart
Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();          // 初始化 Flutter 引擎绑定
  final prefs = await SharedPreferences.getInstance(); // 异步拿持久化句柄
  runApp(ProviderScope(                                // Riverpod 根
    overrides: [sharedPrefsProvider.overrideWithValue(prefs)],
    child: const HelloTimeApp(),
  ));
}
```

- `ProviderScope` 是 Riverpod 的根容器,所有 provider 在它底下才能用。`overrides` 把 `main()` 里 await 到的真实 `SharedPreferences` 注入到一个占位 provider(因为 provider 不能 await,所以在根处一次性注入)。
- `HelloTimeApp` 是 `ConsumerStatefulWidget`(能读 provider 的有状态 widget):`build` 里 `ref.watch(themeProvider)` 决定明/暗,`ref.watch(routerProvider)` 拿到 go_router,组成 `MaterialApp.router`。`initState` 里 `addPostFrameCallback` 调 `auth.bootstrap()` ——首帧渲染后再恢复会话,避免启动时序问题。

## 5. Flutter 核心概念（最少必要）

* **一切皆 Widget**:页面、按钮、文字、布局(Row/Column/Stack)、甚至「居中」「padding」都是 widget。UI = widget 树。
* **`build(context)` 方法**:每个 widget 有个 `build`,返回它的子树。框架在状态变化时**重新调用 build**,拿新树和旧树 diff,只更新变化的部分(和 React 的虚拟 DOM 一回事)。
* **StatelessWidget vs StatefulWidget**:无内部状态用前者;有内部可变状态(如倒计时 tick、hover)用后者,把可变字段放进 `State` 类,改它时调 `setState(() => ...)` 触发重建。
* **`ConsumerWidget` / `ConsumerStatefulWidget`**:Riverpod 提供的 widget 变体,多一个 `ref` 参数,用来 `ref.watch`(订阅,变化重建)/ `ref.read`(只读一次,用于事件回调)provider。
* **const 构造**:能 const 的 widget 加 `const`,框架可跳过其重建,省性能。

一个最小例子(本项目 `pages/not_found_page.dart` 即此形):

```dart
class NotFoundPage extends StatelessWidget {
  const NotFoundPage({super.key});
  @override
  Widget build(BuildContext context) {
    final c = context.colors;                 // 见 §10：从主题扩展取语义色
    return Center(child: Text('404', style: TextStyle(color: c.textPrimary)));
  }
}
```

## 6. 状态层：Riverpod

Riverpod 是本实现的状态管理(对位 React 的 Zustand)。核心:用 `Notifier<State>` 类持有不可变 state,改 `state = newState` 自动通知所有 watch 它的 widget。

```dart
class PlazaState { final List<CapsuleListItem> items; final bool loading; /* … */
  PlazaState copyWith({...}) => PlazaState(...);   // 不可变：改动产生新对象
}
class PlazaNotifier extends Notifier<PlazaState> {
  int _seq = 0;                                    // 闭包式序列号，防并发乱序
  @override PlazaState build() => const PlazaState();
  Future<void> fetch() async {
    final my = ++_seq;
    state = state.copyWith(loading: true);
    final data = await ref.read(apiClientProvider).plaza(/* … */, pageSize: 15);
    if (my != _seq) return;                         // 落后的请求丢弃
    state = state.copyWith(items: data.items, loading: false);
  }
}
final plazaProvider = NotifierProvider<PlazaNotifier, PlazaState>(PlazaNotifier.new);
```

四个 store 与 React 一一对应:`theme`(明暗+持久化)、`auth`(token/user+持久化+守卫所需 `canAccessProtected`)、`plaza`(排序/筛选/搜索/分页)、`capsule`(我创建的/我收藏的 + 删除 + 收藏切换,切换时联动 patch 广场列表)。`providers.dart` 放跨 store 的公共 provider:`sharedPrefsProvider`(根注入)、`apiClientProvider`(单例)。

**与 api 解耦**:`auth.dart` 的 `build()` 里把 token 存取/失效以回调挂到 `ApiClient`(`getAccessToken`/`onTokensRefreshed`/`onAuthLost`),api 层不反向依赖 store——和 React `configureApi(...)` 同一手法。

## 7. 数据层：`api/client.dart`

同步逻辑镜像 React `api/client.ts`:

- 通用 `_request<T>(method, path, {body, auth, parse})`:拼 URL(`API_BASE` 来自 `--dart-define`)、带 `Authorization`、解 `Envelope`(`{success, data, message, errorCode}`)、失败抛 `ApiException`。
- **自动 refresh 单飞**:access token 缺失或 401 时触发一次 `/auth/refresh`,用一个 `Future<String?>? _refreshing` 字段做单飞(并发请求共享同一次刷新),刷新成功重放原请求一次。
- `avatarUrl(id)` / `resolveAsset(url)` 拼后端静态资源地址(头像/技术栈图标)。
- 端点方法逐一对应:`health` / `suggestCapsule` / `capsuleRecommendations` / `avatars` / `register` / `login` / `logout` / `me` / `updateProfile` / `changePassword` / `createCapsule` / `capsuleByCode` / `plaza` / `myCapsules` / `deleteMyCapsule` / `myFavorites` / `favorite` / `unfavorite`。

## 8. 路由层：`router.dart`（go_router）

```dart
final routerProvider = Provider<GoRouter>((ref) {
  final refresh = ValueNotifier(0);
  ref.listen(authProvider, (_, _) => refresh.value++);   // auth 变化触发 redirect 重算
  return GoRouter(
    refreshListenable: refresh,
    redirect: (context, state) {                         // = AuthGate
      final auth = ref.read(authProvider);
      if (!auth.hydrated) return null;
      final loc = state.matchedLocation;
      final needsAuth = loc == '/create' || loc.startsWith('/me');
      if (needsAuth && !(auth.isAuthenticated || auth.refreshToken != null)) {
        return '/login?from=${Uri.encodeComponent(loc)}';
      }
      return null;
    },
    routes: [
      ShellRoute(builder: (_, __, child) => MainLayout(child: child), routes: [/* 顶层页 */]),
      GoRoute(path: '/me', redirect: (_, _) => '/me/created'),
      ShellRoute(builder: (_, __, child) => MeLayout(child: child), routes: [/* me 三页 */]),
    ],
  );
});
```

- 两个 `ShellRoute`:`MainLayout`(顶部 nav + footer)包顶层页;`MeLayout`(侧栏)包 `/me/*`。
- 守卫:`/create` 和 `/me/*` 需登录;放行条件是「有 user 或有 refreshToken」(对齐 React `AuthGate`)。登录后 `LoginPage` 读 `from` 查询参回跳。

## 9. 页面层与组件层

页面在 `lib/pages/`(11 个),组件在 `lib/widgets/`,与 React `pages/`、`components/` 一一对应。典型页面骨架(`ConsumerStatefulWidget`):`initState` 里 `addPostFrameCallback` 触发首屏 fetch,`build` 里 `ref.watch(someProvider)` 拿 state 渲染。

关键组件:
- `CapsuleCard`:渐变描边(自绘 `GradientBoxBorder`)+ 状态辉光 + hover 上浮呼吸(`AnimationController`)+ 未开启每秒倒计时(`Timer.periodic`)。
- `DateTimePicker`:触发按钮(单行显示值 + 距开启)→ 弹层(手动 年/月/日/时/分键盘输入 + ↑↓ 步进 / 周一起月历 / 时分 + 模拟时钟表盘 / 预设),draft 模式,确认才提交。
- `FlipClock`:翻页时钟倒计时(`AnimatedSwitcher` 数字过渡)。
- `RemoteSvg` / `AvatarView`:抓后端 SVG 字节 → `SvgPicture.memory`,带内存缓存与首字母兜底。

## 10. 主题与样式：codegen + ThemeExtension

- `scripts/gen-tokens-flutter` 把 `spec/tokens/tokens.json` 生成 `lib/theme/tokens.dart`:`AppSize`(间距/圆角/字号 px 常量)、`AppFont`(字体族/字重)、`SemanticColors`(每主题一套语义色)、`darkColors`/`lightColors` 两个 const 实例。
- `app_theme.dart`:`buildAppTheme(colors, brightness)` 组 `ThemeData`,并把 `SemanticColors` 挂到 `ThemeExtension<AppColors>`;组件用 `context.colors`(扩展方法)读语义色。复合流光渐变(hero CTA / 卡片描边)是主题无关常量,定义在 `AppGradients`。
- `components.dart`:`HtButton`(变体 primary/ghost/success/danger/heroPrimary/heroSuccess × 尺寸)、`HtAlert`、输入框装饰、卡片装饰——对齐 `spec/styles/cyber.css`。

## 11. 与 React 参考实现的对应（核心叙事）

「逻辑/令牌共享,视图分叉」:

| 层 | React (`frontends/react-ts`) | Flutter（本实现） |
|---|---|---|
| 类型 | `types/index.ts` | `lib/models/models.dart`（fromJson） |
| API | `api/client.ts` | `lib/api/client.dart`（同语义） |
| 状态 | Zustand 4 store | Riverpod 4 Notifier |
| 路由/守卫 | React Router + AuthGate | go_router + redirect |
| 令牌 | `tokens.css` | codegen `tokens.dart` |
| 持久化 | localStorage | shared_preferences |
| 视图 | JSX 组件 | Widget（重建） |

逻辑层是「同一套思路换语言」,视图层是用 Flutter widget 重写。

## 12. 环境与已知点

- **Flutter SDK 不在全局 PATH**:本机经 git clone 装在 `~/development/flutter`,`run`/`build.sh` 内部 export;要让裸 `flutter` 命令与 `hello doctor` 全局可用,在 `~/.zshrc` 加 `export PATH="$HOME/development/flutter/bin:$PATH"`。
- **macOS 沙箱需 `com.apple.security.network.client`**(`macos/Runner/{DebugProfile,Release}.entitlements`),否则出站 HTTP 被静默拦截、后端零日志——排查连通性的第一嫌疑。
- **构建脚本叫 `build.sh` 不是 `build`**:Flutter 强制把产物写入 `build/` 目录,与同名脚本文件在文件系统层面冲突。
- `logo.svg` 含 `<filter>` 发光滤镜,flutter_svg 打印一条 `unhandled element <filter/>` 警告——良性,矢量主体正常渲染。

## 13. 常见改动指南

- **加一个页面**:`lib/pages/` 新建 → `router.dart` 加 `GoRoute` → 若需导航入口,在 header/sidebar 加 `context.go('/x')`。
- **加一个接口**:`api/client.dart` 加端点方法 → 在对应 store 的 Notifier 里调用并更新 state → 页面 `ref.watch` 渲染。
- **加一个状态域**:`lib/stores/` 仿现有 Notifier + `NotifierProvider`。
- **改设计令牌**:改 `spec/styles/tokens.css`(源)→ 同步 `tokens.json` → 跑 `scripts/gen-tokens-flutter` 重生成 `tokens.dart`;不要手改 `tokens.dart`。
- **改主题色用法**:组件里 `context.colors.xxx`(语义色)、`AppSize.sX`(间距)、`AppGradients.xxx`(渐变)。

## 14. 验证（无 computer-use，编译 + 后端日志）

- `./build.sh`:codegen + `flutter analyze` 零问题 + `flutter build macos` 通过;`flutter test` 3/3。
- 连通:`hello start flutter` 后 fastapi 日志出现 `GET /api/v1/health 200`、`GET /api/v1/plaza/capsules?...&pageSize=15 200`、`GET /static/avatars/*.svg 200`,佐证 Dart http → `:9080` 全流程。
- 待补:`integration_test` 核心旅程(登录→建胶囊→开启→收藏)。
