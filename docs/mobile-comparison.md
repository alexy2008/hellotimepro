# HelloTime Pro · 五个移动端实现全面对比

> 对比对象：`mobile/` 下的 5 个移动端客户端，**5/5 已全部落地并验证**（移动端收官 2026-07-06）：
> **React Native（Expo）**（首个，06-23，双平台原生验证 07-06）· **iOS**（SwiftUI 原生，与 macOS 端共享逻辑，06-29）·
> **Flutter**（一码多端，与桌面同源工程，iOS 07-01 / Android 07-05）· **Android**（Jetpack Compose 原生，07-03）·
> **微信小程序**（原生框架，07-06）。
> 姊妹篇：桌面端对比见 `docs/desktop-comparison.md`（规划中）；
> Web 前端对比见 [`docs/frontend-comparison.md`](frontend-comparison.md)；
> 各端深度导读见其 `README.md` / `TECHNICAL_GUIDE.md` 与 [roadmap 落地记录](03-roadmap.md)。

---

## 0. 这篇文章怎么读

移动端与 Web 桌面端是**两套独立 UI 基线**：Web 用顶部导航 + 多列宽屏，移动端用底部 Tab Bar +
单列 + 安全区 + bottom sheet（对标 `ui-prototype/mobile.html`）。所以本文关注的问题是：

> **同一道产品题，搬到五套移动端渲染体系后，哪些能照搬、哪些必须重写、各自拿什么换什么？**

§5 的「逻辑层三种共享策略」是全文枢纽：五端没有一个从零写业务逻辑，但「借」的来源和方式
分成三派，代价与收益截然不同。§6–§9 则各取一个横切面（refresh 单飞 / 沙箱拦网 /
移动 IA / 令牌管线），看同一道难题的五种解法。

---

## 1. 为什么这五个能放在一起比

所有移动端实现的是**同一个产品**，共享同一套约束：

- 同一份 API 契约（都打到 `:9080` 反代后的同一组后端，响应外壳 `{ success, data, message, errorCode }` 一致）；
- 同一套**设计令牌**（`spec/tokens/tokens.json`，经各端 codegen 落地，不漂移）；
- 同样的核心页面 / 交互（广场浏览、创建胶囊、按码开启、收藏、个人中心、AI 创作助手、主题切换）；
- 同样的鉴权全流程（access token 内存、refresh token + user 持久化、并发请求合并 refresh、`/me` 校验）；
- 同样的移动 IA（底部四 Tab：广场 / 开启 / 创建 / 我的 + 受保护入口拦截）。

于是各端差异，纯粹来自**渲染体系与生态选择**，而非需求差异。

---

## 2. 技术栈速览

| | react-native | ios | flutter | android | wechat |
|---|---|---|---|---|---|
| 语言 | TypeScript | Swift 6 | Dart | Kotlin 2.4 | JavaScript（ES6） |
| UI 框架 | React Native 0.85 + Expo 56 | SwiftUI（@Observable） | Flutter（Impeller 自绘） | Jetpack Compose + M3 | 小程序原生（WXML/WXSS） |
| 状态 | Zustand（与 react-ts 同源） | `@Observable` AppStore | Riverpod 3 | StateFlow + Compose state | 40 行手搓可观察 store |
| 导航 | Expo Router（文件式） | TabView + NavigationStack | go_router（与桌面同一棵树） | NavHost + NavigationBar | tabBar + 页面栈 |
| 网络 | fetch | URLSession async/await | Dart http | OkHttp 5 | wx.request（包 Promise） |
| 持久化 | AsyncStorage（异步） | UserDefaults | shared_preferences | DataStore | wx.storageSync（同步） |
| 运行形态 | Metro dev server（:7192） | 原生进程（`native`） | 原生进程（`native`） | 原生进程（`native`） | 微信开发者工具模拟器（`native`） |
| 工程生成 | Expo 模板 | **XcodeGen**（yml→xcodeproj） | flutter create | **全手写 gradle** | 手写四件套 |

---

## 3. 定位与设计哲学

体例同 [`frontend-comparison.md`](frontend-comparison.md) §3：一句话哲学 + 在优化什么、拿什么换。

### 3.1 React Native —— 「同一种 React，换一个渲染目标」

与 `frontends/react-ts` 形成最直接对照：JSX + Hooks + 单向数据流原封不动，`<div>` 换 `<View>`、
CSS 类换 `StyleSheet`、React Router 换 Expo Router 文件式路由。**逻辑层（types / api client /
zustand store / utils）逐字或近逐字搬运**，视图层原生重建。
**在优化**：Web 团队的迁移成本——会 React 就会 RN，逻辑层零学习成本。
**拿什么换**：桥接层的间接性（Metro、原生模块版本矩阵），以及「Android 只有 elevation、
辉光退化」这类渲染保真度妥协。

### 3.2 iOS（SwiftUI）—— 「系统原生，苹果生态内共享」

与 `desktop/swiftui`（macOS）对照：同一种声明式 UI + Swift Concurrency + Observation，
逻辑层（Models / APIClient / AppStore / DateUtil）**拷贝改写**，视图层按移动 IA 重建
（TabView 替代自定义路由栈）。
**在优化**：平台贴合度——SF 字体、系统材质、动态色、每 Tab 独立 NavigationStack 都是白拿的。
**拿什么换**：单平台锁定；工程必须是 Xcode 工程（XcodeGen 补救）；令牌未上 codegen，
`Tokens.swift` 手抄（全场唯一）。

### 3.3 Flutter —— 「一份代码，桌面 + 移动双投影」

与其它四端根本不同：**物理工程唯一**（`lib/` 在 `desktop/flutter`，`mobile/flutter` 只是运行
入口目录）。移动 IA 全部由外壳层 `MediaQuery` 宽窄分支实现（`kWideBreakpoint=740`，窄屏走
127 行的 `MobileShell`），**go_router 路由树零改动，桌面零回归**。
**在优化**：多端边际成本——第 N 个平台 ≈ 加平台脚手架 + 响应式分支，业务代码零增量。
**拿什么换**：自绘引擎不用系统控件（视觉自成一体而非平台原生感）；工具链重
（Gradle/NDK/镜像冲突的坑最多）。

### 3.4 Android（Jetpack Compose）—— 「React 的 fetch 客户端，在 Android 世界逐字重写」

没有可共享的同语言母本，于是把 `react-ts` 的 client.ts **按语义 1:1 重写成 Kotlin**：
Envelope 解包、refresh 单飞、401 重放一次，一一对应，只是 fetch→OkHttp、
Promise 共享→Mutex + 进锁复查。UI 层是移动 IA 的 Compose 表达。
**在优化**：证明「契约驱动的逻辑层设计」不依赖语言——JS 的心智模型能无损翻译成协程 + 挂起函数。
**拿什么换**：全部手写（gradle 工程无向导、版本先 curl maven-metadata 实查），
一行都不能白拿。

### 3.5 微信小程序 —— 「同逻辑异视图，平台原语裸写」

不借 Taro / uni-app，直接吃 `App`/`Page`/`Component` + WXML/WXSS + `setData`。业务逻辑从
react-ts 近逐字移植，承载它的是 **40 行手搓可观察 store（与 zustand vanilla API 同形，
store 工厂一字不改）**；视图层按小程序 IA 全量重建。
**在优化**：分发形态——不装 App、微信内即点即用，以及一个独立平台范式的教学价值。
**拿什么换**：平台枷锁最多——`<image>` 不认 SVG（预烘焙 PNG 补救）、组件属性吃不了 CSS
变量、真机联网要 AppID 审批、运行必须依赖 GUI 开发者工具。

### 3.6 五句话速记

- **react-native**：Web React 的迁移答案——逻辑照搬，视图换渲染目标。
- **ios**：苹果生态内的共享答案——macOS 端拷贝改写，换取系统原生感。
- **flutter**：多端边际成本的答案——一份代码两套 IA，外壳分支而非路由重构。
- **android**：无母本可借的答案——语义 1:1 重写，证明契约设计跨语言成立。
- **wechat**：分发形态的答案——平台原语裸写，枷锁最多但即点即用。

---

## 4. 代码量对比

统一排除 codegen 产物（`tokens.ts` / `Tokens.kt` / `tokens.dart` / `tokens/` 目录），
数据复现命令见文末附录：

| 端 | 行数 | 统计口径 |
|---|---|---|
| flutter | **5,138**（Dart） | ⚠️ 桌面 + 移动**同一份**（移动增量仅 MobileShell 127 行 + 页面级宽窄分支） |
| react-native | 3,898（TS/TSX） | `src/`，屏 + 组件 + 逻辑层 |
| android | 3,005（Kotlin） | `app/src/main/kotlin/`，屏 + 组件 + 逻辑层 |
| wechat | 2,861（JS 1,881 + WXML 569 + WXSS 411） | 9 页四件套 + 组件 + 逻辑层 |
| ios | 2,564（Swift，含手抄 Tokens 174） | `Sources/`，屏 + 组件 + 逻辑层 |

### 怎么读这张表

- **flutter 最大但最「便宜」**：5,138 行同时服务桌面（macOS）与移动（iOS/Android）双 IA，
  单独归给移动端的增量不足 300 行——一码多端的账要按「每平台边际成本」算。
- **ios 最小**：SwiftUI 的声明式密度 + 系统白送的组件（DatePicker / NavigationStack /
  sheet）+ 逻辑层从 macOS 端拷来即用。
- **wechat 的 JS 只有 1,881 行**却覆盖同样的业务面——手搓 store 40 行替代了状态库，
  但代价转移到了 WXML/WXSS（569+411 行模板与样式，Web 系里这部分混在组件文件内）。
- RN 与 android 几乎同量级：**同一份逻辑，一个是搬运（TS→TS），一个是翻译（TS→Kotlin）**，
  翻译并没有显著变贵——契约驱动下逻辑层的语言无关性由此可见。

---

## 5. 逻辑层的三种共享策略（全文枢纽）

五端没有一个从零写业务逻辑，但「借」法分三派：

| 策略 | 端 | 母本 | 共享方式 | 改动量 |
|---|---|---|---|---|
| **A. 逐字移植** | react-native、wechat | `frontends/react-ts` | 复制文件，改平台 API | RN：`localStorage`→`AsyncStorage`；wechat：TS→JS + `fetch`→`wx.request` + zustand→手搓同形 store |
| **B. 拷贝改写** | ios | `desktop/swiftui` | 同语言拷贝，适配平台差异 | `resolveBaseURL` 改读 Bundle；导航从 Route 栈→Tab+sheet；NSColor→UIColor |
| **C. 语义重写 / 同源** | android / flutter | `react-ts`（语义） / 自身 | android 按语义 1:1 翻译成 Kotlin；flutter 物理同一份 | android：全量重写但结构一一对应；flutter：零复制 |

三派的共同点：**「refresh 单飞 + 401 重放 + Envelope 解包 + 收藏计数同步 + 序列号防乱序」
这套业务语义在五端完全一致**——这正是 spec 契约驱动的意义：逻辑层的形状由契约决定，
语言和框架只是宿主。

### 一个值得展开的细节：store 的五种宿主

同一个 plaza store（sort/filter/搜索/分页 + 序列号防乱序）：

- **react-native**：zustand，与 Web 版**同一份文件**。
- **wechat**：`create((set,get)=>({...}))` 工厂函数与 RN 版逐字相同——因为手搓 store 的
  `getState/setState/subscribe` 与 zustand vanilla API 同形；差异只在消费侧
  （页面 `onLoad` 订阅 + `setData`，而非 hook）。
- **ios**：`@Observable` AppStore + 各 View 的 `@State`，语义对齐但形状是 SwiftUI 的。
- **android**：`StateFlow` + Compose `collectAsState`，Kotlin 惯用法。
- **flutter**：Riverpod provider，桌面移动共用。

---

## 6. 同一个 refresh 单飞的五种写法

「并发请求只允许一个去刷新 token，其余等它的结果」——五端五种并发原语：

| 端 | 原语 | 关键点 |
|---|---|---|
| react-native / wechat | 共享 Promise（`let refreshing`） | JS 单线程，赋值即互斥 |
| ios | 共享 `Task<String?, Never>` | Swift Concurrency，`if let r = refreshing { return await r.value }` |
| flutter | 共享 `Future<String?>?`（`_refreshing`） | Dart 事件循环，与 JS 同构 |
| android | `Mutex` + **进锁后复查** | 多线程真并发：拿到锁先查 access 是否已被别人换新，防重复刷新 |

> android 是唯一需要「进锁复查」的——JVM 上协程可能真并行，refresh token 旋转式
> （用一次即作废）意味着两个协程各刷各的必坏一个。JS/Dart 的事件循环白送了这个保证。

---

## 7. 「沙箱拦网」与宿主地址：三平台三部曲

移动端第一课：模拟器/沙箱里「localhost」不一定是你的宿主机，明文 HTTP 默认被拦。

| 端 | 宿主后端地址 | 明文放行方式 |
|---|---|---|
| ios / flutter-iOS | `127.0.0.1`（iOS 模拟器共享宿主网络栈） | Info.plist **ATS** 本地例外 |
| android / flutter-Android / RN-Android | **`10.0.2.2`**（模拟器里 127.0.0.1 是模拟器自身） | `network_security_config.xml` 仅对该地址放行 cleartext |
| react-native-iOS | `localhost` | Expo 开发构建默认放行（07-06 实测 localhost 直连成功） |
| wechat | `127.0.0.1`（模拟器跑在宿主 macOS 进程内） | `project.config.json` `urlCheck:false`（仅开发；上线须 https+合法域名） |

三个平台的「拦网」机制（ATS / network_security_config / urlCheck）互为镜像——都默认拒绝
明文、都提供显式豁免通道、豁免都只该用于本地开发。失败症状也一致：**请求静默被拦、
后端零日志**，这也是为什么本项目的连通性验证统一用「后端日志出现 200」佐证（§10）。

---

## 8. 移动 IA：底部 Tab 与受保护入口的五种拦截

四 Tab（广场/开启/创建/我的）+「创建/我的需登录」在五端的表达：

| 端 | Tab 容器 | 受保护入口拦截 |
|---|---|---|
| react-native | Expo Router `(tabs)/_layout` | `AuthGate` 组件包屏 → `router.replace('/login')` |
| ios | `TabView(selection:)` | `selectTab` 拦截：记 pendingTab + 弹登录 sheet，成功回跳 |
| android | `Scaffold` + `NavigationBar` | `requireLogin(pending)` → `ModalBottomSheet`，成功回跳 pendingRoute |
| flutter | `MobileShell` 底部 `NavigationBar` | **与桌面同一套 go_router `redirect`**（外壳换了，守卫没换） |
| wechat | `app.json` 原生 `tabBar` | 页面内 `hasUser` 分支渲染门禁卡片（tabBar 由平台接管，无法程序化拦截切换） |

> 光谱两端：flutter 一行守卫没改（路由层守卫与 IA 无关的极致）；wechat 连「拦截 Tab 切换」
> 都做不到（原生 tabBar 是平台组件），只能放进去再在页面里挡——平台接管得越多，
> 应用能做的越少。

---

## 9. 设计令牌与头像：codegen 管线的五个目标

M5.1「设计令牌跨端 codegen」管线（事实源 `spec/tokens/tokens.json`）在移动端的落地：

| 端 | 脚本 | 产物 | 形态 |
|---|---|---|---|
| react-native | `gen-tokens-rn`（管线首跑） | `tokens.ts` | rem→px 数字，颜色/渐变字符串 |
| flutter | `gen-tokens-flutter` | `tokens.dart` | 桌面移动共享 |
| android | `gen-tokens-android` | `Tokens.kt` | Color / Brush 渐变 / 辉光 Color+Blur，经 `CompositionLocal` 下发 |
| wechat | `gen-tokens-miniprogram` | `tokens.wxss` + `palette.js` | **双通道**：CSS 变量（样式主通道）+ JS 对象（组件属性吃不了 var() 的场景） |
| ios | —（**手抄** `Tokens.swift`） | — | 全场唯一未上 codegen，与 desktop/swiftui 同策略 |

头像是令牌之外的第二类共享资产（`spec/avatars/*.svg`），五端渲染方式恰好铺满一条降级谱系：

| 端 | SVG 渲染 | 说明 |
|---|---|---|
| ios | SVGView（SwiftPM） | UIImage 不认 SVG，引库直渲远端 |
| android | Coil + SvgDecoder | 同上思路 |
| flutter | flutter_svg | 遇 `<filter>` 打印良性警告 |
| react-native | react-native-svg `SvgUri` | 远端直渲 |
| wechat | **预烘焙 PNG**（`gen-avatars-miniprogram`，rsvg-convert） | `<image>` 不认 SVG 且无社区库可引 → codegen 阶段栅格化成本地 256×256 PNG；加载失败回退「色底+首字」徽章 |

> wechat 的方案是管线思想的延伸：**运行时做不到的，就在 codegen 阶段做掉**——与令牌
> 「事实源→codegen→提交产物」是同一条约定。

---

## 10. 验证：原生窗口在 Playwright 之外

Web 端 25 个 UI 冒烟用例是 Playwright 驱动 DOM；五个移动端全在 DOM 之外，验证分层退化为：

| 层 | 五端共同做法 |
|---|---|
| 契约 | 继承后端已绿 104/104，客户端不重复跑 |
| 编译/静态 | 各端 `./build`（RN：tsc+expo export；ios：xcodebuild；android：assembleDebug；flutter：analyze+build；wechat：结构/JSON/四件套/`node --check`） |
| 连通性 | **后端日志佐证**：启动后 fastapi 日志出现 `GET /api/v1/plaza/capsules ... 200`、`/static/avatars/*.svg 200`（android 用「日志偏移法」排除历史残留） |
| 核心旅程 E2E | 各平台工具均**待跑**：Maestro（RN，flow 已埋）/ XCUITest（ios）/ Compose-test（android）/ `integration_test`（flutter）/ miniprogram-automator（wechat） |

`hello` 编排上，只有 react-native 有 dev server 端口（Metro :7192，探端口判活）；其余四端
`port: None` → status 显示 `native`，以 run 进程存活判活。wechat 是唯一**运行必须依赖 GUI
工具**的端（DevTools `cli open` 只加载编辑器，需手动点「编译」）。

---

## 11. 各端的「招牌坑」

来自各端 TECHNICAL_GUIDE 与项目记忆，都已解决：

- **react-native**：Expo 模板 Gradle wrapper 与 RN 0.85 foojay 插件版本矩阵冲突（降 8.14.3）；
  Metro 广播主机名会选到 VPN 虚拟网卡（钉死 `127.0.0.1`）；`EXPO_PUBLIC_*` 由 Metro 进程
  环境**烘焙**，改了要重启 Metro。
- **ios**：ATS 静默拦明文（后端零日志，最难定位的一类失败）；iOS app 不能纯 SwiftPM
  跑模拟器（XcodeGen 补救）；UIImage 不认 SVG。
- **android**：手写 gradle 的版本全靠 curl maven-metadata 实查（Compose BOM 传递依赖强制
  Kotlin ≥2.4）；根 `build/` 目录与 `./build` 脚本同名冲突（buildDirectory 挪走）；
  `hello stop` 的 killpg 会误杀模拟器（`start_new_session` 独立会话）。
- **flutter**：全局 `~/.gradle/init.gradle` 镜像注入与 Gradle 9 严格仓库模式冲突
  （构建期挪开/还原，残留备份则中止）；`flutter_svg` 不支持 `<filter>`（良性警告）；
  桌面端 `build/` 产物目录逼得脚本改名 `build.sh`（移动入口目录反而保住了惯例名）。
- **wechat**：`cli open` 不自动编译（需手动点「编译」，曾误判为无响应）；游客 appid 联网
  受限（真实 AppID 写 gitignored 私有配置）；组件属性（`<switch color>` 等）吃不了 CSS
  变量（palette.js 经页面工厂注入）。

---

## 12. 横向总结与「该读哪一个」

| 你想学什么 | 读哪端 |
|---|---|
| Web 技能如何平移到移动端 | **react-native**（对照 `frontends/react-ts`，逻辑层逐字可比对） |
| 苹果生态的原生开发与跨设备共享 | **ios**（对照 `desktop/swiftui`，看逻辑拷贝 + 视图重建的边界） |
| 跨平台的边际成本极限 | **flutter**（一份代码两套 IA，外壳分支替代路由重构） |
| 契约驱动设计的语言无关性 | **android**（TS→Kotlin 语义 1:1 翻译，并发原语的真差异在 §6） |
| 受限平台下的工程化补偿 | **wechat**（手搓 store、双通道令牌、预烘焙资产——枷锁越多，管线越重要） |

一句话总结：**移动端五连的真正主角不是任何一个框架，而是「契约 + 令牌 + 逻辑层形状」这套
跨端不变量**——渲染体系换了五次，业务语义一行没变。

### 附：复现本文数据

```bash
# 代码量（§4，排除 codegen 产物）
find mobile/react-native/src \( -name "*.ts" -o -name "*.tsx" \) ! -name tokens.ts | xargs wc -l | tail -1
find mobile/ios/Sources -name "*.swift" | xargs wc -l | tail -1
find mobile/android/app/src/main/kotlin -name "*.kt" ! -name Tokens.kt | xargs wc -l | tail -1
find desktop/flutter/lib -name "*.dart" ! -name tokens.dart | xargs wc -l | tail -1   # 桌面+移动同源
for ext in js wxml wxss; do find mobile/wechat-miniprogram -name "*.$ext" -not -path "*/tokens/*" | xargs wc -l | tail -1; done

# 连通性验证（§10，任一端）
./scripts/hello start <react-native|ios|android|flutter-mobile|wechat>
tail -f data/logs/fastapi.log   # 等待 GET /api/v1/plaza/capsules ... 200
```
