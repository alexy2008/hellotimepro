# HelloTime Pro Next.js 全栈技术手册与代码导读

本文面向已经熟悉 HTML / CSS / JavaScript 基本语法，但还没系统接触过 Next.js、App Router、Server Components、Route Handlers、Drizzle ORM 这一整套「全栈」框架的读者。读完后，你应该能回答三件事：

- 用户在浏览器输入 URL 后，**前端 + 后端**代码各自按什么顺序执行。
- Next.js、App Router、Drizzle ORM、jose、Zustand 分别在做什么。
- 想新增一个页面或 API 端点时，应该改哪些文件。

> 阅读建议：第 1 节介绍技术栈与设计特色；第 2～4 节建立整体地图与入口链路；第 5 节集中讲 Next.js App Router 的几个核心思想（文件系统路由、Server vs Client、Route Handler、`server-only`）；第 6～9 节按一次请求的生命周期分层细讲；第 10 节对比全栈与 SPA 差异；第 11 节给出常见改动的步骤清单。
>
> 如果你已经读过这个项目里 **React SPA + FastAPI 后端** 两份指南，这份的核心问题就是：「在同一个 Next 进程里同时承担两边的职责，目录、依赖、运行模型有什么不一样」。这是「全栈框架」最值得理解的地方。

## 1. 技术选型与设计特色

| 角色 | 选型 | 说明 |
|---|---|---|
| 框架 | Next.js 15（App Router） | 文件系统路由；页面/API 同进程，省去 CORS |
| UI | React 19（RSC + 客户端孤岛） | 公开读页在服务端取数渲染，交互组件按需 `"use client"` |
| 客户端状态 | Zustand 5 | 轻量，无 Context Provider 包裹 |
| 数据访问 | Drizzle ORM | 双 schema（PG / SQLite），类型安全查询 |
| 鉴权 | jose（HS256 JWT）+ bcryptjs | access 存内存，refresh 存 localStorage；RSC 侧加 httpOnly session cookie |
| 样式 | Tailwind CSS v4 + 设计令牌 | 零硬编码颜色，暗/亮主题 CSS 变量 |

**与其他全栈的定位差异**：

- 对比 `fullstacks/nuxt`：同样是「Node 全栈」，但路由/组件模型用 React 而非 Vue；RSC 让服务端组件无需额外 API 调用就能取数渲染，这是 App Router 的核心卖点。
- 对比 `fullstacks/spring-mvc / rails / laravel`：Next 仍是组件化思维——UI 是 JSX，不是模板；交互靠客户端 JS 孤岛，不靠 HTMX / Hotwire / Alpine。
- **`server-only` 编译期防火墙**：`services/*`、`db/*`、`lib/server/*` 顶部 `import "server-only"`，误将其引入客户端组件会在 `next build` 阶段报错——不是运行时保护，是构建期保证。注意：`db/index.ts` 中的类型断言使用了 `any`（`eslint-disable`），以换取双驱动共用同一套 Drizzle 查询 API；「全链路类型安全」在业务代码层成立，驱动切换层有意降级。

## 2. 先建立整体地图

HelloTime Pro 是一个时间胶囊应用。**全栈 Next.js 实现把「前端 SPA」和「后端 REST API」打包成同一个 Node 进程**，前端和后端共享 TypeScript 类型、共享数据库连接、共享一份构建产物：

- `/`、`/login`、`/create`、`/me/*`、`/c/[code]` 等是 **页面**（浏览器拿到 HTML + JS）。
- `/api/v1/auth/login`、`/api/v1/plaza/capsules` 等是 **REST API**（同一进程里的 HTTP 处理函数）。
- 两边都跑在 Next dev server / `next start` 里，**没有独立后端服务**，**没有跨进程 RPC**，**没有 CORS**。

核心目录：

```text
fullstacks/next/
├── package.json              # 单一依赖图：next、drizzle、jose、bcryptjs、zustand…
├── next.config.ts            # Next 配置（基本是空的；只标 better-sqlite3 不要打包）
├── tsconfig.json             # 全栈共用 TS 配置
├── drizzle.config.ts         # drizzle-kit 配置（根据 DB_DRIVER 选 schema 与方言）
├── scripts/migrate.ts        # 一次性迁移脚本（run 不再自动调用，schema 由 ./scripts/db 管理）
├── public/                   # 静态资源（rsync 来的 SVG），Next 直接以 / 暴露
├── drizzle/{pg,sqlite}/      # 两套 SQL 迁移
├── run                       # 一键启动脚本
└── src/
    ├── app/                  # ★ App Router：文件夹结构 = URL 结构
    │   ├── layout.tsx        # 根布局（Server Component；放 <html>/<body>/Header/Footer）
    │   ├── page.tsx          # 首页（/）= 广场
    │   ├── globals.css       # 全局样式入口
    │   ├── not-found.tsx     # 404
    │   ├── login/page.tsx    # /login
    │   ├── create/page.tsx   # /create
    │   ├── c/[code]/page.tsx # /c/:code （[code] 是动态段）
    │   ├── me/layout.tsx     # /me/* 子树共享布局（含侧边栏）
    │   ├── me/created/page.tsx
    │   └── api/v1/           # ★ 同样按文件夹路由，但导出 GET/POST 函数 = REST 端点
    │       ├── health/route.ts
    │       ├── auth/login/route.ts
    │       ├── auth/refresh/route.ts
    │       ├── me/route.ts                       # 单文件导出 GET+PATCH
    │       └── plaza/capsules/route.ts
    ├── components/           # 客户端组件（"use client"）：AppHeader、CapsuleCard、AuthGate…
    ├── stores/               # Zustand 客户端状态（auth/theme/plaza/capsule）
    ├── lib/                  # 共享工具
    │   ├── api-client.ts     # 客户端 fetch 封装（自动 refresh）
    │   ├── format.ts / avatar.ts / env.ts
    │   ├── server/           # ★ 仅服务器可 import（"server-only" 标记）
    │   │   ├── envelope.ts   # 统一响应包装 + withApi 高阶封装
    │   │   ├── errors.ts     # ApiError + ERR.xxx 工厂
    │   │   ├── current-user.ts  # 解析 Authorization 头 → claims
    │   │   ├── security.ts   # bcrypt / JWT (jose) / refresh token
    │   │   ├── session.ts    # ht_session httpOnly cookie（RSC 用户识别）
    │   │   └── parse-body.ts # Zod 校验请求体
    │   └── validation/schemas.ts  # 前后端共享的 Zod 校验
    ├── services/             # 业务层（"server-only"）：auth/capsules/favorites/plaza/me/...
    ├── db/                   # Drizzle ORM
    │   ├── index.ts          # 按 DB_DRIVER 动态 import pg / better-sqlite3
    │   ├── schema-pg.ts
    │   └── schema-sqlite.ts
    ├── types/index.ts        # 与 spec/api/openapi.yaml 对齐的类型
    └── styles/               # 全局 CSS（spec/styles/* 重新 @import）
```

一次「打开广场页 + 点收藏」的端到端流向：

```text
浏览器                                      Next.js 进程（端口 7177）
  │                                            ┃
  │ GET /  （浏览器自动携带 ht_session cookie） ┃
  ├───────────────────────────────────────────►┃ matches src/app/page.tsx
  │                                            ┃ (Server Component，async function)
  │                                            ┃   → getServerViewer()（读 cookie → 解 JWT → 用户）
  │                                            ┃   → plazaList()（直接调服务层，无 HTTP）
  │                                            ┃   → db/index.ts → Drizzle → Postgres/SQLite
  │ ◄────────  含胶囊列表的完整 HTML  ──────────┃
  │ React hydrate PlazaToolbar（客户端孤岛）   ┃
  │                                            ┃
  │ 用户点「🔥 热门」→ URL 改为 /?sort=hot    ┃
  │ GET /?sort=hot  （RSC 重取，?_rsc=...）    ┃
  ├───────────────────────────────────────────►┃ re-render page.tsx（新参数）→ plazaList(hot)
  │ ◄────────  更新后的 HTML 片段  ────────────┃
  │                                            ┃
  │ 点收藏 → POST /api/v1/me/favorites         ┃
  ├───────────────────────────────────────────►┃ Route Handler → services/favorites.ts → DB
  │ ◄────────  { favoriteCount: 6 }  ─────────┃
```

> **关键洞察**：广场页和胶囊详情页是 **Server Component**——浏览器拿到的 HTML 已经包含数据，无须客户端再发 fetch 请求。`PlazaToolbar` 是客户端孤岛（`"use client"`），负责改写 URL；URL 变化触发 Next.js 向服务端请求新的 RSC 片段，服务端重新查 DB 后返回。交互型页面（登录、创建、「我的」）仍是 Client Component + `/api/v1/*`，与 React/Vue SPA 保持一致，便于多栈对比。

## 3. 如何运行和验证

```bash
cd fullstacks/next
./run                          # 开发模式，默认 PostgreSQL，端口 7177
DB_DRIVER=sqlite ./run         # 零依赖跑 SQLite
./build                        # 生产构建到 .next/
./test                         # 类型检查（教学项目；不含单测）
```

打开浏览器访问 `http://localhost:7177`。`./run` 做的事：

1. 检查 `node_modules`，没有就 `npm install`。
2. `rsync` 把仓库 `spec/icons` 和 `spec/avatars` 复制到 `public/static/`——Next 把 `public/` 目录下所有文件按根路径直接暴露（`public/static/icons/xxx.svg` ↔ `/static/icons/xxx.svg`）。
3. **`npm run build`**：生产构建——预编译全部路由，避免 dev 懒编译在 Playwright 测试中超时。
4. **`npm run start`**：以生产模式启动服务器（端口 7177）。

> **注意**：**schema 生命周期由仓库级 `./scripts/db init / reset` 管理，`./run` 不执行迁移**。首次使用前需先执行 `./scripts/db init`。需要热重载开发时改用 `npm run dev`。

与 React SPA 不同，**没有 `vite.config.ts` 的 proxy 配置**，因为前端和 API 是同一个 origin。也没有独立后端进程要起。

## 4. 入口与三类文件：`layout.tsx` / `page.tsx` / `route.ts`

App Router 的核心约定是 **文件夹即路由**，每个文件夹用 **特殊文件名** 表达不同角色：

| 文件 | 角色 | 例子 |
|---|---|---|
| `page.tsx` | 这条 URL 对应的 **页面** | `src/app/login/page.tsx` → `GET /login` 返回 HTML |
| `layout.tsx` | 这条 URL 子树共享的 **布局壳** | `src/app/me/layout.tsx` 包住 `/me/*` 所有页面 |
| `route.ts` | 这条 URL 对应的 **REST 端点** | `src/app/api/v1/health/route.ts` → 导出 `GET` 函数 |
| `not-found.tsx` | 404 兜底页 | `src/app/not-found.tsx` |
| `[xxx]` 文件夹名 | 动态路由参数 | `src/app/c/[code]/page.tsx` → `/c/AB12CDEF` |

**没有路由配置文件**——`src/app/x/y/z/page.tsx` 就是 `/x/y/z`，`src/app/api/x/route.ts` 就是 `/api/x`。

### 3.1 `src/app/layout.tsx`：根布局（Server Component）

```tsx
export const metadata = { title: "HelloTime Pro · Next", ... };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" data-theme="dark">
      <body>
        <AppHeader />
        {children}
        <AppFooter />
      </body>
    </html>
  );
}
```

要点：

- **没有 `"use client"` 指令** ⇒ 这是一个 **Server Component**（默认就是）。Server Components 只在服务端执行，渲染出 HTML 字符串发给浏览器，**它们的 JS 不会进打包产物**。
- 这一个文件取代了 React SPA 里的 `index.html` + `App.tsx` 两份文件——`<html><body>` 直接写在 JSX 里，由服务端 SSR 生成。
- `export const metadata` 让 Next 在 `<head>` 自动注入 title / favicon / og 等。**完全不需要写 `<head>`**。
- `{children}` 是 Next 给的 prop，被替换成当前路由匹配的 `page.tsx`（或更深层的 `layout.tsx` 链）。

### 3.2 `src/app/page.tsx`：广场页（Server Component）

文件**无 `"use client"` 指令**，配合 `export const dynamic = "force-dynamic"` 与 `export const runtime = "nodejs"`，这是一个 **异步 Server Component**——每次 GET `/` 时在服务端执行，渲染结果以完整 HTML 直接发给浏览器，**不需要客户端再发 fetch 请求拿列表数据**。

```tsx
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function PlazaPage({ searchParams }: Props) {
  const { sort, filter, q, page } = parseParams(await searchParams);
  const viewer = await getServerViewer();        // 读 ht_session cookie → 解 JWT → 用户
  const data = await plazaList({                 // 直接调服务层，绕过 HTTP
    sort, filter, q: q || null, page,
    pageSize: PAGE_SIZE,
    viewerId: viewer?.id ?? null,
  });
  return (
    <main className="cy-container">
      <PlazaToolbar sort={sort} filter={filter} q={q} />   {/* 客户端孤岛 */}
      <CapsuleGrid items={data.items} viewer={viewer} />
      <Pagination ... />
    </main>
  );
}
```

要点：

- **`async function Page()`**：Page 是 `async`，可以在函数体内直接 `await`，服务端渲染完整 HTML 后发送。
- **`getServerViewer()`**：读浏览器自动携带的 `ht_session` httpOnly cookie（由登录/注册 Route Handler 写入），解码 JWT 得到当前用户信息。SPA 前端把 token 存在 localStorage，RSC 在服务端无法读取 localStorage，因此需要这枚额外的 cookie（详见 §4.5）。
- **`plazaList()`**：直接 import 服务层函数，**零 HTTP 开销**——调用链：`page.tsx → services/plaza.ts → db/index.ts → Drizzle → DB`。
- **`PlazaToolbar`** 是 `"use client"` **客户端孤岛**：它接收 `sort/filter/q` 作为 prop，用户操作后通过 `router.push("/?sort=hot")` 改写 URL，Next.js 向服务端发起新的 RSC 请求（`?_rsc=...`），服务端用新参数重新查 DB 后返回 HTML 片段——**客户端无须维护 plaza 状态**。

与 React SPA 版的区别：SPA 版 `PlazaPage` 在 `useEffect` 里 `fetch /api/v1/plaza/capsules` 然后更新 Zustand store，客户端 JS 负责渲染；这里服务端直接查 DB 发完整 HTML，**无 loading 状态、无额外 fetch 延迟、首屏已含数据**。

### 3.3 `src/app/api/v1/health/route.ts`：REST 端点

```tsx
import { NextResponse } from "next/server";
import { withApi } from "@/lib/server/envelope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return withApi(async () => ({ status: "ok", service: "hellotime-pro", ... }));
}
```

关键点：

- **导出 HTTP 方法名同名的函数** = 注册这个方法的处理器。一个 `route.ts` 文件里可以 `export GET / POST / PATCH / DELETE / ...` 并存（见 `src/app/api/v1/me/route.ts`）。
- 入参是 Web 标准 `Request`（或 Next 加强版 `NextRequest`），返回 `Response`（或 `NextResponse`）——**和浏览器 fetch API 同一套类型**。
- `runtime = "nodejs"`：在 Node 运行时执行（默认；可换成 `"edge"` 跑 Edge Runtime）。
- `dynamic = "force-dynamic"`：禁用静态缓存。Next 默认对 GET 路由做激进缓存，不加这个，dev/prod 行为会不一致。
- 没有路由表，没有控制器类，没有 `app.get("/health", ...)`——文件存在就是端点存在。

### 3.4 `src/app/api/v1/me/route.ts`：单文件多方法

```tsx
export async function GET(req: NextRequest) {
  return withApi(async () => {
    const claims = requireClaims(req);
    return getMe(claims.userId);
  });
}

export async function PATCH(req: NextRequest) {
  return withApi(async () => {
    const claims = requireClaims(req);
    const body = await parseJson(req, updateProfileSchema);
    return updateProfile(claims.userId, body);
  });
}
```

`GET /api/v1/me` 与 `PATCH /api/v1/me` 共用同一个文件、共用同一段鉴权逻辑。每个方法是独立函数，请求只匹配到对应的那个。

## 5. Next.js App Router 的核心思想

### 4.1 文件系统路由：URL 不需要写代码

| URL | 文件 |
|---|---|
| `/` | `src/app/page.tsx` |
| `/login` | `src/app/login/page.tsx` |
| `/me/created` | `src/app/me/created/page.tsx`（外层套 `src/app/me/layout.tsx`） |
| `/c/AB12CDEF` | `src/app/c/[code]/page.tsx`（`params.code === "AB12CDEF"`） |
| `/api/v1/health` | `src/app/api/v1/health/route.ts` |
| `/api/v1/me/favorites/abc-123` | `src/app/api/v1/me/favorites/[capsuleId]/route.ts` |

新增页面 = 新增一个 `page.tsx`；新增 API = 新增一个 `route.ts`。

### 4.2 Server Component vs Client Component

| | Server Component | Client Component |
|---|---|---|
| 标记 | （默认） | 文件顶部 `"use client";` |
| 在哪里运行 | 只在服务端 | 服务端 SSR 一次 + 浏览器 hydrate 后接管 |
| 能不能用 `useState/useEffect` | ❌ | ✅ |
| 能不能 `import` 数据库、`process.env` | ✅ 直接读 | ❌（除非通过 API 调用） |
| 能不能 `async function Page()` | ✅ 顶层 await | ❌（要数据走 `useEffect` + fetch） |
| 打包到 JS bundle | ❌ 不进 | ✅ 进 |

广场页（`src/app/page.tsx`）和胶囊详情页（`src/app/c/[code]/page.tsx`）是 **Server Component**——直接在服务端查 DB 后发完整 HTML，无须客户端 fetch。登录、创建、「我的」等重度交互页面是 **Client Component**，因为它们依赖 Zustand store 和实时交互。`src/app/layout.tsx` 是静态 Server Component，只做 HTML 外壳与元数据。

> **可以混用**：Server Component 里可以渲染 Client Component，反过来不行（Client Component 不能直接渲染 Server Component，但可以通过 `children` prop 间接接收）。

### 4.3 `"server-only"`：编译期防火墙

```ts
// src/services/auth.ts
import "server-only";   // ← 如果有客户端模块 import 这个文件，构建直接报错
import { getCtx } from "@/db";
...
```

这是 Next 提供的「编译期防火墙」。`src/services/*`、`src/lib/server/*`、`src/db/*` 全部首行加 `import "server-only"`——保证 **数据库连接、JWT 密钥、bcrypt 这些绝对不会被打进浏览器 bundle**。

如果某个 Client Component 不小心 `import { login } from "@/services/auth"`，`next build` 会失败，明确指出问题文件。这比手动管理「哪些代码安全发到客户端」可靠得多。

### 4.4 同进程意味着没有 HTTP 也行

`src/app/api/v1/auth/login/route.ts`：

```ts
export async function POST(req: NextRequest) {
  return withApi(async () => {
    const body = await parseJson(req, loginSchema);
    return login(body);                  // ← 直接 import 业务函数调用
  }, { successStatus: 200 });
}
```

`login` 是从 `@/services/auth` 直接 import 的普通 TS 函数。**它和 route handler 在同一 Node 进程、同一调用栈里**——没有 HTTP、没有 RPC、没有序列化反序列化的开销。

理论上 Server Component 也可以这么做：

```tsx
// 假设 page.tsx 是 Server Component（去掉 "use client"）：
import { listPlaza } from "@/services/plaza";

export default async function PlazaPage() {
  const data = await listPlaza({ sort: "hot" });    // 直接读 DB
  return <CapsuleGrid items={data.items} />;
}
```

**这是「全栈框架」的最大魅力**——零网络开销、共享类型、共享事务上下文。

> **广场页和胶囊详情页已经走了这条路**：`page.tsx` 是 `async function`、直接调 `plazaList()` / `getCapsuleByCode()`——零 HTTP 开销，首屏带数据。登录、创建、「我的」等重度交互页仍保留 Client Component + `/api/v1/*` 模式，与 React/Vue SPA 保持一致便于对比。RSC 与 Client Component 在同一个 App 里混用——这正是「全栈」的最大杠杆（详见 §4.5）。

### 4.5 RSC + httpOnly Cookie：服务端识别当前用户

**问题**：RSC 在服务端执行，浏览器不会自动带上 `Authorization: Bearer` 头（那是客户端 JS 行为）。而 access token 存在 localStorage，服务端完全读不到。如何让服务端知道「当前请求是谁发的」？

**方案**：在登录 / 注册 / 刷新 Route Handler 返回 JSON 的同时，**额外写一枚 httpOnly cookie `ht_session`**，值就是 access token 本身：

```ts
// src/app/api/v1/auth/login/route.ts
const tokens = await login(body);
await setSessionCookie(tokens.accessToken, tokens.accessTokenExpiresIn);  // ← 写 cookie
return tokens;                                                               // ← 还是返回 JSON
```

浏览器在每次同源请求时自动携带所有 cookie，**包括 `GET /` 这种普通页面请求**。RSC 通过 `getServerViewer()` 读取：

```ts
// src/lib/server/session.ts
export async function getServerViewer(): Promise<ServerViewer | null> {
  const token = (await cookies()).get("ht_session")?.value;
  if (!token) return null;
  try {
    const claims = await decodeAccessToken(token);
    return { id: claims.sub, nickname: claims.nickname, avatarId: claims.avatarId };
  } catch {
    return null;          // token 过期或无效 → 匿名渲染，页面按未登录状态展示
  }
}
```

**两条鉴权路径并存，互不干扰**：

| 调用方 | 鉴权方式 | 在哪里 |
|---|---|---|
| 浏览器客户端 JS（SPA 页面） | `Authorization: Bearer <token>` | `requireClaims(req)` in Route Handler |
| RSC 服务端渲染 | `ht_session` httpOnly cookie | `getServerViewer()` in page.tsx |

`httpOnly` 意味着客户端 JS **无法通过 `document.cookie` 读到**这枚 cookie——这是额外的安全保障，XSS 无法直接窃取。

## 6. 数据层：Drizzle ORM + 双数据库

### 5.1 `src/db/index.ts`：按环境动态选驱动

```ts
import "server-only";

declare global { var __helloTimeDb: DbCtx | undefined; }

export async function getCtx(): Promise<DbCtx> {
  if (globalThis.__helloTimeDb) return globalThis.__helloTimeDb;

  if (process.env.DB_DRIVER === "sqlite") {
    const Database = (await import("better-sqlite3")).default;
    const { drizzle } = await import("drizzle-orm/better-sqlite3");
    const schema = await import("./schema-sqlite");
    const db = drizzle(new Database(path), { schema });
    return (globalThis.__helloTimeDb = { db, t: schema, kind: "sqlite" });
  } else {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const schema = await import("./schema-pg");
    const db = drizzle(new Pool({ connectionString }), { schema });
    return (globalThis.__helloTimeDb = { db, t: schema, kind: "postgres" });
  }
}
```

两个 Next.js 全栈特有的小技巧：

1. **动态 `import()`**：不要在文件顶部 `import "pg"`——SQLite 模式下会强制加载 `pg`，反之亦然。动态 import 让 Next 把两份代码拆成独立的 chunk，按需加载。
2. **`globalThis.__helloTimeDb` 单例**：Next dev 模式下 HMR 会**重新执行模块**（重新执行模块顶层的 `let db = ...` 会建一堆死连接）。挂到 `globalThis` 上能跨 HMR 保留。

`next.config.ts` 里还要把 `better-sqlite3` 列进 `serverExternalPackages`——它是原生模块，Next 默认会 bundle，bundle 之后 `.node` 文件路径就错了。

### 5.2 Drizzle Schema：TypeScript 即 SQL

```ts
// src/db/schema-pg.ts
import { pgTable, uuid, varchar, timestamp, integer, boolean, text } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 254 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 100 }).notNull(),
  nickname: varchar("nickname", { length: 20 }).notNull().unique(),
  avatarId: varchar("avatar_id", { length: 20 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull(),
});
```

- 用 TS 对象描述表，**Drizzle 自动推导出 `User` 类型**——查询返回的对象字段名、类型、可空性全自动。
- **`mode: "string"` 是关键**：让 `timestamp` 字段在 JS 侧表现成 ISO 字符串，与 SQLite 的 TEXT 时间列行为一致。两套 schema 的类型同构，业务代码无须分支。
- `schema-pg.ts` 和 `schema-sqlite.ts` 字段同名同含义，仅类型映射不同（PG `uuid` ↔ SQLite `text length=36`）。

### 5.3 业务查询：链式 + SQL 模板

```ts
// src/services/favorites.ts
const { db, t } = await getCtx();
const [capsule] = await db.select().from(t.capsules).where(eq(t.capsules.id, capsuleId));
...
await db.insert(t.favorites).values({ userId, capsuleId, createdAt: now });
await db.update(t.capsules)
  .set({ favoriteCount: sql`${t.capsules.favoriteCount} + 1` })   // ← 原子自增
  .where(eq(t.capsules.id, capsuleId));
```

- 链式 API 像 ActiveRecord，但生成的 SQL 完全可见、可日志、可断点。
- 复杂表达式用 `sql` 模板标签——它不是字符串拼接，参数会被正确占位（防注入）。
- 项目里的 `addFavorite/removeFavorite` 在代码注释里**明确写了「教学版接受非原子计数」**——没有用 `BEGIN/COMMIT` 显式事务。这是和 FastAPI/Spring Boot 版的有意差别（那些是参考实现，更严格）。

### 5.4 迁移：`scripts/migrate.ts`

```ts
const dir = process.env.DB_DRIVER === "sqlite" ? "drizzle/sqlite" : "drizzle/pg";
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
for (const f of files) {
  const sql = readFileSync(join(dir, f), "utf8");
  if (kind === "pg") await pool.query(sql);
  else db.exec(sql);
}
```

- **不用 drizzle-kit 的官方 migrator**，而是手写一个简化版：按文件名顺序执行 SQL。
- 每条迁移都用 `CREATE TABLE IF NOT EXISTS`，幂等。**注意**：`IF NOT EXISTS` 是「整条 CREATE 语句」的开关，已经存在的表里 **不会** 追加新 CHECK 约束。修改 schema 的正确做法是写新的 `0002_xxx.sql` 用 `ALTER TABLE`。
- `./run` **不再自动调用迁移**——schema 生命周期由仓库级 `./scripts/db init / reset --seed` 统一管理（见 CLAUDE.md §Commands）。首次使用前请先执行 `./scripts/db init`。如需手动运行迁移脚本，执行 `npx tsx scripts/migrate.ts`。

## 7. 服务端架构：`route.ts` → `services/*` → `db/*`

每个 Route Handler 都是这个三段式：

```text
route.ts (HTTP)              services/*.ts (业务)         db/index.ts (数据)
─────────────────────        ─────────────────────       ────────────────────
parseJson + Zod    ──┐
requireClaims      ──┤
                     ▼
withApi(() => login(body))  ──►  login(body)            ──►  getCtx() → db.select()
                                  ↓
                                 校验、hash、签 JWT      ──►  db.insert(refreshTokens)
                                  ↓
                                 抛 ApiError 或 return
                                                              
                                返回 data
                     ◄────────────┘
ok / err / status code
```

### 6.1 `withApi`：统一响应包装

```ts
// src/lib/server/envelope.ts
export async function withApi<T>(
  handler: () => Promise<T>,
  opts?: { successStatus?: number; emptyBody?: boolean },
): Promise<NextResponse> {
  try {
    const data = await handler();
    if (opts?.emptyBody) return new NextResponse(null, { status: opts.successStatus ?? 204 });
    return NextResponse.json({ success: true, data, message: null, errorCode: null },
                             { status: opts?.successStatus ?? 200 });
  } catch (e) {
    if (e instanceof ApiError) {
      return NextResponse.json({ success: false, data: null, message: e.message, errorCode: e.code, details: e.details },
                               { status: e.status });
    }
    return NextResponse.json({ success: false, ..., errorCode: "INTERNAL_ERROR" }, { status: 500 });
  }
}
```

- 所有成功响应套 `{ success: true, data, ... }`；所有失败（无论是显式抛 `ApiError` 还是未捕获异常）套 `{ success: false, message, errorCode, ... }`。
- 业务代码只管 `return data` 或 `throw ApiError.notFound(...)`，**不直接构造 Response**。这与 FastAPI 的 `ApiException` + 全局异常处理器异曲同工。

### 6.2 鉴权：`current-user.ts`

```ts
// src/lib/server/current-user.ts
import "server-only";

export function readClaims(req: NextRequest): Claims | null {
  const auth = req.headers.get("authorization");
  if (!auth) return null;
  const [scheme, token] = auth.split(" ", 2);
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return verifyAccessToken(token);     // jose JWT 验证
}

export function requireClaims(req: NextRequest): Claims {
  const c = readClaims(req);
  if (!c) throw ERR.unauthorized("缺少 access token");
  return c;
}
```

- 对于 Route Handler（REST API 端点），鉴权用 **Authorization Bearer 头**——与 React/Vue/Angular SPA 同样的契约，便于多端复用。`jose` 是现代 JWT 库，签 / 验都用 Web Crypto API；HS256 算法、密钥来自 `JWT_SECRET` 环境变量。每个需要登录的 Route Handler 都在最前面调 `requireClaims(req)`——失败 throw `ApiError`，由 `withApi` 转成 401 响应。
- 对于 RSC 页面（`page.tsx`），服务端无法读到客户端 JS 设置的 Bearer 头，改用 `getServerViewer()` 读 **`ht_session` httpOnly cookie**（`src/lib/server/session.ts`）。登录 / 注册 / 刷新 Route Handler 在返回 JSON 的同时会调用 `setSessionCookie()` 写入这枚 cookie；登出时调用 `clearSessionCookie()` 清除。详见 §4.5。

### 6.3 服务层：`services/auth.ts` 示例

```ts
export async function login(body: { email: string; password: string }): Promise<AuthTokens> {
  await rateLimit(body.email);                    // 内存版限流
  const { db, t } = await getCtx();
  const [user] = await db.select().from(t.users).where(eq(t.users.email, body.email.toLowerCase()));
  if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
    recordFailure(body.email);
    throw ERR.unauthorized("邮箱或密码错误");
  }
  return issueTokenPair(user, null);
}
```

特点：

- 业务函数是 **普通 async 函数**——可以被 Route Handler 调用，也可以被未来的 Server Component / Server Action 调用。
- 限流字典挂在 `globalThis.__helloTimeLoginFailures` 上（同 §6.1 的 HMR-safe 模式）。
- refresh token 轮转、重放检测的算法与 FastAPI/Spring Boot 版本一致——这部分代码看起来跟 Gin 或 Spring 实现的伪代码可以一对一比对。

## 8. 客户端：`api-client.ts` + `stores/*`

虽然「同一进程」，浏览器侧仍然得通过 HTTP 调 `/api/v1/*`——浏览器 JS 不能直接调用 Node 函数。

### 7.1 `src/lib/api-client.ts`

代码与 React SPA 版几乎逐行相同（**这是有意为之**）：

```ts
"use client";

const BASE = "";    // 同源，不需要拼前缀，没有代理
async function request<T>(path: string, opts) { ... }
async function tryRefresh() { ... }      // 单例 Promise 去重

export const api = {
  login: (body) => request("/api/v1/auth/login", { method: "POST", body, auth: false }),
  plaza: (q)    => request(`/api/v1/plaza/capsules?${qs}`, ...),
  ...
};
```

差异只在 `BASE = ""`——React SPA 版需要 vite proxy 把 `/api` 转发到 `:9080`，全栈版同源，原样请求就行。

### 7.2 `src/stores/auth-store.ts`

Zustand `persist` 中间件把 `user` 和 `refreshToken` 持久化到 localStorage，access token 只在内存里。模块加载时调用 `configureApi(...)` 把 store 的 getter/回调注入到 api-client（解循环依赖），跟 React SPA 一模一样。

### 7.3 `src/components/auth-gate.tsx`

```tsx
"use client";
import { useRouter, usePathname } from "next/navigation";   // ← 注意是 next/navigation，不是 next/router

export function AuthGate({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const router = useRouter();
  const pathname = usePathname();

  if (!hydrated) return null;
  if (user || refreshToken) return <>{children}</>;
  router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  return null;
}
```

- App Router 用的路由 hooks 在 `next/navigation` 包里（旧 Pages Router 是 `next/router`，别混淆）。
- 守卫策略和 React SPA 的 `AuthGate` 完全一致——`refreshToken` 在就允许进，后续 fetch 自动 refresh。

## 9. 样式：Tailwind v4 + 设计令牌

```css
/* src/app/globals.css （由 src/app/layout.tsx 顶层 import）*/
@import "tailwindcss";
@import "../../../../spec/styles/palette.css";
@import "../../../../spec/styles/tokens.css";
@import "../../../../spec/styles/cyber.css";
@import "../styles/layout.css";
```

跟 React/Vue/Angular 前端同一套设计 token 文件，做法不变：

- `spec/styles/tokens.css` 是 **设计系统的单一来源**——五个前端 + 两个全栈共用一份。
- 主题切换靠 `<html data-theme="dark|light">`。
- 组件用 `cy-*` 共享类，不允许写死颜色。
- Tailwind v4 通过 `@tailwindcss/postcss` 接入。

唯一与 SPA 版的差异：CSS 入口由 `layout.tsx` import，Next 会在 build 时合并、SSR 时把 `<link rel="stylesheet">` 注入到 `<head>`。

## 10. 「全栈」相对于「SPA + 独立后端」的差异要点

读到这里，可以总结这套全栈架构相对独立 FastAPI + React SPA 的关键差异：

| 维度 | SPA + 独立后端 | Next.js 全栈 |
|---|---|---|
| 进程 | 两个：FastAPI :29010 + Vite :7174 | 一个：Next :7177 |
| 跨域 | 需要 CORS 头 / vite proxy | 同源，无 CORS |
| 类型共享 | 前端手写一份 TS 类型对应 Python schema | 服务端业务函数与客户端调用方同仓库，可共享 Zod schema |
| 部署 | 两套构建产物，两套发布流程 | 一个产物，一个进程 |
| 数据库连接 | 后端持有，前端永远看不到 | `"server-only"` 防火墙保证不泄露 |
| 文件夹/路由 | 后端有 routes/、前端有 router.tsx | 全是 `src/app/` 文件系统 |
| 「直接读 DB」的能力 | 前端不可能 | RSC 广场/胶囊页已实现：`async function Page()` 直接调服务层 |
| HMR 单例 | 各自 reload 进程 | 需 `globalThis` 缓存防泄漏 |

## 11. 常见改动指南

| 想做什么 | 改哪里 |
|---|---|
| 加一个新页面 | 新建 `src/app/<路径>/page.tsx`，导出默认组件 |
| 加一个登录后才能访问的页面 | 同上，组件外层包 `<AuthGate>`（或在 server-side 用 `requireClaims` 守卫） |
| 加一个 REST 端点 | 新建 `src/app/api/v1/<路径>/route.ts`，导出 `GET / POST / ...` |
| 在端点里写业务逻辑 | 加到 `src/services/xxx.ts` 函数（首行 `import "server-only"`），handler 里直接 import 调用 |
| 加一张表 / 一列 | ① 编辑 `src/db/schema-{pg,sqlite}.ts`；② 新增 `drizzle/{pg,sqlite}/0002_xxx.sql`；③ 重启会自动迁移 |
| 加一个客户端状态 | `src/stores/xxx-store.ts` 用 `create(...)` 写一个 Zustand store |
| 加一个共享 UI | `src/components/Xxx.tsx`（文件首加 `"use client"`，如果用 hooks/状态） |
| 加一个共享校验 | `src/lib/validation/schemas.ts` 加 Zod schema，前后端复用 |
| 改 DB | `DB_DRIVER=sqlite ./run` |
| 改主题色 / 间距 | 修改 `spec/styles/tokens.css`，所有前端同步生效 |

## 12. 学到这里之后

你已经掌握了 Next.js App Router 全栈最常见的 80%：文件系统路由（`page.tsx` / `layout.tsx` / `route.ts` / `[param]`）、Server vs Client Component、`"server-only"` 编译期防火墙、Route Handler 写法（导出 HTTP 方法函数）、Drizzle ORM 双数据库、`withApi` 响应包装、`requireClaims` 鉴权、RSC 直接取数 + `ht_session` httpOnly cookie 识别用户、Zustand 客户端状态、`globalThis` 单例的 HMR 防御。

下一步建议：

- 参考广场页的改造，把 `/me/created`（我的胶囊）也改成 Server Component——`import { getMyCapsules } from "@/services/capsules"` 直接读 DB，移除 Zustand `capsule-store`，观察 JS bundle 体积的变化。
- 尝试 **Server Action**：把「删除胶囊」按钮改成 `"use server"` 函数，用 `<form action={deleteAction}>` 提交，无须编写专门的 Route Handler，看表单提交的生命周期怎么变。
- 把 `next.config.ts` 的 `experimental.typedRoutes` 开起来，让 `<Link href="/c/...">` 也有类型检查。
- 比较一下 `fullstacks/nuxt`，看同一份业务在 Nuxt + Nitro 上怎么写——是这个项目里最直接的「Next vs Nuxt 全栈对比」。

之后可以再深入研究 Next.js 的几个常见进阶主题：Server Actions（表单 mutation 不写 API）、Streaming + Suspense（边渲染边发）、Parallel Routes + Intercepting Routes（弹窗类高级模式）、ISR / `revalidate`（CDN 缓存策略）、Edge Runtime（部署到边缘节点）。本项目刻意保持极简，把这些留给后续。
