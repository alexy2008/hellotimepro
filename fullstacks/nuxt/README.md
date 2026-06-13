# HelloTime Pro · Nuxt 全栈

Nuxt 3 + Nitro + TypeScript 实现的 HelloTime Pro 全栈，满足 `spec/` 定义的统一 API 契约，
同一 Node 进程同时提供 `/api/v1` JSON 接口（Nitro Route Handlers）与服务端渲染 UI，支持 PostgreSQL / SQLite 双驱动。
端口 **7178**（见根 `CLAUDE.md` 端口分配）。

这是全栈实现里的「Vue/Nuxt 框架长出服务端」代表，与 `fullstacks/next`（React/Next.js）并列——
UI 层移植自 Vue 参考前端，服务端用 Nitro 约定式路由 + Drizzle ORM。

完整代码导读见 [`TECHNICAL_GUIDE.md`](TECHNICAL_GUIDE.md)。

## 技术栈

| 角色 | 选型 |
|---|---|
| 语言 | TypeScript 5 |
| 框架 | Nuxt 3.21（Nitro server engine） |
| UI | Vue 3（Composition API，移植自参考前端） |
| 客户端状态 | Pinia 3 |
| 数据访问 | Drizzle ORM（双 schema：PG / SQLite） |
| 数据库 | PostgreSQL 16 / SQLite 3（better-sqlite3 12）双驱动 |
| 鉴权 | jose（HS256 JWT）+ bcryptjs；header token 方案 |
| 样式 | Tailwind CSS v4 + spec 设计令牌 |

## 目录结构（分层）

```
fullstacks/nuxt/
  pages/                ← 约定式路由：文件结构 = URL 结构
  layouts/              ← 页面布局（MainLayout / MeLayout）
  components/           ← Vue 组件
  composables/          ← 组合式逻辑复用
  stores/               ← Pinia 客户端 store（auth / plaza / capsule）
  plugins/
    bootstrap.client.ts ← 启动时恢复登录态
  server/
    api/v1/             ← Nitro REST 端点，对齐 spec/api/openapi.yaml
    services/           ← 框架无关的领域/应用服务（auth/capsules/plaza/...）
    db/                 ← Drizzle 双 schema（schema-pg / schema-sqlite）+ 运行时驱动切换
    lib/                ← 服务端工具（envelope / errors / 鉴权）
  drizzle/{pg,sqlite}/  ← 两套幂等 SQL 迁移
  run / build / test    ← 端口 7178；build 跑 nuxt build，test 跑 typecheck
```

## 安装与运行

```bash
# 通过仓库级 dev-manager（推荐，会注入 DB/LLM 配置）
./scripts/db init
./scripts/hello start nuxt

# 或直接在本目录
./run    # npm install + nuxt build + 启动 Nitro node-server（默认 postgres）
```

打开 <http://127.0.0.1:7178>。`run` 构建并以生产 Nitro node-server 提供服务，使 API 与 UI 通过同一生产运行时被验证。

## 切换数据库驱动

```bash
DB_DRIVER=postgres ./scripts/hello start nuxt   # 默认；DB_URL 由 hello 从 data/.hello-state.json 注入
DB_DRIVER=sqlite   ./scripts/hello start nuxt   # 使用 data/sqlite/hellotime-nuxt.db
```

差异处理：
- **UUID**：应用层生成 UUID；PG 用原生 `UUID` 列，SQLite 用 `TEXT`。
- **时间戳**：PG 用 `TIMESTAMPTZ`，SQLite 用 ISO-8601 `TEXT`。
- **Drizzle 双 schema**：`schema-pg.ts`（UUID/TIMESTAMPTZ 原生类型）与 `schema-sqlite.ts`（TEXT 模拟），`server/db/index.ts` 按 `DB_DRIVER` 动态导入，业务查询共用同一套 Drizzle API。
- **schema 生命周期**：`run` 只连库；建表 / reset / seed 由根目录 `scripts/db` 显式完成。

## 实现特色

- **一个进程两套接口**：`server/api/v1/` 暴露 `/api/v1/*` JSON 契约（Bearer），`pages/` 提供 SSR UI，业务逻辑集中在 `server/services/` 框架无关层，与 `next` 同构对照。
- **AI 创建辅助公开化**：`POST /api/v1/capsule-suggestion` 与 `GET /api/v1/capsule-recommendations` 为公开端点，匿名可用（早期误加鉴权返回 401，已修）。
- **单页内 refresh 只轮换一次**：登录态由持久化的 `user` 渲染，access token 由真正的 authed 请求惰性刷新——避免整页导航时上一页刚轮换、下一页用旧 token 再刷新触发重放检测、整族吊销、误登出。
- **refresh token rotate + family**：每次 `/auth/refresh` 发新撤旧、family 延续；重放已撤销 token 整族作废；改密吊销该用户全部 refresh token。

## 验证

```bash
./verification/scripts/verify-contract.sh nuxt                  # PostgreSQL 契约 104/104
DB_DRIVER=sqlite ./verification/scripts/verify-contract.sh nuxt # SQLite 契约 104/104
./verification/scripts/verify-ui-smoke.sh nuxt                  # PostgreSQL UI 25/25
DB_DRIVER=sqlite ./verification/scripts/verify-ui-smoke.sh nuxt # SQLite UI 25/25
```

## 注意事项

- 全栈自带 UI + API，**无需 `hello switch` 代理**（仅纯前端 SPA 需要代理指向某后端）。
- **令牌存储策略**：采用教学友好的 header token 路径——access token 存 Pinia 内存，refresh token 与 user 持久化到 `localStorage`。这与 SPA 客户端保持一致、规避 cookie CSRF 处理，代价是接受 `docs/02-design.md §7.2` 指出的 XSS 风险（详见 [`docs/auth.md`](../../docs/auth.md) §7.3）。
- `better-sqlite3` 锁定 12.x 以兼容 Node 26 ABI（11.x 在 Node 26 下 `NODE_MODULE_VERSION` 不匹配无法启动）。
