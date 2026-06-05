# HelloTime Pro · 五个前端实现全面对比

> 对比对象：`frontends/` 下已完成并通过 UI 冒烟验证的 5 个前端
> —— **React**（参考实现）、**Vue 3**、**Angular**、**Svelte 5**、**SolidJS**。
> 数据采集与复核日期：2026-06-05（全部行数 / 依赖数 / dist 体积已重新核对一致）。代码量为物理行（`wc -l`，含注释空行），统计口径见 §3。
> 姊妹篇：后端对比见 [`docs/backend-comparison.md`](backend-comparison.md)。

---

## 1. 为什么这五个能放在一起比

和后端一样，五个前端实现的是**同一个产品**，共享同一套约束：

- 同一份 API 契约（都打到 `:9080` 反代后的同一组后端）；
- 同一套**设计令牌与组件类**（`spec/styles/{palette,tokens,cyber}.css` 的 `cy-*` 类，禁止硬编码色值）；
- 同一组 **25 个 Playwright UI 冒烟用例**（`verification/`），从真实浏览器黑盒验证；
- 同样的页面/路由/交互（广场、创建、开启、收藏、个人中心、AI 创作助手……）。

于是五者之间的差异，纯粹来自**框架的响应式模型与生态选择**，而非需求差异。
全部 5 个前端均已通过 `verify-ui-smoke`，各 **25/25**。

---

## 2. 技术栈速览

| 维度 | React | Vue 3 | Angular | Svelte 5 | SolidJS |
|---|---|---|---|---|---|
| 框架版本 | React 19 | Vue 3.5 | Angular 19 | Svelte 5 (Runes) | Solid 1.9 |
| 渲染模型 | 虚拟 DOM + diff | 虚拟 DOM + diff | 虚拟 DOM + 变更检测 | **编译期，无 VDOM** | **细粒度，无 VDOM** |
| 视图语法 | JSX | SFC `<template>` | 组件内联模板 | `.svelte` 模板 | JSX |
| 响应式原语 | `useState`/hooks | `ref`/`reactive` | Signals(`signal`) | Runes(`$state`) | Signals(`createSignal`) |
| 状态管理 | Zustand 5 | Pinia 2 | NgRx Signal Store | `.svelte.ts` 单例 | 模块级 Signal/Store |
| 路由 | react-router 7 | vue-router 4 | @angular/router | svelte-routing 2 | @solidjs/router |
| 构建 | Vite 6 | Vite 6 | Angular CLI(esbuild) | Vite 6 | Vite 6 |
| 运行时依赖数 | 4 | 3 | 10 | **2** | **2** |
| 端口 | 7174 | 7173 | 7175 | 7176 | 7180 |

一句话画像：

- **React** — 参考实现，hooks + 单向数据流，生态最大、心智最“主流”。
- **Vue 3** — Proxy 响应式 + SFC，渐进、平衡，模板与逻辑分区清晰。
- **Angular** — 全家桶 + 依赖注入 + Signals，约定最强、运行时最重。
- **Svelte 5** — 编译期框架，Runes 让响应式像写普通变量，产物最薄之一。
- **SolidJS** — 细粒度响应式，JSX 外形像 React、内核完全不同，产物最薄。

---

## 3. 代码量对比

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
- **React 居中**：JSX + hooks 的样板适中，Zustand 状态层偏重（427 行，见 §6）。

### 一个值得玩味的对照

```
总实现行：  Angular 2794  <  Vue 3241  <  Svelte 3328  <  React 3384  <  Solid 3536
dist 体积：  Solid 91KB   <  Svelte 117KB < Vue 169KB  <  React 341KB <  Angular 1787KB
```

两条排序几乎**完全相反**。写得少的（Angular）跑起来最重，写得多的（Solid）跑起来最轻——
因为编译期/细粒度框架把“省运行时”的代价转嫁成了“源码里多写一点接线”，而全家桶框架反之。
**抽象的成本不会消失，只会换地方出现**（这一点和后端 ORM 的结论同源）。

---

## 4. 共享逻辑层：契约驱动解耦的实证

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

---

## 5. 响应式模型：最根本的分野

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

> 心智迁移最大的坑都来自这里：React 老手到 Solid 会以为组件会重跑（不会，§见 Solid 的 TECHNICAL_GUIDE）；
> Vue 的 `ref.value`、Solid 的 `signal()`、Angular 模板里的 `signal()` 调用，本质都是“读操作要显式，才能被追踪”。

---

## 6. 状态管理：同一个 theme store 的五种写法

状态层是框架个性最浓的地方。下面是**功能完全相同**的主题 store——`read()` / `apply()` 两个辅助函数在五份里**逐字相同**，
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

### 复杂 store 的行数差异更能说明问题

简单的 theme store 五者都在 38–51 行，差别不大；但把所有 store 加起来，写法的“仪式感”差异被放大：

| 前端 | stores 总行数 | 风格特征 |
|---|---:|---|
| **Svelte** | **247** | Runes class 字段，仪式最少，`$state` 即响应式 |
| Vue (Pinia) | 275 | 组合式 `defineStore`，`ref` + 返回暴露 |
| Angular (NgRx) | 349 | `withState/withComputed/withMethods` 声明式拼装 |
| Solid | 384 | `createStore` + 显式动作函数 + 闭包序列号守卫 |
| **React (Zustand)** | **427** | `create` + `set/get` + selector，样板最多 |

全局状态的共性：五者都**脱离组件树**存在（无需 Provider 包裹，或仅 Angular 用 `providedIn:'root'` DI 单例），
组件直接 import 即可读写——这让“一处操作、多处投影”（如收藏后同步广场与收藏列表）无需跨组件通信。

---

## 7. 路由对比

| 前端 | 路由库 | 嵌套布局方式 | 守卫方式 |
|---|---|---|---|
| React | react-router 7 | `createBrowserRouter` + `<Outlet>` | 路由 element 包 `<AuthGate>` |
| Vue 3 | vue-router 4 | `children` + `<router-view>` | `beforeEnter` / 组件内包裹 |
| Angular | @angular/router | `children` + `<router-outlet>` + `loadComponent` 懒加载 | 函数式 `CanActivateFn` |
| Svelte | svelte-routing 2 | **扁平 `<Route>`**（不可嵌套，须平铺） | `<AuthGate>` 组件包裹 |
| SolidJS | @solidjs/router | 父 `<Route component>` 经 `props.children` 做 outlet | 双层 `<Show>` 声明式守卫 |

差异点：

- **Angular 唯一默认做路由级懒加载**（`loadComponent`），契合其“重框架按需加载”的需要。
- **Svelte-routing 的 `<Route>` 不能嵌套**（项目记忆中的坑：必须平铺列举，否则触发 effect 循环），
  是五者里路由表组织最“反直觉”的。
- **路由路径有一处不一致**：Svelte 用 `/capsules/:code`，其余四者统一 `/c/:code`
  （前端内部路径，不属于 API 契约；`verify-ui-smoke` 对 Svelte 做了 `capsulePath` 兼容）。

---

## 8. 视图语法与组件模式

**控制流的五种写法**（渲染一个列表 + 空态）：

| 框架 | 列表 | 条件 |
|---|---|---|
| React | `items.map(c => <Card .../>)` | `cond && <X/>` / 三元 |
| Vue | `<Card v-for="c in items" :key="c.id"/>` | `v-if` / `v-else` |
| Angular | `@for (c of items(); track c.id)` | `@if (cond)` |
| Svelte | `{#each items as c (c.id)}…{/each}` | `{#if}…{:else}` |
| Solid | `<For each={items}>{c => <Card/>}</For>` | `<Show when={}>` |

**Props / 插槽**：

- React：`props` 对象，children + render-prop（如 `cardSlot={(c) => …}`）。
- Vue：`defineProps` + 具名 `<slot>` / 作用域插槽。
- Angular：`@Input()`（或 signal input）+ `<ng-content>`。
- Svelte：`$props()` 解构 + `Snippet`（Svelte 5 取代 slot 的新原语，`{#snippet card(c)}`）。
- Solid：`props.x`（**不可解构**，否则丢响应性）+ 返回 JSX 的函数 prop。

**一个跨框架的共性**：五者都把“卡片右侧自定义操作”（撤回按钮 / 收藏数）做成了插槽/render-prop——
React/Solid 用函数 prop，Vue/Angular 用具名插槽，Svelte 用 Snippet。同一个交互需求，五种插槽机制。

---

## 9. 依赖与运行时重量

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
  代价是数量级更大的产物。
- React/Vue 处于中间：核心框架轻，但状态/路由靠外部库拼装。

---

## 10. 各框架的“招牌坑”（来自项目记忆与 `docs/dev-notes.md`）

| 框架 | 招牌坑 | 规避 |
|---|---|---|
| **React** | StrictMode 开发期 effect 双触发；LLM 请求会被打两次 | 幂等化 / 用 ref 去重 |
| **Vue** | 解构 `reactive`/`props` 丢响应性；忘了 `.value` | 用 `toRefs` / 始终 `.value` |
| **Angular** | 模板里 signal 要当函数调用 `x()`；方法 vs `computed()`（每次变更检测重算） | 派生值用 `computed()` |
| **Svelte** | `.svelte.ts` 单例导入**必须带 `.ts` 后缀**，否则被加载两次成两个实例；`<Route>` 不可嵌套 | 显式 `.ts` 后缀；路由平铺 |
| **SolidJS** | `createEffect` 会自动追踪它调用的函数里同步读取的响应式数据，导致重复请求；props 不可解构；`style` 用 kebab-case | `untrack()` 圈住调用；`props.x` 访问 |

> 这些坑的共同主题，仍然是 §5 的响应式模型：**每个框架“在哪里、以什么粒度追踪依赖”，决定了它会在哪里咬你一口。**

---

## 11. 横向总结与“该读哪一个”

| 你是… | 推荐先读 | 会学到 |
|---|---|---|
| 想要主流标准答案 | **React** | 参考实现，hooks + 单向数据流，生态与心智最通用 |
| 喜欢结构清晰、渐进 | **Vue 3** | SFC 分区 + Proxy 响应式 + Pinia，平衡之选 |
| 企业/大团队规范 | **Angular** | DI + 模块化 + Signals + 懒加载；以及“源码精简但产物最重”的取舍 |
| 想体验编译期框架 | **Svelte 5** | Runes 让响应式像写普通变量，产物极薄；单例/路由的编译期坑 |
| 想理解细粒度响应式 | **SolidJS** | 组件只跑一次 + 无 VDOM + 点对点更新，与 React 的最佳对照 |

**贯穿全文的两条主线**：

1. **业务逻辑与框架可以彻底解耦**——`api/types/utils` 那 529 行在 React/Vue/Solid 间几乎逐字相同，
   框架真正决定的只是“状态层 + 视图层”。
2. **抽象的成本只会换地方出现**——源码写得最少的 Angular 产物最重，源码写得最多的 Solid 产物最轻；
   编译期/细粒度框架把“省运行时”换成了“源码多接线”，全家桶框架反之。没有免费的午餐，只有不同的账单。

这正是这套多栈教学项目想让你亲手摸到的东西——和后端的 ORM 谱系，是同一个道理的一体两面。

---

### 附：复现本文数据

```bash
# 框架文件行数（以 solid 为例：.tsx / .vue / .svelte 按框架替换）
find frontends/solid/src -name '*.tsx' -print0 | xargs -0 wc -l | tail -1
# 共享逻辑层（§4 的数字排除单测：client.test.ts / format.test.ts）
find frontends/solid/src \( -path '*/api/*' -o -path '*/types/*' -o -path '*/utils/*' \) \
  ! -name '*.test.ts' | xargs wc -l | tail -1
# dist JS 未压缩字节（需先在该前端目录 `npm run build`）
find frontends/solid/dist -name '*.js' -exec cat {} + | wc -c
# UI 冒烟（25 个 Playwright 用例）
./verification/scripts/verify-ui-smoke.sh <react|vue|angular|svelte|solid>
```
