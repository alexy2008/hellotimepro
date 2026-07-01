# HelloTime Pro · 移动端实现对比

> 对比对象：`mobile/` 下的移动端客户端实现。**本文随实现推进逐步生长**。
> 当前已落地：**React Native（Expo）**（首个，2026-06-23）· **iOS**（SwiftUI 原生，与 macOS 端共享逻辑，2026-06-29）· **Flutter**（一码多端，与桌面同源工程，iOS 目标 2026-07-01）。
> 规划中：`android`(Jetpack Compose) · `wechat-miniprogram`。
> 详细逐端对比表随「移动端全部落地」后补齐；各端要点先见其 `README.md` / `TECHNICAL_GUIDE.md` 与 roadmap 落地记录。
> 姊妹篇：桌面端对比见 `docs/desktop-comparison.md`（规划中）；
> Web 前端对比见 [`docs/frontend-comparison.md`](frontend-comparison.md)。

---

## 0. 这篇文章怎么读

移动端与 Web 桌面端是**两套独立 UI 基线**：Web 用顶部导航 + 多列宽屏，移动端用底部 Tab Bar +
单列 + 安全区 + bottom sheet（对标 `ui-prototype/mobile.html`）。所以本文关注的问题是：

> **同一道产品题，搬到移动端原生渲染体系后，哪些能照搬、哪些必须重写？**

答案在 §2 的「分层共享」表里：契约/逻辑/令牌共享，视图/导航重建。

---

## 1. 为什么这些能放在一起比

所有移动端实现的是**同一个产品**，共享同一套约束：

- 同一份 API 契约（都打到 `:9080` 反代后的同一组后端，响应外壳 `{ success, data, message, errorCode }` 一致）；
- 同一套**设计令牌**（`spec/tokens/tokens.json`，经各端 codegen 落地，不漂移）；
- 同样的核心页面 / 交互（广场浏览、创建胶囊、按码开启、收藏、个人中心、AI 创作助手、主题切换）；
- 同样的鉴权全流程（access token 内存、refresh token + user 持久化、并发请求合并 refresh、`/me` 校验）；
- 同一组**核心旅程 E2E 子集**（登录→建胶囊→开启→收藏），按平台用各自工具（Maestro / XCUITest / …）。

于是各端差异，纯粹来自**渲染体系与生态选择**，而非需求差异。

---

## 2. React Native（Expo）

### 定位：Web React vs Native React

`mobile/react-native` 的存在是为了和 `frontends/react-ts` 形成最直接的对照——**同一种语言、同一套
心智模型（JSX + Hooks + 单向数据流），渲染到两套不同的目标**：

| | `frontends/react-ts`（Web React） | `mobile/react-native`（Native React） |
|---|---|---|
| 渲染目标 | DOM（浏览器） | 原生组件（UIView / Android View） |
| 路由 | React Router（`createBrowserRouter`） | Expo Router（文件式，底层 React Navigation） |
| 导航 IA | 顶部 nav + 多列 | **底部 Tab Bar** + 单列 + 安全区 |
| 样式 | Tailwind v4 + `cy-*` CSS 类（CSS 变量） | `StyleSheet` 对象 + codegen 的 `tokens.ts` |
| 状态 | Zustand | **Zustand（同源）** |
| 持久化 | `localStorage`（同步） | `AsyncStorage`（异步，故 hydrate 改 async） |
| 网络 | `fetch` 走 Vite `/api` 代理 | `fetch` 直连 `:9080`（无代理，无 CORS） |
| 图标/头像 | `<img src="/static/...">`（代理） | `react-native-svg` `SvgUri`（远端 SVG，绝对 URL） |
| 构建/运行 | Vite dev server | Expo + Metro（端口 7192） |

### 分层共享：下半身照搬，上半身重写

| 层 | 能否照搬 | 说明 |
|---|---|---|
| API 契约 / 类型 | ✅ 逐字 | `types/index.ts` 零改动复制 |
| API 客户端（refresh 单飞 + 401 重放 + Envelope 解包） | ✅ 近乎逐字 | 仅 `BASE` 由 `""` 改为 `API_BASE` |
| 业务 store（plaza / capsule 收藏计数 / 序列号防乱序） | ✅ 逐字 | zustand 在 RN 原生可用 |
| auth / theme store | ⚠️ 小改 | `localStorage`→`AsyncStorage`，hydrate 变异步 |
| 纯工具（倒计时 / 时间格式化） | ✅ 逐字 | `format.ts` 零改动 |
| 设计令牌 | ⚙️ codegen | CSS 变量 → `tokens.ts`（rem→px、颜色/渐变保留） |
| 视图 / 导航 / 组件树 | ❌ 重建 | DOM 元素 → 原生组件；顶部 nav → 底部 Tab Bar |

> 结论：**逻辑层（约占代码的"地基"）几乎免费迁移，工程增量集中在视图重建与令牌 codegen** ——
> 这正是 roadmap §M5 对客户端「真正工程增量只有两处」判断的实证。

### 视觉取舍：霓虹辉光

Web 端的多层 `box-shadow` 霓虹辉光在 RN 无直接对应。本端用 iOS `shadowColor/shadowRadius` +
`expo-linear-gradient` 近似（`theme/index.ts` 的 `glow()` helper）；Android 仅有 `elevation`（无颜色辉光），
退化为普通投影。**视觉求神似，不求像素级**（roadmap §M5 已认此为合理取舍）。

### 验证

| 层 | 状态 |
|---|---|
| 契约 | 继承后端已绿 104，客户端不重复跑 |
| 类型 + Metro 打包 | ✅ `./build`（`tsc --noEmit` + `expo export --platform ios`）全绿 |
| 编排 | ✅ `hello start react-native` → Metro :7192 `ready` → `stop` 干净释放 |
| 核心旅程 E2E | Maestro flow + `testID` 就绪（`.maestro/core-journey.yaml`）；
  设备级运行需先装 iOS 模拟器运行时（~7GB）与 Maestro CLI |
| 连通性 | App 的 `:9080` 请求落到后端日志佐证（与 swiftui 同法） |

---

## 3. 待补

`ios` / `android` / `flutter` / `wechat-miniprogram` 落地后，本文补齐横向对比表
（渲染体系 / 令牌 codegen 产物 / 辉光实现 / 验证工具链 / 代码量），体例对齐
`frontend-comparison.md` 的 §3「定位 + 一句话哲学 + 在优化什么、拿什么换」。
