# HelloTime Pro Nuxt 全栈技术手册与代码导读

本文面向已经熟悉 HTML / CSS / JavaScript 基本语法，但还没系统接触过 Nuxt、Nitro、文件系统路由、Vue 自动导入这一整套「全栈」框架的读者。读完后，你应该能回答三件事：

- 用户在浏览器输入 URL 后，**前端 + 后端**代码各自按什么顺序执行。
- Nuxt、Nitro、Vue 3、Pinia、Drizzle ORM、jose 分别在做什么。
- 想新增一个页面或 API 端点时，应该改哪些文件。

> 阅读建议：第 1 节介绍技术栈与设计特色；第 2～4 节建立整体地图与入口链路；第 5 节集中讲 Nuxt 的几个核心思想（文件系统路由、Nitro server engine、自动导入、`.client.ts` 后缀）；第 6～9 节按一次请求的生命周期分层细讲；第 10 节对比 Nuxt 与 Next.js 的异同；第 11 节对比全栈与 SPA 差异；第 12 节给出常见改动的步骤清单。
>
> 如果你已经读过这个项目里 **Vue3 SPA** 和 **Next.js 全栈** 两份指南，这份的核心问题就是：「Nuxt 怎么把同一份业务，用更 Vue 风味的方式做成全栈」。和 Next.js 的对照是这份文档的暗线。

## 1. 技术选型与设计特色

HelloTime Pro 的 Nuxt 全栈实现基于 **Nuxt 3 + Vue 3 + TypeScript** 核心骨架，并选用 **Drizzle ORM** 作为双数据库抽象层、**Pinia** 进行客户端状态管理、**Tailwind CSS v4** 配合 **Design Tokens**（设计令牌）定制跨端样式规范。其具体选型考量与设计特色如下：

* **Nuxt 3 与 Nitro（优雅的 Vue 全栈生态）**：依托 Nuxt 的文件系统路由与高性能 Nitro 服务端引擎，将基于 Vue 3 组合式 API 的前端界面与基于 h3 的后端 API 端点无缝集成至单个 Node 进程中，天然免去了跨域（CORS）与多套服务部署的繁琐逻辑。
* **通用渲染与 `useAsyncData`（首屏即数据）**：开启 SSR 后，公开读页（广场、胶囊详情）在服务端预渲染，借助 `useAsyncData` 在服务端直接命中同进程的 Nitro 处理器取数，首屏 HTML 即带内容，利于 SEO 与分享链接；鉴权与强交互页面则按 `routeRules` 保持客户端渲染。这种「按路由选渲染方式」的混合渲染（Hybrid Rendering）是 Nuxt 相对纯 SPA 的核心增量。
* **极速自动导入与类型系统（极佳的 DX 体验）**：利用 Nuxt 强大的自动导入（Auto-Imports）机制，开发者无需手动引入 Vue、Pinia、自定义组件或组合式函数即可直接调用。配合全栈 TypeScript 的共享类型，极大缩减了样板代码，提升了研发效率。
* **Drizzle ORM 与双数据库引擎（通用数据抽象）**：采用轻量化、类型安全的 Drizzle ORM，在服务端根据环境变量动态加载 PostgreSQL (node-postgres) 或 SQLite (better-sqlite3) 驱动，实现同一份业务代码在不同数据库方言下的无感适配。
* **Pinia 与 JWT 轮转（工程级状态与安全）**：使用 Pinia 构建模块化的单例状态管理，并结合基于 Web Crypto API (jose 库) 的 HS256 JWT 及 Refresh Token 家族轮转机制，在为 Vue 3 提供响应式状态流的同时，打造了严密的用户身份与会话保护屏障。
* **Design Tokens 与 Tailwind CSS v4（规范化视觉与主题）**：通过项目共用的设计令牌（CSS 变量）与新一代 Tailwind CSS v4 编译器，完美契合应用原生的暗/亮色主题，带来高品质、流畅的跨端响应式页面呈现。

## 2. 先建立整体地图

HelloTime Pro 是一个时间胶囊应用。**全栈 Nuxt 实现**把「Vue 前端」和「Nitro 后端」打包成同一个 Node 进程，前端和后端共享 TypeScript 类型、共享数据库连接、共享一份构建产物：

- `/`、`/login`、`/create`、`/me/*`、`/c/[code]` 等是 **页面**（浏览器拿到 HTML + JS）。
- `/api/v1/auth/login`、`/api/v1/plaza/capsules` 等是 **REST API**（同一进程里 Nitro 处理的 HTTP 路由）。
- 两边都跑在 `nuxt dev` / `node .output/server/index.mjs` 里，**没有独立后端服务**，**没有 CORS**。

核心目录（注意目录结构和 Next.js 完全不一样——Nuxt 走的是「按角色分目录」，不是「按 URL 分目录」）：

```text
fullstacks/nuxt/
├── package.json              # 单一依赖图：nuxt、drizzle、jose、bcryptjs、pinia…
├── nuxt.config.ts            # Nuxt 配置：模块、Vite 插件、Nitro 选项
├── tsconfig.json
├── app.vue                   # ★ 应用根：只有 <NuxtLayout><NuxtPage /></NuxtLayout>
├── drizzle.config.ts
├── scripts/migrate.ts        # 一次性迁移脚本（run 不再自动调用，schema 由仓库级 ./scripts/db 管理）
├── public/                   # 静态资源（rsync 来的 SVG），Nitro 直接以 / 暴露
├── drizzle/{pg,sqlite}/      # 两套 SQL 迁移
├── run                       # 一键启动脚本
│
├── pages/                    # ★ 文件系统路由：pages/login.vue → /login
│   ├── index.vue             #   广场（/）
│   ├── login.vue / register.vue / create.vue / open.vue / about.vue
│   ├── c/[code].vue          #   /c/:code（[code] 是动态段）
│   └── me/                   #   /me/*
│       ├── index.vue / created.vue / favorites.vue / profile.vue
│
├── layouts/                  # ★ 布局：通过 definePageMeta 选择
│   ├── default.vue           #   <AppHeader /> + <slot /> + <AppFooter />
│   └── me.vue                #   /me 区子树用的布局
│
├── components/               # 顶层 Vue 组件，被自动导入（不用写 import）
│
├── stores/                   # Pinia stores，被 @pinia/nuxt 自动注册 + 自动导入
│
├── composables/              # composables，被自动导入（useCountdown, useDebouncedRef…）
│
├── middleware/auth.client.ts # ★ 路由守卫（注册名 auth-client；.client 对中间件不生效，见 §4.4）
├── plugins/bootstrap.client.ts# ★ 客户端启动钩子（.client.ts = 仅浏览器）
│
├── api/client.ts             # 客户端 fetch 封装（与服务端 server/api 区别开）
├── utils/                    # 普通 TS 工具（format、avatar）
├── types/                    # 与 spec/api/openapi.yaml 对齐的类型
├── styles/                   # 全局 CSS
├── lib/validation/schemas.ts # 前后端共享的 Zod 校验
│
└── server/                   # ★★★ 这里就是「后端」
    ├── api/v1/               # 文件 = 端点，后缀决定 HTTP 方法
    │   ├── health.get.ts                            # GET  /api/v1/health
    │   ├── auth/login.post.ts                       # POST /api/v1/auth/login
    │   ├── auth/refresh.post.ts
    │   ├── me.get.ts                                # GET  /api/v1/me
    │   ├── me.patch.ts                              # PATCH /api/v1/me
    │   ├── plaza/capsules.get.ts
    │   ├── plaza/capsules/[id].get.ts
    │   ├── capsules/[code].get.ts
    │   ├── me/favorites.get.ts / .post.ts
    │   ├── me/favorites/[capsuleId].delete.ts
    │   └── ...
    ├── lib/                  # 服务端工具（仅 Nitro 可达）
    │   ├── envelope.ts / errors.ts
    │   ├── current-user.ts   # 解析 Authorization 头 → claims
    │   ├── security.ts       # bcrypt / JWT (jose) / refresh token
    │   ├── parse-body.ts     # Zod 校验
    │   └── env.ts            # 读环境变量
    ├── services/             # 业务层：auth/capsules/favorites/plaza/me/...
    └── db/                   # Drizzle ORM
        ├── index.ts          # 按 DB_DRIVER 动态加载 pg / better-sqlite3
        ├── schema-pg.ts
        └── schema-sqlite.ts
```

一次「打开广场页（SSR）+ 点收藏」的端到端流向：

```text
浏览器                                  Nuxt 进程（端口 7178，内含 Nitro server）
  │                                          ┃
  │ GET /                                    ┃
  ├─────────────────────────────────────────►┃ matches pages/index.vue（SSR）
  │                                          ┃   → useAsyncData 在服务端执行：
  │                                          ┃     $fetch('/api/v1/plaza/capsules') 同进程直达
  │                                          ┃     server/services/plaza → Drizzle → DB
  │ ◄──────  含胶囊列表的完整 HTML  ──────────┃   （取到的数据序列化进 payload）
  │ Vue + Pinia hydrate（复用 payload，不重取）┃
  │                                          ┃
  │ 点收藏 → POST /api/v1/me/favorites       ┃
  ├─────────────────────────────────────────►┃ matches server/api/v1/me/favorites.post.ts
  │                                          ┃   → defineEventHandler → services/favorites → DB
  │ ◄────────  JSON envelope  ───────────────┃
```

> **关键洞察**：本项目 `nuxt.config.ts` 设 `ssr: true`，并用 `routeRules` 做**混合渲染**——公开读页（`/`、`/c/[code]`、`/about`）走 SSR，首屏 HTML 即带数据；鉴权/强交互页（`/create`、`/me/**`）标为 `ssr: false`、保持客户端渲染。SSR 页用 `useAsyncData` 取数：服务端渲染时 `$fetch('/api/v1/*')` 由 Nitro 在**同进程内直接调用处理器**（无真实 HTTP 往返），客户端 hydrate 时直接复用服务端传来的 payload、不重复请求。这正是 Nuxt 相对纯 SPA 的最大杠杆。

## 3. 如何运行和验证

```bash
cd fullstacks/nuxt
./run                          # 默认 PostgreSQL，端口 7178
DB_DRIVER=sqlite ./run         # 零依赖跑 SQLite
./build                        # 生产构建到 .output/
./test                         # 类型检查
```

打开浏览器访问 `http://localhost:7178`。`./run` 做的事：

1. 检查 `node_modules`，没有就 `npm install`。
2. `rsync` 把 `spec/icons` 和 `spec/avatars` 复制到 `public/static/`——Nitro 把 `public/` 直接以根路径暴露（`public/static/icons/xxx.svg` ↔ `/static/icons/xxx.svg`）。
3. `npm run build && npm run start` —— **注意**：`./run` 跑的是生产模式（`nuxt build` 后 `node .output/server/index.mjs`），不是 `nuxt dev`。这让全栈版的行为更接近部署形态。开发期想用 dev server，自己 `npm run dev`。

> **注意**：`./run` **不执行数据库迁移**——schema 生命周期由仓库级 `./scripts/db init / reset --seed` 统一管理。首次使用前先执行 `./scripts/db init`。

构建产物 `.output/server/index.mjs` 是 Nitro 打包的可执行 Node 应用——一个文件就能 `node` 起来。

## 4. 入口与三类文件夹：`app.vue` / `pages/*` / `server/api/*`

Nuxt 的核心约定是 **「按角色分目录」**——`pages/`、`layouts/`、`components/`、`composables/`、`stores/`、`middleware/`、`plugins/`、`server/` 每个目录的内容都被 Nuxt 自动识别为对应角色。

### 3.1 `app.vue`：应用根（只 5 行）

```vue
<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
```

- **没有 `main.ts`，没有 `createApp().mount('#app')`**——Nuxt 自己生成。
- `<NuxtLayout>` 解析当前页面通过 `definePageMeta({ layout })` 选择的布局（默认是 `layouts/default.vue`）。
- `<NuxtPage>` 在布局的 `<slot />` 位置渲染当前 URL 匹配的 `pages/*.vue`。
- 这一个文件取代了 Vue3 SPA 里的 `index.html` + `main.ts` + `App.vue` + `router/index.ts` 四份。

### 3.2 `nuxt.config.ts`：模块系统

```ts
export default defineNuxtConfig({
  ssr: true,                                   // 通用渲染（默认即 true）
  modules: ["@pinia/nuxt"],                    // 装上 Pinia + 自动注册 + 自动导入 stores
  alias: { "@spec": resolve(__dirname, "../../spec") },
  routeRules: {                                // 混合渲染：按路由覆盖渲染方式
    "/create": { ssr: false },                 //   鉴权/强交互页保持客户端渲染
    "/me/**": { ssr: false },
  },
  nitro: { preset: "node-server" },            // 生产打包成传统 Node 服务
  vite: { plugins: [tailwindcss()] },
  components: [{ path: "~/components", pathPrefix: false }],
});
```

要点：

- **`ssr: true` + `routeRules`**：这是 Nuxt 的**混合渲染**。`ssr: true` 让所有页面默认服务端渲染；`routeRules` 再按路由前缀覆盖——把 `/create`、`/me/**` 标为 `{ ssr: false }`，让它们退回客户端渲染（SPA 孤岛）。原因见 §4.6：这些页依赖 localStorage 里的登录态，服务端读不到，SSR 既无 SEO 收益、还会让路由守卫在服务端误判。
- **`modules: ["@pinia/nuxt"]`**：Nuxt 的「模块」是注册点，可以扩展任何事——加 Pinia、加 i18n、加 image optimization……都靠模块。
- `nitro.preset: "node-server"`：Nitro 是 Nuxt 内置的服务端引擎，**生产构建时可切换 preset**——`node-server`（传统 Node）、`vercel`、`cloudflare`、`netlify`、`aws-lambda`……同一份代码可以部署到任何地方。
- 没有 `runtimeConfig`：环境变量通过 `server/lib/env.ts` 直接读 `process.env`。

### 3.3 `pages/index.vue`：广场页

```vue
<script setup lang="ts">
import { storeToRefs } from "pinia";
import type { Envelope, PaginatedCapsules } from "@/types";

const plaza = usePlazaStore();
const auth = useAuthStore();
const { items, loading, pagination, page } = storeToRefs(plaza);
const { user, hydrated } = storeToRefs(auth);

// ★ 服务端预取首屏广场：useAsyncData 的回调在 SSR 时于服务端执行，$fetch 同进程
//   直达 Nitro 处理器；结果序列化进 payload，客户端 hydrate 时直接复用、不重取。
//   注意 SSR 无 Authorization 头 → favoritedByMe 一律 false，登录用户在客户端补取纠正。
const { data: ssrPlaza } = await useAsyncData("plaza:home", () =>
  $fetch<Envelope<PaginatedCapsules>>("/api/v1/plaza/capsules", {
    query: { sort: plaza.sort, filter: plaza.filter, page: plaza.page, pageSize: plaza.pageSize },
  }),
);
if (ssrPlaza.value?.success && ssrPlaza.value.data) {
  plaza.items = ssrPlaza.value.data.items;          // seed 进 store，模板照常绑定
  plaza.pagination = ssrPlaza.value.data.pagination;
}

// 登录用户在客户端补取一次纠正 favoritedByMe；匿名用户沿用 SSR 数据、不再请求。
onMounted(() => { if (hydrated.value && user.value) void plaza.fetch(); });
watch(hydrated, (v) => { if (v && user.value) void plaza.fetch(); });
</script>

<template>
  <section class="cy-hero-block">...</section>
  <PlazaToolbar />        <!-- 自动导入，无需 import 语句 -->
  <CapsuleGrid :items="items" :loading="loading">
    <template #empty>...</template>
  </CapsuleGrid>
</template>
```

要点：

- **`await useAsyncData(key, handler)`**：Nuxt 的服务端数据获取约定。`<script setup>` 顶层 `await` 让页面成为异步组件（Suspense 边界），SSR 时等数据就绪再渲染 HTML。`key`（`"plaza:home"`）用于 payload 去重与缓存。
- **`$fetch` 而非 `api.client` 的 `fetch`**：`$fetch`（ofetch）在服务端能解析相对 URL `/api/v1/*` 并直达同进程 Nitro 处理器；而 `api/client.ts` 用原生 `fetch`、`BASE=""`，相对 URL 在服务端无法解析（详见 §8.1 的注意）。
- 胶囊详情页 `pages/c/[code].vue` 用同样的 `useAsyncData` 模式，是更纯粹的 SSR 读页范例（详见 §4.6）。

与 Vue3 SPA 版的区别：SPA 版只在 `onMounted` 里 `fetch` 后客户端渲染；这里服务端先把带数据的 HTML 发出去，首屏无 loading、利于 SEO。

### 3.4 `server/api/v1/health.get.ts`：REST 端点

```ts
import { defineEventHandler } from "h3";
import { withApi } from "~/server/lib/envelope";

export default defineEventHandler((event) => {
  return withApi(event, () => ({
    status: "ok",
    service: "hellotime-pro",
    version: "0.1.0",
    ...
  }));
});
```

关键点：

- **文件名后缀 `.get.ts` 决定 HTTP 方法**。Nitro 扫描 `server/api/**/*.<method>.ts`，把它们注册为对应方法的路由。一个文件管一个 (URL, method) 组合。
- **`defineEventHandler((event) => ...)`** 是 Nitro / h3 的入口约定。`event` 对象封装了 request / response 上下文。
- 没有路由表，没有控制器类——文件存在就是端点存在。

### 3.5 `server/api/v1/me.get.ts` + `me.patch.ts`：方法拆文件

跟 Next.js 把 GET/PATCH 写在同一个 `route.ts` 里不同，Nuxt 强制 **一个文件一个方法**：

```text
server/api/v1/me.get.ts    →  GET   /api/v1/me
server/api/v1/me.patch.ts  →  PATCH /api/v1/me
```

```ts
// me.get.ts
export default defineEventHandler((event) =>
  withApi(event, async () => {
    const claims = requireClaims(event);
    return getMe(claims.userId);
  }),
);
```

```ts
// me.patch.ts
export default defineEventHandler((event) =>
  withApi(event, async () => {
    const claims = requireClaims(event);
    const body = await parseJson(event, updateProfileSchema);
    return updateProfile(claims.userId, body);
  }),
);
```

### 3.6 动态参数 + 方法：`server/api/v1/me/favorites/[capsuleId].delete.ts`

```ts
export default defineEventHandler((event) =>
  withApi(event, async () => {
    const claims = requireClaims(event);
    const capsuleId = getRouterParam(event, "capsuleId")!;
    await removeFavorite(claims.userId, capsuleId);
  }, { successStatus: 204, emptyBody: true }),
);
```

- `[capsuleId]` 文件夹/文件名段是动态参数。`getRouterParam(event, "capsuleId")` 取出。
- `withApi(..., { successStatus: 204, emptyBody: true })` 让成功响应没有 body、状态码 204。

## 5. Nuxt 的核心思想

### 4.1 文件系统路由：URL 不需要写代码

| URL | 文件 |
|---|---|
| `/` | `pages/index.vue` |
| `/login` | `pages/login.vue` |
| `/me/created` | `pages/me/created.vue`（外层套 `layouts/me.vue`） |
| `/c/AB12CDEF` | `pages/c/[code].vue`（`route.params.code === "AB12CDEF"`） |
| `/api/v1/health` (GET) | `server/api/v1/health.get.ts` |
| `/api/v1/me/favorites/abc-123` (DELETE) | `server/api/v1/me/favorites/[capsuleId].delete.ts` |

新增页面 = 新增一个 `.vue`；新增 API = 新增一个 `<method>.ts`。

### 4.2 Nitro：Nuxt 的「后端引擎」

[Nitro](https://nitro.unjs.io/) 是 Nuxt 内置的服务端框架，独立可用。它给 Nuxt 提供：

- `server/api/**/*` 路由扫描与方法分发
- `server/middleware/**/*` 中间件（每次请求都跑）
- `server/plugins/**/*` 启动钩子
- `defineEventHandler(...)`、`getRouterParam`、`getQuery`、`readBody`、`getHeader`、`setCookie`、`getCookie`、`sendNoContent`、`setResponseStatus` 等一组 **基于 h3 的事件对象 API**
- 生产构建：把整个 server + Nuxt 渲染器打包成单一 `.output/server/index.mjs`，按 `nitro.preset` 适配各种部署目标

> 类比：Next.js App Router 的 Route Handler 用「Web 标准 Request/Response」；Nitro 用「h3 event」对象（`event.node.req` 是原生 Node `IncomingMessage`，但通常用 `getXxx(event)` 高层 helper）。两套设计的功能等价、写法不同。

### 4.3 自动导入（Auto-Imports）

Nuxt 最有辨识度的「魔法」之一：

| 类型 | 自动导入来源 | 不用写 |
|---|---|---|
| Vue API | `ref / computed / watch / onMounted / nextTick / ...` | `import { ref } from "vue"` |
| Pinia stores | `stores/*.ts` 导出的 `useXxxStore` | `import { useAuthStore } from "@/stores/auth"` |
| Components | `components/**/*.vue` | `import CapsuleCard from "@/components/CapsuleCard.vue"` |
| Composables | `composables/**/*.ts` | `import { useCountdown } from "@/composables/useCountdown"` |
| Nuxt helpers | `useRoute / useRouter / navigateTo / definePageMeta / defineNuxtPlugin / ...` | — |
| h3 / Nitro 助手 | `defineEventHandler / readBody / getQuery / getRouterParam / ...` | — |

实际项目里，`pages/index.vue` 的脚本块只 import 了 `vue` 和 `pinia`——其余全是自动导入。

> **本项目里仍能看到一些显式 import**（比如 `pages/index.vue` import 了 `computed/onMounted` from "vue"）：这是因为 IDE 类型推断在 `<script setup>` 里有时需要显式提示，写出来更稳。但删掉这些 import 代码也能跑——Nuxt build 时会自动补上。

### 4.4 `.client.ts` / `.server.ts` 后缀：环境隔离

| 文件名 | 行为 | 适用 |
|---|---|---|
| `xxx.ts` | 同构：服务端和客户端都跑（SSR 时两次） | plugins / 普通模块 |
| `xxx.client.ts` | 仅在浏览器跑（SSR 期间跳过） | **plugins / components** |
| `xxx.server.ts` | 仅在服务端跑 | **plugins / components** |

本项目用了：

- `plugins/bootstrap.client.ts`：水合 store、wire api 回调，只在浏览器执行一次。`.client` 后缀对**插件**生效——这个插件确实只在客户端跑。

> ⚠️ **路由中间件不认 `.client` / `.server` 后缀**。这是一个容易踩的坑：`middleware/auth.client.ts` 看起来像「只在客户端跑的守卫」，但 Nuxt **不会**把它当客户端专属——它只是把文件名 kebab 化注册成名为 **`auth-client`** 的普通命名中间件，在服务端和客户端**都会执行**（可在 `.nuxt/types/middleware.d.ts` 看到 `MiddlewareKey = "auth-client"`）。
>
> 后果：若一个受保护页面开了 SSR，这个守卫会在**服务端**运行，而服务端读不到 localStorage 里的登录态 → 把已登录用户误判为未登录、重定向到 `/login`。本项目的对策是在 `nuxt.config.ts` 用 `routeRules` 把 `/create`、`/me/**` 标为 `{ ssr: false }`，让这些页面只在客户端渲染，守卫自然也只在客户端跑（详见 §4.6）。

```ts
// middleware/auth.client.ts —— 注册名为 "auth-client"
export default defineNuxtRouteMiddleware((to) => {
  const auth = useAuthStore();
  if (auth.user || auth.refreshToken) return;          // 放行
  return navigateTo({ path: "/login", query: { from: to.fullPath } });
});
```

页面通过 `definePageMeta({ middleware: "auth-client" })` 把守卫挂上：

```vue
<!-- pages/create.vue -->
<script setup lang="ts">
definePageMeta({ middleware: "auth-client" });
</script>
```

### 4.5 `server/` 目录天然隔离

`server/` 目录里的代码 **永远不会** 被打进客户端 bundle——Nuxt 把 `server/` 单独交给 Nitro，与 Vue 应用是两个构建图。

这等价于 Next.js 的 `import "server-only"`，但是 **目录级别的隔离**——不需要在每个文件首行加导入。客户端代码想 import `~/server/lib/security` 直接构建失败。

### 4.6 混合渲染与 `useAsyncData`：服务端取数 + hydration 守卫

这是本实现相对纯 SPA 的核心增量，也是 Nuxt 全栈最值得理解的部分。

**(1) 谁 SSR、谁不 SSR**：`nuxt.config.ts` 里 `ssr: true` 让所有页面默认服务端渲染，再用 `routeRules` 把鉴权/强交互页退回客户端：

```ts
routeRules: {
  "/create": { ssr: false },   // 依赖 localStorage 登录态，SSR 无收益且会误重定向
  "/me/**": { ssr: false },
}
```

SSR 的是公开读页：`/`（广场）、`/c/[code]`（胶囊详情）、`/about`。它们对 SEO 和首屏速度敏感，且内容公开可读。

**(2) `useAsyncData` 取数**（以胶囊详情页为例）：

```ts
// pages/c/[code].vue
const { data: cap, error, refresh } = await useAsyncData(
  () => `capsule:${code.value}`,
  async () => {
    const env = await $fetch<Envelope<CapsuleDetailT>>(
      `/api/v1/capsules/${encodeURIComponent(code.value)}`,
    );
    if (!env.success || !env.data) throw createError({ statusCode: 404, message: "胶囊不存在", fatal: false });
    return env.data;
  },
  { watch: [code] },
);
```

- SSR 时回调在服务端跑，`$fetch` 同进程直达 Nitro 处理器（无真实 HTTP），首屏 HTML 带数据；数据序列化进 payload，客户端 hydrate 复用、不重取。
- `createError({ fatal: false })` 把错误填进 `error`，页面渲染错误分支而非整站错误页。
- 鉴权投影（`favoritedByMe`）：SSR 无 token → 一律 false；登录用户在 `onMounted` 里带 token 补取一次纠正。

**(3) hydration 守卫——SSR 最常见的坑**：服务端没有 `window` / `document` / `localStorage`。两类代码必须隔离，否则 SSR 直接 500：

- **依赖 localStorage 的渲染**（如登录态决定的 Header 用户菜单、主题）：用 `<ClientOnly>` 包裹。服务端一律按「未登录 / 默认主题」渲染，客户端 hydrate 后再补，避免「服务端 HTML ≠ 客户端首次渲染」的 hydration mismatch。

  ```vue
  <ClientOnly>
    <ThemeToggle />
    <template v-if="user">…用户菜单…</template>
    <template v-else>…登录/注册…</template>
  </ClientOnly>
  ```

- **触碰 `window` / `document` 的副作用**（定时器、事件监听）：用 `import.meta.client` 守卫。**注意 `watch(..., { immediate: true })` 的回调会在 SSR 的 setup 阶段同步执行**——这是个反直觉的点，不能假设「watcher 只在客户端跑」：

  ```ts
  // composables/useClickOutside.ts
  watch(active, (on) => {
    if (!import.meta.client) return;   // SSR 无 document，且 immediate watcher 会在服务端执行
    if (on) document.addEventListener("pointerdown", onPointer);
    else document.removeEventListener("pointerdown", onPointer);
  }, { immediate: true });
  ```

  本项目的 `useCountdown`、`useClickOutside` 与 `CapsuleDetail` 的自动开启定时器都加了这道守卫。

## 6. 数据层：Drizzle ORM + 双数据库

跟 Next.js 全栈版用同一套思路，只是文件路径在 `server/db/`：

### 5.1 `server/db/index.ts`：按环境动态选驱动

```ts
declare global { var __helloTimeDb: DbCtx | undefined; }

export async function getCtx(): Promise<DbCtx> {
  if (globalThis.__helloTimeDb) return globalThis.__helloTimeDb;

  if (process.env.DB_DRIVER === "sqlite") {
    const Database = (await import("better-sqlite3")).default;
    const { drizzle } = await import("drizzle-orm/better-sqlite3");
    const schema = await import("./schema-sqlite");
    return (globalThis.__helloTimeDb = { db: drizzle(...), t: schema, kind: "sqlite" });
  }
  // ...PG 分支同理
}
```

- 动态 `import()`：SQLite 模式下不加载 `pg`，反之亦然。
- `globalThis.__helloTimeDb` 单例：Nitro dev 模式 HMR 会重新执行模块，挂 globalThis 防止连接泄漏。

### 5.2 Drizzle Schema：与 Next.js 全栈版完全一致

```ts
// server/db/schema-pg.ts
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 254 }).notNull().unique(),
  ...
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
});
```

`mode: "string"` 让 timestamp 字段在 JS 侧表现成 ISO 字符串，与 SQLite 的 TEXT 时间列行为一致。

### 5.3 业务查询：和 Next.js 同款

```ts
// server/services/favorites.ts
const { db, t } = await getCtx();
const [capsule] = await db.select().from(t.capsules).where(eq(t.capsules.id, capsuleId));
...
await db.insert(t.favorites).values({ userId, capsuleId, createdAt: now });
await db.update(t.capsules)
  .set({ favoriteCount: sql`${t.capsules.favoriteCount} + 1` })
  .where(eq(t.capsules.id, capsuleId));
```

> **`fullstacks/next/src/db/` 和 `fullstacks/nuxt/server/db/` 几乎是同一份代码**——这是项目刻意为之的对照，让读者一眼看出「同一套 ORM 在两个全栈框架下的差异只是路径」。

### 5.4 迁移：`scripts/migrate.ts`

跟 Next.js 全栈版一样，手写一个简化 migrator：按文件名顺序执行 SQL，所有迁移用 `CREATE TABLE IF NOT EXISTS` 保证幂等。**`./run` 不再自动调用它**——schema 生命周期由仓库级 `./scripts/db init / reset --seed` 统一管理；需手动迁移时执行 `npx tsx scripts/migrate.ts`。

## 7. 服务端架构：`server/api/*` → `server/services/*` → `server/db/*`

每个 Nitro Event Handler 都是这个三段式：

```text
server/api/v1/...post.ts        server/services/*.ts         server/db/index.ts
─────────────────────────       ─────────────────────       ────────────────────
defineEventHandler:
  parseJson + Zod   ──┐
  requireClaims     ──┤
                      ▼
  withApi(event, () => login(body))  ──►  login(body)        ──►  getCtx() → db.select()
                                            ↓
                                           bcrypt verify     ──►  db.insert(refreshTokens)
                                            ↓
                                           jose sign JWT
                                            ↓
                                           return data
                      ◄─────────────────────┘
  ok / err / status code
```

### 6.1 `withApi`：统一响应包装

```ts
// server/lib/envelope.ts
export async function withApi<T>(
  event: H3Event,
  handler: () => T | Promise<T>,
  opts?: { successStatus?: number; emptyBody?: boolean },
) {
  try {
    const data = await handler();
    if (opts?.emptyBody) {
      setResponseStatus(event, opts.successStatus ?? 204);
      return null;
    }
    if (opts?.successStatus) setResponseStatus(event, opts.successStatus);
    return { success: true, data, message: null, errorCode: null };
  } catch (e) {
    if (e instanceof ApiError) {
      setResponseStatus(event, e.status);
      return { success: false, data: null, message: e.message, errorCode: e.code, details: e.details };
    }
    setResponseStatus(event, 500);
    return { success: false, ..., errorCode: "INTERNAL_ERROR" };
  }
}
```

- 业务代码只管 `return data` 或 `throw ApiError.notFound(...)`，不直接构造 Response。
- 用 `setResponseStatus(event, ...)` 而不是 `new Response(...)`——Nitro 通过 event 对象修改响应状态。

### 6.2 鉴权：`server/lib/current-user.ts`

```ts
export function readClaims(event: H3Event): Claims | null {
  const auth = getHeader(event, "authorization");
  if (!auth) return null;
  const [scheme, token] = auth.split(" ", 2);
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return verifyAccessToken(token);
}

export function requireClaims(event: H3Event): Claims {
  const c = readClaims(event);
  if (!c) throw ERR.unauthorized("缺少 access token");
  return c;
}
```

- 鉴权用 **Authorization Bearer 头**——与 SPA 同款契约。
- 注意 `getHeader(event, name)` 是 h3 helper（自动导入）。

### 6.3 服务层：`server/services/auth.ts` 示例

```ts
export async function login(body: { email: string; password: string }): Promise<AuthTokens> {
  await rateLimit(body.email);
  const { db, t } = await getCtx();
  const [user] = await db.select().from(t.users).where(eq(t.users.email, body.email.toLowerCase()));
  if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
    recordFailure(body.email);
    throw ERR.unauthorized("邮箱或密码错误");
  }
  return issueTokenPair(user, null);
}
```

- 业务函数是 **普通 async 函数**——可以被任何 Event Handler 调用。
- 限流字典挂 `globalThis.__helloTimeLoginFailures` 上（HMR-safe）。
- refresh token 轮转、重放检测算法与 FastAPI/Spring Boot 版本一致。

## 8. 客户端：`api/client.ts` + `stores/*` + plugin

虽然「同一进程」，浏览器仍然通过 HTTP 调 `/api/v1/*`。

### 7.1 `api/client.ts`（注意：是 **顶层** `api/`，不是 `server/api/`）

```ts
const BASE = "";    // 同源
export const api = {
  login: (body) => request("/api/v1/auth/login", { method: "POST", body, auth: false }),
  ...
};
```

> **`api/` 与 `server/api/` 是两个不同的目录**——前者是客户端发请求的 SDK，后者是 Nitro 注册的端点。容易混。

代码与 Vue3 SPA 版本几乎一行不差，只是 `BASE = ""`（同源、无 vite proxy）。

> ⚠️ **SSR 取数不要用这个 `api` 客户端**：它内部是原生 `fetch` + `BASE=""`，相对 URL `/api/v1/*` 在浏览器能解析（基于当前 origin），但在**服务端无 origin 会抛 `Failed to parse URL`**。所以 SSR 页面取数统一用 Nuxt 的 `$fetch`（ofetch）——它在服务端会把相对路径直达同进程 Nitro 处理器（详见 §4.6）。`api/client` 只在客户端事件/`onMounted` 里调用（这些只在浏览器跑），因此安全。

### 7.2 `plugins/bootstrap.client.ts`：客户端启动钩子

```ts
export default defineNuxtPlugin(() => {
  const auth = useAuthStore();
  const theme = useThemeStore();

  // 把 store 注入到 api client（解循环依赖）
  configureApi({
    getAccessToken: () => auth.accessToken,
    getRefreshToken: () => auth.refreshToken,
    onTokensRefreshed: (a, r) => auth.patchTokens(a, r),
    onAuthLost: () => auth.dropFromAuthLost(),
  });

  theme.hydrate();
  auth.hydrate();
  if (auth.refreshToken) void auth.refreshMe();
});
```

- 文件名 `.client.ts` 后缀 = 仅浏览器执行。
- `defineNuxtPlugin` 是 Nuxt 的「应用启动钩子」——在 Vue app 挂载前、所有 store 就绪后自动调用一次。
- 这一个文件干了 Vue3 SPA 版本 `main.ts` + `App.vue` 的 `onMounted` 的活。

> 对比 Next.js 全栈：Next 没有「应用启动钩子」的概念，等价工作分散在 Zustand store 的模块顶层 `configureApi(...)` 和 `app/layout.tsx` 的某个 Client Component 的 `useEffect` 里。Nuxt 的这种集中钩子读起来更清晰。

### 7.3 路由守卫：`middleware/auth.client.ts`（注册名 `auth-client`）

```ts
export default defineNuxtRouteMiddleware((to) => {
  const auth = useAuthStore();
  if (auth.user || auth.refreshToken) return;
  return navigateTo({ path: "/login", query: { from: to.fullPath } });
});
```

页面通过 `definePageMeta({ middleware: "auth-client" })` 启用。和 Vue3 SPA 的 `router.beforeEach` 思路一样，但写法更分散（每个守卫一个文件，每个页面声明用哪些）。

> 如 §4.4 所述，文件名里的 `.client` 对中间件**不生效**——它是名为 `auth-client` 的通用中间件，服务端也会跑。因为守卫读 localStorage 里的登录态、服务端读不到，本项目用 `routeRules` 把挂了这个守卫的页面（`/create`、`/me/**`）标为 `ssr: false`，确保守卫只在客户端执行。

## 9. 样式：Tailwind v4 + 设计令牌

```css
/* styles/index.css （由 nuxt.config.ts 的 css 选项导入）*/
@import "tailwindcss";
@import "../../../spec/styles/palette.css";
@import "../../../spec/styles/tokens.css";
@import "../../../spec/styles/cyber.css";
@import "./layout.css";
```

跟所有其他前端 / 全栈共用同一套设计 token：

- `spec/styles/tokens.css` 是 **设计系统的单一来源**。
- 主题切换靠 `<html data-theme="dark|light">`。
- 组件用 `cy-*` 共享类。
- Tailwind v4 通过 Vite 插件接入（`vite: { plugins: [tailwindcss()] }`）。

## 10. Nuxt 与 Next.js 的并排对比

由于两套全栈实现解决同一个问题，最直观的学习方式是并排看：

| 维度 | Next.js | Nuxt |
|---|---|---|
| 前端框架 | React | Vue 3 |
| 服务端引擎 | Next.js Server | Nitro |
| 渲染模式 | RSC + 客户端混合（公开读页 RSC，交互页 Client Component） | SSR + `routeRules` 混合（公开读页 SSR，鉴权页 `ssr:false`） |
| 服务端取数 | RSC 内 `async` 直接 `import` 服务层调用 | `useAsyncData` + `$fetch` 同进程直达 Nitro 处理器 |
| 路由配置 | `src/app/<URL>/page.tsx`（**按 URL 分层**） | `pages/<URL>.vue`（**按 URL 分层**） |
| API 配置 | `src/app/api/<URL>/route.ts` 导出 `GET/POST/...` | `server/api/<URL>.<method>.ts` 一文件一方法 |
| 一个 URL 多方法 | 单文件 `export GET, export PATCH` | 多文件 `me.get.ts`、`me.patch.ts` |
| 服务端入参 | Web 标准 `Request` / `NextRequest` | h3 `H3Event` + `getXxx(event)` helpers |
| 服务端响应 | `return NextResponse.json(...)` | `return obj` + `setResponseStatus(event, ...)` |
| 服务端隔离 | `import "server-only"` 文件级 | `server/` 目录级 |
| 启动入口 | `src/app/layout.tsx`（Server Component）+ 客户端 Provider | `app.vue` + `plugins/*.client.ts` |
| 状态管理 | Zustand `persist` | Pinia + 手写 hydrate |
| 路由守卫 | `<AuthGate>` 组件包裹 | `definePageMeta({ middleware })` |
| 自动导入 | 无（必须 `import`） | 强大（components / composables / stores / Vue / Nitro helpers） |
| 部署目标 | Node / Vercel / Edge / 容器 | `nitro.preset` 切换：Node / Vercel / Cloudflare / Netlify / Lambda / static |
| 生产产物 | `.next/`（Next 自己跑） | `.output/server/index.mjs`（普通 Node 应用） |
| Server Component | 一等公民（默认就是） | 当前版本没有等价物（Nuxt 4+ 正在做 Server Components） |
| 路径别名 | `@/` 默认指向 `src/` | `~/` 指向项目根 |

**两边几乎所有「服务端业务代码」一一对应**——`server/lib/security.ts` ↔ `src/lib/server/security.ts`、`server/services/auth.ts` ↔ `src/services/auth.ts`、`server/db/index.ts` ↔ `src/db/index.ts`。差异只在「壳」：路由约定、请求/响应 API、自动导入。

## 11. 「全栈」相对于「SPA + 独立后端」的差异要点

跟 Next.js 版同样适用：

| 维度 | SPA + 独立后端 | Nuxt 全栈 |
|---|---|---|
| 进程 | 两个：FastAPI :29010 + Vite :7173 | 一个：Nuxt :7178 |
| 跨域 | 需要 CORS / vite proxy | 同源，无 CORS |
| 类型共享 | 前端手写一份 TS 类型对应 Python schema | `~/types/index.ts` 和 `~/server/...` 共享 |
| 部署 | 两套构建产物 | 一个 `.output/` 目录 |
| DB 连接 | 后端持有 | `server/` 目录天然隔离 |
| 文件夹/路由 | 后端 routes/、前端 router.ts | 全在 `pages/` + `server/api/` |
| HMR 单例 | 各自 reload | 需 `globalThis` 缓存 |

## 12. 常见改动指南

| 想做什么 | 改哪里 |
|---|---|
| 加一个新页面 | 新建 `pages/<路径>.vue`，自动注册路由 |
| 加一个登录后才能访问的页面 | 页面 `<script setup>` 里加 `definePageMeta({ middleware: "auth-client" })`；若该页不需要 SSR，在 `nuxt.config.ts` 的 `routeRules` 标 `{ ssr: false }`（见 §4.4/§4.6） |
| 加一个 REST 端点 | 新建 `server/api/v1/<路径>.<method>.ts`，导出 `defineEventHandler(...)` |
| 在端点里写业务逻辑 | 加到 `server/services/xxx.ts`，handler 直接 import 调用 |
| 加一张表 / 一列 | ① 编辑 `server/db/schema-{pg,sqlite}.ts`；② 新增 `drizzle/{pg,sqlite}/0002_xxx.sql`；③ 重启自动迁移 |
| 加一个 store | `stores/xxx.ts` 用 `defineStore(...)`，自动被注册 + 自动导入 |
| 加一个 composable | `composables/useXxx.ts` 写函数；自动导入 |
| 加一个 component | `components/Xxx.vue`；自动导入 |
| 加一个客户端启动逻辑 | `plugins/xxx.client.ts` 用 `defineNuxtPlugin(...)` |
| 加一个全局路由守卫 | `middleware/xxx.global.ts`（`.global` 后缀让所有页面都跑） |
| 改 DB | `DB_DRIVER=sqlite ./run` |
| 改主题色 / 间距 | 修改 `spec/styles/tokens.css`，所有前端同步生效 |
| 改部署目标 | `nuxt.config.ts` 里改 `nitro.preset` |

## 13. 学到这里之后

你已经掌握了 Nuxt 全栈最常见的 80%：文件系统路由（`pages/` + `server/api/<method>.ts`）、Nitro event handler API、自动导入（components/composables/stores/Vue/h3）、`.client.ts` / `.server.ts` 环境隔离、`definePageMeta` + middleware、`defineNuxtPlugin` 启动钩子、Drizzle 双数据库、`withApi` 响应包装、`requireClaims` 鉴权、`globalThis` 单例。

下一步建议：

- 参照广场页，把 `pages/me/created.vue` 也改造一下思路——它走的是客户端渲染（`routeRules` 标了 `ssr:false`），对比一下「为什么受保护页不适合 SSR」，加深对 §4.6 的理解。
- 给胶囊详情页 `pages/c/[code].vue` 加 `useHead` / `useSeoMeta`，把胶囊标题写进 `<title>` 和 `og:title`——这是开了 SSR 后才真正有意义的能力（爬虫和社交卡片能读到服务端渲染的 meta）。
- 把一个 `server/api/...` 端点的实现搬到一个 `server/middleware/*.ts` 全局中间件里，体验「每次请求都跑」的钩子（比如记请求日志）。
- 对照 `fullstacks/next` 的 `src/app/page.tsx`（RSC）与本仓库的 `pages/index.vue`（`useAsyncData`）——同一个「服务端取数渲染广场」，两套框架两种写法，理解 RSC 与 `useAsyncData` 的设计取舍。
- 看 `nuxt.config.ts` 里 `nitro.preset` 能切换什么——把它改成 `"static"` 跑 `nuxt build` 看产物，理解 Nuxt 在 SSG（静态站点生成）方向的能力。

之后可以再深入研究 Nuxt 的几个常见进阶主题：`useFetch`（`useAsyncData + $fetch` 的简写）、`server/middleware/` 中间件链、`useRuntimeConfig` 暴露安全的客户端配置、`useCookie` 做服务端可读的鉴权（让 SSR 也能识别登录态，免去客户端补取）、Nitro 部署 preset（Cloudflare Workers、Vercel Edge）、Nuxt Modules 生态。本项目刻意保持极简，把这些留给后续。
