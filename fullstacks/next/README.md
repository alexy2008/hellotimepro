# HelloTime Pro · Next.js 全栈

Next.js 15 (App Router) + React 19 + TypeScript 实现的 HelloTime Pro 全栈，满足 `spec/` 定义的统一 API 契约，
同一 Node 进程同时提供 `/api/v1` JSON 接口与服务端渲染 UI，支持 PostgreSQL / SQLite 双驱动。
端口 **7177**（见根 `CLAUDE.md` 端口分配）。

这是全栈实现里的「SPA 框架长出服务端」代表，与 `fullstacks/nuxt`（Vue/Nuxt）并列——
展示 React Server Components、Route Handlers、`server-only` 编译期防火墙等 App Router 核心能力。

完整代码导读见 [`TECHNICAL_GUIDE.md`](TECHNICAL_GUIDE.md)。

## 技术栈

| 角色 | 选型 |
|---|---|
| 语言 | TypeScript 5 |
| 框架 | Next.js 15（App Router） |
| UI | React 19（RSC + 客户端孤岛） |
| 客户端状态 | Zustand 5 |
| 数据访问 | Drizzle ORM（双 schema：PG / SQLite） |
| 数据库 | PostgreSQL 16 / SQLite 3 双驱动 |
| 鉴权 | jose（HS256 JWT）+ bcryptjs；RSC 端 httpOnly session cookie |
| 样式 | Tailwind CSS v4 + spec 设计令牌 |

## 目录结构（分层）

```
fullstacks/next/
  src/
    app/                  ← App Router：文件夹结构 = URL 结构
      api/v1/*/route.ts   ← Route Handlers（JSON API）
      layout.tsx          ← 根布局（Server Component）
      page.tsx            ← 广场首页（RSC 直接取数）
      c/[code]/page.tsx   ← 胶囊详情（RSC 取数 + 客户端 CapsuleDetail）
      ...                 ← 其余页面
    components/           ← "use client" 组件（交互孤岛）
    services/             ← server-only 业务逻辑（auth/capsule/plaza/llm...）
    db/                   ← Drizzle 双 schema + 运行时驱动切换
    lib/server/           ← 服务端工具（current-user/envelope/errors/session）
    stores/               ← Zustand 客户端 store
  drizzle/{pg,sqlite}/    ← SQL 迁移文件
  run / build / test      ← 端口 7177；test 跑 tsc 类型检查
```

## 安装与运行

```bash
# 通过仓库级 dev-manager（推荐，会注入 DB/LLM 配置）
./scripts/db init
./scripts/hello start next

# 或直接在本目录
./run    # npm install + 构建 + next start（默认 postgres）
```

## 切换数据库驱动

```bash
DB_DRIVER=postgres ./run     # 默认；DB_URL 由 hello 从 data/.hello-state.json 注入
DB_DRIVER=sqlite   ./run     # 使用 data/sqlite/hellotime-next.db
```

## 实现特色

- **RSC 无往返取数**：广场(`app/page.tsx`)与胶囊详情(`app/c/[code]/page.tsx`)作为 Server Component 直调 `services/*`，无 HTTP 往返；搜索/排序由 URL `searchParams` 驱动，浏览器导航即触发服务端重取。
- **`server-only` 编译期防火墙**：所有 `services/*`、`db/*`、`lib/server/*` 顶部 `import "server-only"`；误将它们引入客户端组件会在构建阶段报错。
- **会话双通道**：`/api/v1/*` 走标准 Bearer（与独立后端契约完全兼容）；RSC 渲染时读 httpOnly `ht_session` cookie 识别用户——两套互不干扰（见 `lib/server/session.ts` 注释）。
- **Drizzle 双 schema**：`schema-pg.ts`（UUID/TIMESTAMPTZ 原生类型）与 `schema-sqlite.ts`（TEXT 模拟），运行时 `db/index.ts` 按 `DB_DRIVER` 动态导入，绝大多数业务查询共用同一套 Drizzle API。

## 验证

```bash
./verification/scripts/verify-contract.sh next                 # PostgreSQL 契约 104/104
DB_DRIVER=sqlite ./verification/scripts/verify-contract.sh next # SQLite 契约 104/104
./verification/scripts/verify-ui-smoke.sh next                  # PostgreSQL UI 25/25
DB_DRIVER=sqlite ./verification/scripts/verify-ui-smoke.sh next # SQLite UI 25/25
```

## 注意事项

- `run` 脚本执行生产构建（`next build` + `next start`）而非 dev 模式，避免懒编译在 Playwright 超时窗口内未完成。开发时改用 `npm run dev`。
- `db/index.ts` 用 `globalThis` 缓存连接句柄，避免 Next dev 的 HMR 导致每次模块重载都重新建连。
- 页面级 `export const dynamic = "force-dynamic"` 禁用 Next 静态缓存；所有页面取实时数据。
