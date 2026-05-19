# HelloTime Pro Nuxt 全栈技术手册与代码导读

本文面向已经熟悉 HTML / CSS / JavaScript 基本语法，但还没系统接触过 Nuxt、Nitro、文件系统路由、Vue 自动导入这一整套「全栈」框架的读者。读完后，你应该能回答三件事：

- 用户在浏览器输入 URL 后，**前端 + 后端**代码各自按什么顺序执行。
- Nuxt、Nitro、Vue 3、Pinia、Drizzle ORM、jose 分别在做什么。
- 想新增一个页面或 API 端点时，应该改哪些文件。

> 阅读建议：第 1～3 节先建立整体地图；第 4 节集中讲 Nuxt 的几个核心思想（文件系统路由、Nitro server engine、自动导入、`.client.ts` 后缀）；第 5～12 节按一次请求的生命周期分前后端两半细讲；第 13 节给出常见改动的步骤清单。
>
> 如果你已经读过这个项目里 **Vue3 SPA** 和 **Next.js 全栈** 两份指南，这份的核心问题就是：「Nuxt 怎么把同一份业务，用更 Vue 风味的方式做成全栈」。和 Next.js 的对照是这份文档的暗线。

## 1. 先建立整体地图

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
├── scripts/migrate.ts        # 启动前跑迁移
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
├── middleware/auth.client.ts # ★ 客户端路由守卫（.client.ts = 仅浏览器）
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

一次「打开广场页 + 点收藏」的端到端流向：

```text
浏览器                                  Nuxt 进程（端口 7178，内含 Nitro server）
  │                                          ┃
  │ GET /                                    ┃
  ├─────────────────────────────────────────►┃ matches pages/index.vue
  │                                          ┃ (SPA 模式：仅返回 SPA 壳；客户端再渲染)
  │ ◄────────  HTML + bundle  ───────────────┃
  │ Vue + Pinia hydrate                      ┃
  │                                          ┃
  │ fetch /api/v1/plaza/capsules?sort=hot    ┃
  ├─────────────────────────────────────────►┃ matches server/api/v1/plaza/capsules.get.ts
  │                                          ┃   → defineEventHandler 回调
  │                                          ┃   → import { listPlaza } from "~/server/services/plaza"
  │                                          ┃   → server/db/index.ts → Drizzle → DB
  │ ◄────────  JSON envelope  ───────────────┃
  │                                          ┃
  │ 渲染 CapsuleCard 列表                    ┃
```

> **关键洞察**：本项目 `nuxt.config.ts` 里设了 `ssr: false`——这是个 **SPA 模式的 Nuxt**，pages 在客户端渲染（不预渲染 HTML）。但 Nitro server 仍然存在并提供 `/api/v1/*`。这让前端体验和 React/Vue SPA 一致，便于多栈对比。生产 Nuxt 项目通常开 SSR 拿首屏优势。

## 2. 如何运行和验证

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
3. `tsx scripts/migrate.ts`：跑数据库迁移。
4. `npm run build && npm run start` —— **注意**：`./run` 跑的是生产模式（`nuxt build` 后 `node .output/server/index.mjs`），不是 `nuxt dev`。这让全栈版的行为更接近部署形态。开发期想用 dev server，自己 `npm run dev`。

构建产物 `.output/server/index.mjs` 是 Nitro 打包的可执行 Node 应用——一个文件就能 `node` 起来。

## 3. 入口与三类文件夹：`app.vue` / `pages/*` / `server/api/*`

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
  ssr: false,                                  // SPA 模式
  modules: ["@pinia/nuxt"],                    // 装上 Pinia + 自动注册 + 自动导入 stores
  alias: { "@spec": resolve(__dirname, "../../spec") },
  nitro: { preset: "node-server" },            // 生产打包成传统 Node 服务
  vite: { plugins: [tailwindcss()] },
  components: [{ path: "~/components", pathPrefix: false }],
});
```

要点：

- **`modules: ["@pinia/nuxt"]`**：Nuxt 的「模块」是注册点，可以扩展任何事——加 Pinia、加 i18n、加 image optimization……都靠模块。
- `nitro.preset: "node-server"`：Nitro 是 Nuxt 内置的服务端引擎，**生产构建时可切换 preset**——`node-server`（传统 Node）、`vercel`、`cloudflare`、`netlify`、`aws-lambda`……同一份代码可以部署到任何地方。
- 没有 `runtimeConfig`：环境变量通过 `server/lib/env.ts` 直接读 `process.env`。

### 3.3 `pages/index.vue`：广场页

```vue
<script setup lang="ts">
import { computed, onMounted, watch } from "vue";
import { storeToRefs } from "pinia";
// 注意：usePlazaStore / useAuthStore 没有 import —— 自动导入！

const plaza = usePlazaStore();
const auth = useAuthStore();
const { items, loading, pagination, page } = storeToRefs(plaza);
const { user, hydrated } = storeToRefs(auth);

onMounted(() => { if (hydrated.value) void plaza.fetch(); });
watch(hydrated, (v) => { if (v) void plaza.fetch(); });
</script>

<template>
  <section class="cy-hero-block">...</section>
  <PlazaToolbar />        <!-- 自动导入，无需 import 语句 -->
  <CapsuleGrid :items="items" :loading="loading">
    <template #empty>...</template>
  </CapsuleGrid>
</template>
```

跟 Vue3 SPA 版几乎一模一样——只是少了 `import PlazaToolbar from "@/components/PlazaToolbar.vue"` 这种行（详见 §4.3 自动导入）。

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

## 4. Nuxt 的核心思想

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

| 文件名 | 行为 |
|---|---|
| `xxx.ts` | 同构：服务端和客户端都跑（SSR 时两次） |
| `xxx.client.ts` | 仅在浏览器跑（SSR 期间跳过） |
| `xxx.server.ts` | 仅在服务端跑 |

本项目用了：

- `middleware/auth.client.ts`：路由守卫只在客户端跑（SSR 时跳过，因为 SSR 取不到 localStorage 里的 user）。
- `plugins/bootstrap.client.ts`：水合 store、wire api 回调，只在浏览器执行一次。

```ts
// middleware/auth.client.ts
export default defineNuxtRouteMiddleware((to) => {
  const auth = useAuthStore();
  if (auth.user || auth.refreshToken) return;          // 放行
  return navigateTo({ path: "/login", query: { from: to.fullPath } });
});
```

页面通过 `definePageMeta({ middleware: ["auth"] })` 把守卫挂上：

```vue
<!-- pages/create.vue -->
<script setup lang="ts">
definePageMeta({ middleware: ["auth"] });
</script>
```

### 4.5 `server/` 目录天然隔离

`server/` 目录里的代码 **永远不会** 被打进客户端 bundle——Nuxt 把 `server/` 单独交给 Nitro，与 Vue 应用是两个构建图。

这等价于 Next.js 的 `import "server-only"`，但是 **目录级别的隔离**——不需要在每个文件首行加导入。客户端代码想 import `~/server/lib/security` 直接构建失败。

## 5. 数据层：Drizzle ORM + 双数据库

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

跟 Next.js 全栈版一样，手写一个简化 migrator：按文件名顺序执行 SQL，所有迁移用 `CREATE TABLE IF NOT EXISTS` 保证幂等。`./run` 启动前自动跑。

## 6. 服务端架构：`server/api/*` → `server/services/*` → `server/db/*`

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

## 7. 客户端：`api/client.ts` + `stores/*` + plugin

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

### 7.3 客户端路由守卫：`middleware/auth.client.ts`

```ts
export default defineNuxtRouteMiddleware((to) => {
  const auth = useAuthStore();
  if (auth.user || auth.refreshToken) return;
  return navigateTo({ path: "/login", query: { from: to.fullPath } });
});
```

页面通过 `definePageMeta({ middleware: ["auth"] })` 启用。和 Vue3 SPA 的 `router.beforeEach` 思路一样，但写法更分散（每个守卫一个文件，每个页面声明用哪些）。

## 8. 样式：Tailwind v4 + 设计令牌

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

## 9. Nuxt 与 Next.js 的并排对比

由于两套全栈实现解决同一个问题，最直观的学习方式是并排看：

| 维度 | Next.js | Nuxt |
|---|---|---|
| 前端框架 | React | Vue 3 |
| 服务端引擎 | Next.js Server | Nitro |
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

## 10. 「全栈」相对于「SPA + 独立后端」的差异要点

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

## 11. 常见改动指南

| 想做什么 | 改哪里 |
|---|---|
| 加一个新页面 | 新建 `pages/<路径>.vue`，自动注册路由 |
| 加一个登录后才能访问的页面 | 页面 `<script setup>` 里加 `definePageMeta({ middleware: ["auth"] })` |
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

## 12. 学到这里之后

你已经掌握了 Nuxt 全栈最常见的 80%：文件系统路由（`pages/` + `server/api/<method>.ts`）、Nitro event handler API、自动导入（components/composables/stores/Vue/h3）、`.client.ts` / `.server.ts` 环境隔离、`definePageMeta` + middleware、`defineNuxtPlugin` 启动钩子、Drizzle 双数据库、`withApi` 响应包装、`requireClaims` 鉴权、`globalThis` 单例。

下一步建议：

- 把 `nuxt.config.ts` 的 `ssr: false` 改成 `ssr: true`，看广场页是否在服务端拿到数据后再 HTML 返回——这是 Nuxt 默认能力，本项目刻意关了图对比 SPA。
- 把一个 `server/api/...` 端点的实现搬到一个 `server/middleware/*.ts` 全局中间件里，体验「每次请求都跑」的钩子（比如记请求日志）。
- 对照 `fullstacks/next` 的 `src/app/api/v1/me/route.ts` 与本仓库的 `server/api/v1/me.{get,patch}.ts`——同一份业务逻辑、两套路由约定，理解「Next 用方法名导出函数 vs Nuxt 用文件名后缀分方法」的设计取舍。
- 看 `nuxt.config.ts` 里 `nitro.preset` 能切换什么——把它改成 `"static"` 跑 `nuxt build` 看产物，理解 Nuxt 在 SSG（静态站点生成）方向的能力。

之后可以再深入研究 Nuxt 的几个常见进阶主题：SSR + Hydration、`useFetch` / `useAsyncData`（在 RSC 出来前，Nuxt 自带的服务端数据获取约定）、`server/middleware/` 中间件链、`useRuntimeConfig` 暴露安全的客户端配置、Nitro 部署 preset（Cloudflare Workers、Vercel Edge）、Nuxt Modules 生态。本项目刻意保持极简，把这些留给后续。
