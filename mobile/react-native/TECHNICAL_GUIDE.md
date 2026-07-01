# HelloTime Pro React Native（Expo）移动端技术手册与代码导读

本文面向已经熟悉 React（Web）、但没系统接触过 **React Native / Expo / 原生移动端** 的读者。读完后你应能回答:

- 同一套 React 心智(JSX + Hooks + 单向数据流)在「渲染到原生组件」时和「渲染到 DOM」差在哪。
- Expo、Expo Router、Metro、AsyncStorage、react-native-svg 各自在做什么。
- 这套客户端和 `frontends/react-ts` 是什么对应关系——哪些**逐字搬**、哪些重写。
- 想加一个页面 / 状态 / 接口调用,改哪些文件。

> 核心叙事:本端是「**Web React vs Native React**」的对照实验。**逻辑层(类型 / API 客户端 / Zustand store / 工具函数)与 `frontends/react-ts` 近乎逐字相同**——所以这部分的深度代码导读请直接看 `frontends/react-ts/TECHNICAL_GUIDE.md`。本文重点讲**不同的地方**:视图层换成原生组件、路由换成 Expo Router 文件式 + 底部 Tab Bar、几处 Web→原生的适配。

## 1. 技术选型与设计特色

本实现是 M5 **首个移动端**,基于 **Expo + React Native + React 19 + TypeScript**,状态 **Zustand**,路由 **Expo Router**(文件式)。设计特色:

* **同种 React,不同渲染目标**:还是 JSX + Hooks + 单向数据流,但 `<div>`/`<span>`/`<button>` 换成 `<View>`/`<Text>`/`<Pressable>`,样式从 CSS 类换成 `StyleSheet` 对象。「只有状态变更触发重渲染」这点和 Web 完全一致。
* **分层共享,视图分叉**:`types` / `api/client` / `stores` / `utils` 从 React 前端**逐字或近逐字搬过来**(仅改少量 Web-only 依赖),只有**视图层(11 屏 + UI 基元/域组件)用 RN 原生组件重建**,IA 也从顶部 nav 换成**底部 Tab Bar**(对标 `ui-prototype/mobile.html`)。
* **纯 API 消费者**:不新增后端代码;RN 无 Vite 代理,`fetch` 直连 `:9080`(`EXPO_PUBLIC_API_BASE` 可覆盖,真机用局域网 IP)。
* **设计令牌 codegen**:`scripts/gen-tokens-rn` 从 `spec/tokens/tokens.json` 生成 `src/theme/tokens.ts`(这是 M5.1 令牌 codegen 管线的首次实跑)。

## 2. 先建立整体地图

```text
mobile/react-native/
├── app.json                   # Expo 配置（应用名、scheme、插件）
├── package.json               # Expo SDK 56 + RN 0.85 + React 19 等
├── run                        # 令牌 codegen + 启动 Metro(:7192) + 开模拟器
├── build                      # codegen + tsc --noEmit + expo export
└── src/
    ├── app/                    # ← Expo Router：文件即路由（见 §4）
    │   ├── _layout.tsx         # 根布局：hydrate auth/theme + Stack 导航
    │   ├── (tabs)/             # 底部 Tab Bar 分组
    │   │   ├── _layout.tsx     # Tab Bar 定义（广场/开启/创建/我的）
    │   │   ├── index.tsx       # 广场（= PlazaPage）
    │   │   ├── open.tsx  create.tsx  me.tsx
    │   ├── c/[code].tsx        # 凭码详情（动态路由 = /c/:code）
    │   ├── login.tsx  register.tsx  about.tsx  settings.tsx  +not-found.tsx
    ├── types/index.ts          # ← 与 react-ts 逐字相同
    ├── api/{client,config}.ts  # ← client 逐字（仅 BASE 改 API_BASE）
    ├── stores/                 # ← plaza/capsule 逐字；auth/theme 改 AsyncStorage
    ├── utils/{format,avatar}.ts # ← 逐字
    ├── theme/{tokens,index}.ts  # tokens 为 codegen 产物；index 包成调色板
    └── components/             # 视图层：原生重建（CapsuleCard、ui.tsx 基元、chrome.tsx…）
```

一次「打开广场」的流向(对照 React Web 版,差异已标注):

```text
expo start（Metro，:7192）→ 模拟器加载 JS bundle
  │
  ▼
src/app/_layout.tsx：hydrate auth/theme（从 AsyncStorage，← Web 是 localStorage）
  │ Expo Router 渲染 Stack
  ▼
(tabs)/_layout.tsx：底部 Tab Bar（← Web 是顶部 nav）
  │ 默认 tab = index.tsx（广场）
  ▼
广场屏 useEffect → usePlaza.fetch()（← 与 Web 同一个 store 文件，逐字）
  │
  ▼
api.plaza(...) → fetch(`${API_BASE}/api/v1/plaza/capsules?...&pageSize=15`)（← 直连 :9080，无代理）
  │
  ▼
后端 JSON → Zustand 更新 → RN 重渲染 <FlatList> 卡片（← Web 是 .map 渲染 <div>）
```

## 3. 如何运行和验证

```bash
./scripts/hello start react-native   # 启动 Metro(:7192)，探端口即就绪
cd mobile/react-native
./run            # = ./run ios：Metro + iOS 模拟器
./run android    # Metro + Android 模拟器
./run metro      # 仅 Metro（headless，给 Maestro/CI）
./build          # codegen + tsc --noEmit + expo export --platform ios
```

`./run`:① 首次 `npm install`;② 跑 `scripts/gen-tokens-rn` 重生成 `src/theme/tokens.ts`;③ `expo start --port 7192`(`hello` 探 :7192 即判 ready;模拟器启动 + Expo Go 安装在其后异步完成,首次较慢)。后端地址经 `EXPO_PUBLIC_API_BASE`(默认 `:9080`)注入。

## 4. Expo Router：文件即路由（与 React Router 的最大不同）

React Web 版用 `router.tsx` 集中声明路由表;RN 版用 **Expo Router** —— `src/app/` 下的**文件路径就是 URL**:
- `app/(tabs)/index.tsx` → 默认 tab(广场);`(tabs)` 是「分组」目录,不进 URL,但 `(tabs)/_layout.tsx` 在这里定义**底部 Tab Bar**。
- `app/c/[code].tsx` → 动态路由 `/c/:code`(`[code]` 是参数,用 `useLocalSearchParams()` 取)。
- `app/login.tsx`、`about.tsx` 等 → 栈内推入的普通屏。
- `app/_layout.tsx` → 根布局,放全局 hydrate + `<Stack>`。
- 导航:`router.push('/c/ABC')` / `router.replace('/login')`(`expo-router` 的 `useRouter`)。
- **守卫**:`components/AuthGate.tsx` 包住受保护屏(创建/我的),未登录 `router.replace('/login')` —— 思路同 Web `AuthGate`。

## 5. Web React → Native React 的关键差异

| Web（`frontends/react-ts`） | Native（本实现） |
|---|---|
| `<div> <span> <button> <input>` | `<View> <Text> <Pressable> <TextInput>` |
| CSS 类 / Tailwind | `StyleSheet.create({...})` 对象，无级联 |
| `<img src>` | `react-native-svg` 的 `<SvgUri>`（头像/图标）/ `<Image>` |
| `.map()` 渲染列表 | `<FlatList>`（虚拟化滚动） |
| localStorage（同步） | `AsyncStorage`（异步，store hydrate 要 await） |
| React Router 路由表 | Expo Router 文件式 + Tab Bar |
| 顶部 nav 多列宽屏 | 底部 Tab Bar + 单列 + 安全区 |
| 浏览器 fetch（Vite 代理 /api） | fetch 直连 `:9080`（`EXPO_PUBLIC_API_BASE`） |

逻辑层(types / api / stores / utils)几乎不变——这正是「同种 React」的证据。

## 6. 共享层:与 `frontends/react-ts` 的对应

- **`types/index.ts`**:逐字相同(与 `spec/api/openapi.yaml` 对齐)。
- **`api/client.ts`**:逐字搬,只把 `BASE` 从 `""`(Vite 代理)改为 `API_BASE`(`config.ts` 读 `EXPO_PUBLIC_API_BASE`);refresh 单飞 + 401 重放 + Envelope 解包逻辑不变。
- **`stores/plaza.ts`、`stores/capsule.ts`**:逐字搬(纯逻辑,与渲染无关)。
- **`stores/auth.ts`、`stores/theme.ts`**:把 `localStorage` 同步读写换成 `AsyncStorage` 异步(hydrate 改成 `await`)。
- **`utils/format.ts`、`utils/avatar.ts`**:逐字。

> 深度导读(request 封装、refresh 去重、Zustand 序列号模式、四个 store 的职责)见 `frontends/react-ts/TECHNICAL_GUIDE.md` §8–9——本端这些**就是同一份代码**。

## 7. 视图层与组件层

`src/app/*`(11 屏)对应 React 的 `pages/*`;`src/components/*` 对应 `components/*`,但用 RN 原生组件重建:
- `components/ui.tsx`:基础 UI 基元(按钮/卡片/输入框/Alert 等的原生封装,消费 `theme/index.ts` 的调色板)。
- `components/chrome.tsx`:外壳件(头/页脚/容器之类)。
- `components/media.tsx`:头像/SVG 图标(`react-native-svg` 的 `SvgUri` 拉后端 `/static/*.svg`,不自造)。
- `CapsuleCard` / `PlazaToolbar` / `Pagination` / `FavoriteButton` / `CapsuleCodeInput` / `DateTimeField` / `RecommendationStrip` / `AvatarPicker` / `CapsuleList`:与 Web 同名组件功能对齐,原生重建。

## 8. 主题与令牌

`scripts/gen-tokens-rn` 读 `spec/tokens/tokens.json` → `src/theme/tokens.ts`(rem→px 数字、颜色/渐变保留字符串)。`theme/index.ts` 把它包成调色板 / glow / 字体 / 间距的消费层,组件从这里取色,不写死值。`run`/`build` 启动前自动重生成,防漂移。

## 9. 常见改动指南

- **加一屏**:在 `src/app/` 按文件式路由新建(普通屏直接 `xxx.tsx`,要进 Tab Bar 放 `(tabs)/` 并在 `(tabs)/_layout.tsx` 注册)。
- **加接口 / 状态**:与 Web 完全一样——`api/client.ts` 加端点 → 对应 store 调用 → 屏里 `use*` 订阅。多数情况可直接对照 react-ts 改。
- **改令牌**:改 `spec/styles/tokens.css`(源)→ 同步 `tokens.json` → 跑 `scripts/gen-tokens-rn`;不要手改 `tokens.ts`。
- **Web→原生陷阱**:列表用 `FlatList` 而非 `.map`;持久化记得 `await`;样式用 `StyleSheet` 无级联;尺寸用数字不带单位。

## 10. 验证

- `./build`:codegen + `tsc --noEmit`(类型检查)+ `expo export --platform ios`(打包)全绿。
- `hello start react-native`:Metro 在 :7192 `ready`(`packager-status:running`),codegen 自动执行,后端指向 :9080;`hello stop` 干净停。
- 核心旅程 E2E 用 **Maestro**(`.maestro/core-journey.yaml`,testID 已埋:登录→建胶囊→开启→收藏);设备实跑待 iOS 模拟器运行时(`xcodebuild -downloadPlatform iOS`,~7GB)+ Maestro CLI 就绪。
