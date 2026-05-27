# HelloTime Pro Svelte 5 前端技术手册与代码导读

本文面向已经熟悉 HTML / CSS / JavaScript 基本语法，但还没系统接触过 Svelte 5、TypeScript、Vite、单页应用（SPA）这套现代前端栈的读者。读完后，你应该能回答三件事：

- 用户在浏览器输入 URL 后，代码按什么顺序执行。
- Svelte 5 Runes、TypeScript、Vite、svelte-routing 分别在做什么。
- 想新增一个页面、状态或接口调用时，应该改哪些文件。

> 阅读建议：第 1 节介绍技术栈与设计特色；第 2～4 节建立整体地图与入口链路；第 5 节集中讲 Svelte 5 的核心概念（Runes、组件、模板语法）；第 6 节快速过 TypeScript；第 7～14 节按一次「打开页面」的生命周期分层细讲；第 15 节给出常见改动的步骤清单。

## 1. 技术选型与设计特色

HelloTime Pro 的 Svelte 5 前端实现基于 **Svelte 5 + TypeScript + Vite** 核心骨架，并选用 **svelte-routing** 控制路由、基于原生 **Runes Class Singletons** 建立零依赖的状态管理、**Tailwind CSS v4** 配合 **Design Tokens**（设计令牌）定制视觉系统。其具体选型考量与设计特色如下：

* **Svelte 5 与 svelte-routing（编译期响应式与单页体验）**：利用 Svelte 5 革命性的 **Runes**（类符文）特性，通过编译期静态分析实现无虚拟 DOM 的极致运行效率与精确重绘。配合 svelte-routing 的声明式跳转，提供流畅的单页应用（SPA）体验。
* **TypeScript（强类型约束与契约对齐）**：通过静态类型检查，使前端数据结构与后端的 OpenAPI 合约保持高度一致。在编写代码阶段即可拦截绝大多数因字段拼写错误或未处理空值（null/undefined）导致的运行时异常。
* **Vite 构建（极速的开发与编译体验）**：基于原生 ESM 的极速热更新（HMR）特性，能实现代码改动的即时响应，并完美对接 Svelte 的编译流程，在生产环境下输出极其轻量的静态资源。
* **Runes Class Singletons（零冗余的状态管理）**：摒弃繁重状态管理库，直接利用 Svelte 5 原生的 `$state` 在标准类中声明响应式状态，以模块化 class 单例形式暴露全局状态。这种机制不仅在组件内自然追踪，也使得在组件外的 API 请求库中直接读取和修改状态变得极为优雅。
* **Design Tokens 与 Tailwind CSS v4（规范化视觉与主题）**：将颜色、字号等样式规范抽离为跨前端通用的设计令牌（CSS 变量）。配合 Tailwind v4 使得暗/亮主题切换和视觉一致性的维护变得十分高效。

## 2. 先建立整体地图

HelloTime Pro 是一个时间胶囊应用。Svelte 前端的职责是：

- 渲染所有 UI 页面（广场 / 开启 / 创建 / 我的 / 登录 / 注册 / 关于）。
- 通过 HTTP 调用后端 `/api/v1/*` 接口，把 JSON 渲染成卡片、表单、详情。
- 维护客户端状态：登录态、主题（暗/亮）、广场筛选条件、我创建的 / 收藏的列表。
- 守卫需要登录的路由（`/create`、`/me/*`），自动用 refresh token 续期 access token。
- 跑在浏览器里，是一个**单页应用**（SPA）：所有跳转都不刷新页面，由 JS 重新渲染。

核心目录：

```text
frontends/svelte/
├── index.html                  # SPA 唯一的 HTML 文件，含主题提前注入脚本
├── vite.config.ts              # Vite 配置：dev server、API 代理、路径别名
├── svelte.config.js            # Svelte 预处理配置（vitePreprocess，不开全局 runes）
├── tsconfig.app.json           # TypeScript 编译配置（含 allowImportingTsExtensions）
├── package.json                # 依赖与 npm 脚本
├── run / build / test          # 三个 Bash 脚本，封装 npm 命令
└── src/
    ├── main.ts                 # 入口：Svelte 5 mount() 挂载到 #app + wireAuthApi()
    ├── App.svelte              # 根组件：hydrate auth/theme + 路由表（扁平 Route 列表）
    ├── styles/                 # 全局样式（导入 spec/styles 的设计令牌 + Tailwind v4）
    ├── types/index.ts          # 与后端 spec/api/openapi.yaml 对齐的 TypeScript 类型
    ├── api/client.ts           # fetch 封装 + 解响应包装 + 自动 refresh
    ├── stores/                 # .svelte.ts 单例：auth · plaza · theme（$state class）
    ├── lib/                    # Runes 工具：clickOutside（action）/ countdown / debounce
    ├── utils/                  # 纯函数：倒计时 / 时间格式化 / 头像 URL
    ├── components/             # 16 个可复用 .svelte 组件
    └── pages/                  # 12 个路由页面 .svelte
```

一次「打开广场页」的流向：

```text
浏览器
  │ GET /
  ▼
Vite dev server（开发）/ 静态文件（生产）
  │ 返回 index.html
  ▼
浏览器解析 HTML → 加载 /src/main.ts
  │ ESM 动态加载所有 import 的模块
  ▼
main.ts: wireAuthApi() + mount(App, { target: document.getElementById("app") })
  │ Svelte 把响应式 DOM 树挂到 #app
  ▼
App.svelte
  │ $effect → themeStore.hydrate() / authStore.hydrate()
  │ 渲染 <Router> → 按 URL 匹配 <Route> → <MainLayout><PlazaPage /></MainLayout>
  ▼
PlazaPage 的 $effect → plazaStore.fetch()
  │
  ▼
api.plaza({...}) → fetch("/api/v1/plaza/capsules")
  │ Vite dev server 反代到 :9080
  ▼
后端返回 JSON → plazaStore.items 更新 → Svelte 重渲染卡片列表
```

返回方向上完全相反：用户点收藏按钮 → `FavoriteButton` 里的 `toggle()` → `api.favorite(id)` → 收到新计数 → `active = true; count = n; plazaStore.patchFavorited(...)` → 触发 Svelte 重渲染。**只有响应式状态（$state）变更会触发渲染，没有人手动操作 DOM**。

## 3. 如何运行和验证

```bash
cd frontends/svelte
./run                          # 开发模式，端口 7176
./build                        # 类型检查 + 生产构建到 dist/
./test                         # vitest 单测
```

打开浏览器访问 `http://localhost:7176`。`./run` 做的事：

1. 检查 `node_modules` 是否存在，没有就 `npm install`。
2. 执行 `npm run dev`，即 `vite --host 0.0.0.0 --port 7176`。
3. Vite 启动一个开发服务器，按需编译 `.ts/.svelte`（使用 `@sveltejs/vite-plugin-svelte`），**修改文件自动热更新**（HMR），不需要手动刷新。

API 代理由 `vite.config.ts` 配置：所有 `/api/*` 和 `/static/*` 转发到 `BACKEND_PROXY`（默认 `http://localhost:9080`；可以直连后端：`BACKEND_PROXY=http://localhost:29010 ./run`）。

生产构建（`./build`）：

```bash
svelte-check --tsconfig ./tsconfig.app.json   # 类型检查（含 Svelte 专用规则）
vite build                                     # 把 src/ 打包到 dist/
```

## 4. 入口链路：`index.html` → `main.ts` → `App.svelte`

### 3.1 `index.html`：SPA 的唯一 HTML

```html
<!doctype html>
<html lang="zh-CN" data-theme="dark">
  <head>
    <script>
      (function () {                          // 提早注入主题，避免首屏闪白
        try {
          var t = localStorage.getItem("hellotime.theme");
          if (t === "dark" || t === "light")
            document.documentElement.setAttribute("data-theme", t);
        } catch (e) {}
      })();
    </script>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- 整个应用只有一个 `<div id="app"></div>`，所有页面都在它内部渲染——这就是 SPA 的「单页」含义。
- 内联 `<script>` 在 Svelte 启动前同步读 localStorage 设置 `data-theme`，避免「主题闪白」。

### 3.2 `main.ts`：挂载入口

```ts
import { mount } from "svelte";
import App from "./App.svelte";
import "./styles/index.css";
import { wireAuthApi } from "./stores/auth.svelte.ts";

wireAuthApi();                            // 把 store 的 token getter 注入 api client

mount(App, { target: document.getElementById("app")! });
```

- `mount()`：Svelte 5 引入的挂载 API（取代了旧版 `new App()`）。
- `wireAuthApi()` 必须在 `mount()` 前调用——原因见第 9.3 节。

### 3.3 `App.svelte`：根组件 + 路由表

```svelte
<script lang="ts">
  import { Router, Route } from "svelte-routing";
  import { authStore } from "@/stores/auth.svelte.ts";
  import { themeStore } from "@/stores/theme.svelte.ts";
  // ... 导入所有页面组件

  $effect(() => {
    themeStore.hydrate();
    authStore.hydrate();
  });

  $effect(() => {
    if (authStore.hydrated && authStore.refreshToken && !authStore.user) {
      void authStore.refreshMe();        // 有 refresh token 但没有 user → 静默续期
    }
  });
</script>

<Router>
  <Route path="/"><MainLayout><PlazaPage /></MainLayout></Route>
  <Route path="/login"><MainLayout><LoginPage /></MainLayout></Route>
  <Route path="/capsules/:code" let:params>
    <MainLayout><CapsuleByCodePage code={params.code} /></MainLayout>
  </Route>
  <Route path="/plaza/:id" let:params>
    <MainLayout><PlazaDetailPage id={params.id} /></MainLayout>
  </Route>
  <!-- ... 其他路由 -->
  <Route><MainLayout><NotFoundPage /></MainLayout></Route>  <!-- 兜底 -->
</Router>
```

**注意**：svelte-routing 2.13 + Svelte 5 要求 **路由扁平化**，不能嵌套 `<Route>` 到另一个 `<Route>` 的内容里。嵌套会触发 Svelte 5 的 `effect_update_depth_exceeded` 错误（子 Route 注册 → 触发父 Route 重渲染 → 子 Route 再注册 → 无限循环）。解决方案：每个 Route 直接内联自己的布局组件。

## 5. Svelte 5 的核心概念：Runes

Svelte 5 引入了 **Runes**（类符文）——一套以 `$` 开头的特殊语法，用于声明响应式状态、副作用和推导值。这是 Svelte 5 与旧版（Svelte 4）最大的区别，也是与 React Hooks、Vue Composition API 最直接的对标。

### 4.1 `$state`：响应式状态

```svelte
<script lang="ts">
  let count = $state(0);
  let user = $state<User | null>(null);
</script>

<button onclick={() => count++}>{count}</button>
```

- `$state(初始值)` 声明一个响应式变量。**只有 `$state` 变量的变化才会触发组件重渲染**。
- 与 React 的 `useState` 对比：无需 `setCount(n)`，直接 `count++` 就能触发更新——Svelte 在编译期把赋值语句变成通知。
- 与 Vue 的 `ref()` 对比：无需 `.value`，直接读写变量名。

**对象和数组**：`$state` 会递归代理对象的字段，可以直接改字段：

```svelte
let items = $state<string[]>([]);
items.push("x");                    // ✅ 直接 push，触发更新
// React 需要 setItems([...items, "x"])
```

### 4.2 `$derived`：推导值

```svelte
<script lang="ts">
  let content = $state("");
  const contentLen = $derived(content.length);       // 自动追踪 content
  const isLong = $derived(contentLen > 3000);        // 追踪 contentLen
</script>
```

- `$derived(表达式)` 等效于 Vue 的 `computed`、React 的 `useMemo`。
- 当被追踪的状态变化时，Svelte 自动重算，不需要手动声明依赖数组。

复杂推导用 `$derived.by(() => { ... })`：

```svelte
const sortedItems = $derived.by(() => {
  return [...items].sort((a, b) => b.favoriteCount - a.favoriteCount);
});
```

### 4.3 `$effect`：副作用

```svelte
<script lang="ts">
  let page = $state(1);

  $effect(() => {
    page;                // 追踪 page
    void load();         // page 变化时重新加载
  });
</script>
```

- `$effect(fn)` 等效于 React 的 `useEffect`：每当依赖变化时执行。
- **Svelte 自动追踪**：`fn` 运行时读了哪些 `$state`，就追踪哪些——不需要手动写 `[deps]` 数组。
- 返回一个函数即为清理：

```svelte
$effect(() => {
  const t = setInterval(() => { now = Date.now(); }, 1000);
  return () => clearInterval(t);                          // 卸载或重跑前清理
});
```

**`untrack()`**：有时想在 effect 里读一个值，但不想把它加入追踪：

```svelte
import { untrack } from "svelte";
$effect(() => {
  active;                                  // 追踪 active
  const current = untrack(() => count);    // 读 count 但不追踪
});
```

### 4.4 `$props`：接受父组件传入的值

```svelte
<script lang="ts">
  interface Props {
    capsule: CapsuleListItem;
    size?: "sm" | "md";
    onChange?: (favorited: boolean, count: number) => void;
  }

  let { capsule, size = "sm", onChange }: Props = $props();
</script>
```

- `$props()` 取代了旧版 `export let xxx`，**统一解构**，默认值写在解构里。
- 等效于 React 的 `function Btn({ capsule, size = "sm", onChange }: Props)`。
- 在 `.svelte.ts` 文件里（非 Svelte 组件），不能用 `$props()`——用普通函数参数即可。

### 4.5 模板语法

Svelte 模板不是 JSX，它是**增强版 HTML**，在 `{...}` 里嵌入 JS 表达式：

```svelte
<!-- 条件 -->
{#if user}
  <span>{user.nickname}</span>
{:else}
  <a href="/login">登录</a>
{/if}

<!-- 列表 -->
{#each items as c (c.id)}
  <CapsuleCard capsule={c} />
{/each}

<!-- key 是第三个参数，等效于 React 的 key prop -->
```

**Snippet**（Svelte 5 取代 slot 的新原语）：

```svelte
<!-- 父组件定义 snippet 内容 -->
<CapsuleGrid {items}>
  {#snippet empty()}
    <p>暂无数据</p>
  {/snippet}
  {#snippet card(c)}
    <button onclick={() => withdraw(c.id)}>撤回</button>
  {/snippet}
</CapsuleGrid>

<!-- 子组件 CapsuleGrid.svelte -->
<script lang="ts">
  import type { Snippet } from "svelte";
  let { empty, card }: { empty?: Snippet; card?: Snippet<[CapsuleListItem]> } = $props();
</script>

{#if items.length === 0}
  {@render empty?.()}          <!-- 渲染 snippet -->
{:else}
  {#each items as c}
    {@render card?.(c)}        <!-- 渲染带参数的 snippet -->
  {/each}
{/if}
```

Snippet 等效于 React 的 render prop / slot。本项目用 `empty` 和 `card` 两个 snippet 分别自定义 CapsuleGrid 的空态和每张卡片的右侧操作区。

## 6. TypeScript 快速概览

`.ts` 与 `.svelte` 文件（`<script lang="ts">`）本质是带类型注解的 JavaScript。读代码时几乎可以「把冒号后面的内容当注释」忽略。

```ts
interface User { id: string; email: string; nickname: string; }
type ErrorCode = "VALIDATION_ERROR" | "UNAUTHORIZED" | ...;  // 联合类型

const user: User | null = null;
const email = $state<string>("");                 // 泛型参数告诉 TS 类型
```

本项目频繁出现的写法：

```ts
Pick<CapsuleListItem, "id" | "favoritedByMe">   // 从类型里摘出几个字段
e instanceof ApiError                            // 运行时类型检查
e as Error                                       // 类型断言
```

`tsconfig.app.json` 里开了 `"allowImportingTsExtensions": true`——这是**关键配置**，允许 `import { authStore } from "@/stores/auth.svelte.ts"` 带 `.ts` 后缀，是防止 store 单例破裂的必要条件（详见第 10.4 节）。

## 7. 路由层：`App.svelte` + svelte-routing

本项目用 `svelte-routing@2.13` 实现客户端路由：

```svelte
<Router>
  <Route path="/"><MainLayout><PlazaPage /></MainLayout></Route>
  <Route path="/capsules/:code" let:params>
    <MainLayout><CapsuleByCodePage code={params.code} /></MainLayout>
  </Route>
  <Route path="/plaza/:id" let:params>
    <MainLayout><PlazaDetailPage id={params.id} /></MainLayout>
  </Route>
  <Route path="/me/created">
    <MeLayout><AuthGate><MeCreatedPage /></AuthGate></MeLayout>
  </Route>
  <Route><MainLayout><NotFoundPage /></MainLayout></Route>
</Router>
```

要点：

- **`<Router>`**：根容器，拦截 `<a>` 点击和 `popstate` 事件，保证 SPA 跳转不刷页面。
- **`<Route path="...">`**：按当前 URL 匹配，匹配到才渲染内部内容；不匹配则不渲染。
- **路径参数**：`let:params` 是 svelte-routing 的特殊指令，把 `:code`、`:id` 等注入为 `params.code`、`params.id`。
- **兜底路由**：最后一个没有 `path` 的 `<Route>` 匹配所有未匹配路径，用来渲染 `NotFoundPage`。
- **已登录重定向**：`LoginPage` / `RegisterPage` 在 `$effect` 里检测 `authStore.hydrated && authStore.user`，满足条件就 `navigate("/", { replace: true })`。

页面跳转三种方式：

```svelte
<a href="/login" use:link>登录</a>              <!-- use:link action：阻止默认行为，走前端路由 -->
<a href="/plaza/{id}" use:link>查看</a>

navigate("/login");                             <!-- 编程式跳转 -->
navigate("/login?from=/create");               <!-- 携带参数 -->
navigate(from, { replace: true });             <!-- 不留历史记录 -->

const location = useLocation();               <!-- 读当前 URL -->
const from = new URLSearchParams($location.search).get("from");
```

## 8. 关键模式：布局与守卫

### 7.1 `MainLayout.svelte` / `MeLayout.svelte`：共享外壳

```svelte
<!-- MainLayout.svelte -->
<script lang="ts">
  import type { Snippet } from "svelte";
  let { children }: { children: Snippet } = $props();
</script>

<AppHeader />
{@render children()}
<AppFooter />
```

- `children` 是 Svelte 5 内置 snippet prop，等效于 React 的 `children`。
- `{@render children()}` 渲染被 `<MainLayout>` 包裹的内容。
- 因为 svelte-routing 不支持嵌套 Route，每个路由都要**直接内联布局组件**，而不是靠 Router 的嵌套机制注入 Outlet。

### 7.2 `AuthGate.svelte`：路由守卫

```svelte
<script lang="ts">
  import type { Snippet } from "svelte";
  import { navigate } from "svelte-routing";
  import { authStore } from "@/stores/auth.svelte.ts";

  let { children }: { children: Snippet } = $props();

  $effect(() => {
    if (!authStore.hydrated) return;
    if (!authStore.user && !authStore.refreshToken) {
      navigate("/login", { replace: true });
    }
  });
</script>

{#if authStore.user || authStore.refreshToken}
  {@render children()}
{/if}
```

- 等 `hydrated` 之后才判断——避免页面刷新时 localStorage 还没读完就跳登录。
- 如果有 `refreshToken` 但没 `user`，允许进入——因为下一个 API 请求会自动 refresh（见第 9.2 节），用户看不到打断。

## 9. 数据层：`api/client.ts`

### 8.1 通用 `request<T>(path, opts)`

```ts
async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const useAuth = opts.auth ?? true;
  const accessToken = await accessTokenForRequest(useAuth);
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

  const res = await fetch(`${BASE}${path}`, { ...opts, headers, body: ... });

  if (res.status === 204) return undefined as T;

  const env = (await res.json()) as Envelope<T>;
  if (!res.ok || !env.success) {
    if (shouldTryRefresh(...)) {
      const newAt = await tryRefresh();
      if (newAt) return request<T>(path, { ...opts, _retry: true });
    }
    throw new ApiError(env.message ?? "请求失败", res.status, env.errorCode, env.details);
  }
  return env.data as T;
}
```

做的事：

1. 自动注入 `Authorization` 头、序列化 `body`、设置 `Content-Type`。
2. 解开后端的统一外壳 `{ success, data, message, errorCode }`，调用者只看到 `data`。
3. 失败时抛 `ApiError`，页面用 `e instanceof ApiError ? e.message : "失败"` 展示。
4. **泛型 `<T>`**：`api.plaza()` 返回 `Promise<PaginatedCapsules>`，TS 全程检查字段拼写。

### 8.2 自动 refresh：去重 + 重放

```ts
let refreshing: Promise<string | null> | null = null;

async function tryRefresh() {
  if (refreshing) return refreshing;               // 并发请求共用同一个 Promise
  refreshing = (async () => { /* POST /auth/refresh */ })();
  return refreshing;
}
```

模块级单例变量 `refreshing`：当一波 401 同时触发（比如页面挂载后同时调了 3 个接口），只发一次 refresh，其余 `await` 同一个 Promise。`_retry` 标记防止重放后又 401 陷入无限循环。

### 8.3 与 store 解耦：`configureApi()` / `wireAuthApi()`

`api/client.ts` **不 import store**（否则 `auth.svelte.ts` → `client.ts` → `auth.svelte.ts` 形成循环依赖）。解法是依赖注入：

```ts
// api/client.ts
let getAccessToken: () => string | null = () => null;
export function configureApi(opts: { getAccessToken: ...; ... }) {
  getAccessToken = opts.getAccessToken;
}

// stores/auth.svelte.ts
export function wireAuthApi() {
  configureApi({
    getAccessToken: () => authStore.accessToken,
    getRefreshToken: () => authStore.refreshToken,
    onTokensRefreshed: (a, r) => authStore.patchTokens(a, r),
    onAuthLost: () => authStore.dropFromAuthLost(),
  });
}
```

`wireAuthApi()` 在 `main.ts` 里 `mount()` 前调用一次，后续 client 拿 token 都走这些函数。

## 10. 状态层：`.svelte.ts` 单例

### 9.1 Svelte 5 的 class 单例模式

与 React（Zustand）或 Vue（Pinia）不同，Svelte 5 允许把 `$state` 写在**普通 class 字段**上：

```ts
// stores/auth.svelte.ts
class AuthStore {
  user = $state<User | null>(null);
  accessToken = $state<string | null>(null);
  refreshToken = $state<string | null>(null);
  hydrated = $state(false);

  hydrate() {
    const persisted = load();
    if (persisted) {
      this.user = persisted.user;
      this.refreshToken = persisted.refreshToken;
    }
    this.hydrated = true;
  }

  async logout() { ... }
}

export const authStore = new AuthStore();
```

- `$state` 在 class 字段上声明，让实例的每个字段都具备响应性。
- `export const authStore = new AuthStore()` 是**模块级单例**：所有组件 `import { authStore }` 时拿到的是同一个实例——这是跨组件共享状态的机制，等效于 Zustand store 的全局单例。

### 9.2 本项目的三个 store

| Store | 关心什么 | 持久化 |
|---|---|---|
| `authStore` | user / accessToken / refreshToken / hydrated | refreshToken + user → localStorage |
| `themeStore` | "dark" / "light" | localStorage `hellotime.theme` |
| `plazaStore` | sort / filter / q / page + items / pagination / loading | 否（每次进页面重新拉） |

### 9.3 一致性：跨 store 联动

`FavoriteButton` 收藏/取消后，同时**直接调** `plazaStore.patchFavorited(...)` 更新广场列表里这条胶囊的 `favoritedByMe / favoriteCount`：

```ts
// FavoriteButton.svelte
await api.unfavorite(capsule.id);
active = false;
count = next;
plazaStore.patchFavorited(capsule.id, false, next);  // 同步更新广场 store
onChange?.(false, next);                             // 通知父组件（如 MeFavoritesPage）
```

这样从「我收藏的」列表里取消，再切回广场，那一条不会显示成已收藏。

### 9.4 ⚠️ 关键陷阱：`.svelte.ts` 必须带 `.ts` 后缀导入

```ts
// ✅ 正确
import { authStore } from "@/stores/auth.svelte.ts";

// ❌ 错误（会破坏单例）
import { authStore } from "@/stores/auth.svelte";
```

原因：`@sveltejs/vite-plugin-svelte` 在处理 `auth.svelte` 时，会同时把它当成「Svelte 组件」和「TS 模块」两条加载路径解析，产生**两个不同的模块实例**。`authStore` 在 A 实例里 hydrate，但 AppHeader 读的是 B 实例（没有 user）——store 单例彻底破裂。

带 `.ts` 后缀后，Vite 只走 TS 模块路径，不会触发 Svelte 组件解析器，始终是一个实例。

项目里所有 store 导入都必须显式带 `.ts`，`tsconfig.app.json` 里开的 `allowImportingTsExtensions: true` 就是为了支持这个写法。

### 9.5 并发请求的「序列号」模式

```ts
// stores/plaza.svelte.ts
class PlazaStore {
  #fetchSeq = 0;

  async fetch() {
    const myId = ++this.#fetchSeq;
    this.loading = true;
    const data = await api.plaza({ sort: this.sort, ... });
    if (myId !== this.#fetchSeq) return;    // 我已经被新请求淘汰了
    this.items = data.items;
    this.loading = false;
  }
}
```

用户快速切 sort/filter 时连发好几个请求，网络响应顺序不确定。`#fetchSeq` 保证「只有最后发起的那个请求才能写状态」，避免老结果覆盖新结果。

## 11. 工具库：`lib/` 里的 Runes 工具

### 10.1 `createCountdown`：每秒倒计时

```ts
// lib/countdown.svelte.ts
export function createCountdown(active: () => boolean) {
  let now = $state(Date.now());

  $effect(() => {
    if (!active()) return;                           // 已开启的胶囊不 setInterval
    const t = setInterval(() => { now = Date.now(); }, 1000);
    return () => clearInterval(t);                  // effect 清理
  });

  return { get now() { return now; } };             // 暴露 getter 而非直接暴露 state
}
```

在组件里用：

```svelte
<script lang="ts">
  const cd = createCountdown(() => !opened);
  const left = $derived(countdownTo(capsule.openAt, cd.now));
</script>

<p>还剩 {left.days} 天 {left.hours} 时 {left.minutes} 分 {left.seconds} 秒</p>
```

`active` 是函数而非值，因为 `$effect` 需要在每次运行时读取最新状态来决定是否追踪。已开启 (`opened = true`) 时 `active()` 返回 `false`，`$effect` 直接 return，不创建 interval。

### 10.2 `createDebounced`：防抖

```ts
// lib/debounce.svelte.ts
export function createDebounced<T>(source: () => T, delay: number) {
  let value = $state<T>(source());

  $effect(() => {
    const v = source();                              // 追踪 source 的变化
    const t = setTimeout(() => { value = v; }, delay);
    return () => clearTimeout(t);
  });

  return { get value() { return value; } };
}
```

在 `PlazaToolbar` 里搜索框输入后 300ms 才触发请求：

```svelte
const debouncedQ = createDebounced(() => rawQ, 300);
$effect(() => { plazaStore.setQ(debouncedQ.value); });
```

### 10.3 `clickOutside`：Svelte action

```ts
// lib/clickOutside.ts
export function clickOutside(
  node: HTMLElement,
  opts: { handler: () => void; active: () => boolean }
) {
  function handle(e: MouseEvent) {
    if (opts.active() && !node.contains(e.target as Node)) {
      opts.handler();
    }
  }
  document.addEventListener("click", handle, true);
  return {
    destroy() { document.removeEventListener("click", handle, true); }  // 卸载时清理
  };
}
```

用法：

```svelte
<div use:clickOutside={{ handler: close, active: () => menuOpen }}>
  ...
</div>
```

Svelte action 是「DOM 生命周期的副作用函数」：挂载时 Svelte 调用它，卸载时调 `destroy()`。比在 `$effect` 里手动 `addEventListener` 更封装，比组合式钩子更轻量。

## 12. 页面层：几个典型模式

### 11.1 数据拉取页（PlazaPage / MeCreatedPage）

```svelte
<script lang="ts">
  let items = $state<CapsuleListItem[]>([]);
  let page = $state(1);

  $effect(() => {
    page;                     // 读 page → 追踪 page
    void load();              // page 变化时重新加载
  });

  async function load() {
    const r = await api.myCapsules(page, PAGE_SIZE);
    items = r.items;
  }
</script>
```

- `page;` 这一行孤零零地读 `page` 变量，唯一目的是**让 `$effect` 追踪 page**。这是 Svelte 5 里常见的「显式追踪」写法。

### 11.2 受控表单（LoginPage / CreatePage）

```svelte
<script lang="ts">
  let email = $state("");
  let busy = $state(false);
  let err = $state<string | null>(null);

  async function submit(e: SubmitEvent) {
    e.preventDefault();                             // 阻止浏览器整页 POST
    err = null;
    busy = true;
    try {
      const tokens = await api.login({ email: email.trim(), password });
      authStore.setTokens(tokens);
      navigate(from ?? "/me/created", { replace: true });
    } catch (e2) {
      err = e2 instanceof ApiError ? e2.message : "登录失败";
    } finally {
      busy = false;
    }
  }
</script>

<input bind:value={email} />   <!-- bind:value 等效于 Vue v-model / React value+onChange -->
<button disabled={busy}>登录</button>
```

`bind:value={email}` 是 Svelte 的双向绑定语法糖：等效于 `value={email} oninput={(e) => email = e.currentTarget.value}`。

### 11.3 Snippet 传递（MeCreatedPage 自定义卡片操作）

```svelte
<!-- MeCreatedPage.svelte -->
<CapsuleGrid {items} {loading}>
  {#snippet card(c)}
    <div style:display="flex" style:align-items="center" style:gap="var(--space-2)">
      {#if c.isOpened}
        <span>♥ {fmtNumber(c.favoriteCount)}</span>
      {/if}
      <button onclick={() => withdraw(c.id)}>
        {c.isOpened ? "删除" : "撤回"}
      </button>
    </div>
  {/snippet}
</CapsuleGrid>
```

Snippet 让父组件「注入」一段 UI 到子组件指定的槽位，而不需要子组件知道具体逻辑。`CapsuleGrid` 的 `{@render card?.(c)}` 负责在每张卡片上调用这段注入的 UI。

## 13. 工具层：`utils/format.ts` 等

纯函数，没有 Svelte 依赖，可以直接 import 用：

```ts
countdownTo(iso, now)          // 返回 { days, hours, minutes, seconds, expired }
fmtDateTime(iso)               // 本地化日期时间字符串
fmtNumber(n)                   // 数字格式化（千分位）
localInputToIso(local)         // <input type="datetime-local"> 值 → ISO UTC
isoToLocalInput(iso)           // 反向
avatarUrl(avatarId)            // → "/static/avatars/<id>.svg"
```

## 14. 样式层：Tailwind v4 + 设计令牌

```css
/* src/styles/index.css */
@import "tailwindcss";
@import "../../../../spec/styles/palette.css";   /* 色阶变量 --brand-500 等 */
@import "../../../../spec/styles/tokens.css";    /* 语义令牌 --color-text-primary 等 */
@import "../../../../spec/styles/cyber.css";     /* 共享类 cy-btn / cy-card / cy-capsule */
@import "./layout.css";
```

- `spec/styles/tokens.css` 是设计系统的**单一来源**。所有前端实现（React / Vue / Angular / Svelte / Solid）共用同一份。修改一次，五个前端同步生效。
- 主题切换靠 `data-theme="dark" | "light"`：tokens.css 里用 `[data-theme="dark"] { --color-text-primary: ... }` 重写变量。
- 组件用 **`cy-*` 共享类**（如 `cy-btn cy-btn--primary`），底层是 CSS 变量。**不允许直接写 `color: #ff00aa` 或用色阶变量 `--brand-500`**——这是为了保证多前端实现视觉一致和暗/亮主题正确切换。
- Tailwind v4 主要用 utility 类做微调（间距、对齐）；一次性的微调用内联 `style:margin-top="var(--space-4)"` 语法（Svelte 特有的简写，等效于 `:style="{ marginTop: 'var(--space-4)' }"`）。

## 15. 常见改动指南

| 想做什么 | 改哪里 |
|---|---|
| 加一个新页面 | ① `src/pages/XxxPage.svelte` 写组件；② `src/App.svelte` 加 `<Route path="..." ...>` |
| 加一个登录后才能访问的页面 | 同上，但在 Route 内容里套 `<AuthGate>` |
| 加一个 API 端点 | ① `src/types/index.ts` 加请求/响应类型；② `src/api/client.ts` 在 `api` 对象里加方法 |
| 加一个跨组件状态域 | `src/stores/xxx.svelte.ts` 写 class，`export const xxxStore = new XxxStore()` |
| 加一个可复用 UI | `src/components/Xxx.svelte` 写组件，接受 `$props()` |
| 自定义某个列表的卡片操作 | 向 `CapsuleGrid` 传 `{#snippet card(c)} ... {/snippet}` |
| 加一个全局样式 | 优先到 `spec/styles/cyber.css` 加 `cy-*` 类；只服务本前端的放 `src/styles/layout.css` |
| 加一个表单字段 | 在组件里加 `let xxx = $state("")` + `<input bind:value={xxx}>` |
| 改 API 代理目标 | `BACKEND_PROXY=http://localhost:29010 ./run` |
| 改主题色 / 间距 | 修改 `spec/styles/tokens.css` 的 CSS 变量，所有前端同步生效 |
| 需要防抖的输入 | `const db = createDebounced(() => rawVal, 300ms)` → 读 `db.value` |
| 需要每秒倒计时 | `const cd = createCountdown(() => !opened)` → 读 `cd.now` |
| 在模板里检测「点击外部」 | `use:clickOutside={{ handler: close, active: () => menuOpen }}` |

## 16. Svelte 5 vs React vs Vue 对照表

| 概念 | Svelte 5 | React | Vue 3 |
|---|---|---|---|
| 响应式状态 | `let x = $state(v)` | `const [x, setX] = useState(v)` | `const x = ref(v)` |
| 更新状态 | `x = newVal` | `setX(newVal)` | `x.value = newVal` |
| 推导值 | `$derived(expr)` | `useMemo(() => expr, [deps])` | `computed(() => expr)` |
| 副作用 | `$effect(() => { ... })` | `useEffect(() => { ... }, [deps])` | `watchEffect(() => { ... })` |
| 副作用清理 | `$effect` 返回函数 | `useEffect` 返回函数 | `watchEffect` 返回的 stop / `onUnmounted` |
| 依赖追踪 | 自动（编译期分析） | 手动声明 `[deps]` | 自动（运行期 Proxy）|
| 接受 props | `let { x } = $props()` | `function Comp({ x })` | `const { x } = defineProps()` |
| 子内容注入 | `{#snippet name()} ... {/snippet}` | `render prop` / `children` | `<template #name>` |
| DOM 生命周期副作用 | Svelte action `use:fn` | `useEffect` + `ref` | `v-directive` 自定义指令 |
| 跨组件状态 | `.svelte.ts` class 单例 | Zustand / Context | Pinia |
| 路由 | svelte-routing | React Router | Vue Router |

## 17. 学到这里之后

读到这里，你已经掌握了现代 Svelte 5 SPA 最常见的部分：Runes（`$state / $derived / $effect / $props`）、组件与 Snippet、svelte-routing、fetch 封装 + 自动 refresh、`.svelte.ts` class 单例、CSS 变量主题。

下一步建议：

- 翻 `src/pages/CreatePage.svelte`（最复杂的页面），跟读「填表单 → 调 AI 建议 → 提交 → 跳详情」整条路径。
- 在 `plazaStore.fetch()` 加 `console.log`，切换 sort/filter 观察「序列号丢弃旧请求」的行为。
- 比较一下 `frontends/react-ts` 或 `frontends/vue3-ts` 的同名页面，理解相同 UI 在 React Hooks / Vue Composition API 下怎么写——这是这个项目最大的价值。

之后可以再深入研究 Svelte 5 的进阶主题：`$bindable()`（子组件可写的 prop）、Svelte stores 兼容层（`.svelte.ts` 是 Svelte 5 推荐的替代方案）、Svelte 5 的细粒度响应性原理（编译期代码转换）、SvelteKit 全栈框架（本项目用 Vite 纯 SPA 模式，没有用 SvelteKit）。本项目刻意保持极简，把这些留给后续。
