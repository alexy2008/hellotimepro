# HelloTime Pro Next.js 全栈技术手册与代码导读（2.0）

本文面向已经熟悉 HTML / CSS / JavaScript，但还没系统接触过 Next.js App Router、Route Handlers、Drizzle ORM 这一套「全栈」框架的读者。读完后，你应该能回答三件事：

- 用户在浏览器输入 URL 后，**页面 + 接口**的代码各自按什么顺序执行。
- Next.js、App Router、Drizzle ORM、jose、Zustand 分别在做什么。
- 想新增一个页面或接口时，应该改哪些文件。

> 阅读建议：第 1～3 节建立整体地图；第 4～5 节讲 App Router 的核心约定，以及 Server Component 与 Client Component 怎么分工、两套皮肤和登录态怎么与服务端渲染相处；第 6～8 节按一次请求的生命周期讲接口层；第 9～10 节讲页面层与样式；第 11 节对比「全栈」与「SPA + 独立后端」；第 12 节是常见改动清单。
>
> 页面层的 hooks、stores、两套皮肤视图与 `frontends/react-ts` 逐文件对应，组件级的细节（Zustand store 的写法、请求序列号、受控表单、测试钩子）请直接读 [React 前端技术手册](../../frontends/react-ts/TECHNICAL_GUIDE.md)。本文只讲 Next 全栈**不一样**的部分。

## 1. 技术选型与设计特色

| 角色 | 选型 | 说明 |
|---|---|---|
| 框架 | Next.js 15（App Router） | 文件系统路由；页面与接口同一个进程，没有 CORS |
| UI | React 19 | 页面服务端渲染：`layout.tsx` / `page.tsx` 是 Server Component（读 Cookie、调 services 取数），皮肤视图是参与 SSR 的 Client Component（第 5 节） |
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
    │   ├── layout.tsx        # 根布局（Server Component）：读偏好 Cookie，渲染 <html data-skin data-theme> 与应用外壳
    │   ├── styles.css        # spec/styles 入口；app.css 是本实现唯一的样式胶水
    │   ├── page.tsx          # /：async Server Component，服务端取广场第一屏
    │   ├── about/            # /about：服务端取 /health 技术栈
    │   ├── open/ · login/ · register/ · create/
    │   ├── capsules/[code]/page.tsx   # [code] 是动态段；服务端取胶囊 + generateMetadata
    │   ├── me/page.tsx       # /me → /me/created（服务端 redirect）
    │   ├── me/[tab]/page.tsx # /me/created | favorites | profile
    │   ├── not-found.tsx
    │   └── api/v1/**/route.ts        # ★ 同样按文件夹路由，导出 GET/POST… 就是接口
    ├── services/             # 业务层（server-only）
    ├── db/                   # Drizzle：index.ts（选驱动 + withTx）、schema-pg.ts、schema-sqlite.ts
    ├── lib/
    │   ├── server/           # ★ 仅服务端：page-data（页面取数）· envelope · errors · current-user · security · ids · avatar-catalog · parse-body
    │   ├── preferences.ts    # 皮肤 / 明暗的 localStorage + Cookie 约定与首帧脚本
    │   ├── validation/       # Zod 请求体校验
    │   ├── router.tsx        # 导航适配层（第 9.2 节）
    │   └── avatars.ts · fmt.ts · icons.tsx · palette.ts · about.ts · redirect.ts
    ├── components/           # App（客户端应用根）· AppLayout + 与 react-ts 相同的共享部件
    ├── views/                # 路由入口组件（按皮肤挑视图）
    ├── hooks/ · stores/ · skins/{paper,amber}/ · api/client.ts   # 与 react-ts 相同
    └── types/index.ts        # 前后端共用的 openapi 2.0.0 类型
```

一次「打开首页 + 点收藏」的端到端流向：

```text
浏览器                                         Next.js 进程（:7177）
  │ GET /   Cookie: ht-skin=paper; ht-theme=light ┃
  ├──────────────────────────────────────────────►┃ app/layout.tsx（Server Component）
  │                                               ┃   读 Cookie → <html data-skin="paper" data-theme="light">
  │                                               ┃   读 spec/avatars/v2、/health 技术栈
  │                                               ┃ app/page.tsx（async Server Component）
  │                                               ┃   直接调 services/plaza.ts（匿名）→ Drizzle → DB
  │                                               ┃   把第一屏作为 props 交给 views/PlazaPage
  │ ◄── 完整 HTML：时笺皮肤的首页，卡片、统计都在 ─ ┃   Client Component 也在服务端渲染成 HTML
  │ 首帧脚本核对 localStorage（一致 → 什么都不改）  ┃
  │ JS 加载 → React 水合（复用服务端 DOM）          ┃
  │ 水合后从 localStorage 恢复登录态                ┃
  │ 已登录：GET /api/v1/plaza/capsules（带令牌）    ┃
  ├──────────────────────────────────────────────►┃ Route Handler → services/plaza.ts → 补上 favoritedByMe
  │                                               ┃
  │ 点收藏 → POST /api/v1/me/favorites            ┃
  ├──────────────────────────────────────────────►┃ requireClaims → services/favorites.ts（withTx）
  │ ◄── { capsuleId, favoriteCount, favoritedAt } ┃
```

页面取数与接口复用同一层 `services/*`：Server Component 调它是同进程函数调用（不绕 HTTP），Route Handler 调它再包一层响应信封。

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

### 4.1 `page.tsx`：Server Component 入口

公开页的 `page.tsx` 是 async Server Component：在服务端直接调 services 取数，把结果作为 props 交给客户端视图。

```tsx
// src/app/capsules/[code]/page.tsx（节选）
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const seed = await loadCapsuleSeed(code);       // React cache()：与下面的页面共用一次查询
  if (seed?.status === "ok") return { title: `${seed.capsule.title} · HelloTime Pro`, … };
  …
}

export default async function Page({ params }: Props) {
  const { code } = await params;
  return <CapsuleByCodePage initial={await loadCapsuleSeed(code)} />;
}
```

- `lib/server/page-data.ts`（`server-only`）集中放页面取数：`loadPlazaSeed()`（广场默认查询的列表、数量、年鉴、精选）、`loadCapsuleSeed(code)`（查到 / 查无此码 / 其他失败交给客户端重取）、`loadHealth()`。
- `generateMetadata` 给胶囊详情生成标题与描述：已开启用正文摘要，未开启只写「谁封存、哪天开启」，不泄露正文；查无此码也有标题。
- 静态标题用 `export const metadata`，客户端内导航时 Next 会自动换 `document.title`，视图里不再手写。
- 需要登录的路由外面包 `AuthGate`，对应 React 版路由表里的 `gated(...)`：

```tsx
// src/app/me/[tab]/page.tsx
export const metadata: Metadata = { title: "我的 · HelloTime Pro" };
export default function Page() {
  return (
    <AuthGate>
      <MePage />
    </AuthGate>
  );
}
```

`views/*` 和 `AuthGate` 顶部有 `"use client"`：它们和它们引入的一切是 Client Component——**仍然在服务端渲染成 HTML**，只是到了浏览器还要水合、能用 state 和 effect。`/me` 不需要客户端参与，直接用服务端 `redirect("/me/created")`。

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

## 5. 服务端渲染：Server / Client 组件分工

Next 官方推荐的模型是「Server Component 取数 + 叶子上的 Client Component 负责交互」。本实现照此组织；难点在于有三样东西只存在浏览器里——皮肤与明暗（localStorage）、登录态（localStorage 里的 refresh token）、此刻（两边的 `Date.now()` 不同）。下面逐个说明它们怎么和 SSR 相处。

```text
app/layout.tsx（Server Component）
  ├── await cookies() → prefs = { skin, theme }（ht-skin / ht-theme，缺省琥珀 · 星夜）
  ├── <html data-skin data-theme>、theme-color、首帧内联脚本（lib/preferences.ts）
  ├── import "./styles.css"（两套皮肤的样式都加载，靠 :root[data-skin] 区分）
  └── <App avatars prefs health serverNow>          ← components/App.tsx，"use client"，参与 SSR
        ├── UiSeedContext = prefs                    ← 服务端渲染与水合时 useUi 读它
        ├── NowSeedContext = serverNow               ← 服务端渲染与水合时 useNow 读它
        ├── HealthContext = health                   ← 页脚、关于页的技术栈
        ├── useLayoutEffect：useAuth.hydrate()       ← 水合后恢复登录态
        └── <Layout>{children}</Layout>              ← 按皮肤挑页头 / 页脚 / 底栏
              └── app/*/page.tsx（Server Component）→ views/*（Client Component）→ skins/*
```

| 文件 | 类型 | 服务端做什么 |
|---|---|---|
| `app/layout.tsx` | Server | 读 Cookie 定皮肤与明暗；读头像表与 `/health`；记下渲染时刻 |
| `app/page.tsx` | Server（async） | `loadPlazaSeed()`：广场第一屏（匿名） |
| `app/capsules/[code]/page.tsx` | Server（async） | `loadCapsuleSeed()` + `generateMetadata` |
| `app/about/page.tsx` | Server（async） | `loadHealth()` |
| `app/me/page.tsx` | Server | `redirect("/me/created")` |
| `app/{open,login,register,create,me/[tab]}/page.tsx` | Server | 只给 `metadata`，内容交给客户端视图 |
| `components/App.tsx`、`AppLayout.tsx`、`views/*`、`skins/*` | Client | 照常在服务端渲染成 HTML，浏览器里水合 |

### 5.1 皮肤与明暗：Cookie 给服务端，localStorage 仍是首帧权威

约定在 `lib/preferences.ts`：

- **localStorage**（`hellotime.skin` / `hellotime.theme`）与 React 参考前端同名，是首帧权威——冒烟也只通过它预置皮肤。
- **Cookie**（`ht-skin` / `ht-theme`）是给服务端看的副本：`setSkin` / `toggleTheme` 每次切换都同步写；水合后 `syncCookies()` 再按当前值校正一次。**明暗也写 Cookie**，否则亮色用户每次都会拿到暗色的 `data-theme`，水合时再翻回来。
- **首帧脚本**（`<head>` 内联，早于正文解析）：皮肤 = localStorage → 服务端写好的 `data-skin`；明暗 = localStorage → 系统偏好（没选过就跟随系统，与 React 版一致）。**只在值确实不同时才改 `<html>`**——Cookie 与本地一致时不产生任何属性变更。
- **不一致时**（旧标签页、清过 Cookie、只预设了 localStorage）：脚本改写 `data-skin` 并打上 `data-skin-pending`，`app.css` 让 `:root[data-skin-pending] body` 暂时 `visibility: hidden`，藏住服务端按 Cookie 渲染的那一套 DOM；`AppLayout` 在真正按 `<html data-skin>` 渲染出那一套后摘掉。只有明暗不同时不隐藏（DOM 结构相同，颜色由属性决定，只是明暗开关的文字晚一拍）。

`stores/ui.ts` 怎么做到「服务端渲染、水合用 Cookie 值，之后用真实值」：store 是模块级单例，服务端不能按请求去改它。`useUi(selector)` 内部是 `useSyncExternalStore`，第三个参数 `getServerSnapshot` 返回 `{ ...store, ...UiSeedContext }`。React 在服务端渲染和**水合**时调用 `getServerSnapshot`，两边都是 Cookie 值，输出一致；水合完成后改读 `getSnapshot`（首帧脚本已按 localStorage 写好的 `<html>`），不一致就重渲一次。

> zustand 自带的 `useStore` 的 `getServerSnapshot` 返回 `getInitialState()`——创建 store 时的初值。这正好让 auth、plaza 这些 store 在水合时都是空初值，与服务端一致；但皮肤需要按请求变化的值，所以 `useUi` 自己包了一层。

### 5.2 登录态：匿名 SSR + 客户端补个人投影

令牌在 localStorage，服务端看不到，所以**公开页的 HTML 一律以匿名身份生成**（与 nuxt 相同的取舍）：

- `components/App` 在 `useLayoutEffect` 里 `useAuth.getState().hydrate()`：layout effect 早于所有 passive effect，页面里的取数、守卫第一次运行时就能拿到登录态。
- 广场：查询条件与服务端一致时接纳新的首屏，登录用户随后用 `refreshViewer()` 补列表里的 `favoritedByMe`。保留了其他筛选或历史导航还原了旧首屏时，按当前条件刷新。
- 详情：两套皮肤共用 `useCapsuleByCode(code, initial)`。进入详情时后台复验首屏，收到 404 后清除胶囊数据并展示「找不到这枚胶囊」。浏览器从页面缓存恢复时也会复验。
- 登录用户的收藏按钮等当前会话的查询结果返回后才允许切换。查询失败时，点击按钮重试读状态。创建入口在登录态恢复后才有导航目标，匿名点击时仍先确认。
- 水合时 zustand 读的是空初值、服务端又不能改 store，所以首屏数据要「铺」在 store 上：广场经 `PlazaSeedContext` 给 `usePlazaHome` 叠加（`overlaySeed`），水合后的 layout effect 写进 store 并清掉，换成读 store 时内容不变。
- 需要登录的页面（`/create`、`/me/*`）：`AuthGate` 在登录态恢复前什么也不输出，服务端 HTML 里这块是空的；恢复后放行或 `<Navigate>` 去登录页。已登录访问 `/login`、`/register`：服务端按未登录渲染表单，登录态恢复后的第一次渲染判断一次再跳走（`useGuestRedirect`）。

### 5.3 此刻：倒计时用同一时刻水合

倒计时、进度条、「此刻」邮戳都依赖当前时间，服务端与浏览器的 `Date.now()` 不同，直接渲染会让文字水合不匹配。`hooks/useNow` 的 `getServerSnapshot` 返回根布局传下来的 `serverNow`：服务端渲染与水合用同一时刻，水合完成后再改读本机时钟、每秒一跳。

公开页使用 `useDisplayDate`。服务端和首次水合都按 `Asia/Shanghai` 格式化，客户端接管后按浏览器时区显示。时间选择器按本地时区解释输入，倒计时按时间戳计算。

### 5.4 服务端渲染的取舍

- 读了 Cookie，所有页面都是按请求动态渲染（`ƒ`），不做静态预渲染。
- 两套皮肤切换只在客户端：用同一份数据重渲，不请求服务端（广场、详情的数据都在路由层或 store 里，换肤不重取）。
- 服务端渲染期间不能碰 `window` / `document` / `localStorage`：这些访问都在 effect 或事件处理里；模块顶层要碰时先判断（`stores/ui.ts` 的 `hasDom`）。
- 路由名 `body[data-route]` 仍在 effect 里写（根布局拿不到当前路径），只影响时笺登录 / 注册页页脚的一处间距。

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

`hooks/`、`stores/`、`skins/paper|amber/`、`components/`（除 `App`、`AppLayout`）、`api/client.ts` 与 `frontends/react-ts/src` 下的同名文件逐文件对应，差别只有：

- 导入路径：`react-router-dom` → `@/lib/router`；
- 关于页「前端」卡片：展示 Next.js / React / TypeScript / Zustand，源码路径写 `fullstacks/next`；
- 服务端渲染带来的改动（第 5 节）：`stores/ui.ts`（Cookie 同步、`UiSeedContext`）、`hooks/useNow.ts`（`NowSeedContext`）、`components/shared.tsx` 的 `useHealth`（`HealthContext`）、`stores/plaza.ts` 与 `hooks/usePlazaHome.ts`（首屏 seed、`refreshViewer`、进首页的取数移到 `views/PlazaPage`）、`hooks/useCapsule.ts`（`initial`、在路由层调用）、两套皮肤的 `CapsulePage` 改为接收 props、`views/LoginPage` 的 `useGuestRedirect`；`lib/avatars.ts` 改为运行时登记。

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
- **首帧守卫**：升级指南提到，路由器还没开始监听 history 时调用 `navigate()`，只会改地址栏、页面不切。`<Navigate>` 在服务端什么也不输出，跳转放在 effect 里，只会在水合完成之后执行，那时 App Router 已经接管 history。已在浏览器核实：匿名直接打开 `/create`、`/me/favorites` 会真正渲染登录页，已登录打开 `/login?redirect=…` 会真正切到目标页。

### 9.3 总布局与外壳

`components/AppLayout.tsx` 与 React 版 `app/Layout.tsx` 相同：按皮肤挑页头 / 页脚 / 底栏，`main#view` 放页面（这里是 App Router 传进来的 `children`），路由名写到 `body[data-route]`；另外负责在皮肤换好后摘掉 `data-skin-pending`（第 5.1 节）。根布局与 `App` 在路由切换时不会重新挂载，所以外壳、Toast、确认框和所有 store 状态都保持不变。

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
- 自己的样式只有 `app/app.css` 里的「加载更多」和 `data-skin-pending` 隐藏两条，只用 `base.css` 刻度；`verify-design-tokens.sh next` 检查不写色值、不引用非公开令牌。
- 根布局给 `<html>` 与 `theme-color` 加了 `suppressHydrationWarning`：Cookie 与 localStorage 不一致时首帧脚本会在水合前改写它们，这是预期的不一致。

## 11. 「全栈」相对于「SPA + 独立后端」

| 维度 | React SPA + FastAPI | Next.js 全栈 |
|---|---|---|
| 进程 | 两个：FastAPI :29010 + Vite :7174（经 :9080 反代） | 一个：Next :7177 |
| 跨域 | Vite proxy / 反代 | 同源 |
| 路由表 | `router.tsx` | `src/app/` 目录结构 |
| 首屏 HTML | 空的 `#root`，JS 加载后渲染、再请求数据 | 服务端按 Cookie 里的皮肤渲染，广场 / 详情 / 关于带着数据 |
| 首帧脚本 | `index.html` 内联 `<script>`，从 localStorage 写属性 | `app/layout.tsx` 的 `<head>` 内联 `<script>`，只在 localStorage 与 Cookie 不一致时改属性 |
| 页面标题 | 视图里写 `document.title` | `metadata` / `generateMetadata`（胶囊标题在服务端生成） |
| 头像 SVG 内联 | Vite `import.meta.glob` 构建期内联 | Server Component 读文件 → props 下发 |
| 类型 | 前端手写 TS 类型对应 Python schema | `types/index.ts` 前后端共用一份 |
| 数据库连接 | 后端持有 | `server-only` 防火墙保证不进浏览器 |
| HMR 单例 | 各自重启进程 | `globalThis` 缓存防连接泄漏 |

## 12. 常见改动指南

| 想做什么 | 改哪里 |
|---|---|
| 加一个页面 | `src/views/XxxPage.tsx`（`"use client"`，按皮肤挑视图）+ `src/app/<路径>/page.tsx` 引入它并导出 `metadata` |
| 页面首屏要带数据 | `page.tsx` 改成 async，在 `lib/server/page-data.ts` 加取数函数（匿名、调 services），作为 props 传给视图；视图在水合后按需补个人投影 |
| 加一个需要登录的页面 | 同上，`page.tsx` 里外面包 `<AuthGate>` |
| 加一个接口 | `src/app/api/v1/<路径>/route.ts` 导出 `GET / POST / …`，业务写进 `src/services/*.ts`（首行 `import "server-only"`） |
| 加请求体校验 | `src/lib/validation/schemas.ts` 加 Zod schema，route 里 `parseJson(req, schema)` |
| 先读后写的业务 | 包进 `withTx`，按外部 id 查找用 `idCandidates`，输出用 `dashed` / `iso` |
| 加一个客户端状态 | `src/stores/` 用 `create(...)`；顶层别直接碰 `document` / `window`；渲染里别用 `Date.now()`（用 `useNow`） |
| 改皮肤视图 | `src/skins/paper|amber/`，与 `frontends/react-ts` 同步修改 |
| 换数据库 | `DB_DRIVER=sqlite ./run` |
| 改颜色 / 间距 | 改 `spec/styles`（所有实现同步生效），实现里不写色值 |

下一步可以对比 `fullstacks/nuxt`：同一份业务在 Nuxt + Nitro 上怎么组织，皮肤又是怎么处理的。
