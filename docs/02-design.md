# HelloTime Pro 总体设计

> 版本 0.1 · 2026-04-17 · 面向对象：第一次接触本项目的新开发者

> 阅读本文之前建议先读 [01-requirements.md](01-requirements.md)。

---

## 1. 设计原则

1. **规范即单一事实源**。业务契约在 `spec/` 下（OpenAPI、Design Tokens、数据字典）。所有实现 **必须** 从 spec 生成或对齐，不允许"各实现自己定义"。
2. **栈内正交**。每个实现使用该技术栈的**地道**写法（Signals 对 Angular，composition API 对 Vue，runes 对 Svelte），不强行统一代码结构。
3. **外部一致**。不管内部怎么写，对外行为（路由、JSON 形状、错误码、样式）必须一致，肉眼可比。
4. **最小脚手架**。每个实现的 `run` / `build` / `test` 三个脚本就是用户入口，不搞复杂 CI DSL。
5. **教学可读优先于性能极致**。不做不必要的缓存 / 优化层，代码要让读者能在 30 分钟内看完主流程。

## 2. 架构总览

```
┌───────────────────────────────────────────────────────────────────────┐
│                         HelloTime Pro Monorepo                         │
│                                                                        │
│  ┌──────────────┐  ┌─────────────┐  ┌──────────────────────────────┐  │
│  │ spec/        │  │ verification/│  │ scripts/                     │  │
│  │  openapi.yaml│  │  contract.sh │  │  hello  (dev-manager v2)     │  │
│  │  tokens.json │  │  ui-smoke.sh │  │  build.sh  test.sh           │  │
│  │  avatars/    │  └──────┬───────┘  └──────────────────────────────┘  │
│  └──────┬───────┘         │                                            │
│         │ drives          │ validates                                  │
│         ▼                 ▼                                            │
│  ┌──────────────────────────────────────────────────────────────┐     │
│  │                        Implementations                        │     │
│  │                                                               │     │
│  │  backends/ (10)  ── port 29xxx, all implement openapi.yaml    │     │
│  │       │                                                       │     │
│  │       │  proxied via :9080                                    │     │
│  │       ▼                                                       │     │
│  │  frontends/ (5)  ── port 7173..7180, pure SPA                 │     │
│  │                                                               │     │
│  │  fullstacks/ (5) ── port 7177..7182, self-contained           │     │
│  └──────────────────────────────────────────────────────────────┘     │
└───────────────────────────────────────────────────────────────────────┘
```

读法：

- `spec/` 是**源头**。任意实现修改行为都必须先动 spec，再动实现。
- 验证脚本（`verification/`）对着 spec 跑，不信任实现自报。
- 10 个后端长得完全不同，但从外面看它们都是"同一个服务"。
- 5 个前端通过 `:9080` 这个反向代理访问"当前选中"的后端，这样就能"同一个前端，换后端看差异"。
- 5 个全栈各自闭环，不走 proxy（教学目标就是展示"一体化"这件事）。

## 3. 仓库结构

```
HelloTimeProByClaude/
├── README.md
├── docs/
│   ├── 01-requirements.md
│   ├── 02-design.md          ← 本文
│   ├── 03-roadmap.md
│   ├── api-contract.md       ← OpenAPI 的人话版
│   ├── db-schema.md
│   ├── design-tokens.md
│   ├── auth.md
│   ├── tech-stack-display.md
│   └── multi-stack-reading-guide.md
├── spec/
│   ├── api/openapi.yaml
│   ├── styles/
│   │   ├── tokens.css        ← 语义令牌（brand / surface / text / ...）
│   │   ├── palette.css       ← 色阶（50..900）
│   │   └── cyber.css         ← 共享组件样式（按钮 / 卡片 / 输入）
│   ├── tokens/
│   │   └── tokens.json       ← 由 tokens.css 同步生成，供 Tailwind/JS 消费
│   ├── avatars/
│   │   ├── 01-neo.svg ... 10-specter.svg
│   │   └── catalog.json      ← id / 名称 / 推荐色
│   └── icons/                ← 技术栈 SVG 图标（Simple Icons 来源，统一 24×24 viewBox）
│       ├── python.svg
│       ├── fastapi.svg
│       ├── postgresql.svg
│       └── ...               ← 各栈按需引用；每个后端/全栈软链或复制到 /static/icons/
├── frontends/
│   ├── vue3-ts/
│   ├── react-ts/
│   ├── angular-ts/
│   ├── svelte-ts/
│   └── solid-ts/
├── fullstacks/
│   ├── next-ts/
│   ├── nuxt-ts/
│   ├── spring-boot-mvc/
│   ├── laravel/
│   └── rails/
├── backends/
│   ├── spring-boot/
│   ├── fastapi/
│   ├── gin/
│   ├── elysia/
│   ├── nest/
│   ├── aspnet-core/
│   ├── vapor/
│   ├── axum/
│   ├── drogon/
│   └── ktor/
├── verification/
│   ├── scripts/
│   │   ├── verify-contract.sh    ← 一套跨所有后端的契约验证
│   │   ├── verify-ui-smoke.sh    ← Playwright 主流程冒烟
│   │   └── verify-design-tokens.sh
│   └── fixtures/                 ← 测试用固定数据
├── data/                         ← SQLite 文件 & Postgres 卷（gitignored）
├── scripts/
│   ├── hello                     ← 统一 CLI（见 §11）
│   ├── build.sh
│   ├── test.sh
│   └── docker-compose.yml        ← 本地 Postgres
└── ui-prototype/                 ← 设计原型（HTML 静态页）
```

## 4. 端口分配

为避免与老仓库 (`HelloTimeByClaude`) 冲突，Pro 使用全新的端口段：

| 类别 | 用途 | 端口 |
|---|---|---|
| Backends | Spring Boot | 29000 |
| | FastAPI | 29010 |
| | Gin | 29020 |
| | Elysia | 29030 |
| | NestJS | 29040 |
| | ASP.NET Core | 29050 |
| | Vapor | 29060 |
| | Axum | 29070 |
| | Drogon | 29080 |
| | Ktor | 29090 |
| SPA 入口（代理） | `:9080` → 当前选中后端 | 9080 |
| Frontends | Vue | 7173 |
| | React | 7174 |
| | Angular | 7175 |
| | Svelte | 7176 |
| | Solid | 7180 |
| Fullstacks | Next.js | 7177 |
| | Nuxt | 7178 |
| | Spring MVC | 7179 |
| | Rails | 7181 |
| | Laravel | 7182 |
| 开发设施 | dev-manager Web UI | 9090 |
| | Postgres（本地 compose） | 55432 |

> 端口段选择的规则：**2xxxx 段给后端，7xxx 给前端 / 全栈，9xxx 给开发基础设施**。所有数字都和老仓库不同，两套可以同时跑。

## 5. 数据模型

### 5.1 实体关系

```
 ┌──────────┐        ┌────────────────┐        ┌────────────┐
 │  users   │ 1 : N  │    capsules    │ 1 : N  │ favorites  │
 │          ├────────┤                ├────────┤            │
 │ id (UUID)│        │ id (UUID)      │        │ user_id FK │
 │ email    │        │ owner_id FK    │        │ capsule_id │
 │ password │        │ code UNIQUE(8) │        │ created_at │
 │ nickname │        │ title          │        │ PK(user_id,│
 │ avatar_id│        │ content        │        │    capsule)│
 │ ...      │        │ open_at        │        └────────────┘
 └──────────┘        │ in_plaza BOOL  │
                     │ favorite_count │  ← 冗余计数器，写 favorites 时 ±1
                     │ created_at     │
                     │ updated_at     │
                     └────────────────┘
```

> 关于 `favorite_count`：是**冗余字段**，在收藏 / 取消收藏事务里同步更新。这样广场排序 `ORDER BY favorite_count` 无需 join。每个实现都必须处理好事务一致性（或用数据库触发器，选一种写在该实现的 README 里）。

### 5.2 字段细则

**users**

| 字段 | 类型 | 约束 |
|---|---|---|
| `id` | UUID | PK |
| `email` | varchar(254) | NOT NULL UNIQUE, 存小写 |
| `password_hash` | varchar(100) | NOT NULL, bcrypt |
| `nickname` | varchar(20) | NOT NULL UNIQUE |
| `avatar_id` | varchar(20) | NOT NULL，外键到 `spec/avatars/catalog.json` 中的 id |
| `created_at` | timestamptz | NOT NULL |
| `updated_at` | timestamptz | NOT NULL |

**capsules**

| 字段 | 类型 | 约束 |
|---|---|---|
| `id` | UUID | PK |
| `owner_id` | UUID | FK → users.id, NOT NULL |
| `code` | char(8) | NOT NULL UNIQUE，`[A-Z0-9]` |
| `title` | varchar(60) | NOT NULL |
| `content` | text | NOT NULL |
| `open_at` | timestamptz | NOT NULL, 索引 |
| `in_plaza` | boolean | NOT NULL DEFAULT true |
| `favorite_count` | integer | NOT NULL DEFAULT 0 |
| `created_at` | timestamptz | NOT NULL, 索引 |
| `updated_at` | timestamptz | NOT NULL |

**favorites**

| 字段 | 类型 | 约束 |
|---|---|---|
| `user_id` | UUID | FK → users.id |
| `capsule_id` | UUID | FK → capsules.id |
| `created_at` | timestamptz | NOT NULL |
| PK | `(user_id, capsule_id)` | |
| CHECK | `user_id != capsules.owner_id`（见 §5.3） |

**refresh_tokens**（服务端维护，便于 rotate / 吊销）

| 字段 | 类型 | 约束 |
|---|---|---|
| `id` | UUID | PK |
| `user_id` | UUID | FK |
| `token_hash` | varchar(100) | NOT NULL UNIQUE |
| `family_id` | UUID | NOT NULL（rotate 时保留，便于整家族撤销） |
| `expires_at` | timestamptz | NOT NULL |
| `revoked_at` | timestamptz | NULLABLE |

### 5.3 不变式（Invariants）

- **I1**：不能收藏自己的胶囊。实现层面在 service 里显式校验（数据库 CHECK 需要 subquery，SQLite 不支持，统一用业务校验）。
- **I2**：`favorite_count == COUNT(favorites WHERE capsule_id = c.id)`。所有 favorites 表写操作必须与 capsules 的 `favorite_count` 在同一事务里完成。
- **I3**：`code` 严格 8 位 `[A-Z0-9]`。生成失败重试最多 5 次。
- **I4**：`open_at > created_at + 60 seconds` 在创建时校验。

## 6. API 契约

完整定义见 `spec/api/openapi.yaml`。人话版见 [docs/api-contract.md](api-contract.md)。本节只给总览。

### 6.1 统一响应形式

```json
{
  "success": true | false,
  "data": <object | array | null>,
  "message": <string | null>,
  "errorCode": <string | null>
}
```

错误码枚举：`VALIDATION_ERROR`、`UNAUTHORIZED`、`FORBIDDEN`、`NOT_FOUND`、`CONFLICT`、`RATE_LIMITED`、`BAD_REQUEST`、`INTERNAL_ERROR`。

### 6.2 路由清单

**公共**

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/v1/health` | 健康检查 + 技术栈元数据 |
| GET | `/api/v1/avatars` | 内置头像列表 |
| GET | `/api/v1/capsules/{code}` | 按 8 位码查询（凭证即可见） |
| GET | `/api/v1/plaza/capsules` | 广场列表（分页 + sort + filter + q 模糊搜索） |
| GET | `/api/v1/plaza/capsules/{id}` | 广场胶囊详情 |

**鉴权**

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/v1/auth/register` | 注册 |
| POST | `/api/v1/auth/login` | 登录 |
| POST | `/api/v1/auth/refresh` | 刷新 access token |
| POST | `/api/v1/auth/logout` | 登出（吊销 refresh token） |

**登录后**

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/v1/me` | 当前用户资料 |
| PATCH | `/api/v1/me` | 修改昵称 / 头像 |
| POST | `/api/v1/me/password` | 修改密码 |
| POST | `/api/v1/capsules` | 创建胶囊 |
| GET | `/api/v1/me/capsules` | 我创建的 |
| DELETE | `/api/v1/me/capsules/{id}` | 删除我创建的（MUST；胶囊内容与时间一经创建不可修改） |
| GET | `/api/v1/me/favorites` | 我收藏的 |
| POST | `/api/v1/me/favorites` | 收藏 |
| DELETE | `/api/v1/me/favorites/{capsuleId}` | 取消收藏 |

### 6.3 请求鉴权

- `Authorization: Bearer <accessToken>` 头
- access token 过期返回 `401 { errorCode: "UNAUTHORIZED", message: "access_token_expired" }`，前端 SHOULD 自动用 refresh token 换新再重放

### 6.4 `/api/v1/health` 的形状（用于页脚与关于页展示技术栈）

技术栈用**有序数组**表示，每一项包含名称、版本号、图标 URL 三个独立字段：

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "service": "hellotime-pro",
    "stack": {
      "kind": "backend",
      "items": [
        {
          "role": "language",
          "name": "Python",
          "version": "3.12",
          "iconUrl": "/static/icons/python.svg"
        },
        {
          "role": "framework",
          "name": "FastAPI",
          "version": "0.115",
          "iconUrl": "/static/icons/fastapi.svg"
        },
        {
          "role": "database",
          "name": "PostgreSQL",
          "version": "16",
          "iconUrl": "/static/icons/postgresql.svg"
        },
        {
          "role": "orm",
          "name": "SQLAlchemy",
          "version": "2.0",
          "iconUrl": "/static/icons/sqlalchemy.svg"
        }
      ]
    },
    "version": "0.1.0",
    "uptimeSeconds": 1234
  }
}
```

**字段说明**

| 字段 | 类型 | 说明 |
|---|---|---|
| `kind` | `"backend" \| "fullstack"` | 该服务的类型 |
| `items[].role` | string | 技术在栈中的职责，如 `language / framework / database / orm / runtime / template` 等，自由填写 |
| `items[].name` | string | 技术名称，如 `"FastAPI"` |
| `items[].version` | string | 版本号，如 `"0.115"` |
| `items[].iconUrl` | string | 相对路径，指向该后端/全栈自己静态托管的 SVG 图标，如 `/static/icons/fastapi.svg` |

**图标文件约定**

- 图标源文件统一存放在 `spec/icons/*.svg`（来源：[Simple Icons](https://simpleicons.org) 或自绘，统一 24×24 viewBox）
- 每个后端/全栈把 `spec/icons/` 下的文件**复制或软链**到自己的静态文件目录，以 `/static/icons/<name>.svg` 对外暴露
- 前端通过 `<img src="{backendBaseUrl}{iconUrl}">` 渲染；`backendBaseUrl` 从 `:9080` 或全栈自身域名取得
- 若某技术无对应 SVG（如冷门库），`iconUrl` 可为 `null`，前端降级显示文字

**全栈示例（Next.js）**

```json
{
  "kind": "fullstack",
  "items": [
    { "role": "framework",  "name": "Next.js",    "version": "15",  "iconUrl": "/static/icons/nextjs.svg" },
    { "role": "language",   "name": "TypeScript", "version": "5.5", "iconUrl": "/static/icons/typescript.svg" },
    { "role": "runtime",    "name": "Node.js",    "version": "22",  "iconUrl": "/static/icons/nodejs.svg" },
    { "role": "database",   "name": "PostgreSQL", "version": "16",  "iconUrl": "/static/icons/postgresql.svg" },
    { "role": "orm",        "name": "Drizzle",    "version": "0.38","iconUrl": "/static/icons/drizzle.svg" }
  ]
}
```

## 7. 鉴权设计

### 7.1 令牌策略

- **access token**：JWT HS256，有效期 1 小时，payload 含 `sub`（user id）、`nickname`、`avatarId`、`exp`、`iat`
- **refresh token**：不透明随机字符串（256-bit base64url），服务端存 hash + 家族 id
- 登录 / 注册 / refresh 三个端点返回 `{ accessToken, refreshToken, user }`

### 7.2 存储策略（前端）

- 默认方案：**access token 存内存**，**refresh token 存 HttpOnly + Secure + SameSite=Lax Cookie**
- 教学目的下，各前端可以选用"双 token 都放 `localStorage`"的更简单方案，但必须在该前端的 README 里明确权衡（XSS 风险）
- 参考实现（Nuxt）采用默认方案

### 7.3 Rotate + Family

- 每次 refresh：新发 refresh token，标记旧 token 为 `revoked`，但 **family_id 延续**
- 若某次 refresh 使用了一个已 `revoked` 的 token：把整个 family_id 下的所有 refresh token 撤销（表示可能被盗用）

### 7.4 改密码后

- 吊销该 user 所有 refresh token（update `revoked_at = now`）
- 用户需要在其他设备重新登录

## 8. 数据库策略

### 8.1 双驱动

每个后端 / 全栈 **必须** 同时支持 PostgreSQL 和 SQLite。切换通过环境变量：

```bash
DB_DRIVER=postgres   # 默认
DB_URL=postgres://hellotime:hellotime@localhost:55432/hellotime_pro
# 或
DB_DRIVER=sqlite
DB_URL=sqlite://../../data/hellotime.db
```

### 8.2 迁移工具（按栈）

| 栈 | 工具 |
|---|---|
| Spring Boot / Spring MVC | Flyway |
| FastAPI | Alembic |
| Gin | `golang-migrate` |
| Elysia | `drizzle-kit` |
| NestJS | TypeORM migrations 或 `drizzle-kit` |
| ASP.NET Core | EF Core Migrations |
| Vapor | Fluent Migrations |
| Axum | `sqlx migrate` |
| Drogon | 自持简易迁移器（v1 已实现，Pro 在其基础上扩展新表） |
| Ktor | Flyway（与 JDBC 共享） |
| Next.js | `drizzle-kit` |
| Nuxt | `drizzle-kit` |
| Laravel | Laravel Migrations |
| Rails | ActiveRecord Migrations |

所有迁移 **必须** 以 `spec/db/schema.sql`（规范原型）为事实基准；各栈的 migration 只是为了照出相同 schema。

### 8.3 本地开发

- 首选：`docker compose up postgres` 起 PG（端口 55432，数据持久化到 `./data/pg/`）
- 次选：直接用 `data/hellotime.db`（SQLite 文件）
- dev-manager（见 §11）启动服务前会检查 `DB_DRIVER` 对应的前置条件

## 9. 前端架构

### 9.1 共用层

- **Tailwind CSS v4** 为主要样式方案，通过 `tokens.json` 生成 Tailwind preset，保持与 CSS 令牌一致
- `spec/styles/cyber.css` 提供少量不适合 utility class 表达的组件样式（渐变、动画关键帧）
- 每个前端 SHOULD 有一个 `api/client.ts`（fetch 封装，统一错误、自动 refresh token）
- 每个前端 SHOULD 有一个 `types/index.ts`（从 OpenAPI 生成或手维护，但 shape 一致）

### 9.2 各栈状态方案

| 栈 | 状态方案 | 路由 |
|---|---|---|
| Vue 3 | **Pinia**（auth / capsule / plaza store） | `vue-router` |
| React | **Zustand**（小而直接，符合 React 生态风气） | `react-router` |
| Angular | **Signal Store (@ngrx/signals)**（Signals 原生融合） | Angular Router |
| Svelte 5 | **runes + 模块级 store**（Svelte 官方推荐） | `svelte-routing` |
| Solid | **createSignal + createContext**（Solid 的惯用法） | `@solidjs/router` |

> 选择理由：**Pinia** 是 Vue 生态标准；对其他栈特意不统一，因为"各栈用各自习惯"本身就是教学目标。

### 9.3 Tailwind + Design Tokens

流水线：

```
spec/styles/tokens.css (真源)
        │
        │   build step: scripts/build-tokens.mjs
        ▼
spec/tokens/tokens.json
        │
        ├─→ tailwind.config.ts preset (所有前端共用)
        └─→ 各全栈的 Tailwind 配置
```

Tailwind 不允许写任意色值，只允许用语义 token 类：`bg-surface-1`、`text-brand-primary`、`border-plaza-divider`。原始色阶（`brand-50..900`）对 utility 可见，但组件层应优先使用语义类。

### 9.4 组件清单（所有前端 / 全栈必须有）

- `AppHeader`（logo / 首页链接 / 登录态切换）
- `AppFooter`（技术栈展示）
- `ThemeToggle`
- `AuthGate`（路由守卫）
- `CapsuleCard`（广场列表项）
- `CapsuleGrid`（含 sort / filter / 关键词搜索）
- `PlazaToolbar`（`CapsuleGrid` 顶部：sort segmented + filter segmented + `SearchInput` 300ms 防抖）
- `CapsuleForm`（创建）
- `CapsuleCodeInput`（8 位码输入）
- `CapsuleDetail`（未开启倒计时 + 已开启正文）
- `FavoriteButton`（含匿名用户跳登录提示）
- `AvatarPicker`（9 / 10 宫格 + 选中态）
- `NicknameField`（带唯一性异步校验）
- `LoginForm` / `RegisterForm` / `PasswordChangeForm`
- `MeLayout`（左侧我的二级菜单 + 右侧内容区）

## 10. 后端架构（通用分层建议）

每个后端都 SHOULD 采用以下分层（具体命名随栈惯例）：

```
presentation (route / controller)
      │
      ▼
application (service)
      │
      ▼
domain (entity + rules)
      │
      ▼
infrastructure (repo / orm / migration / auth providers)
```

关键服务：

- `AuthService`：注册、登录、token rotate、修改密码、吊销
- `UserService`：资料读写、昵称冲突校验
- `CapsuleService`：创建、查询、按 code 查、按 id 查、隐藏 content 规则
- `PlazaService`：广场列表（sort / filter / 模糊搜索 q / 分页 + 是否已收藏投影）
- `FavoriteService`：收藏 / 取消收藏 + 计数同步

## 11. 全栈架构

五套全栈实现彼此独立，不共享代码。每一套自己实现：

- 所有 `/api/v1/*` 端点（和 10 个后端一致）
- 一套面向用户的 Web 前端
- 用该框架的惯用技术（Next 用 App Router + Server Actions；Nuxt 用 Nitro + `useAsyncData`；Spring MVC 用 Thymeleaf + HTMX；Laravel 用 Blade + Alpine.js；Rails 用 ERB + Turbo）

全栈不走 `:9080` 代理，端口固定（见 §4）。

## 12. 热度算法

按用户确认：**最热 = 收藏数降序**，无衰减。

```sql
-- plaza hot（含可选模糊搜索 q）
SELECT c.*, u.nickname, u.avatar_id
FROM capsules c JOIN users u ON c.owner_id = u.id
WHERE c.in_plaza = true
  AND (
    $filter = 'all'
    OR ($filter = 'opened'   AND c.open_at <= now())
    OR ($filter = 'unopened' AND c.open_at >  now())
  )
  AND (
    $q IS NULL
    OR lower(c.title)    LIKE '%' || lower($q) || '%'
    OR lower(u.nickname) LIKE '%' || lower($q) || '%'
  )
ORDER BY c.favorite_count DESC, c.created_at DESC
LIMIT $pageSize OFFSET ($page - 1) * $pageSize;
```

模糊搜索规则：

- **跨库可移植**：统一用 `lower(col) LIKE '%' || lower($q) || '%'`（Postgres 与 SQLite 都支持）
- 服务端先对 `q` 做 `trim`，结果为空当未传处理；长度越界返回 `VALIDATION_ERROR`
- `total` 基于过滤后的结果集；分页信息准确反映搜索后的总数

索引建议：

- `capsules(in_plaza, favorite_count DESC, created_at DESC)`
- `capsules(in_plaza, created_at DESC)`
- `capsules(in_plaza, open_at)`（过滤支撑）
- `capsules(owner_id, created_at DESC)`（"我创建的"支撑）
- `favorites(user_id, created_at DESC)`（"我收藏的"支撑）
- **（Postgres SHOULD）** `pg_trgm` GIN 索引加速前后缀模糊搜索：
  - `capsules USING gin (lower(title)    gin_trgm_ops)`
  - `users    USING gin (lower(nickname) gin_trgm_ops)`
  - SQLite 无等价索引；数据量小可接受全表 `LIKE` 扫描

## 13. 内置头像

- 10 个 SVG 赛博风格头像，存在 `spec/avatars/*.svg`
- 每个头像有 `id`（小写 kebab-case，如 `neo` / `specter` / `glyph`）、中文名、主色
- `spec/avatars/catalog.json` 为事实源；`GET /api/v1/avatars` 直接返回
- 设计由 `ui-prototype/` 原型驱动；本项目自制，不依赖外部资源

## 14. dev-manager v2（`scripts/hello`）

老项目的 `dev-manager.py` 已经很好，v2 在其基础上**合并端口代理切换**，统一入口为单个可执行：

### 14.1 CLI

```bash
./scripts/hello                    # Web UI (http://127.0.0.1:9090)
./scripts/hello status
./scripts/hello start <name>       # name 例 fastapi / react / next-ts
./scripts/hello stop <name>
./scripts/hello restart-all
./scripts/hello switch <backend>   # 切换 :9080 → backend 端口
./scripts/hello doctor             # 检查环境依赖（JDK / Python / Go / ...）
./scripts/hello logs <name>        # 尾部日志
```

### 14.2 Web UI 页面

- 所有实现的启停 / 状态 / 日志
- `:9080` 当前指向显示与切换
- DB_DRIVER 当前值显示与切换（切换时提示需要重启已启动的服务）
- 一键打开前端 URL
- 健康检查聚合

### 14.3 技术选型

- Python 3.11+，单文件实现（沿用老项目路线）
- `aiohttp` 做 Web UI 后端；前端用纯 HTMX + Alpine.js，不引入 npm 依赖
- 进程管理：用 `asyncio.create_subprocess_exec`，状态写入 `./data/.hello-state.json`
- 端口代理：macOS 用 `pfctl` 或轻量 Python `asyncio` TCP 代理；Linux 同方案

> 选择不依赖 `nginx` 等外部工具是为了**零依赖本地跑起来**。若读者愿意可以替换。

## 15. 测试与验证策略

### 15.1 三层

| 层 | 目标 | 工具 |
|---|---|---|
| 单元 | 各实现内部逻辑 | 栈原生（pytest / jest / go test / swift test / ...） |
| 契约 | 从外部黑盒验证 API 行为与 spec 一致 | 自研 `verify-contract.sh`（见下） + Schemathesis 辅助 |
| UI 冒烟 | 从外部跑一遍主流程 | Playwright（单一套用例，跑到 :9080 + 任一前端） |

### 15.2 契约验证脚本

`verification/scripts/verify-contract.sh <target>` 对一个后端 / 全栈跑完整脚本：

1. 启动目标（通过 `hello start`），等健康检查
2. 注册 2 个用户 → 登录 → 创建若干胶囊（含 `inPlaza=true/false`）
3. 跑 [`verification/contract/*.spec.ts`](../verification/contract/)（fetch + 断言）
4. 验证未到期 `content = null`
5. 验证广场只返回 `in_plaza = true`
6. 验证收藏不能收藏自己 / 不能收藏 private
7. 验证热度排序正确
8. 清理

输出统一的绿 / 红报告。

### 15.3 UI 冒烟

`verification/scripts/verify-ui-smoke.sh <frontend>`：

- 对前端启动 dev 服务器
- Playwright 用例：注册 → 创建公开胶囊 → 登出 → 匿名浏览广场看到 → 再登另一用户 → 收藏 → 进"我收藏的"看到

### 15.4 Design Token 验证

`verification/scripts/verify-design-tokens.sh` 静态比对：

- 读 `spec/styles/tokens.css` 提取所有语义变量
- 扫描每个前端构建产物是否引用了未声明的 token
- 失败即红灯

## 16. 本地开发体验（Day-1 指标）

一个新开发者拿到仓库后，SHOULD 能在 **15 分钟内** 看到首页：

1. `git clone`
2. `./scripts/hello doctor` 告知依赖缺失
3. 一键 `docker compose up -d postgres`
4. `./scripts/hello start nest vue3-ts` 启一对参考栈
5. 打开 `http://localhost:7173` 看到广场（即使是空的）

`README.md` 必须以此为主叙事。

## 17. 风险与权衡

| 风险 | 影响 | 缓解 |
|---|---|---|
| 10 后端 × Postgres + SQLite 双驱动维护成本高 | 迁移难写、修 bug 慢 | 先打通参考栈，其他栈按模板补；Schemathesis 兜底契约 |
| Tailwind 的 utility 风被某些栈（Angular）不适 | 模板变脏 | Angular 中允许以组件级 `.scss` 写 token 类别名 |
| 每次 refresh 去数据库增加延迟 | 登录态切换慢感知 | refresh 是低频事件（1h 一次），可接受 |
| `favorite_count` 冗余计数器一致性 | 排序错误 | 事务写 + 契约验证覆盖 |
| 5 全栈各自样式漂移 | 视觉不一致 | Design Token 验证脚本把关 |

## 18. 和 v1 的替换关系

**不共用**：仓库独立；数据库独立（`hellotime_pro`）；不迁移胶囊。

**可借鉴**：

- v1 `dev-manager.py` 的进程管理代码风格
- v1 `spec/styles/cyber.css` 的设计基因（色调、霓虹感）
- v1 各栈的项目脚手架（作为起手式，不是复制粘贴）

**必须重写**：鉴权、数据模型、前端路由、状态管理、首页信息架构。
