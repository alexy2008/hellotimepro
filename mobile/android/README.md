# HelloTime Pro · Android 原生（Jetpack Compose）

M5 移动客户端之一，**纯原生、零 webview**：用 **Jetpack Compose + Material 3** 重建整套界面，跑在 Android 模拟器/真机。
与 react-native / ios / flutter 实现同一份产品与 `/api/v1` 契约——底部 **Tab Bar**（广场/开启/创建/我的）+ 登录 sheet 的移动 IA。
**OkHttp** 直连宿主反代（模拟器经 `10.0.2.2:9080`），设计令牌经 `scripts/gen-tokens-android` 从 spec 同源生成。

## 运行

```bash
./scripts/hello start android      # 起模拟器 + installDebug + 启动（port:None → status 显示 native）
./scripts/hello stop android       # 停 app（模拟器保留，独立会话不陪葬）
# 或直接：
cd mobile/android && ./run         # ANDROID_AVD="Pixel_9" ./run 指定 AVD（默认 HelloTimePro）
./build                            # 令牌 codegen + gradle assembleDebug（编译校验）
```

后端默认 `http://10.0.2.2:9080`——**模拟器里 `127.0.0.1` 是模拟器自身**，`10.0.2.2` 是宿主 loopback 的固定别名；
真机联调用 `BACKEND_PROXY=http://<局域网IP>:9080 ./build` 重打包（并把该 IP 加进 network_security_config）。

## 技术栈（Android 的惯用答案）

| 层 | 选型 | 对照其他端 |
|---|---|---|
| UI | Jetpack Compose + Material 3 | SwiftUI / Flutter widgets |
| 状态 | Compose state + StateFlow（会话级） | @Observable / Riverpod / zustand |
| 导航 | navigation-compose + NavigationBar | NavigationStack / go_router |
| HTTP | OkHttp + kotlinx.serialization（手写 ApiClient，1:1 对齐 react-ts client） | URLSession / Dart http |
| SVG | Coil 3 + SvgDecoder | SVGView / flutter_svg |
| 持久化 | DataStore（refreshToken + user + 主题） | UserDefaults / SharedPreferences |

工程为手写 gradle 工程（Version Catalog `gradle/libs.versions.toml`），不依赖 Android Studio 向导；
`./run`/`./build` 纯命令行（AGP 8.13 + Kotlin 2.4 + Compose BOM 2026.05）。

## 已知点 / Android 特有坑

- **明文 HTTP 默认被拦**（Android 9+，Android 版「沙箱拦网」）→ `res/xml/network_security_config.xml` 只对 `10.0.2.2`/localhost 放行 cleartext。
- **`10.0.2.2` 才是宿主**：连 `127.0.0.1` 后端永远零日志。
- **gradle 根 build/ 目录让位**：`build.gradle.kts` 把根工程 buildDirectory 挪到 `.gradle/root-build`，故本目录可用仓库惯例名 `./build` 脚本（不像 flutter 被迫 `build.sh`；app 产物仍在 `app/build/`）。
- **hello stop 不杀模拟器**：`run` 经 `python3 start_new_session` 把 emulator 挂独立会话，`killpg` 只停 app；`run` 以 app 进程存活为界（app 退出 → run 退出，语义同 ios/swiftui）。
- Compose BOM 2026.05 传递依赖 kotlin-stdlib 2.4 元数据 → Kotlin 编译器须 ≥2.4。

## 验证（无 computer-use，编译 + 模拟器 + 后端日志）

- `./build`：令牌 codegen + `assembleDebug` 通过。
- `hello start android`：起模拟器 → 装 → 启动；fastapi 日志出现该 app 的
  `GET /api/v1/plaza/capsules?...&pageSize=15 200`、`GET /static/avatars/*.svg 200`（日志偏移法确认为本次冷启动新增）；`hello stop` 干净停、模拟器保留。
- 核心旅程 E2E（Espresso / Compose-test）：后续。
