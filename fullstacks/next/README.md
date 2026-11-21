# HelloTime Pro · Next.js 全栈（2.0）

Next.js 15（App Router）+ React 19 + TypeScript 实现的 HelloTime Pro 全栈：同一个 Node 进程既提供 `/api/v1/*` JSON 接口，也提供页面，支持 PostgreSQL / SQLite 双驱动。端口 **7177**。

- **接口层**对齐参考后端 `backends/fastapi`（契约 `spec/api/openapi.yaml` 2.0.0）：Route Handlers → `services/*` → Drizzle ORM。
- **页面层**对齐参考前端 `frontends/react-ts`：两套皮肤「时笺」「琥珀」× 明暗，样式原样引入 `spec/styles`，不用 Tailwind。

这是全栈实现里「SPA 框架长出服务端」的代表，与 `fullstacks/nuxt`（Vue / Nuxt）并列。完整代码导读见 [`TECHNICAL_GUIDE.md`](TECHNICAL_GUIDE.md)。

## 技术栈

| 角色 | 选型 |
|---|---|
| 语言 | TypeScript 5 |
| 框架 | Next.js 15（App Router：文件系统路由 + Route Handlers） |
| UI | React 19（页面在客户端渲染，见下文「设计要点」） |
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
│   ├── layout.tsx              根布局（Server Component）：<html>、首帧皮肤脚本、全局样式、头像表
│   ├── styles.css · app.css    spec/styles 入口（base → 时笺 → 琥珀 → shell）与本实现的样式胶水
│   ├── page.tsx                /            首页（广场概览 + 就地输码 + 胶囊广场）
│   ├── open/ · about/ · login/ · register/ · create/
│   ├── capsules/[code]/        /capsules/:code  胶囊详情
│   ├── me/page.tsx             /me → /me/created（服务端 redirect）
│   ├── me/[tab]/               /me/created · /me/favorites · /me/profile
│   ├── not-found.tsx           404
│   └── api/v1/**/route.ts      ← Route Handlers（JSON 接口，含 2.0 的 plaza/stats、me/stats）
├── services/                   ← 业务层（server-only）：auth · capsules · favorites · plaza · me · llm …
├── db/                         ← Drizzle 双 schema、按 DB_DRIVER 选驱动、withTx 事务
├── lib/
│   ├── server/                 ← 仅服务端：envelope · errors · current-user · security · ids · avatar-catalog
│   ├── validation/schemas.ts   ← Zod 请求体校验
│   ├── router.tsx              ← 导航适配层：react-router 的 Link / useNavigate / Navigate … 落到 next/navigation
│   └── …                       图标、时间说法、头像、专属色、关于页文字、登录回跳（与 react-ts 相同）
├── components/
│   ├── ClientRoot.tsx · App.tsx · AppLayout.tsx   客户端应用根与按皮肤挑外壳的总布局
│   └── …                       Seg、FavButton、Feedback、forms、shared、AuthGate（与 react-ts 相同）
├── views/                      ← 路由入口组件：按当前皮肤挑视图（不能叫 pages/，会被当成 Pages Router）
├── hooks/ · stores/ · skins/{paper,amber}/ · api/client.ts   ← 与 frontends/react-ts 相同
└── types/index.ts              ← 前后端共用的 openapi 2.0.0 类型
```

## 路由

| 路由 | 页面 | 权限 |
|---|---|---|
| `/` | 首页：广场概览 + 就地输码 + 胶囊广场 | 公开 |
| `/open` | 凭码开启（登录后附「我封存过的胶囊」） | 公开 |
| `/capsules/:code` | 胶囊详情（倒计时归零后以服务端 `isOpened` 为准开启） | 公开 |
| `/create` | 写一枚胶囊 | 登录 |
| `/login` · `/register` | 登录 / 注册（支持 `?redirect=`） | 公开 |
| `/me/created` · `/me/favorites` · `/me/profile` | 我的 | 登录 |
| `/about` | 关于 | 公开 |

## 设计要点

- **页面与接口同源**：浏览器请求 `/api/v1/*` 打到同一个 Next 进程，没有反代、没有 CORS。接口层鉴权走 `Authorization: Bearer`，与独立后端的契约完全一致。
- **页面树只在客户端渲染**：皮肤与明暗存在 `localStorage`（`hellotime.skin` / `hellotime.theme`），服务端拿不到，而两套皮肤的 DOM 结构差别很大，服务端按默认皮肤渲染会导致水合不一致、闪出另一套。所以根布局只输出 `<html>` 骨架和首帧脚本，`ClientRoot` 用 `next/dynamic({ ssr: false })` 挂载应用；首帧颜色由 `<head>` 里的内联脚本先写好。
- **服务端仍然做它擅长的事**：根布局是 Server Component，在服务端读 `spec/avatars/v2`，把头像表作为 props 交给客户端（React 版是 Vite 的 `import.meta.glob` 构建期内联）；`/me` 的跳转用服务端 `redirect()`；未匹配路由由 `not-found.tsx` 返回 HTTP 404。
- **逻辑一份，视图按皮肤分**：`hooks/`、`stores/`、`skins/`、`components/` 与 `frontends/react-ts` 逐文件对应，差别只在导入路径（`react-router-dom` → `@/lib/router`）和少数文案。草稿、表单值、广场搜索放在共享 store，切皮肤不丢。
- **`server-only` 编译期防火墙**：`services/*`、`db/*`、`lib/server/*` 顶部 `import "server-only"`，误被客户端组件引入会在 `next build` 时报错。
- **跨库归一**：对外的 UUID 一律带连字符、时间一律 `toISOString()`；SQLite 下按 id 查找同时匹配种子的 32 位十六进制写法（`lib/server/ids.ts`）。

## 2.0 验证

2026-11-22 实测（契约用独立库：PostgreSQL `hellotime_contract_next`、SQLite `/tmp/hellotime-contract-next.db`；UI 冒烟用同一组库）：

| 项目 | PostgreSQL | SQLite |
|---|---|---|
| 契约 `verify-contract.sh next` | ✅ 117/117 | ✅ 117/117 |
| UI 冒烟 `verify-ui-smoke.sh next`（44 条 × 时笺 / 琥珀） | ✅ 88/88 | ✅ 88/88 |
| 设计令牌 `verify-design-tokens.sh next` | ✅ 通过 | — |

另外手动核对了契约没覆盖的几项：

- 路径里的非法 UUID：`GET /plaza/capsules/not-a-uuid`、`DELETE /me/capsules/1-1-1-1-1`、`DELETE /me/favorites/xyz` → 422；格式合法但不存在 → 404（取消收藏仍 204）。
- 内置浏览器：匿名直接打开 `/create` 会真正切到登录页（不只是地址栏变了）；已登录打开 `/login?redirect=/about` 会切到关于页；控制台无报错、无水合警告。
- `./test`（类型检查）与 `./build` 通过。

```bash
DB_URL=postgresql://<user>:<pwd>@127.0.0.1:5432/hellotime_contract_next READY_TIMEOUT=240 ./verification/scripts/verify-contract.sh next
DB_DRIVER=sqlite DB_URL=sqlite:////tmp/hellotime-contract-next.db READY_TIMEOUT=240 ./verification/scripts/verify-contract.sh next
DB_URL=postgresql://<user>:<pwd>@127.0.0.1:5432/hellotime_contract_next UI_READY_TIMEOUT=300 ./verification/scripts/verify-ui-smoke.sh next
DB_DRIVER=sqlite DB_URL=sqlite:////tmp/hellotime-contract-next.db UI_READY_TIMEOUT=300 ./verification/scripts/verify-ui-smoke.sh next
./verification/scripts/verify-design-tokens.sh next
```

每次启动都要先跑 `next build`，冷启动可能超过脚本默认的 60 秒就绪等待，所以要调大 `READY_TIMEOUT` / `UI_READY_TIMEOUT`。

## 2.0 迁移笔记

升级指南第 1、2 节的清单都已逐条对齐，下面只记录这次遇到、清单里没写的情况：

1. **1.x 的 RSC 取数改成了客户端渲染**。1.x 的广场和详情是 Server Component，靠登录时额外写的 httpOnly `ht_session` cookie 识别用户。2.0 的皮肤只存在 `localStorage`，冒烟也只通过 `localStorage` 预置皮肤，服务端渲染不出正确的皮肤，所以整个页面树改为客户端渲染，`ht_session` cookie 和 `lib/server/session.ts` 一并删掉。不要试图「服务端按默认皮肤渲染、客户端再换」，那样会出现水合不一致和闪烁。
2. **`src/pages/` 是 Next 的保留目录**。从 React 版搬页面入口时如果沿用 `pages/`，Next 会把它当成 Pages Router 路由。本实现改名为 `views/`。
3. **客户端模块在构建时也会被服务端求值**。页面组件虽然只在浏览器渲染，`next build` 预渲染时仍会加载它们的模块图。`stores/ui.ts` 在 zustand 初始化时就读 `document.documentElement`，这里提前加了 `typeof document` 判断（同类写法搬过来时都要注意）。
4. **better-sqlite3 的 Drizzle 事务只接受同步回调**。async 回调会在第一个 `await` 之前就提交。`db/index.ts` 的 `withTx` 在 PostgreSQL 下用 `db.transaction` 并在事务内 `SELECT … FOR UPDATE` 锁胶囊行；在 SQLite 下改用进程内队列加 `BEGIN IMMEDIATE`。收藏、取消收藏、删除胶囊都走它，加锁顺序都是「胶囊 → 收藏」。
5. **PostgreSQL 的 `timestamptz` 用 `mode: "string"` 读回来不是 ISO 格式**，而是 `2026-01-01 00:00:00+00`。SQLite 种子是 `…+00:00`，应用写入的是 `…Z`。输出前统一用 `new Date(v).toISOString()` 处理。SQLite 种子的主键是 32 位十六进制：对外统一输出带连字符的格式，查找时两种格式都匹配，写外键时用查到的原始主键。
6. **Vite 专有写法的替代**：`import.meta.glob(..., { query: "?raw" })` 内联头像 SVG，改成由根布局（Server Component）用 `fs` 读取后通过 props 下发；`spec/styles` 与 `@fontsource` 直接在 `app/styles.css` 里 `@import`，Next 的 CSS 管线可以解析仓库外的相对路径和裸包名。
7. **导航适配**：React 版的 `<Link to>` / `useNavigate` / `<Navigate>` 由 `lib/router.tsx` 映射到 `next/link` 和 `next/navigation`。next/link 在 `onClick` 里 `preventDefault()` 后不会跳转，所以「匿名点创建先弹确认框」不用改。整棵树在 App Router 接管 history 之后才挂载，守卫在 effect 里 `router.replace` 能真正切换页面（第 2 节第 7 条的坑在这里不会出现，已用浏览器核实）。
8. **健康检查**：`version` 固定为 `"2.0.0"`，不再读取 `SERVICE_VERSION`。头像目录和 `/static/avatars/*` 都改用 `spec/avatars/v2`，`run` / `build` 同步的也是 v2。
