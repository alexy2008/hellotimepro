# HelloTime Pro Android 原生（Jetpack Compose）技术手册与代码导读

本文面向熟悉一门现代语言、想了解 **Android 原生开发 / Jetpack Compose** 的读者。读完后你应能回答：

- 一个 Compose app 从 `Application`/`MainActivity` 到看到广场页，代码按什么顺序跑。
- 它与其他移动端（react-native / ios / flutter）如何共享同一份产品语义——哪些逐字对齐、哪些是 Android 的惯用替换。
- Android 特有的几个坑（10.0.2.2、cleartext、gradle build 目录、模拟器进程组）怎么解决。
- 想加一个屏 / 接口 / 状态，改哪些文件。

> 核心叙事：**「React 的 fetch 客户端，在 Android 世界怎么逐字重写」**——`data/ApiClient.kt`
> 与 `frontends/react-ts/src/api/client.ts` 1:1 对齐（refresh 单飞 + 401 重放一次 + Envelope 解包），
> 只是 fetch→OkHttp、Promise 共享→Mutex + 进锁复查。UI 层则是移动 IA 的 Compose 表达。

## 1. 技术选型与设计特色

* **Jetpack Compose + Material 3，零 webview**：声明式 UI + Kotlin 协程，Android 官方现代栈。
* **手写 gradle 工程**：不依赖 Android Studio 向导，`settings/build.gradle.kts` + Version Catalog（`gradle/libs.versions.toml`）全部手写，`./run`/`./build` 纯命令行——与本项目其他原生端一致的「脚本化、可 CI」哲学。
* **纯 API 消费者**：OkHttp 直连 `:9080` 反代（模拟器经 `10.0.2.2`），复用 `/api/v1` 契约，不新增后端代码。
* **令牌 codegen**：`scripts/gen-tokens-android` 读 `spec/tokens/tokens.json` 生成 `theme/Tokens.kt`（Color / Brush 渐变 / 辉光 Color+Blur / FontWeight / px 常量），暗浅两套 `SemanticColors` 走 `CompositionLocal` 下发（`HT.colors`）。

## 2. 先建立整体地图

```text
mobile/android/
├── run / build                 # 起模拟器+装+附着 / codegen+assembleDebug
├── settings.gradle.kts / build.gradle.kts / gradle/libs.versions.toml
└── app/src/main/
    ├── AndroidManifest.xml     # INTERNET + networkSecurityConfig + HelloTimeApp
    ├── res/xml/network_security_config.xml   # 10.0.2.2 cleartext 例外
    └── kotlin/pro/hellotime/android/
        ├── HelloTimeApp.kt     # Application：AppGraph 手工装配 + Coil SVG 注册
        ├── MainActivity.kt     # setContent { HelloTimeTheme { RootView() } }
        ├── data/               # Models(kotlinx.serialization) / ApiClient / SessionStore / ThemeStore
        ├── theme/              # Tokens.kt(codegen) / Theme.kt(M3 装配 + HT.colors)
        ├── util/DateUtil.kt    # java.time：距开启 / 倒计时
        └── ui/                 # Root(底部Tab+NavHost) / 各屏 / 组件
```

一次「打开广场」的流向：

```text
HelloTimeApp.onCreate → AppGraph.init（SessionStore↔ApiClient 回调互指）→ bootstrap()（DataStore 恢复会话）
  ▼
MainActivity.setContent → HelloTimeTheme(dark) → RootView：Scaffold(bottomBar=NavigationBar) + NavHost
  ▼
PlazaScreen LaunchedEffect → AppGraph.api.plaza(...) → OkHttp 打 http://10.0.2.2:9080
  ▼
Envelope 解包 → Compose state 更新 → 卡片重组；头像 Coil+SvgDecoder 拉 /static/avatars/<id>.svg
```

## 3. 逻辑层（与 react-ts 1:1 对齐的部分）

| react-ts | Android | 说明 |
|---|---|---|
| `fetch` + `request<T>()` | OkHttp + `ApiClient.request<T>()`（inline reified） | Envelope 解包、错误→`ApiException` 同构 |
| refresh 单飞（共享 Promise） | `Mutex` + **进锁后复查 access 是否已被换新** | refresh token 旋转式，不能并发各刷各的 |
| 401 UNAUTHORIZED → 重放一次 | 同 | `_retry` 标志防死循环 |
| zustand auth store + AsyncStorage | `SessionStore`(StateFlow) + DataStore | access 内存 / refresh+user 落盘 |
| `configureApi` 注册回调 | `AppGraph` 构造时回调互指 | 避免构造环 |

## 4. UI 层：移动 IA 的 Compose 表达

- **外壳**（`ui/Root.kt`）：`Scaffold` + `NavigationBar` 四 Tab + `NavHost`；受保护 Tab（创建/我的）未登录 → `session.requireLogin(pending)` 弹 `ModalBottomSheet` 登录/注册，成功回跳 pendingRoute（= iOS selectTab 拦截 / go_router redirect）。
- **广场**：紧凑 hero（`Brush` 渐变标题 + `Modifier.blur` 紫色辉光——Material 阴影只有高度模型，辉光靠 blur 补偿）+ 排序/筛选 `Segmented`（等分全宽）+ 300ms 防抖搜索（`LaunchedEffect(query){delay(300)}`，注意跳过首帧防双载）+ 分页。顶栏带**主题切换 + 关于**（登录前可达）。
- **开启**：8 位码 = 隐藏 `BasicTextField` + `decorationBox` 画 8 格（软键盘退格天然可用，= iOS 同思路）。
- **详情**：密封 → 每秒 tick 倒计时、到点自动重拉；已开启 → 正文；复制码 `LocalClipboardManager`；作者可删。
- **创建**：AI 生成（`capsule-suggestion`）+ 推荐灵感条（`capsule-recommendations`，换一批）+ M3 `DatePickerDialog`/`TimePicker` + 快捷预设 + 广场开关；成功页展示 8 位码。
- **辉光/彩影**：卡片用 `Modifier.shadow(ambientColor/spotColor=玻色)`（API 28+ 有彩色阴影）。

## 5. Android 平台坑（都已解决）

- **`127.0.0.1` 是模拟器自己**：宿主后端必须走 `10.0.2.2`（emulator 固定别名），否则后端零日志。
- **cleartext 默认被拦**（Android 9+）：`network_security_config.xml` 仅对 `10.0.2.2`/localhost 放行——Android 版「沙箱拦网」（对照 macOS network.client / iOS ATS）。
- **gradle 根 `build/` 目录 vs `./build` 脚本**：把根工程 `layout.buildDirectory` 挪到 `.gradle/root-build`，脚本得以用惯例名（flutter 当时只能让位改叫 `build.sh`）。
- **hello stop 是 `killpg`**：`run` 里 emulator 经 `python3 subprocess.Popen(start_new_session=True)` 挂独立会话才不陪葬；app 本体则以 `pidof` 存活为界，app 退出 → run 退出（判活语义 = ios/swiftui）。
- **版本矩阵**：Compose BOM 2026.05 传递依赖 kotlin-stdlib 2.4 元数据 → Kotlin 必须 ≥2.4（2.2 编译器读不了）；Kotlin 2.4 移除旧 `kotlinOptions` DSL → 用 `kotlin { compilerOptions { jvmTarget } }`。版本一律先 `curl` Google Maven / Maven Central 的 `maven-metadata.xml` 实查，不猜。

## 6. 如何运行和验证（无 computer-use）

```bash
cd mobile/android && ./build        # codegen + assembleDebug
./scripts/hello start android       # 起模拟器 + installDebug + am start + logcat 附着
```

验证：fastapi 日志出现 `GET /api/v1/plaza/capsules?...&pageSize=15 200` + `GET /static/avatars/*.svg 200`
（**日志偏移法**：记 offset → force-stop + 重启 app → 只看偏移后的新增行，排除历史残留）。
核心旅程 E2E（Compose-test / Espresso）：后续。

## 7. 常见改动指南

- **加一屏**：`ui/` 新建 Composable → `Root.kt` 的 `NavHost` 加 `composable("route")`。
- **加接口**：`data/ApiClient.kt` 加 suspend 端点方法（模型进 `data/Models.kt`）。
- **改令牌**：改 `spec/styles/tokens.css`（源）→ 派生 `tokens.json` → `node scripts/gen-tokens-android`（`run`/`build` 每次自动跑）。
- **升依赖**：只动 `gradle/libs.versions.toml`；先 curl maven-metadata 确认版本存在。
