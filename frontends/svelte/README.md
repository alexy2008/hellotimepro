# HelloTime Pro · Svelte 5 + TypeScript

5 个前端实现之一：Svelte 5（**Runes 模式**）+ TypeScript + Vite 6 + Tailwind v4 + svelte-routing。
状态层用 `.svelte.ts` 单例 + `$state / $derived / $effect`，组件层用 Svelte 5 的 `$props / $bindable`。

## 快速开始

```bash
# 一次性：起一个后端（默认 FastAPI）
cd ../../
docker compose up -d postgres
./scripts/hello start fastapi
./scripts/hello switch fastapi   # 把 :9080 指向 fastapi

# 启动前端（端口 7176）
cd frontends/svelte
./run
# → http://localhost:7176
```

也可以跳过 :9080 反代直连后端：

```bash
BACKEND_PROXY=http://localhost:29010 ./run
```

## 脚本

| 脚本 | 作用 |
|---|---|
| `./run` | 起 dev server（端口 7176） |
| `./build` | 生产构建到 `./dist` |
| `./test` | 跑单元测试（vitest） |

## 目录结构

```
src/
├── api/client.ts            ← fetch 封装、统一响应解包、access token 自动 refresh
├── stores/                  ← `.svelte.ts` 单例：auth · plaza · theme（$state class）
├── lib/                     ← 可复用 runes 工具：clickOutside（action）/ countdown / debounce
├── types/                   ← 与 spec/api/openapi.yaml 对齐的 TS 类型
├── utils/                   ← 倒计时 / 时间格式 / 头像 URL（纯函数）
├── components/              ← 16 个 .svelte
│                              AppHeader · AppFooter · ThemeToggle · AuthGate · Alert
│                              · CapsuleCard · CapsuleGrid · PlazaToolbar · CapsuleCodeInput
│                              · CapsuleDetail · CalendarUnit · FavoriteButton · AvatarPicker
│                              · Pagination · MeLayout · MainLayout
├── pages/                   ← 12 个 .svelte 路由页面
│   ├── PlazaPage              /
│   ├── OpenPage               /open
│   ├── AboutPage              /about
│   ├── LoginPage              /login
│   ├── RegisterPage           /register
│   ├── CreatePage             /create           （AuthGate 包裹）
│   ├── CapsuleByCodePage      /capsules/:code
│   ├── PlazaDetailPage        /plaza/:id
│   ├── MeCreatedPage          /me/created       （AuthGate 包裹）
│   ├── MeFavoritesPage        /me/favorites     （AuthGate 包裹）
│   ├── MeProfilePage          /me/profile       （AuthGate 包裹）
│   └── NotFoundPage           *（svelte-routing 兜底）
├── App.svelte               ← 路由表 + hydrate auth/theme + 自动 /me 校验
├── main.ts                  ← Svelte 5 `mount()` 挂载到 #app
└── styles/
    ├── index.css            ← Tailwind v4 + spec/styles/{palette,tokens,cyber}.css
    └── layout.css           ← 页面级布局类（与 react-ts / vue3-ts 同源；纯 CSS 无框架耦合）
```

## Svelte 5 特色落点

| 维度 | 体现 |
|---|---|
| 状态 | **Runes class 单例**：`AuthStore` / `PlazaStore` / `ThemeStore` 在 `.svelte.ts` 里把 `$state / $derived` 写在类字段上，`export const xxxStore = new XxxStore()` 即得到跨组件共享的响应式单例 |
| 副作用 | `$effect(...)` 替代 React 的 `useEffect` / Vue 的 `watchEffect`；倒计时 / 防抖封装为 `createCountdown(active)` / `createDebounced(source, delay)`，内部用 `$effect` 自动清理 |
| 派生值 | `$derived(expr)` / `$derived.by(() => {...})`；`AboutPage` 用 `$derived.by` 排序后端 stack |
| 表单 | `bind:value={state}` / `bind:checked={state}`，与 Vue v-model 几乎对位；`AvatarPicker` 用 props + `onChange` 回调实现"受控" |
| 路由 | **svelte-routing**：`<Router>` + `<Route path="...">`，导航用 `use:link` 动作和 `navigate()`；激活态读 `useLocation()` 自己派生 |
| 动作 | **Svelte action**：`clickOutside` 封装为 `use:clickOutside={{ handler, active }}`，比组合式更轻；vs Vue `watch + addEventListener` |
| 模板 | `{#if}` / `{#each}` / `{#snippet}`：`Snippet` 是 Svelte 5 取代 slot 的新原语，`CapsuleGrid` / `MeCreatedPage` 用 `{#snippet empty()}` `{#snippet card(c)}` 把"空态"和"卡片右侧操作"传给子组件 |
| Props 解构 | `let { capsule, onChange }: Props = $props();`，比 React `props.capsule` 少一层，比 Vue `defineProps` 更直接 |

## 设计要点

- **设计令牌单一来源**：`src/styles/index.css` 直接 `@import "../../../../spec/styles/{palette,tokens,cyber}.css"`，
  组件层只允许用语义令牌（`var(--color-*)`）和 `cy-*` 共享类，禁止直接消费色阶。
- **存储策略**：access token 仅在内存（`AuthStore.accessToken`），refresh token 与 user 持久化到 `localStorage`
  （教学版方案；XSS 风险见 `docs/02-design.md §7.2`）。
- **自动刷新**：`api/client.ts` 拦截 `401 + UNAUTHORIZED`，调用 `/auth/refresh` 拿新 access token
  后重放原请求；refresh 并发请求会被去重。
- **匿名收藏**：`FavoriteButton` 检测到匿名用户会弹确认框，跳 `/login?from=<当前路径>`；
  `LoginPage` 读 `from` 参数，登录后自动回跳。
- **倒计时**：未开启卡片每秒局部更新（`createCountdown` 启动 setInterval；`$effect` 清理），已开启卡片不再 setInterval。
- **主题持久化**：`hellotime.theme = "dark" | "light"`，并在 `index.html` 的内联脚本里
  提早注入，避免首屏闪白。
- **`.svelte.ts` 导入**：项目里统一写 `import { authStore } from "@/stores/auth.svelte.ts"`，
  显式带 `.ts` 后缀。**这是关键**——只写 `auth.svelte` 时，Vite + Svelte 插件会同时把它当成"Svelte 组件"
  与"TS 模块"两条加载链解析出**两个不同的模块实例**，store 单例就会破裂（auth state 在 hydrate
  完成后无法传递给 AppHeader 等消费者）。

## 与契约对齐

| 契约要点 | 落点 |
|---|---|
| 统一响应包装 `{ success, data, message, errorCode }` | `src/api/client.ts` 解包并将失败映射成 `ApiError` |
| 错误码枚举 | `src/types/index.ts` `ErrorCode` |
| 8 位胶囊码 `[A-Z0-9]{8}` | `CapsuleCodeInput` 强制大写 + 字符过滤 |
| 广场 sort/filter/q + 分页 | `PlazaStore` + `PlazaToolbar`（搜索 300ms 防抖） |
| 头像列表 `/api/v1/avatars` | `RegisterPage` / `MeProfilePage` 取自 API |
| 健康检查 `/api/v1/health` | `AppFooter` / `AboutPage` 渲染当前后端栈 |
