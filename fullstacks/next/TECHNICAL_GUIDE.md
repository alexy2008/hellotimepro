# HelloTime Pro Next.js 全栈技术手册与代码导读（2.0）

本文面向已经熟悉 HTML / CSS / JavaScript，但还没系统接触过 Next.js App Router、Route Handlers、Drizzle ORM 这一套「全栈」框架的读者。读完后，你应该能回答三件事：

- 用户在浏览器输入 URL 后，**页面 + 接口**的代码各自按什么顺序执行。
- Next.js、App Router、Drizzle ORM、jose、Zustand 分别在做什么。
- 想新增一个页面或接口时，应该改哪些文件。

> 阅读建议：第 1～3 节建立整体地图；第 4～5 节讲 App Router 的核心约定，以及本实现为什么让页面树只在客户端渲染；第 6～8 节按一次请求的生命周期讲接口层；第 9～10 节讲页面层与样式；第 11 节对比「全栈」与「SPA + 独立后端」；第 12 节是常见改动清单。
>
> 页面层的 hooks、stores、两套皮肤视图与 `frontends/react-ts` 逐文件对应，组件级的细节（Zustand store 的写法、请求序列号、受控表单、测试钩子）请直接读 [React 前端技术手册](../../frontends/react-ts/TECHNICAL_GUIDE.md)。本文只讲 Next 全栈**不一样**的部分。

## 1. 技术选型与设计特色

| 角色 | 选型 | 说明 |
|---|---|---|
| 框架 | Next.js 15（App Router） | 文件系统路由；页面与接口同一个进程，没有 CORS |
| UI | React 19 | 页面在客户端渲染（原因见第 5 节）；根布局与 `/me` 跳转是 Server Component |
| 客户端状态 | Zustand 5 | 与 React 参考前端同一套 store |
| 数据访问 | Drizzle ORM | 双 schema（PG / SQLite），类型安全查询 |
| 鉴权 | jose（HS256 JWT）+ bcryptjs | access 存内存，refresh 存 localStorage；refresh token 轮换 + 家族追踪 |
| 样式 | `spec/styles` 2.0 | 两套皮肤「时笺」「琥珀」× 明暗，原样引入，不用 Tailwind |

**与其他全栈的定位差异**：

- 对比 `fullstacks/nuxt`：同样是「Node 全栈」，路由与组件模型用 React 而不是 Vue。
- 对比 `fullstacks/spring-mvc / rails / laravel`：UI 是 JSX 组件而不是服务端模板，交互靠 React 而不是 HTMX / Hotwire / Alpine。
- **`server-only` 编译期防火墙**：`services/*`、`db/*`、`lib/server/*` 顶部 `import "server-only"`，误被客户端组件引入会在 `next build` 阶段报错，属于构建期保证。`db/index.ts` 的驱动切换层用了 `any` 断言，换取两种驱动共用同一套 Drizzle 查询 API；业务代码这一层的类型是完整的，驱动切换层有意放宽了类型。

## 2. 先建立整体地图

**Next.js 全栈把「前端 SPA」和「后端 REST API」打包成同一个 Node 进程**，两边共享 TypeScript 类型、共享一份构建产物：

- `/`、`/open`、`/capsules/[code]`、`/create`、`/me/*` 等是**页面**。
- `/api/v1/auth/login`、`/api/v1/plaza/stats` 等是**接口**（同一进程里的 HTTP 处理函数）。
- 两边都由 `next start` 提供服务：没有独立后端，也没有 `:9080` 反代和 CORS。

```text
fullstacks/next/
├── package.json              # 单一依赖图：next、react、drizzle、jose、bcryptjs、zustand、@fontsource…
├── next.config.ts            # better-sqlite3 标为服务端外部包（原生模块不能打包）
├── run / build / test        # 端口 7177；run = 同步静态资源 + next build + next start
├── public/static/            # run 从 spec/avatars/v2、spec/icons 同步过来，按 /static/* 暴露
└── src/
    ├── app/                  # ★ App Router：文件夹结构 = URL 结构
    │   ├── layout.tsx        # 根布局（Server Component）
    │   ├── styles.css        # spec/styles 入口；app.css 是本实现唯一的样式胶水
    │   ├── page.tsx · open/ · about/ · login/ · register/ · create/
    │   ├── capsules/[code]/page.tsx   # [code] 是动态段
    │   ├── me/page.tsx       # /me → /me/created（服务端 redirect）
    │   ├── me/[tab]/page.tsx # /me/created | favorites | profile
    │   ├── not-found.tsx
    │   └── api/v1/**/route.ts        # ★ 同样按文件夹路由，导出 GET/POST… 就是接口
    ├── services/             # 业务层（server-only）
    ├── db/                   # Drizzle：index.ts（选驱动 + withTx）、schema-pg.ts、schema-sqlite.ts
    ├── lib/
    │   ├── server/           # ★ 仅服务端：envelope · errors · current-user · security · ids · avatar-catalog · parse-body
    │   ├── validation/       # Zod 请求体校验
    │   ├── router.tsx        # 导航适配层（第 9.2 节）
    │   └── avatars.ts · fmt.ts · icons.tsx · palette.ts · about.ts · redirect.ts
    ├── components/           # ClientRoot · App · AppLayout + 与 react-ts 相同的共享部件
    ├── views/                # 路由入口组件（按皮肤挑视图）
    ├── hooks/ · stores/ · skins/{paper,amber}/ · api/client.ts   # 与 react-ts 相同
    └── types/index.ts        # 前后端共用的 openapi 2.0.0 类型
```

一次「打开首页 + 点收藏」的端到端流向：

```text
浏览器                                         Next.js 进程（:7177）
  │ GET /                                         ┃
  ├──────────────────────────────────────────────►┃ app/layout.tsx（Server Component）
  │                                               ┃   读 spec/avatars/v2 → 头像表
  │ ◄── HTML 骨架：<head> 首帧脚本 + 样式 ───────  ┃   页面本体不在服务端渲染
  │ 首帧脚本从 localStorage 写好 data-skin/theme   ┃
  │ JS 加载 → ClientRoot 挂载 App → 按皮肤渲染首页 ┃
  │                                               ┃
  │ GET /api/v1/plaza/capsules?…、/plaza/stats    ┃
  ├──────────────────────────────────────────────►┃ Route Handler → services/plaza.ts → Drizzle → DB
  │ ◄── { success, data, … } ─────────────────────┃
  │                                               ┃
  │ 点收藏 → POST /api/v1/me/favorites            ┃
  ├──────────────────────────────────────────────►┃ requireClaims → services/favorites.ts（withTx）
  │ ◄── { capsuleId, favoriteCount, favoritedAt } ┃
```

## 3. 如何运行和验证

```bash
./scripts/db init                 # 仓库根目录：建表（schema 生命周期在实现之外）
./scripts/hello start next        # 推荐：dev-manager 注入 DB / LLM 配置

cd fullstacks/next
./run                             # 默认 PostgreSQL
DB_DRIVER=sqlite ./run            # 使用 data/sqlite/hellotime-next.db
./build                           # 生产构建到 .next/
./test                            # tsc --noEmit
```

`./run` 做的事：

1. 没有 `node_modules` 就 `npm install`。
2. 把 `spec/icons`、`spec/avatars/v2` 同步到 `public/static/`。Next 把 `public/` 下的文件按根路径直接暴露（`public/static/icons/x.svg` ↔ `/static/icons/x.svg`），关于页与页脚的技术栈图标就是从这里加载的。
3. `npm run build` 后 `npm run start`。用生产构建而不是 dev，是为了预编译全部路由，避免 dev 的懒编译在 Playwright 的超时窗口里还没完成。

验证（契约会先重置 `DB_URL` 指向的库，多人并行时用独立库，见升级指南第 4 节）：

```bash
./verification/scripts/verify-contract.sh next          # 契约 117 条
./verification/scripts/verify-ui-smoke.sh next          # UI 冒烟 44 条 × 两套皮肤
./verification/scripts/verify-design-tokens.sh next     # 自己的样式只用语义令牌
```

## 4. App Router 的三类文件：`layout.tsx` / `page.tsx` / `route.ts`

App Router 的核心约定是**文件夹即路由**，用特殊文件名表达不同角色：

| 文件 | 角色 | 本实现里的例子 |
|---|---|---|
| `layout.tsx` | URL 子树共享的布局壳 | `src/app/layout.tsx`（全站唯一一个） |
| `page.tsx` | 这条 URL 的页面 | `src/app/capsules/[code]/page.tsx` → `/capsules/AB12CDEF` |
| `route.ts` | 这条 URL 的接口 | `src/app/api/v1/plaza/stats/route.ts` → `GET /api/v1/plaza/stats` |
| `not-found.tsx` | 404 兜底 | 未匹配的 URL 渲染它，HTTP 状态码 404 |
| `[xxx]` 文件夹 | 动态段 | `me/[tab]`、`api/v1/me/favorites/[capsuleId]` |

**没有路由配置文件**：React 版的 `router.tsx` 在这里变成了 `src/app/` 下的目录结构。

### 4.1 `page.tsx`：每条路由一个很薄的入口

```tsx
// src/app/me/[tab]/page.tsx
import { AuthGate } from "@/components/AuthGate";
import { MePage } from "@/views/MePage";

export default function Page() {
  return (
    <AuthGate>
      <MePage />
    </AuthGate>
  );
}
```

`page.tsx` 本身是 Server Component（没有 `"use client"`），只负责把对应的视图组件放进来；需要登录的路由外面包 `AuthGate`，对应 React 版路由表里的 `gated(...)`。`views/*` 和 `AuthGate` 顶部有 `"use client"`，它们和它们引入的一切都属于客户端。

`/me` 不需要客户端参与，直接用服务端重定向：

```tsx
// src/app/me/page.tsx
import { redirect } from "next/navigation";
export default function Page() {
  redirect("/me/created");
}
```

### 4.2 `route.ts`：导出 HTTP 方法名就是注册处理器

```ts
// src/app/api/v1/me/stats/route.ts
export async function GET(req: NextRequest) {
  return withApi(async () => {
    const claims = await requireClaims(req);
    return myStats(claims.id);
  });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
```

- 一个 `route.ts` 可以同时导出 `GET / POST / PATCH / DELETE`（见 `api/v1/me/route.ts`）。
- 入参是 Web 标准的 `Request`（Next 增强版 `NextRequest`），返回 `Response`，与浏览器的 fetch API 是同一套类型。
- 动态段从第二个参数取，Next 15 起 `params` 是 Promise：`const { id } = await ctx.params`。
- `dynamic = "force-dynamic"` 关掉 GET 路由的静态缓存；`runtime = "nodejs"` 保证能用 `fs`、`pg`、`better-sqlite3`。

## 5. 为什么页面树只在客户端渲染

App Router 默认希望页面在服务端渲染（Server Component 直接查数据库、首屏带数据）。1.x 的广场和详情就是这么做的，靠登录时额外写一枚 httpOnly cookie 让服务端认出用户。2.0 放弃了这条路，原因在皮肤：

- 皮肤与明暗存在浏览器的 `localStorage`（`hellotime.skin` / `hellotime.theme`），服务端读不到；UI 冒烟也只通过 `localStorage` 预置皮肤。
- 两套皮肤不只是换颜色：首页、卡片、详情、创建、账号页的 DOM 结构都不同（`skins/paper` 与 `skins/amber` 各一份）。
- 服务端如果按默认皮肤渲染，浏览器里用的却是另一套，React 水合时会发现 DOM 对不上，用户还会先看到另一套皮肤闪一下。

所以本实现的分工是：

```text
app/layout.tsx（Server Component，服务端执行）
  ├── <head>：viewport、theme-color、首帧内联脚本（从 localStorage 写好 data-skin / data-theme）
  ├── import "./styles.css"（两套皮肤的样式都加载，靠 :root[data-skin] 区分）
  └── <ClientRoot avatars={avatarCatalog()}>{children}</ClientRoot>
        │  next/dynamic(() => import("@/components/App"), { ssr: false })
        ▼
      components/App.tsx（只在浏览器执行）
        ├── 模块顶层：useAuth.getState().hydrate()   ← 登录态在首次渲染前恢复
        ├── registerAvatars(avatars)                  ← 服务端读好的头像表
        └── <Layout>{children}</Layout>               ← 按皮肤挑页头 / 页脚 / 底栏
```

服务端仍然做它擅长、又不依赖皮肤的事：

- **读仓库文件**：`lib/server/avatar-catalog.ts` 在服务端读 `spec/avatars/v2/catalog.json` 和每个 SVG 的内层路径，作为 props 交给客户端。头像必须内联进 DOM 才能被皮肤样式上色（`<img>` 里的 `currentColor` 只会是黑色）。React 版用 Vite 的 `import.meta.glob(…, { query: "?raw" })` 在构建期内联，这里换成「Server Component 读文件 → props 下发」。
- **重定向**：`/me` → `/me/created`。
- **404**：未匹配路由由 `not-found.tsx` 兜底，响应码是真正的 404。
- **整个 `/api/v1`**。

> 一个容易踩的坑：页面组件虽然只在浏览器里渲染，`next build` 预渲染时仍会**加载**它们的模块图。所以客户端模块的顶层代码不能直接碰 `document` / `window`。`stores/ui.ts` 在 zustand 初始化时读 `<html>` 的属性，这里加了 `typeof document !== "undefined"` 判断。

## 6. 数据层：Drizzle ORM + 双数据库

### 6.1 `src/db/index.ts`：按环境动态选驱动

```ts
async function build(): Promise<Handle> {
  if (process.env.DB_DRIVER === "sqlite") {
    const Database = (await import("better-sqlite3")).default;
    const { drizzle } = await import("drizzle-orm/better-sqlite3");
    // DB_URL 是 sqlite:////绝对路径 或 file:路径：恰好去掉 sqlite:/// 或 file: 前缀
    ...
  }
  const { Pool } = await import("pg");
  const { drizzle } = await import("drizzle-orm/node-postgres");
  ...
}

export async function getCtx() { /* { db, t, kind } */ }
```

- **动态 `import()`**：SQLite 模式下不加载 `pg`，反之亦然。
- **`globalThis.__helloTimeDb` 单例**：Next dev 的 HMR 会重新执行模块，挂到 `globalThis` 上避免每次重载都新建连接。
- `next.config.ts` 把 `better-sqlite3` 列进 `serverExternalPackages`：它是原生模块，被打包后 `.node` 文件路径会错。

### 6.2 两套 schema，同名同形

`schema-pg.ts` 用原生 `uuid` / `timestamptz`，`schema-sqlite.ts` 用 `TEXT`；字段名与含义完全相同，`timestamp` 配 `mode: "string"` 让两边在 JS 里都是字符串，业务代码不用按驱动分支。

### 6.3 跨库归一：`lib/server/ids.ts`

两种数据库读回来的值长得不一样，种子数据和应用写入的格式也不一样：

| | PostgreSQL | SQLite（种子） | SQLite（应用写入） |
|---|---|---|---|
| 主键 | `xxxxxxxx-xxxx-…` | 32 位十六进制，无连字符 | `xxxxxxxx-xxxx-…` |
| 时间 | `2026-01-01 00:00:00+00` | `2026-01-01T00:00:00+00:00` | `2026-01-01T00:00:00.000Z` |

约定：

- **输出**一律 `dashed(id)` 与 `iso(time)`（`new Date(v).toISOString()`）。
- **按外部 id 查找**用 `inArray(t.capsules.id, idCandidates(id, kind))`，SQLite 下两种写法都匹配；写外键（收藏、删除）用查到的原始主键。
- **校验**：路径和请求体里的胶囊 id 先过 `requireUuid`，格式不合法 → 422 `VALIDATION_ERROR`，不让解析错误掉进通用处理器变成 500。
- **开启时间上限**：`addCalendarYears(now, 10)`——10 个日历年，目标年没有 2 月 29 日时取 2 月 28 日（`Date` 会把它进位成 3 月 1 日，要显式回退）。

### 6.4 事务：`withTx`

收藏、取消收藏、删除胶囊都是「先读后写」，需要在一个事务里完成：

```ts
export async function deleteOwnCapsule(userId: string, capsuleId: string) {
  requireUuid(capsuleId, "id");
  await withTx(async (ctx) => {
    const c = await lockCapsule(ctx, capsuleId);          // PG：SELECT … FOR UPDATE（只锁胶囊行）
    if (!c) throw ERR.notFound("胶囊不存在");
    if (c.ownerId !== userId) throw ERR.forbidden("无权删除他人胶囊");
    await ctx.db.delete(ctx.t.favorites).where(eq(ctx.t.favorites.capsuleId, c.id));  // 显式先删收藏
    await ctx.db.delete(ctx.t.capsules).where(eq(ctx.t.capsules.id, c.id));
  });
}
```

- **PostgreSQL**：`db.transaction(async (tx) => …)`。三个操作的加锁顺序都是「胶囊 → 收藏」，作者删除与别人取消收藏并发时不会死锁。
- **SQLite**：Drizzle 的 better-sqlite3 事务**只接受同步回调**，传 async 函数会在第一个 `await` 之前就提交。`withTx` 改用进程内队列串行化，并用 `BEGIN IMMEDIATE` 一开始就拿写锁（避免读锁升级成写锁时 `SQLITE_BUSY`），出错 `ROLLBACK`。
- 删除不依赖外键级联：SQLite 没开 `foreign_keys` 时级联不生效，所以显式先删收藏。

### 6.5 业务查询：链式 API + `sql` 模板

```ts
// services/plaza.ts：q 按字面匹配（% 和 _ 不是通配符）
const literal = q.toLowerCase().replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
const pattern = `%${literal}%`;
or(
  sql`lower(${t.capsules.title}) like ${pattern} escape '\\'`,
  sql`lower(${t.users.nickname}) like ${pattern} escape '\\'`,
);
```

`sql` 模板不是字符串拼接，`${pattern}` 会成为参数占位符。统计接口里的条件计数写成 `coalesce(sum(case when … then 1 else 0 end), 0)`，两种方言通用，空集也落成 0；最远 / 最近开启时刻用 `ORDER BY open_at … LIMIT 1` 取列，而不是 `MAX/MIN` 聚合（SQLite 下聚合结果会丢掉列类型）。

## 7. 接口层：`route.ts` → `services/*` → `db/*`

```text
route.ts（HTTP）             services/*.ts（业务）          db/index.ts（数据）
parseJson + Zod     ──┐
requireClaims       ──┤
                      ▼
withApi(() => addFavorite(...)) ──► addFavorite           ──► withTx → lockCapsule → insert/update
                                     抛 ApiError 或 return
◄── ok / err 包装、状态码 ───────────┘
```

### 7.1 `withApi`：统一响应包装

`lib/server/envelope.ts` 的 `withApi(handler, { successStatus, emptyBody })`：成功时套 `{ success: true, data, message: null, errorCode: null }`，抛出 `ApiError` 时套 `{ success: false, data: null, message, errorCode, details? }` 并用对应状态码，其他异常一律 `INTERNAL_ERROR` 500。业务代码只管 `return data` 或 `throw ERR.notFound(...)`，与 FastAPI 的 `ApiException` + 全局异常处理器是同一个思路。

### 7.2 鉴权：`current-user.ts`

- `readClaims(req)`：读 `Authorization: Bearer`，用 jose 验证 HS256 JWT；过期返回 `UNAUTHORIZED` + `access_token_expired`，客户端据此刷新后重放。
- `requireClaims(req)`：需要登录的接口第一行调用，没有 token 抛 401。
- 页面层不需要服务端识别用户（第 5 节），所以 1.x 的 `ht_session` cookie 已经删掉，接口层只有 Bearer 这一条通道。

### 7.3 2.0 的接口变化落在哪里

| 清单条目 | 位置 |
|---|---|
| `health.version = "2.0.0"` | `lib/env.ts`（固定值，不再读环境变量） |
| `GET /plaza/stats`、`GET /me/stats` | `services/plaza.ts` 的 `plazaStats` / `myStats` |
| 收藏不校验状态（自己的、未公开的都能收藏） | `services/favorites.ts` |
| 「我创建的」照常计算 `favoritedByMe` | `services/plaza.ts` 的 `myCapsules` |
| 删除连带删收藏、PG 加锁顺序 | `services/capsules.ts` 的 `deleteOwnCapsule` + `db/index.ts` 的 `withTx` |
| `openAt` 上限 10 个日历年 | `services/capsules.ts` + `lib/server/ids.ts` 的 `addCalendarYears` |
| `q` 字面匹配 | `services/plaza.ts` 的 `queryCond` |
| 路径 UUID → 422 | `lib/server/ids.ts` 的 `requireUuid`；请求体走 `validation/schemas.ts` |
| 头像读 `spec/avatars/v2` | `services/avatars.ts`、`lib/server/avatar-catalog.ts`、`run` / `build` |

## 8. `server-only` 与同进程

```ts
// src/services/auth.ts
import "server-only";   // 客户端模块 import 这个文件，next build 直接失败
```

`services/*`、`lib/server/*`、`db/*` 首行都有这句，数据库连接、JWT 密钥、bcrypt 不会被打进浏览器 bundle。Route Handler 调业务函数就是普通的函数调用——同一进程、同一调用栈，没有 HTTP、RPC 或序列化开销。

## 9. 页面层：把 React 参考前端搬进 App Router

### 9.1 哪些文件与 react-ts 相同

`hooks/`、`stores/`、`skins/paper|amber/`、`components/`（除 `ClientRoot`、`App`、`AppLayout`）、`api/client.ts` 与 `frontends/react-ts/src` 下的同名文件逐文件对应，差别只有：

- 导入路径：`react-router-dom` → `@/lib/router`；
- 关于页「前端」卡片：展示 Next.js / React / TypeScript / Zustand，源码路径写 `fullstacks/next`；
- `stores/ui.ts` 加了 SSR 判断（第 5 节）；`lib/avatars.ts` 改为运行时登记（第 5 节）。

业务逻辑全在 hooks 与 stores 里：草稿按账号保存、创建路由持有提交锁与回执、AI 代笔可被手动编辑打断、表单值和广场搜索跨皮肤保留、「我的」列表按实际条数续页、详情到点后以服务端 `isOpened` 为准退避重试、8 格输码按路由保存……这些都是升级指南第 2 节的清单，原样继承。逐条讲解见 React 手册第 10、11 节。

`views/*` 是路由入口（React 版的 `pages/`）：按当前皮肤挑 `skins/paper` 或 `skins/amber` 的视图。目录不能叫 `pages/`——那是 Next Pages Router 的保留目录，放在里面的文件会被当成路由。

### 9.2 导航适配层 `lib/router.tsx`

| React 版用法 | 适配到 |
|---|---|
| `<Link to="/x">` | `next/link` 的 `<Link href="/x">` |
| `useNavigate()(to, { replace })` | `useRouter().push / replace` |
| `useLocation()` → `{ pathname, search }` | `usePathname()` + `useSearchParams()` |
| `useParams()` | `next/navigation` 的 `useParams()` |
| `<Navigate to replace />` | effect 里 `router.replace(to)` |

两个细节：

- `next/link` 和 react-router 一样，`onClick` 里调用 `preventDefault()` 后就不会跳转。所以 `CreateLink` 的「匿名点创建先弹确认框，确认后再去登录页」不用改。
- **首帧守卫**：升级指南提到，路由器还没开始监听 history 时调用 `navigate()`，只会改地址栏、页面不切。这里整棵树在 App Router 水合之后才挂载，`AuthGate` / 登录页的 `<Navigate>` 在 effect 里执行时路由器已经就绪。已在浏览器核实：匿名直接打开 `/create` 会真正渲染登录页。

### 9.3 总布局与外壳

`components/AppLayout.tsx` 与 React 版 `app/Layout.tsx` 相同：按皮肤挑页头 / 页脚 / 底栏，`main#view` 放页面（这里是 App Router 传进来的 `children`），路由名写到 `body[data-route]`。根布局与 `ClientRoot` 在路由切换时不会重新挂载，所以外壳、Toast、确认框和所有 store 状态都保持不变。

## 10. 样式：`spec/styles` 原样引入

```css
/* src/app/styles.css（由 app/layout.tsx 引入） */
@import "@fontsource/noto-serif-sc/400.css";       /* 时笺字体自托管 */
...
@import "../../../../spec/styles/base.css";
@import "../../../../spec/styles/paper/tokens.css";
@import "../../../../spec/styles/paper/components.css";
@import "../../../../spec/styles/paper/pages.css";
@import "../../../../spec/styles/amber/tokens.css";
@import "../../../../spec/styles/amber/components.css";
@import "../../../../spec/styles/amber/pages.css";
@import "../../../../spec/styles/shell.css";
@import "./app.css";
```

- 两套皮肤的规则都限定在 `:root[data-skin=…]` 下，可以同时加载；换皮肤、换明暗只改 `<html>` 上的两个属性（View Transition 过渡，减少动效时直接切）。
- Next 的 CSS 管线能解析仓库外的相对路径和 `@fontsource` 裸包名，不需要把 `spec/styles` 复制进来。
- 自己的样式只有 `app/app.css` 里的「加载更多」一条，只用 `base.css` 刻度；`verify-design-tokens.sh next` 检查不写色值、不引用非公开令牌。
- 根布局给 `<html>` 加了 `suppressHydrationWarning`：首帧脚本会在水合前改写 `data-skin` / `data-theme`，这是预期的不一致。

## 11. 「全栈」相对于「SPA + 独立后端」

| 维度 | React SPA + FastAPI | Next.js 全栈 |
|---|---|---|
| 进程 | 两个：FastAPI :29010 + Vite :7174（经 :9080 反代） | 一个：Next :7177 |
| 跨域 | Vite proxy / 反代 | 同源 |
| 路由表 | `router.tsx` | `src/app/` 目录结构 |
| 首帧脚本 | `index.html` 内联 `<script>` | `app/layout.tsx` 的 `<head>` 内联 `<script>` |
| 头像 SVG 内联 | Vite `import.meta.glob` 构建期内联 | Server Component 读文件 → props 下发 |
| 类型 | 前端手写 TS 类型对应 Python schema | `types/index.ts` 前后端共用一份 |
| 数据库连接 | 后端持有 | `server-only` 防火墙保证不进浏览器 |
| HMR 单例 | 各自重启进程 | `globalThis` 缓存防连接泄漏 |

## 12. 常见改动指南

| 想做什么 | 改哪里 |
|---|---|
| 加一个页面 | `src/views/XxxPage.tsx`（`"use client"`，按皮肤挑视图）+ `src/app/<路径>/page.tsx` 引入它 |
| 加一个需要登录的页面 | 同上，`page.tsx` 里外面包 `<AuthGate>` |
| 加一个接口 | `src/app/api/v1/<路径>/route.ts` 导出 `GET / POST / …`，业务写进 `src/services/*.ts`（首行 `import "server-only"`） |
| 加请求体校验 | `src/lib/validation/schemas.ts` 加 Zod schema，route 里 `parseJson(req, schema)` |
| 先读后写的业务 | 包进 `withTx`，按外部 id 查找用 `idCandidates`，输出用 `dashed` / `iso` |
| 加一个客户端状态 | `src/stores/` 用 `create(...)`；顶层别直接碰 `document` / `window` |
| 改皮肤视图 | `src/skins/paper|amber/`，与 `frontends/react-ts` 同步修改 |
| 换数据库 | `DB_DRIVER=sqlite ./run` |
| 改颜色 / 间距 | 改 `spec/styles`（所有实现同步生效），实现里不写色值 |

下一步可以对比 `fullstacks/nuxt`：同一份业务在 Nuxt + Nitro 上怎么组织，皮肤又是怎么处理的。
