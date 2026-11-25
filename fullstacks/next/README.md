# HelloTime Pro · Next.js 全栈（2.0）

Next.js 15（App Router）+ React 19 + TypeScript 实现的 HelloTime Pro 全栈：同一个 Node 进程既提供 `/api/v1/*` JSON 接口，也提供页面，支持 PostgreSQL / SQLite 双驱动。端口 **7177**。

- **接口层**对齐参考后端 `backends/fastapi`（契约 `spec/api/openapi.yaml` 2.0.0）：Route Handlers → `services/*` → Drizzle ORM。
- **页面层**对齐参考前端 `frontends/react-ts`：两套皮肤「时笺」「琥珀」× 明暗，样式原样引入 `spec/styles`，不用 Tailwind。
- **服务端渲染**照 Next 官方推荐：`layout.tsx` / `page.tsx` 是 Server Component，读偏好 Cookie 决定皮肤、直接调 `services/*` 取广场 / 详情 / 关于的首屏数据；皮肤视图是参与 SSR 的 Client Component，水合后接管交互。

这是全栈实现里「SPA 框架长出服务端」的代表，与 `fullstacks/nuxt`（Vue / Nuxt）并列。完整代码导读见 [`TECHNICAL_GUIDE.md`](TECHNICAL_GUIDE.md)。

## 技术栈

| 角色 | 选型 |
|---|---|
| 语言 | TypeScript 5 |
| 框架 | Next.js 15.5.29（App Router：文件系统路由 + Route Handlers） |
| UI | React 19.3.1：Server Components 取数 + Client Components 交互（全部页面服务端渲染，见「设计要点」） |
| 客户端状态 | Zustand 5 |
| 数据访问 | Drizzle ORM（双 schema：PG / SQLite） |
| 数据库 | PostgreSQL 16 / SQLite 3 双驱动 |
| 鉴权 | jose（HS256 JWT）+ bcryptjs；refresh token 轮换与家族追踪 |
| 样式 | `spec/styles` 2.0 两套皮肤 + `@fontsource` 自托管字体 |

## 快速开始

```bash
# 仓库根目录：建表后经 dev-manager 启动（会注入 DB / LLM 配置）
./scripts/db init
./scripts/hello start next
# → http://localhost:7177
```

也可以在本目录直接运行：

```bash
./run                      # npm install（首次）+ 同步静态资源 + next build + next start
DB_DRIVER=sqlite ./run     # 使用 data/sqlite/hellotime-next.db
```

## 脚本

| 脚本 | 作用 |
|---|---|
| `./run` | 同步 `spec/avatars/v2`、`spec/icons` 到 `public/static/`，生产构建后启动（端口 7177） |
| `./build` | 生产构建到 `.next/` |
| `./test` | `tsc --noEmit` 类型检查（本实现没有单元测试套件，接口与页面由仓库级黑盒验证覆盖） |

`run` 用生产构建而不是 dev 模式：dev 的懒编译会撞穿 Playwright 的超时。需要热重载时用 `npm run dev`。schema 由仓库级 `./scripts/db` 管理，`run` 不建表、不迁移、不导数据。

## 目录结构

```
src/
├── app/                        ← App Router：文件夹 = URL
│   ├── layout.tsx              根布局（Server Component）：读偏好 Cookie → <html data-skin data-theme>、首帧脚本、头像表、/health
│   ├── styles.css · app.css    spec/styles 入口（base → 时笺 → 琥珀 → shell）与本实现的样式胶水
│   ├── page.tsx                /            首页（async：服务端取广场第一屏）
│   ├── about/                  /about       关于（服务端取 /health 技术栈）
│   ├── open/ · login/ · register/ · create/   只导出 metadata，内容交给客户端视图
│   ├── capsules/[code]/        /capsules/:code  胶囊详情（服务端取数 + generateMetadata）
│   ├── me/page.tsx             /me → /me/created（服务端 redirect）
│   ├── me/[tab]/               /me/created · /me/favorites · /me/profile
│   ├── not-found.tsx           404
│   └── api/v1/**/route.ts      ← Route Handlers（JSON 接口，含 2.0 的 plaza/stats、me/stats）
├── services/                   ← 业务层（server-only）：auth · capsules · favorites · plaza · me · health · llm …（接口与页面取数共用）
├── db/                         ← Drizzle 双 schema、按 DB_DRIVER 选驱动、withTx 事务
├── lib/
│   ├── server/                 ← 仅服务端：page-data（页面取数）· envelope · errors · current-user · security · ids · avatar-catalog
│   ├── preferences.ts          ← 皮肤 / 明暗：localStorage + Cookie 约定与首帧脚本（服务端与浏览器共用）
│   ├── validation/schemas.ts   ← Zod 请求体校验
│   ├── router.tsx              ← 导航适配层：react-router 的 Link / useNavigate / Navigate … 落到 next/navigation
│   └── …                       图标、时间说法、头像、专属色、关于页文字、登录回跳（与 react-ts 相同）
├── components/
│   ├── App.tsx · AppLayout.tsx 客户端应用根（偏好 / 时刻 / 健康信息的 seed、恢复登录态）与按皮肤挑外壳的总布局
│   └── …                       Seg、FavButton、Feedback、forms、shared、AuthGate（与 react-ts 相同）
├── views/                      ← 路由入口组件：按当前皮肤挑视图（不能叫 pages/，会被当成 Pages Router）
├── hooks/ · stores/ · skins/{paper,amber}/ · api/client.ts   ← 与 frontends/react-ts 对应（SSR 相关的改动见 TECHNICAL_GUIDE 第 9.1 节）
└── types/index.ts              ← 前后端共用的 openapi 2.0.0 类型
```

## 路由

| 路由 | 页面 | 权限 | 服务端渲染 |
|---|---|---|---|
| `/` | 首页：广场概览 + 就地输码 + 胶囊广场 | 公开 | 带数据：列表、筛选数量、年鉴、精选（匿名） |
| `/open` | 凭码开启（登录后附「我封存过的胶囊」） | 公开 | 页面结构；「我封存过的」水合后取 |
| `/capsules/:code` | 胶囊详情（倒计时归零后以服务端 `isOpened` 为准开启） | 公开 | 带数据（匿名）+ 胶囊标题 / 描述；查无此码直接渲染提示 |
| `/create` | 写一枚胶囊 | 登录 | 外壳；表单在登录态恢复后渲染 |
| `/login` · `/register` | 登录 / 注册（支持 `?redirect=`） | 公开 | 表单；已登录时水合后跳走 |
| `/me/created` · `/me/favorites` · `/me/profile` | 我的 | 登录 | 外壳；内容在登录态恢复后渲染 |
| `/about` | 关于 | 公开 | 带数据：前后端技术栈 |

## 设计要点

- **页面与接口同源**：浏览器请求 `/api/v1/*` 打到同一个 Next 进程，没有反代、没有 CORS。接口层鉴权走 `Authorization: Bearer`，与独立后端的契约完全一致。
- **Server / Client 组件分工**：`app/` 下的 `layout.tsx`、`page.tsx` 是 Server Component——读 Cookie、调 `services/*`（经 `lib/server/page-data.ts`，同进程函数调用，不绕 HTTP）、生成 `metadata`；`views/*`、`skins/*`、`components/*` 是 Client Component，同样在服务端渲染成 HTML，浏览器里水合后接管交互。后续的翻页、筛选、搜索、收藏仍走 `/api/v1`。两套皮肤切换只在客户端用同一份数据重渲，不请求服务端。
- **偏好：Cookie 给服务端，localStorage 仍是首帧权威**：切换皮肤 / 明暗时同时写 localStorage（`hellotime.skin` / `hellotime.theme`）与 Cookie（`ht-skin` / `ht-theme`），**明暗也写**；服务端按 Cookie 输出 `<html data-skin data-theme>` 并渲染对应皮肤。首帧脚本只在 localStorage 与 Cookie 不一致时改 `<html>`，皮肤不同就打上 `data-skin-pending` 暂时隐藏内容，客户端换好皮肤后摘掉，并把 Cookie 校正为本地值。一致时 `<html>` 上没有任何属性变化（已用 MutationObserver 核实）。
- **匿名 SSR 与收藏状态**：公开页以匿名身份生成。查询条件一致时，广场接纳新的服务端首屏，登录用户随后静默补取收藏状态。详情进入后在后台复验，查到胶囊已删除时清除旧正文。收藏状态确认后才允许登录用户切换收藏，查询失败时可点按钮重试。
- **水合一致**：服务端不能按请求改模块级 zustand store，所以按请求变化的值走 Context 给 `useSyncExternalStore` 的 `getServerSnapshot`——皮肤 / 明暗（`UiSeedContext`）、渲染时刻（`NowSeedContext`，倒计时两边用同一时刻）；广场首屏经 `PlazaSeedContext` 叠加在空 store 上，水合后写进 store。
- **服务端还做的事**：根布局在服务端读 `spec/avatars/v2`，把头像表作为 props 交给客户端（React 版是 Vite 的 `import.meta.glob` 构建期内联）；`/me` 的跳转用服务端 `redirect()`；未匹配路由由 `not-found.tsx` 返回 HTTP 404。
- **逻辑一份，视图按皮肤分**：`hooks/`、`stores/`、`skins/`、`components/` 与 `frontends/react-ts` 逐文件对应，差别在导入路径（`react-router-dom` → `@/lib/router`）、少数文案，以及服务端渲染需要的首屏数据与 seed。草稿、表单值、广场搜索放在共享 store，切皮肤不丢。
- **与 react-ts 的差异**：react-ts 的首屏是空 `#root`，JS 加载后才渲染、再请求数据；这里首屏 HTML 已经是对应皮肤、带着数据的完整页面（可直接被抓取，胶囊详情有自己的 `<title>` 与描述）。代价是偏好要多存一份 Cookie、登录相关的部分晚一拍出现（服务端看不到令牌），以及所有页面按请求动态渲染。
- **`server-only` 编译期防火墙**：`services/*`、`db/*`、`lib/server/*` 顶部 `import "server-only"`，误被客户端组件引入会在 `next build` 时报错。
- **跨库归一**：对外的 UUID 一律带连字符、时间一律 `toISOString()`；SQLite 下按 id 查找同时匹配种子的 32 位十六进制写法（`lib/server/ids.ts`）。

## 2.0 复核修复（2026-11-22）

广场 API 缺省按最新排序，三个列表接口共用分页参数校验。标题、正文、昵称和搜索词按 Unicode 码点计数。直接运行 PostgreSQL 模式时，空的 `DB_URL` 会回退到驱动默认连接。

客户端将当前用户请求和改密后的延迟登出绑定到登录会话。两套皮肤共享搜索防抖与输码空位，查询条件变化时清理旧列表，个人列表首次加载失败可重试。时笺处理开启途中胶囊被删除的状态，琥珀关闭时间面板后移出焦点顺序。复制结果按剪贴板写入是否成功提示。

本轮仅做静态检查，未重跑契约、UI 冒烟或构建。

## SSR 复核修复（2026-11-23）

- 升级到 Next.js 15.5.29 与 React 19.3.1，并更新锁文件。Next.js 版本采用[官方 11 月安全更新](https://nextjs.org/blog/november-2026-security-release)的 15.x 维护版本。
- 服务端渲染与首次水合统一按 `Asia/Shanghai` 格式化公开页日期，客户端接管后用浏览器时区。创建入口等登录态恢复后才启用导航。
- 2026-11-25 复核修复后重验（独立库 `hellotime_contract_next` 与 `/tmp/hellotime-contract-next.db`）：契约 PostgreSQL / SQLite 117/117，UI 冒烟 PostgreSQL / SQLite 88/88，设计令牌通过。

## 2.0 验证

### 恢复服务端渲染后（2026-11-22）

契约用独立库（PostgreSQL `hellotime_contract_next`、SQLite `/tmp/hellotime-contract-next.db`）；UI 冒烟用 `verify-ui-smoke.sh` 的默认库。

| 项目 | PostgreSQL | SQLite |
|---|---|---|
| 契约 `verify-contract.sh next` | ✅ 117/117 | ✅ 117/117 |
| UI 冒烟 `verify-ui-smoke.sh next`（44 条 × 时笺 / 琥珀） | ✅ 88/88 | ✅ 88/88 |
| 设计令牌 `verify-design-tokens.sh next` | ✅ 通过 | — |
| `./build`、`./test` | ✅ 通过 | — |

另外实测了服务端渲染本身：

- **SSR 内容**：`curl` 取 `/`，HTML 里有 9 张胶囊卡片和统计；`/capsules/<码>` 的 `<title>` 是胶囊标题，未开启的描述只写「谁封存、哪天开启」，已开启的描述是正文摘要；查无此码的标题是「找不到这枚胶囊」，正文直接是 `detail-not-found`；`/about` 带前后端技术栈。带 Cookie `ht-skin=paper` / `amber` 时，`<html data-skin>`、`theme-color` 和 DOM（时笺的印章 / 琥珀的主视觉）分别是对应皮肤。
- **偏好不翻转**：经一个只在 HTML `<head>` 最前面注入 MutationObserver 的观测反代（不改应用代码），用同源 iframe 从解析开始观察 `<html>` 的 `data-skin` / `data-theme` / `data-skin-pending`。Cookie 与 localStorage 一致的 4 种组合（时笺 / 琥珀 × 昼 / 夜）× 7 个页面，属性变化 0 次；不一致的组合只有首帧脚本那一次改写，皮肤不同时 `data-skin-pending` 约 100～170ms 后摘掉，最终属性与 localStorage 一致、Cookie 被校正为本地值。
- **无水合警告**：`next dev` 下同样 56 次加载（含 404 页）与登录态下 12 次加载，控制台没有任何 error / warning；生产构建下同样为 0。
- **个人投影**：登录并收藏后，首页卡片与详情页的收藏按钮服务端渲染为未收藏，水合后变为已收藏；匿名访客打开首页、详情、关于页不发任何 `/api/v1` 请求。
- **守卫**：匿名直接打开 `/create`、`/me/favorites` 会真正渲染登录页；已登录打开 `/login?redirect=/me/favorites` 会真正切到「我收藏的」。
- **交互**：切换皮肤写 `data-skin-dir` 并有 `is-skinning` 转场（约 2s），明暗切换有 `is-theming` 晕开，两者都同步写 Cookie；琥珀 `/create` 的星轨时钟可展开、点年份可跳年；375 宽下各页无横向溢出。

```bash
DB_URL=postgresql+psycopg://<user>:<pwd>@127.0.0.1:5432/hellotime_contract_next ./verification/scripts/verify-contract.sh next
DB_DRIVER=sqlite DB_URL=sqlite:////tmp/hellotime-contract-next.db ./verification/scripts/verify-contract.sh next
./verification/scripts/verify-ui-smoke.sh next
DB_DRIVER=sqlite ./verification/scripts/verify-ui-smoke.sh next
./verification/scripts/verify-design-tokens.sh next
```

### 升级时（2026-11-22，客户端渲染版本）

契约 PostgreSQL / SQLite 117/117，UI 冒烟 88/88，令牌通过；当时还手动核对了路径非法 UUID → 422、格式合法但不存在 → 404（取消收藏仍 204）。每次启动都要先跑 `next build`，冷启动较慢时调大 `READY_TIMEOUT` / `UI_READY_TIMEOUT`。

## 2.0 迁移笔记

升级指南第 1、2 节的清单都已逐条对齐，下面只记录这次遇到、清单里没写的情况：

1. **服务端渲染（2026-11-22 恢复）**。2.0 升级时曾因皮肤只在 `localStorage` 而把整棵页面树用 `next/dynamic({ ssr: false })` 关掉 SSR，退化成 Next 托管的 SPA。现已按 nuxt 全栈的思路恢复：皮肤 / 明暗同步写 Cookie 供服务端选视图，localStorage 仍是首帧权威，不一致时 `data-skin-pending` 暂藏内容、水合后恢复；公开页由 async Server Component 匿名取数，个人投影在客户端补齐。1.x 那枚识别用户的 httpOnly `ht_session` cookie 没有恢复——令牌仍按 2.0 方案放在 localStorage。
2. **`src/pages/` 是 Next 的保留目录**。从 React 版搬页面入口时如果沿用 `pages/`，Next 会把它当成 Pages Router 路由。本实现改名为 `views/`。
3. **客户端组件也在服务端执行**。`"use client"` 只表示「到了浏览器还要水合」，渲染函数照样在服务端跑一遍：渲染期不能碰 `window` / `document` / `localStorage`，也不能直接用 `Date.now()`（用 `useNow`，水合时与服务端同一时刻）；模块顶层要碰时先判断（`stores/ui.ts` 的 `hasDom`）。zustand 的 `useStore` 在水合时读 `getInitialState()`，所以「渲染前在模块顶层恢复登录态」在 SSR 下没有意义，改为水合后的 layout effect。
4. **better-sqlite3 的 Drizzle 事务只接受同步回调**。async 回调会在第一个 `await` 之前就提交。`db/index.ts` 的 `withTx` 在 PostgreSQL 下用 `db.transaction` 并在事务内 `SELECT … FOR UPDATE` 锁胶囊行；在 SQLite 下改用进程内队列加 `BEGIN IMMEDIATE`。收藏、取消收藏、删除胶囊都走它，加锁顺序都是「胶囊 → 收藏」。
5. **PostgreSQL 的 `timestamptz` 用 `mode: "string"` 读回来不是 ISO 格式**，而是 `2026-01-01 00:00:00+00`。SQLite 种子是 `…+00:00`，应用写入的是 `…Z`。输出前统一用 `new Date(v).toISOString()` 处理。SQLite 种子的主键是 32 位十六进制：对外统一输出带连字符的格式，查找时两种格式都匹配，写外键时用查到的原始主键。
6. **Vite 专有写法的替代**：`import.meta.glob(..., { query: "?raw" })` 内联头像 SVG，改成由根布局（Server Component）用 `fs` 读取后通过 props 下发；`spec/styles` 与 `@fontsource` 直接在 `app/styles.css` 里 `@import`，Next 的 CSS 管线可以解析仓库外的相对路径和裸包名。
7. **导航适配**：React 版的 `<Link to>` / `useNavigate` / `<Navigate>` 由 `lib/router.tsx` 映射到 `next/link` 和 `next/navigation`。next/link 在 `onClick` 里 `preventDefault()` 后不会跳转，所以「匿名点创建先弹确认框」不用改。`<Navigate>` 在服务端不输出任何东西，跳转放在 effect 里，只会在水合完成、App Router 接管 history 之后执行，能真正切换页面（第 2 节第 7 条的坑在这里不会出现，已用浏览器核实）。
8. **健康检查**：`version` 固定为 `"2.0.0"`，不再读取 `SERVICE_VERSION`。头像目录和 `/static/avatars/*` 都改用 `spec/avatars/v2`，`run` / `build` 同步的也是 v2。
