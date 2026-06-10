# HelloTime Pro · 五个前端实现全面对比

> 对比对象：`frontends/` 下已完成并通过 UI 冒烟验证的 5 个前端
> —— **React**（参考实现）、**Vue 3**、**Angular**、**Svelte 5**、**SolidJS**。
> 数据采集与复核日期：2026-06-05（全部行数 / 依赖数 / dist 体积已重新核对一致）。代码量为物理行（`wc -l`，含注释空行），统计口径见 §4。
> 姊妹篇：后端对比见 [`docs/backend-comparison.md`](backend-comparison.md)，全栈对比见 [`docs/fullstack-comparison.md`](fullstack-comparison.md)；单栈深读见各前端目录下的 `TECHNICAL_GUIDE.md`。

---

## 0. 这篇文章怎么读

本文的篇幅刻意做到不短于任何一份单栈技术手册，因为它要回答的是一个比「某个框架怎么用」更难的问题：

> **同一道题，五种母语，差异到底落在哪几个地方？**

如果你只想快速建立印象，读 §1～§3 就够了——§3 是全文的灵魂，把五个框架的「定位 + 一句话设计哲学 + 它在优化什么、又拿什么去换」摊开。
如果你要逐层对照源码，§5～§12 按「响应式模型 → 状态 → 路由 → 视图语法 → 视图实战 → 数据层 → 依赖」的顺序，把每一层的五种写法并排放在一起。
§13 是「招牌坑」，§14 给出「该先读哪一个」的导航。

阅读时请始终记住一件事：**这五个前端的页面、路由、交互、视觉、API 调用全都一样**，所以你看到的每一处差异，都纯粹是框架本身的取舍，而非需求不同。

---

## 1. 为什么这五个能放在一起比

和后端一样，五个前端实现的是**同一个产品**，共享同一套约束：

- 同一份 API 契约（都打到 `:9080` 反代后的同一组后端，响应外壳 `{ success, data, message, errorCode }` 完全一致）；
- 同一套**设计令牌与组件类**（`spec/styles/{palette,tokens,cyber}.css` 的 `cy-*` 类，禁止硬编码色值）；
- 同一组 **25 个 Playwright UI 冒烟用例**（`verification/`），从真实浏览器黑盒验证；
- 同样的页面 / 路由 / 交互（广场浏览、创建胶囊、按码开启、收藏、个人中心、AI 创作助手、主题切换……）；
- 同样的鉴权全流程（access token 在内存、refresh token + user 持久化到 localStorage、并发请求合并 refresh、`/me` 校验登录态）。

于是五者之间的差异，纯粹来自**框架的响应式模型与生态选择**，而非需求差异。
全部 5 个前端均已通过 `verify-ui-smoke`，各 **25/25**。

> 一个隐藏的强约束：因为视觉系统是共享的 `cy-*` 类（CSS 变量驱动），**没有任何一个框架能用「样式更好写」来取巧**——大家拿到的是同一盒乐高积木，区别只在「怎么把状态接到积木上」。这把对比聚焦在了框架最核心的能力：**状态 → DOM 的映射方式**。

---

## 2. 技术栈速览

| 维度 | React | Vue 3 | Angular | Svelte 5 | SolidJS |
|---|---|---|---|---|---|
| 框架版本 | React 19 | Vue 3.5 | Angular 19 | Svelte 5 (Runes) | Solid 1.9 |
| 渲染模型 | 虚拟 DOM + diff | 虚拟 DOM + diff | 虚拟 DOM + 变更检测 | **编译期，无 VDOM** | **细粒度，无 VDOM** |
| 视图语法 | JSX | SFC `<template>` | 组件内联模板 | `.svelte` 模板 | JSX |
| 响应式原语 | `useState`/hooks | `ref`/`reactive` | Signals(`signal`) | Runes(`$state`) | Signals(`createSignal`) |
| 组件函数执行次数 | 每次渲染重跑 | `setup` 跑一次 | 类实例化一次 | 编译展开跑一次 | **只跑一次** |
| 状态管理 | Zustand 5 | Pinia 2 | NgRx Signal Store | `.svelte.ts` 单例 | 模块级 Signal/Store |
| 路由 | react-router 7 | vue-router 4 | @angular/router | svelte-routing 2 | @solidjs/router |
| 路由懒加载 | 否（本项目） | 否（本项目） | **是（`loadComponent`）** | 否 | 否 |
| 构建 | Vite 6 | Vite 6 | Angular CLI(esbuild) | Vite 6 | Vite 6 |
| 运行时依赖数 | 4 | 3 | 10 | **2** | **2** |
| 端口 | 7174 | 7173 | 7175 | 7176 | 7180 |

一句话画像（详细展开见 §3）：

- **React** — 参考实现，hooks + 单向数据流，生态最大、心智最“主流”。
- **Vue 3** — Proxy 响应式 + SFC，渐进、平衡，模板与逻辑分区清晰。
- **Angular** — 全家桶 + 依赖注入 + Signals，约定最强、运行时最重。
- **Svelte 5** — 编译期框架，Runes 让响应式像写普通变量，产物最薄之一。
- **SolidJS** — 细粒度响应式，JSX 外形像 React、内核完全不同，产物最薄。

---

## 3. 技术栈定位与设计哲学

如果说 §2 的表格是「参数」，这一节就是「人格」。每个框架都在回答同一个问题——「状态变了，DOM 怎么跟着变？」——但它们的答案背后，是五种截然不同的世界观。

### 3.1 React —— 「UI 是状态的纯函数」

- **一句话设计哲学**：`UI = f(state)`。你只描述「某个状态对应的界面长什么样」，永不亲手碰 DOM；状态一变，整个组件函数重跑，React 用虚拟 DOM diff 算出最小补丁。
- **定位**：前端世界的「普通话」。生态最大、岗位最多、文章最全，是绝大多数人理解现代前端的默认坐标系，也因此被选作本项目的**参考实现**——其余四栈都对齐它的页面结构与逻辑层。
- **它在优化什么**：心智的**统一与可预测**。一切皆组件、一切皆函数、数据永远单向流动（父传子用 props，子影响父用回调）。没有双向绑定的隐式魔法，调试时「状态长这样 → 界面就该长这样」。
- **它拿什么去换**：**运行时开销**与**心智陷阱**。组件每次渲染都从头重跑，于是要靠 `useMemo / useCallback / React.memo` 手动止血；`useEffect` 的依赖数组、`setInterval` 里的闭包快照、StrictMode 下 effect 双触发，都是「函数每次重跑」这一设计的副作用。
- **本项目里的体现**：四个 Zustand store（auth / theme / plaza / capsule）+ `api/client.ts` 的自动 refresh + `AuthGate` 守卫，是一套教科书式的「函数组件 + 外置状态库」组合。

### 3.2 Vue 3 —— 「响应式应该是自动的，结构应该是分区的」

- **一句话设计哲学**：用 Proxy 把数据「劫持」成响应式，谁读了它就自动订阅谁；模板、逻辑、样式各归各位，渐进可上手。
- **定位**：React 与 Angular 之间的**平衡点**。比 React 多了自动依赖追踪（不用写依赖数组）、比 Angular 轻得多（不背全家桶）。对从 HTML/jQuery 一路走来的开发者最friendly。
- **它在优化什么**：**开发体验的平滑曲线**。SFC（单文件组件）把 `<template>` / `<script setup>` / `<style>` 收在一个文件里、各占一块，结构一眼可读；`ref` / `reactive` + 自动追踪让「改数据 = 更新界面」几乎无需仪式。
- **它拿什么去换**：**一点点隐式**。`.value` 要记得加、`reactive` 对象解构会丢响应性（要 `toRefs`）、Proxy 在某些边界（数组下标、新增属性）上有历史包袱。自动追踪很爽，但「为什么这里没更新」偶尔需要理解 Proxy 的脾气。
- **本项目里的体现**：Pinia 的 `defineStore` 组合式写法（`ref` + 返回暴露），与 React 的 Zustand 几乎一一对应，是观察「同一状态逻辑在两种响应式系统下」的最佳样本。

### 3.3 Angular —— 「大型团队需要的是约定、结构与可治理性」

- **一句话设计哲学**：框架不是工具箱而是**平台**——路由、DI、表单、HTTP、状态、变更检测全部内建并强约定，让一百个人写出来的代码长得像一个人写的。
- **定位**：**企业级全家桶**。它不追求「最小」，追求「最可治理」：依赖注入解耦、模块化分层、TypeScript 优先、CLI 脚手架统一。是大团队、长生命周期项目的稳态选择。
- **它在优化什么**：**规模化与一致性**。`inject()` 依赖注入让 `ApiService`、`AuthStore` 这类单例天然可替换、可测试；`loadComponent` 路由级懒加载是五栈里唯一默认开启的，契合「重框架按需加载」；NgRx Signal Store 用 `withState / withMethods / withComputed` 把状态拼装得高度声明式、可组合。
- **它拿什么去换**：**运行时重量**与**前期心智门槛**。10 个运行时依赖（`@angular/*` + ngrx + rxjs + zone.js）、数量级更大的 bundle（见 §4），以及 DI / 装饰器 / 变更检测这套需要先理解才能动手的概念。源码可以写得最精简（内联模板 + Signals），但「精简的源码」不等于「轻量的产物」。
- **本项目里的体现**：唯一把 `fetch` 封装成可注入 `ApiService`（而非自由函数）的栈，也是唯一做路由级代码分割的栈——两处都是「框架哲学倒逼出来的写法差异」的鲜活证据。

### 3.4 Svelte 5 —— 「框架应该在编译期消失」

- **一句话设计哲学**：把响应式编译进代码。`$state` 写起来像普通变量，编译器在构建时就算清「哪个变量影响哪段 DOM」，运行时直接赋值更新，**没有虚拟 DOM、没有运行时框架在场**。
- **定位**：**编译期框架**的代表。它质疑「为什么要把一个 diff 引擎随包发给用户」，主张框架的活儿应该在打包时干完。产物薄、运行时几乎为零。
- **它在优化什么**：**写法的朴素**与**产物的轻盈**。Runes（`$state` / `$derived` / `$effect`）让响应式回归「赋值即更新」的直觉；只需 2 个运行时依赖（svelte + routing），状态管理是语言内置的，不需要 Zustand/Pinia/NgRx。
- **它拿什么去换**：**编译期的隐式规则**与**生态成熟度**。`.svelte.ts` 单例必须带 `.ts` 后缀导入，否则会被编译链当成两个不同模块、得到两个 store 实例（项目记忆里的真实坑）；`svelte-routing` 的 `<Route>` 不能嵌套、必须平铺，否则触发 effect 递归更新。编译魔法省了运行时，但把一部分复杂度搬进了「你得知道编译器在背后做了什么」。
- **本项目里的体现**：store 用 `class` + `$state` 字段写成单例（`themeStore = new ThemeStore()`），是五栈里仪式感最少的状态层；视图用 `Snippet`（Svelte 5 取代 slot 的新原语）实现卡片插槽。

### 3.5 SolidJS —— 「响应式可以细到单个 DOM 节点」

- **一句话设计哲学**：组件函数**只跑一次**，建立一张「signal → DOM 节点」的订阅图；状态变了不重跑组件、不 diff，而是点对点直接命中那个要改的节点。
- **定位**：**细粒度响应式**的极致。它长着一张 React 的脸（JSX），骨子里却和 React 相反——React 是「状态变 → 重跑函数 → diff」，Solid 是「状态变 → 精确更新那一处」。是理解「细粒度响应式 vs 虚拟 DOM」最好的对照组。
- **它在优化什么**：**运行时性能**与**更新精度**。没有 VDOM、没有 diff、组件不重跑，所以 dist 最小（~91 KB）、更新开销最低。逻辑层能逐字复用 React 的纯 TS 代码，证明「业务逻辑与框架可彻底解耦」。
- **它拿什么去换**：**反直觉的心智**与**显式的接线**。React 老手最容易栽的坑：以为组件会重跑（不会）。于是 props 不能解构（解构会丢掉 getter 的响应性，必须 `props.x` 访问）、控制流要用 `<Show>` / `<For>` / `<Index>` 组件而非裸 `map`、`createEffect` 会自动追踪它同步读取的 signal（容易重复请求，要用 `untrack` 圈住）、`style` 要用 kebab-case 字符串带单位。
- **本项目里的体现**：`api/types/utils` 三层直接从 react-ts 原样搬运（纯 TS、框架无关），UI 层用 `createSignal` / `createStore` + 导出动作函数重写；并发请求用闭包序列号守卫，与 React/Svelte 同构。

### 3.6 五句话速记

> - **React**：状态的纯函数——简单可预测，代价是重跑与手动止血。
> - **Vue**：自动响应 + 分区结构——平滑好上手，代价是一点点 Proxy 隐式。
> - **Angular**：可治理的平台——规模化一致，代价是重量与门槛。
> - **Svelte**：编译期消失的框架——产物极薄，代价是编译期暗规则。
> - **Solid**：细到节点的响应式——运行最轻最快，代价是反直觉的接线。

---

## 4. 代码量对比

**统计口径**：仅计入各前端 `src/` 下自己编写的实现源码，排除 `node_modules / dist`，
排除单元测试（单列）。框架文件指 `.tsx / .vue / .svelte`；Angular 全部为 `.ts`（模板内联）。

| 前端 | 框架文件数 | 框架文件行 | `.ts` 文件行 | **总实现行** | 单测行 | dist JS（未压缩，全 chunk）|
|---|---:|---:|---:|---:|---:|---:|
| **SolidJS** | 29 (tsx) | 2 622 | 914 | **3 536** | 193 | **~91 KB** |
| **React** | 30 (tsx) | 2 427 | 957 | 3 384 | 193 | ~341 KB |
| **Svelte** | 30 (svelte) | 2 422 | 906 | 3 328 | 193 | ~117 KB |
| **Vue 3** | 28 (vue) | 2 254 | 987 | 3 241 | 193 | ~169 KB |
| **Angular** | 0 | 0（内联） | 2 794 | **2 794** | 0 | ~1 787 KB |

> dist 体积为 `dist/` 下所有 `.js` 的未压缩字节总和（含懒加载 chunk、polyfill），**仅作数量级参考**，
> 不等于首屏体积、也未 gzip；Angular 的数字尤其包含大量按路由切分的 chunk 与 `zone.js`。

### 怎么读这张表

源码行数差距不大（2 794 ~ 3 536），因为页面/逻辑都一样；差异来自**视图语法的密度**与**框架的样板**：

- **SolidJS 最多（3 536 行）**：JSX + 显式控制流组件（`<Show>` / `<For>` / `<Index>`）比模板指令更啰嗦，
  细粒度响应式需要把 signal 的读写显式接线，状态层（384 行）也偏重。换来的是最小的运行时产物（91 KB）。
- **Angular 最少（2 794 行）却也最“重”**：得益于内联模板 + Signals + NgRx 的声明式写法，源码紧凑；
  但运行时框架体积是数量级地大（全家桶 + DI + zone.js）。**源码精简 ≠ 产物轻量**，Angular 是最鲜明的反例。
- **Svelte / Vue 居中偏低**：模板指令（`{#if}` / `v-if`）比 JSX 控制流更省字符，SFC/`.svelte` 把结构-逻辑-样式
  收在一个文件里，密度高。
- **React 居中**：JSX + hooks 的样板适中，Zustand 状态层偏重（427 行，见 §7）。

### 一个值得玩味的对照

```
总实现行：  Angular 2794  <  Vue 3241  <  Svelte 3328  <  React 3384  <  Solid 3536
dist 体积：  Solid 91KB   <  Svelte 117KB < Vue 169KB  <  React 341KB <  Angular 1787KB
```

两条排序几乎**完全相反**。写得少的（Angular）跑起来最重，写得多的（Solid）跑起来最轻——
因为编译期/细粒度框架把“省运行时”的代价转嫁成了“源码里多写一点接线”，而全家桶框架反之。
**抽象的成本不会消失，只会换地方出现**（这一点和后端 ORM 的结论同源，见 backend-comparison §6）。

---

## 5. 共享逻辑层：契约驱动解耦的实证

把 `api/`（fetch 封装 + 自动 refresh）、`types/`（契约类型）、`utils/`（倒计时/格式化/头像）三个**框架无关**的目录单独统计：

| 前端 | 共享逻辑层行数（api+types+utils） |
|---|---:|
| Svelte | 531 |
| React / Vue / Solid | **529（三者几乎逐字一致）** |
| Angular | 472 |

React、Vue、Solid 三者的这一层是 **529 行、近乎逐字相同**的纯 TypeScript——
因为它不依赖任何框架，可以原样搬运（Solid 实现时就是直接复用 react-ts 的 `client.ts` / `types` / `utils`）。
Svelte 仅多 2 行；**Angular 是唯一的例外（472 行）**，因为它按框架惯例把 `fetch` 封装成了可注入的 `ApiService`
（`inject()` + class），而不是导出自由函数。

> 这正是契约驱动多栈项目想证明的事：**业务逻辑与框架是可以彻底解耦的**，框架只负责“把状态渲染成 DOM”。
> 真正体现框架差异的，是下面的状态层与视图层。

### 一个值得展开的细节：循环依赖怎么破

`api/client.ts` 要读 access token，但 token 在 auth store 里；而 auth store 又要 import `api` 来发登录/refresh 请求——
天然的循环依赖。React / Vue / Svelte / Solid 四栈用同一招破解：**依赖注入式的 `configureApi(...)`**。

```ts
// api/client.ts —— 不 import 任何 store，只留一个可被注入的回调
let getAccessToken: () => string | null = () => null;
export function configureApi(opts: { getAccessToken: () => string | null; /* … */ }) {
  getAccessToken = opts.getAccessToken;
}

// stores/auth.* —— 模块加载时注册一次，把 store 的 getter 交给 client
configureApi({ getAccessToken: () => /* 各栈读 token 的方式 */ });
```

**Angular 不需要这一招**——因为 DI 天生解循环：`ApiService` 用 `inject(AuthStore)` 拿状态，依赖关系由注入器在运行时编织，
不存在「模块 A import 模块 B 又被 B import」的静态环。这是「依赖注入」这个看似笨重的概念，在边界处兑现价值的一个具体瞬间。

---

## 6. 响应式模型：最根本的分野

这是五个框架最深层的差异，也是其余一切（为什么 props 不能解构、为什么读值要加 `.value` 或 `()`）的根因。

| 框架 | 组件函数执行 | 更新机制 | 依赖追踪 |
|---|---|---|---|
| **React** | **每次渲染重跑** | 状态变 → 重跑组件 → 产出新 VDOM → diff → 打补丁 | 手写依赖数组 |
| **Vue 3** | `setup` 跑一次 | Proxy 拦截读写 → 标记脏 → 重渲染受影响组件 → VDOM diff | 自动（Proxy） |
| **Angular** | 类实例化一次 | Signal 变 → 标记组件 → 变更检测 → 更新绑定 | 自动（Signal）/ zone |
| **Svelte 5** | 编译期展开，跑一次 | 编译器把 `$state` 写成赋值即更新，直接改 DOM，无 VDOM | 编译期分析 + Runes |
| **SolidJS** | **只跑一次** | signal 变 → 直接定位到订阅该 signal 的 DOM 节点去改，无 VDOM、无 diff | 自动（运行时收集） |

可以分成三大阵营：

- **虚拟 DOM 阵营（React / Vue / Angular）**：状态变化触发“重渲染 → 计算差异 → 打补丁”。
  React 最纯粹（整组件重跑），Vue/Angular 用响应式系统缩小重渲染范围。
- **编译期阵营（Svelte）**：没有运行时 VDOM，编译器在构建时就把“哪个变量影响哪段 DOM”算好，
  运行时直接赋值更新。
- **细粒度阵营（Solid）**：组件函数只跑一次，建立一张“signal → DOM 位置”的订阅图，更新时点对点命中，
  连 diff 都不需要。

### 同一个倒计时，三种「定时重渲染」写法

胶囊卡片要每秒刷新倒计时，这个需求把响应式模型的差异放在了显微镜下：

**React** —— 状态变才重渲染，于是要造一个「无意义的 tick」逼组件重跑，计算放渲染期：

```tsx
const [, setTick] = useState(0);
useEffect(() => {
  if (opened) return;                                   // 已开启不开定时器
  const t = window.setInterval(() => setTick((x) => x + 1), 1000);  // 函数式更新避免闭包陷阱
  return () => window.clearInterval(t);                 // 清理
}, [opened]);
const cd = countdownTo(capsule.openAt);                 // 每次渲染重算
```

**Svelte / Solid** —— 不需要假 tick：把倒计时本身放进响应式状态，定时改它，订阅它的 DOM 自动更新。
Svelte 用 `$state` + `$effect`，Solid 用 `createSignal` + `createEffect`（注意 Solid 的 effect 会自动追踪同步读取的 signal，定时器要小心不要把请求写进去）。

**Vue / Angular** —— 介于其间：把 `now` 做成 `ref` / `signal`，定时 `now.value = Date.now()`，
依赖 `now` 的 `computed` 倒计时自动重算。

> 同一个「每秒刷新」，React 要绕一圈造重渲染、Svelte/Solid 直接改响应式值、Vue/Angular 改一个被 computed 依赖的源——
> 三种写法的根因，全在上表那一列「组件函数执行几次」。

> 心智迁移最大的坑都来自这里：React 老手到 Solid 会以为组件会重跑（不会）；
> Vue 的 `ref.value`、Solid 的 `signal()`、Angular 模板里的 `signal()` 调用，本质都是“读操作要显式，才能被追踪”。

---

## 7. 状态管理：同一个 store 的五种写法

状态层是框架个性最浓的地方。下面先看**功能完全相同**的主题 store——`read()` / `apply()` 两个辅助函数在五份里**逐字相同**，
唯一的差异就是“响应式状态怎么声明、动作怎么挂、组件怎么读”。

**React / Zustand** — `create()` 工厂 + `set/get`，组件用 selector 订阅：
```ts
export const useTheme = create<ThemeState>()((set, get) => ({
  theme: "dark",
  hydrate: () => { const t = read(); apply(t); set({ theme: t }); },
  toggle:  () => { const next = get().theme === "dark" ? "light" : "dark"; apply(next); set({ theme: next }); },
}));
// 组件：const theme = useTheme((s) => s.theme);
```

**Vue / Pinia** — `defineStore` + `ref`，`.value` 读写：
```ts
export const useThemeStore = defineStore("theme", () => {
  const theme = ref<Theme>("dark");
  function hydrate() { const t = read(); apply(t); theme.value = t; }
  return { theme, hydrate, /* … */ };
});
```

**Angular / NgRx Signal Store** — `signalStore` + `withState/withMethods` + `patchState`，组件读 `store.theme()`：
```ts
export const ThemeStore = signalStore(
  { providedIn: 'root' },
  withState({ theme: 'dark' as Theme }),
  withMethods((store) => ({
    hydrate() { const t = read(); apply(t); patchState(store, { theme: t }); },
  })),
);
```

**Svelte 5 / Runes** — `class` 字段上写 `$state`，导出单例，读写像普通属性：
```ts
class ThemeStore {
  theme = $state<Theme>("dark");
  hydrate() { const t = read(); apply(t); this.theme = t; }
}
export const themeStore = new ThemeStore();
```

**SolidJS / 模块级 Signal** — 顶层 `createSignal` + 导出 getter + 动作函数，读 `theme()`：
```ts
const [theme, setThemeSignal] = createSignal<Theme>("dark");
export { theme };
export function hydrateTheme() { const t = read(); apply(t); setThemeSignal(t); }
```

### 鉴权 store：同一套 hydrate / setTokens 的五种风格

主题 store 太简单，看不出差距。鉴权 store（access token 在内存、refresh + user 持久化、`configureApi` 解耦）才是试金石。
五栈的 `hydrate()` 逻辑逐字相同（`load()` → 写状态 → 标记 `hydrated`），区别只在「状态怎么声明、怎么写回」：

- **Vue / Pinia**：组合式 `defineStore`，`user / accessToken / refreshToken / hydrated` 各是一个 `ref`，
  `hydrate()` 里 `user.value = persisted.user`。
- **Angular / NgRx**：`signalStore(withState<AuthState>({...}), withMethods((store) => { const api = inject(ApiService); return { hydrate() {...} }; }))`——
  注意 `inject(ApiService)` 在 `withMethods` 内拿依赖，这是 DI 在 store 里的样子。
- **Svelte**：`class AuthStore { user = $state(...); ... }`，导出 `new AuthStore()`；**必须带 `.ts` 后缀 import**，否则两个实例。
- **Solid**：模块级 `createStore` 持有对象，导出 `auth` 只读引用 + 一组 `setTokens` / `logout` 动作函数。
- **React**：`create((set, get) => ({...}))`，`set` 浅合并触发订阅，组件用 selector `useAuth((s) => s.user)` 细订阅。

### 复杂 store 的行数差异更能说明问题

简单的 theme store 五者都在 38–51 行，差别不大；但把所有 store 加起来，写法的“仪式感”差异被放大：

| 前端 | stores 总行数 | 风格特征 |
|---|---:|---|
| **Svelte** | **247** | Runes class 字段，仪式最少，`$state` 即响应式 |
| Vue (Pinia) | 275 | 组合式 `defineStore`，`ref` + 返回暴露 |
| Angular (NgRx) | 349 | `withState/withComputed/withMethods` 声明式拼装 |
| Solid | 384 | `createStore` + 显式动作函数 + 闭包序列号守卫 |
| **React (Zustand)** | **427** | `create` + `set/get` + selector，样板最多 |

### 并发请求的「序列号」守卫：跨栈同构的一招

广场快速切换 sort/filter 会连发多个请求，响应顺序不保证。五栈用**完全相同的思路**解决：一个序列号变量，只有「最新发起」的请求才能写回结果。
有意思的是它放在哪里，泄露了各栈的响应式哲学：

```ts
// Svelte：放在 class 的私有字段（#fetchSeq），因为 store 是 class 实例
class PlazaStore {
  #fetchSeq = 0;
  async fetch() { const myId = ++this.#fetchSeq; /* … */ if (myId !== this.#fetchSeq) return; }
}

// Solid：放在模块级闭包变量，刻意「不」用 store state——避免触发额外订阅
let fetchSeq = 0;
export async function fetchPlaza() { const myId = ++fetchSeq; /* … */ if (myId !== fetchSeq) return; }

// React：模块级 let（同 Solid 思路），写回用 set({ items, ... })
```

> Solid 的注释一针见血：序列号「用闭包变量而非 store state，避免触发额外订阅」——
> 在细粒度响应式里，**把不该是响应式的东西放进响应式容器，是一种性能错误**。这个细节是 Solid 哲学的微缩景观。

全局状态的共性：五者都**脱离组件树**存在（无需 Provider 包裹，或仅 Angular 用 `providedIn:'root'` DI 单例），
组件直接 import 即可读写——这让“一处操作、多处投影”（如收藏后同步广场与收藏列表）无需跨组件通信。

---

## 8. 路由对比

| 前端 | 路由库 | 嵌套布局方式 | 守卫方式 | 懒加载 |
|---|---|---|---|---|
| React | react-router 7 | `createBrowserRouter` + `<Outlet>` | 路由 element 包 `<AuthGate>` | 否 |
| Vue 3 | vue-router 4 | `children` + `<router-view>` | `beforeEnter` / 组件内包裹 | 否 |
| Angular | @angular/router | `children` + `<router-outlet>` + `loadComponent` | 函数式 `CanActivateFn` | **是** |
| Svelte | svelte-routing 2 | **扁平 `<Route>`**（不可嵌套，须平铺） | `<AuthGate>` 组件包裹 | 否 |
| SolidJS | @solidjs/router | 父 `<Route component>` 经 `props.children` 做 outlet | 双层 `<Show>` 声明式守卫 | 否 |

### 三种守卫写法

守卫逻辑完全一致：**水合前放行（组件内自行等待）；已登录或持有 refresh token 放行；否则跳登录并记下来路**。
但表达方式分成两派：

**React / Svelte / Solid —— 守卫是「组件」**，包住要保护的内容：

```tsx
// React：<AuthGate> 是普通组件，未登录就 <Navigate>
export function AuthGate({ children }: { children: ReactNode }) {
  const { user, hydrated, refreshToken } = /* 从 store 读 */;
  if (!hydrated) return null;                              // 等 localStorage 读完
  if (user || refreshToken) return <>{children}</>;        // 已登录或可静默续期
  return <Navigate to="/login" replace state={{ from: location.pathname }} />;
}
```

**Angular —— 守卫是「函数」**，挂在路由的 `canActivate` 上，用 `inject()` 拿依赖：

```ts
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthStore);
  const router = inject(Router);
  if (!auth.hydrated()) return true;                       // 水合前放行
  if (auth.user() || auth.refreshToken()) return true;
  void router.navigate(['/login'], { state: { from: state.url } });
  return false;
};
```

> 两派的精妙之处一致：**只要 `refreshToken` 在就放行**——因为接下来的 API 调用会自动 refresh（见 §11），用户看不到打断。
> 这个「乐观放行 + 惰性续期」的设计，是五栈共享逻辑层（`api/client.ts` 的自动 refresh）赋予守卫层的底气。

### 差异点

- **Angular 唯一默认做路由级懒加载**（`loadComponent: () => import(...).then(m => m.XxxComponent)`），
  契合其“重框架按需加载”的需要——也是它 dist 里那么多 chunk 的来源。
- **Svelte-routing 的 `<Route>` 不能嵌套**（项目记忆中的坑：必须平铺列举 `/`、`/open`、`/me`、`/me/created`……
  每条各自包 `<MainLayout>` 或 `<MeLayout>`，否则触发 `effect_update_depth_exceeded` 递归更新），
  是五者里路由表组织最“反直觉”的。
- **路由路径有一处不一致**：Svelte 用 `/capsules/:code` 并额外有 `/plaza/:id`，其余四者统一 `/c/:code`
  （前端内部路径，不属于 API 契约；`verify-ui-smoke` 对 Svelte 做了 `capsulePath` 兼容）。

---

## 9. 视图语法与组件模式

**控制流的五种写法**（渲染一个列表 + 空态）：

| 框架 | 列表 | 条件 |
|---|---|---|
| React | `items.map(c => <Card key={c.id} .../>)` | `cond && <X/>` / 三元 |
| Vue | `<Card v-for="c in items" :key="c.id"/>` | `v-if` / `v-else` |
| Angular | `@for (c of items(); track c.id)` | `@if (cond)` |
| Svelte | `{#each items as c (c.id)}…{/each}` | `{#if}…{:else}` |
| Solid | `<For each={items}>{c => <Card/>}</For>` | `<Show when={}>` |

两类阵营：**JSX 派（React / Solid）** 把控制流当普通 JS 表达式（`map` / `&&`），代价是啰嗦；
**模板派（Vue / Angular / Svelte）** 用指令（`v-for` / `@for` / `{#each}`），更省字符、更声明式。
注意 React/Vue/Svelte 都强制列表项给稳定 `key`，Angular 用 `track`，Solid 的 `<For>` 按引用 keyed、定长按位场景（8 位胶囊码格子）则用 `<Index>`。

**Props / 插槽**：

- **React**：`props` 对象，children + render-prop（如 `cardSlot={(c) => …}`）。
- **Vue**：`defineProps` + 具名 `<slot>` / 作用域插槽。
- **Angular**：`@Input()`（或 signal input）+ `<ng-content>`。
- **Svelte**：`$props()` 解构 + `Snippet`（Svelte 5 取代 slot 的新原语，`{#snippet card(c)}…{/snippet}`）。
- **Solid**：`props.x`（**不可解构**，否则丢响应性）+ 返回 JSX 的函数 prop。

**一个跨框架的共性**：五者都把“卡片右侧自定义操作”（撤回按钮 / 收藏数）做成了插槽/render-prop——
React/Solid 用函数 prop，Vue/Angular 用具名插槽，Svelte 用 Snippet。同一个交互需求，五种插槽机制。

### 表单：受控 vs 双向绑定

输入框的写法是「单向 vs 双向」哲学的又一次显形：

- **React / Solid**：受控组件，`value={x}` + `onChange/onInput` 手动写回——单向数据流的体现。
- **Vue**：`v-model="x"` 双向绑定，一行搞定（语法糖，底层仍是 value + input）。
- **Angular**：`[(ngModel)]="x"` 双向绑定，或 Signals + 事件。
- **Svelte**：`bind:value={x}`，编译期双向绑定。

提交时五者都 `preventDefault()` 阻止整页 POST，调 `api.login(...)`，成功后 `navigate` 到来路或 `/me/created`，
失败 catch `ApiError` 显示消息——这部分逻辑因为共享 `api/client.ts` 而高度一致。

---

## 10. 视图层实战：同一个收藏按钮的五种写法

前面都是分层概述，这一节把显微镜对准一个**真实组件**——`FavoriteButton`，看五栈如何写同一段交互。
它的业务逻辑在五栈里**几乎逐字相同**：本地维护 `active / count / busy / err` 四个状态；匿名点击弹 `confirm` 跳登录；
已登录则调 `api.favorite/unfavorite`，成功后更新本地状态、`patchFavorited` 同步广场列表、`onChange` 通知父组件。
差异全在三处「框架接缝」：**状态怎么声明、props 变化怎么同步、user 怎么读**。

### 接缝一：本地状态声明 + props → 本地 state 同步

收藏数等字段是 props 传入的，但点击后要本地乐观更新，所以每栈都把 props「拍」进本地状态，并在 props 变化时重新同步。
这一处把五种响应式原语并排亮了出来：

```tsx
// React —— useState + useEffect(依赖数组列出要监听的 props)
const [active, setActive] = useState(capsule.favoritedByMe);
useEffect(() => { setActive(capsule.favoritedByMe); setCount(capsule.favoriteCount); },
          [capsule.id, capsule.favoritedByMe, capsule.favoriteCount]);
```
```ts
// Vue —— ref + watch(显式 getter 列依赖)
const active = ref(props.capsule.favoritedByMe);
watch(() => [props.capsule.id, props.capsule.favoritedByMe, props.capsule.favoriteCount] as const,
      ([, fav, c]) => { active.value = fav; count.value = c; });
```
```ts
// Angular —— signal + ngOnChanges(生命周期钩子)
active = signal(false);
ngOnChanges(changes: SimpleChanges) {
  if (changes['capsule']) { this.active.set(this.capsule().favoritedByMe); /* … */ }
}
```
```svelte
<!-- Svelte —— $state + $effect(自动追踪 effect 内读到的 capsule.*) -->
let active = $state(false);
$effect(() => { active = capsule.favoritedByMe; count = capsule.favoriteCount; });
```
```tsx
// Solid —— createSignal + createEffect(自动追踪,无需列依赖)
const [active, setActive] = createSignal(props.capsule.favoritedByMe);
createEffect(() => { setActive(props.capsule.favoritedByMe); setCount(props.capsule.favoriteCount); });
```

**一图看尽依赖追踪谱系**：React 手写依赖数组、Vue 写 getter、Angular 用生命周期钩子判断哪个 input 变了——
这三者是「**显式声明依赖**」；Svelte 的 `$effect` 和 Solid 的 `createEffect` 则**自动追踪函数体里读到的响应式值**，
不用列依赖。这正是 §6 那张表的微缩——「依赖追踪：手写 vs 自动」在这一个 effect 上一目了然。

> 注意 Solid 的 `createEffect` 自动追踪是把双刃剑：这里它只读 `props.capsule.*` 很安全，
> 但若 effect 里同步调了某个会读 signal 的函数，就会意外建立订阅、导致重复执行（§12 招牌坑）。

### 接缝二：读全局 user 的语法

匿名判断 `if (!user)` 一行，五种读法：

| 框架 | 读 user | 说明 |
|---|---|---|
| React | `const user = useAuth((s) => s.user)` | selector 订阅，user 变才重渲染 |
| Vue | `const { user } = storeToRefs(auth)` → `user.value` | `storeToRefs` 保持响应性，否则解构丢响应 |
| Angular | `inject(AuthStore)` → `this.auth.user()` | DI 拿 store，signal 当函数调 |
| Svelte | `authStore.user`（导入单例直接读） | class 字段，读写如普通属性 |
| Solid | `auth.user`（导入 store 直接读） | store 代理，读即订阅 |

### 接缝三：视图模板 —— 双向阵营的分水岭

按钮本身的写法，把「JSX 派 vs 模板派」摊开了。同样是「`active` 决定 ♥/♡ 和高亮类」：

```tsx
// React / Solid —— JSX 表达式，signal 在 Solid 里要调用 active()
<button class={active() ? "is-active" : ""} disabled={busy()} onClick={toggle}>
  {active() ? "♥" : "♡"} {count()}
</button>
```
```vue
<!-- Vue —— 模板指令 + 事件简写 @click -->
<button :class="['cy-capsule__fav', active ? 'is-active' : '']" :disabled="busy" @click="toggle">
  {{ active ? "♥" : "♡" }} {{ count }}
</button>
```
```ts
// Angular —— 内联模板,@if 控制流 + [属性]/(事件) 绑定 + signal() 调用
@if (size() === 'md') { <button [class]="..." [disabled]="busy()" (click)="toggle()">… </button> }
```

> Vue / Angular / Svelte 的属性绑定（`:class` / `[class]` / `class=`）是声明式的；React/Solid 在 JSX 里写三元。
> 而 Solid 的 `active()`、Angular 的 `busy()`、Vue 的 `active`（模板里自动解包 `.value`）——
> 三种「在视图里读响应式值」的语法差异，又一次回到 §6 的根：**值是不是要显式调用，取决于框架怎么追踪它**。

### 这个组件的跨栈共性

无论语法多不同，五栈在这个组件上做了**完全相同的三件正确的事**，这也是契约驱动多栈的价值：

1. **乐观更新 + 跨 store 联动**：点完立刻本地改 `active/count`，并 `patchFavorited` 同步广场 store——
   于是从「我收藏的」取消后切回广场，那条不会还显示已收藏。
2. **匿名不静默失败**：未登录弹 `confirm` 引导登录（Svelte 还带上 `?from=` 回跳），而不是默默吞掉点击。
3. **props 同步防陈旧**：详情页切换胶囊、或父组件外部 patch 后，本地状态会跟着刷新（接缝一）。

---

## 11. 数据层与鉴权：共享逻辑如何被五种方式「接上」

§5 说了 `api/client.ts` 在四栈里逐字相同，这里补足「它怎么和各栈的状态层接上」。
核心是同一条自动 refresh 链路：

```text
fetch → 401 + UNAUTHORIZED → tryRefresh()
                                ├── 拿到新 accessToken → 重放原请求（带 _retry 防死循环）
                                └── refresh 也失败 → onAuthLost() 清状态 → 守卫把用户弹回登录
```

并发去重也一致：模块级 `let refreshing: Promise | null`，一波 401 同时发生时只发一次 refresh，其余 `await` 同一个 Promise。

**四栈（React/Vue/Svelte/Solid）**：`api` 是一组导出的自由函数（`api.login`、`api.plaza`…），
通过 `configureApi({ getAccessToken, onAuthLost })` 把 store 的能力注入进去（见 §5）。

**Angular**：`ApiService` 是 `@Injectable({ providedIn: 'root' })` 的类，方法即 `login()` / `plaza()`，
组件/守卫/store 用 `inject(ApiService)` 取得。不需要 `configureApi`——DI 自动解循环。这也是 Angular 共享逻辑层只有 472 行（少 57 行）的原因：它把「注入回调」换成了「注入服务」。

> 一个值得记住的结论：**同一段网络逻辑，函数式四栈靠「手动注入回调」解耦，Angular 靠「DI 容器」解耦**。
> 前者轻、显式、要自己接线；后者重、隐式、框架代劳。又一次「抽象的成本换地方出现」。

---

## 12. 依赖与运行时重量

| 前端 | 运行时依赖 | 状态库是否内置 | dist JS（未压缩，数量级） |
|---|---:|---|---:|
| SolidJS | 2（solid-js + router） | 内置（signals） | ~91 KB |
| Svelte | 2（svelte + routing） | 内置（runes） | ~117 KB |
| Vue 3 | 3（vue + router + pinia） | 外置（Pinia） | ~169 KB |
| React | 4（react + dom + router + zustand） | 外置（Zustand） | ~341 KB |
| Angular | 10（@angular/* + ngrx + zone.js + rxjs） | 外置（NgRx） | ~1 787 KB |

- **Svelte / Solid 各只需 2 个运行时依赖**：因为状态管理是语言/编译器内置的（runes / signals），
  无需 Zustand/Pinia/NgRx 这类外部库。这也是它们 bundle 最小的原因之一。
- **Angular 的 10 个依赖**是全家桶哲学的体现（DI、变更检测、RxJS、zone.js 一应俱全）；
  代价是数量级更大的产物。注意它做了路由级懒加载，**首屏实际加载量远小于 1.7 MB 总量**——这张表比的是总产物，不是首屏。
- **React/Vue 处于中间**：核心框架轻，但状态/路由靠外部库拼装。React 的 dist 偏大一部分来自 react-dom 的体量。

> 把这张表和 §4 的代码量表叠起来看，是全文最值得带走的一张图：**源码行数与产物体积几乎反相关**。
> 不存在「又省源码又轻产物」的免费午餐——你总在为某种简洁，在另一处付费。

---

## 13. 各框架的「招牌坑」（来自项目记忆与 `docs/dev-notes.md`）

| 框架 | 招牌坑 | 规避 |
|---|---|---|
| **React** | StrictMode 开发期 effect 双触发；LLM 请求会被打两次；`setInterval` 闭包拿到过期 state 快照 | 幂等化 / 用 ref 去重；`setX(prev => ...)` 函数式更新 |
| **Vue** | 解构 `reactive`/`props` 丢响应性；忘了 `.value` | 用 `toRefs` / 始终 `.value` |
| **Angular** | 模板里 signal 要当函数调用 `x()`；方法 vs `computed()`（方法每次变更检测都重算） | 派生值用 `computed()`，别在模板里调方法 |
| **Svelte** | `.svelte.ts` 单例导入**必须带 `.ts` 后缀**，否则被加载两次成两个实例；`<Route>` 不可嵌套；不要全局开 `runes: true`（会让 svelte-routing 的 legacy `$$restProps` 构建失败） | 显式 `.ts` 后缀；路由平铺；按需开 runes |
| **SolidJS** | `createEffect` 会自动追踪它调用的函数里同步读取的响应式数据，导致重复请求；props 不可解构；`style` 用 kebab-case 带单位；计时器用 `window.setInterval` 拿 `number` | `untrack()` 圈住调用；`props.x` 访问；显式单位 |

> 这些坑的共同主题，仍然是 §6 的响应式模型：**每个框架“在哪里、以什么粒度追踪依赖”，决定了它会在哪里咬你一口。**
> React 在「函数重跑 + 闭包」处咬你，Vue 在「Proxy 边界」处咬你，Svelte 在「编译期模块识别」处咬你，Solid 在「自动追踪的范围」处咬你，Angular 在「变更检测的时机」处咬你。

---

## 14. 横向总结与「该读哪一个」

| 你是… | 推荐先读 | 会学到 |
|---|---|---|
| 想要主流标准答案 | **React** | 参考实现，hooks + 单向数据流，生态与心智最通用 |
| 喜欢结构清晰、渐进 | **Vue 3** | SFC 分区 + Proxy 响应式 + Pinia，平衡之选 |
| 企业/大团队规范 | **Angular** | DI + 模块化 + Signals + 懒加载；以及“源码精简但产物最重”的取舍 |
| 想体验编译期框架 | **Svelte 5** | Runes 让响应式像写普通变量，产物极薄；单例/路由的编译期坑 |
| 想理解细粒度响应式 | **SolidJS** | 组件只跑一次 + 无 VDOM + 点对点更新，与 React 的最佳对照 |

**贯穿全文的三条主线**：

1. **业务逻辑与框架可以彻底解耦**——`api/types/utils` 那 529 行在 React/Vue/Solid 间几乎逐字相同，
   框架真正决定的只是“状态层 + 视图层”。Angular 是唯一例外，但例外本身（DI 把自由函数换成服务）也印证了规律。
2. **响应式模型是一切差异的根**——「组件函数跑几次、依赖怎么追踪」决定了状态怎么写、倒计时怎么刷、props 能不能解构、effect 会不会重复触发。读懂 §6 那张表，五栈的脾气就都解释得通了。
3. **抽象的成本只会换地方出现**——源码写得最少的 Angular 产物最重，源码写得最多的 Solid 产物最轻；
   编译期/细粒度框架把“省运行时”换成了“源码多接线”，全家桶框架反之。没有免费的午餐，只有不同的账单。

这正是这套多栈教学项目想让你亲手摸到的东西——和后端的 ORM 谱系，是同一个道理的一体两面。

---

### 附：复现本文数据

```bash
# 框架文件行数（以 solid 为例：.tsx / .vue / .svelte 按框架替换）
find frontends/solid/src -name '*.tsx' -print0 | xargs -0 wc -l | tail -1
# 共享逻辑层（§5 的数字排除单测：client.test.ts / format.test.ts）
find frontends/solid/src \( -path '*/api/*' -o -path '*/types/*' -o -path '*/utils/*' \) \
  ! -name '*.test.ts' | xargs wc -l | tail -1
# stores 总行数（§7）
find frontends/solid/src/stores -type f | xargs wc -l | tail -1
# dist JS 未压缩字节（需先在该前端目录 `npm run build`）
find frontends/solid/dist -name '*.js' -exec cat {} + | wc -c
# UI 冒烟（25 个 Playwright 用例）
./verification/scripts/verify-ui-smoke.sh <react|vue|angular|svelte|solid>
```
