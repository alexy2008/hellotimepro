# HelloTime Pro 总体设计

> 版本 2.0 · 2026-11-17 · 面向对象：第一次接触本项目的新开发者
>
> 2.0 相对 0.1 的设计变化：收藏不再校验状态（§5.3）、两个统计接口（§6.2、§12.1）、双皮肤与令牌分层（§9.3）、组件清单与测试钩子（§9.4、§9.5）、胶囊专属色（§9.6）、头像新画法（§13）、验证策略（§15）。

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
│   ├── styles/               ← 见 §9.3
│   │   ├── base.css          ← 皮肤无关：间距、字号阶梯、动效曲线与时长、层级、版心
│   │   ├── paper/            ← 「时笺」：tokens.css + components.css + pages.css
│   │   ├── amber/            ← 「琥珀」：同上
│   │   ├── shell.css         ← 皮肤切换开关与转场
│   │   └── build_tokens.py   ← 生成 / 校验 spec/tokens/skins.json
│   ├── tokens/
│   │   └── skins.json        ← 2.0 语义令牌的 JSON 投影，供 JS / 原生客户端消费
│   ├── ui/
│   │   ├── testids.md        ← 界面测试钩子契约（UI 冒烟唯一依赖）
│   │   └── copy.md           ← 两套皮肤共用的文案（校验提示、关于页、确认框）
│   ├── avatars/
│   │   └── v2/               ← 2.0：neo.svg … void.svg 十个单线徽记（currentColor）+ catalog.json（id / 名称 / 题记 / 主色）
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
├── ui-prototype/                 ← 1.x 设计原型（HTML 静态页）
└── 2.0版原型byClaude-合集/        ← 2.0 设计原型：「时笺」「琥珀」双皮肤，视觉与交互基准
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
| `avatar_id` | varchar(20) | NOT NULL，取值为 `spec/avatars/v2/catalog.json` 中的 id |
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
| FK | `capsule_id` → `capsules.id` `ON DELETE CASCADE` | 删除胶囊时连带删除收藏 |

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

- **I1**（2.0 移除）：1.x 的"不能收藏自己的胶囊 / 不能收藏 `inPlaza = false` 的胶囊"不再成立。收藏只要求胶囊存在；各实现删掉对应的业务校验。
- **I2**：`favorite_count == COUNT(favorites WHERE capsule_id = c.id)`。所有 favorites 表写操作必须与 capsules 的 `favorite_count` 在同一事务里完成。
- **I3**：`code` 严格 8 位 `[A-Z0-9]`。生成失败重试最多 5 次。
- **I4**：`open_at > created_at + 60 seconds` 在创建时校验。
- **I5**：删除胶囊与删除它的所有收藏在同一事务里完成（依赖外键级联，或显式先删收藏）。SQLite 必须开启 `PRAGMA foreign_keys = ON`，否则级联不生效。
- **I6**：`title`、`content`、`open_at` 创建后不可修改；没有任何更新接口。

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
| GET | `/api/v1/plaza/stats` | **2.0 新增**：广场统计（各筛选的数量受 `q` 影响；最远 / 最近开启时刻） |
| GET | `/api/v1/plaza/capsules/{id}` | 广场胶囊详情（2.0 前端不再使用，契约保留） |
| POST | `/api/v1/capsule-suggestion` | AI 生成胶囊正文与建议开启天数（标题可空） |
| GET | `/api/v1/capsule-recommendations` | AI 推荐主题（LLM 不可用时返回空数组） |

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
| GET | `/api/v1/me/stats` | **2.0 新增**：我的统计（创建 / 已开启 / 未开启 / 在广场 / 被收藏 / 收藏了） |
| DELETE | `/api/v1/me/capsules/{id}` | 删除我创建的（不限状态；连带删除所有收藏；不可恢复） |
| GET | `/api/v1/me/favorites` | 我收藏的（可能含 `inPlaza = false` 的胶囊） |
| POST | `/api/v1/me/favorites` | 收藏（2.0 起不校验状态；不存在 404，非法 UUID 422，重复幂等） |
| DELETE | `/api/v1/me/favorites/{capsuleId}` | 取消收藏（幂等） |

> 2.0 是破坏性升级：所有实现一起升，不做能力协商。`/api/v1/health` 的 `version` 固定返回 `"2.0.0"`，验证脚本据此确认目标已升级。

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
    "version": "2.0.0",
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
- 教学目的下，各前端 / 全栈可以选用"access token 存内存，refresh token + user 放 `localStorage`"的更简单方案，但必须在该实现的 README 里明确权衡（XSS 风险）
- 采用 HttpOnly Cookie 的实现必须额外处理 CSRF；采用纯 header token 的实现不需要 cookie CSRF，但要接受 XSS 风险权衡

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

- **Tailwind CSS v4** 只用于少量布局 utility；颜色、字体、间距一律走 `spec/styles` 的令牌（§9.3）
- 每个前端 SHOULD 有一个 `api/client.ts`（fetch 封装，统一错误、自动 refresh token 并重放）
- 每个前端 SHOULD 有一个 `types/index.ts`（从 OpenAPI 生成或手维护，但 shape 一致），2.0 新增 `PlazaStats`、`MyStats`
- 2.0 的视觉原型在 `2.0版原型byClaude-合集/`（纯静态，可直接双击打开）：它是两套皮肤的**视觉与交互基准**，实现时以它为参照，以 `spec/` 为契约

### 9.2 各栈状态方案

| 栈 | 状态方案 | 路由 |
|---|---|---|
| Vue 3 | **Pinia**（auth / plaza / ui store；capsule 逻辑内联在页面） | `vue-router` |
| React | **Zustand**（小而直接，符合 React 生态风气） | `react-router` |
| Angular | **Signal Store (@ngrx/signals)**（Signals 原生融合） | Angular Router |
| Svelte 5 | **runes + 模块级 store**（Svelte 官方推荐） | `svelte-routing` |
| Solid | **模块级 createStore + createSignal**（Solid 的惯用法） | `@solidjs/router` |

> 选择理由：**Pinia** 是 Vue 生态标准；对其他栈特意不统一，因为"各栈用各自习惯"本身就是教学目标。

2.0 在各栈的 store 里新增两份**跨皮肤保留**的状态：

- `ui`：`skin`（`paper | amber`）、`theme`（`light | dark`），持久化到 `localStorage` 的 `hellotime.skin`、`hellotime.theme`
- `draft`：创建页草稿（标题、正文、开启时间、是否发布到广场），只放内存，封存成功后清空
- 广场的 `sort / filter / q / page` 1.x 已在 plaza store 里，切换皮肤时不重置

### 9.3 皮肤机制与令牌分层

**两个正交维度，挂在 `<html>` 上：**

```html
<html data-skin="amber" data-theme="dark">
```

- `data-skin`：`paper`（时笺）| `amber`（琥珀），默认 `amber`
- `data-theme`：`light` | `dark`，默认跟随 `prefers-color-scheme`
- 两个属性 MUST 在首帧之前由 `index.html` 里的内联脚本（或服务端模板）根据 `localStorage` 写好，否则会闪出另一套皮肤
- 切换时 MAY 用 View Transitions 做转场（换皮肤：模糊淡入淡出；换明暗：从开关处圆形晕开），MUST 在 `prefers-reduced-motion` 或不支持时直接切换

**样式分三层，全部位于 `spec/styles/`：**

```
spec/styles/base.css                 ← 第一层：皮肤无关的刻度，不含颜色
                                        --space-*、--text-*（字号阶梯）、--ease-*、--dur-*、--z-*、版心
spec/styles/<skin>/tokens.css        ← 第二层：皮肤令牌，明 / 暗两套
                                        · 私有令牌：沿用原型的命名（时笺 --paper / --ink / --seal…，琥珀 --bg / --text / --amber…），
                                          只给本皮肤的组件样式用
                                        · 语义层：--color-* / --bg-primary / --font-* / --radius-* / --shadow-card / --shadow-pop / --header-h，
                                          两套皮肤同名同集合（44 个），全部是对私有令牌的 var() 引用
spec/styles/<skin>/components.css    ← 第三层：基础排版、外壳、可复用部件（按钮、字段、分段、卡片、对话框、Toast…）
spec/styles/<skin>/pages.css         ←         各页面的版式与仪式性动画
spec/styles/shell.css                ← 两套皮肤共用的外壳：皮肤切换开关、皮肤转场
spec/styles/build_tokens.py          ← 生成 spec/tokens/skins.json；--check 校验语义层同名同集合、JSON 是否最新
spec/tokens/skins.json               ← { base, skins: { paper: { light, dark }, amber: { light, dark } } }，只含语义层，值已展开
```

规则：

- **全部选择器按皮肤限定**：每条规则都以 `:root[data-skin="<skin>"]` 开头，`@keyframes` 加 `<skin>-` 前缀。两套皮肤的样式表因此可以同时加载、互不干扰，切换皮肤只改 `<html data-skin>`
- **加载顺序固定**：`base.css` → 时笺三件 → 琥珀三件 → `shell.css`。各实现原样引入，不做二次加工
- **类名就是原型的类名**（`.btn`、`.cap__title`、`.hquick__in`…，BEM 风格），组件的 DOM 结构以 2.0 原型为准：实现某个组件时，照原型里那套皮肤的模板写出同样的结构与类名，样式自然就对了。原型本身直接引用 `spec/styles`，它就是这套样式的活样本
- **各实现自己写的样式**（布局胶水、框架特有的包装）只能引用 `base.css` 与语义层，不得引用私有令牌，不得写色值字面量。`spec/styles` 本身可以有字面量（插画、光效里的固定色）
- 与 Tailwind 共存：皮肤类名带 `:root[data-skin]` 前缀，特异性高于 utility；实现里不要给同一元素同时套用同名含义冲突的 utility（如 `.container`、`.grid`）
- **1.x 遗留**：`palette.css`、`tokens.css`、`cyber.css`（`cy-*` 类）与 `spec/tokens/tokens.json` 暂时保留，因为尚未升级的实现还在引用。20 个 Web 实现全部迁到 2.0 后删除前三个；`tokens.json` 等桌面端与移动端在下一轮升级后删除

**结构差异怎么办**：两套皮肤不只是换色——时笺的卡片是信封，琥珀的卡片是胶囊；时笺用长按火漆封缄，琥珀用按钮。因此：

- **逻辑层共享**：store、api client、路由守卫、倒计时、表单校验、收藏的乐观更新，每个实现只写一份
- **视图层按皮肤分**：结构差异大的组件（卡片、首页 hero、创建页的封缄台、详情页的开启动画、页头页脚）每套皮肤一份，放在 `skins/paper/`、`skins/amber/` 之类的目录里，通过当前 `skin` 选择渲染哪一份；结构相同只是样式不同的组件（表单字段、分段控件、分页、对话框、Toast）只写一份，靠令牌换肤
- 无论哪套皮肤，**测试钩子（§9.5）与文案（`spec/ui/copy.md`）完全相同**
- 全栈（服务端模板）同理：模板按皮肤分片段，切换皮肤 MAY 整页刷新，但 MUST 保留草稿与筛选（草稿可暂存 `sessionStorage`）

**字体**：时笺用宋体标题（思源宋体）+ 衬线拉丁（Cormorant Garamond）+ 等宽（IBM Plex Mono）；琥珀全部用系统字体。网络字体 MUST 自托管（放在实现的静态目录，或由 `spec/assets/fonts/` 提供子集），不得依赖 Google Fonts 等外网 CDN；回退到系统字体时版式不能崩。

### 9.4 组件清单（所有前端 / 全栈必须有）

标 **[分皮肤]** 的组件每套皮肤各一份，其余共用一份。

**外壳**

- `AppHeader` [分皮肤]：品牌、主导航（广场 / 开启 / 创建 / 我的）、皮肤开关、明暗开关、登录态
- `AppFooter` [分皮肤]：技术栈（来自 `/health`）
- `TabBar`：手机宽度下的底部标签栏
- `SkinSwitcher`：两个选项的单选组（`role="radiogroup"`，选项 `aria-checked`）；`ThemeToggle`：`role="switch"` 开关。两者互相独立
- `AuthGate`：路由守卫，未登录跳 `/login?redirect=`
- `Toast`、`ConfirmDialog`（焦点圈定、Esc 关闭、确认按钮可设危险色）

**首页 / 广场**

- `HomeHero` [分皮肤]：标题、创建入口、就地输码（直接复用 `CapsuleCodeInput` 的小号，两套皮肤都是 8 格）
- `PlazaStats` [分皮肤]：广场概览（`/plaza/stats`）
- `PlazaToolbar`：sort 分段 + filter 分段（带数量）+ `SearchInput`（300ms 防抖）
- `CapsuleGrid`：列表、加载骨架、空态、出错重试、分页
- `CapsuleCard` [分皮肤]：已开启 / 未开启在形态上区分；未开启有倒计时与模糊遮蔽
- `FavoriteButton`：收藏数 + 状态；匿名用户跳登录；乐观更新

**胶囊**

- `CapsuleCodeInput` [分皮肤]：8 格输码（四四分组，大小两号），粘贴整码、退格回跳、输满自动查询；首页与开启页共用
- `MySealedList`：开启页的「我封存过的胶囊」（至多 3 枚）
- `CapsuleDetail` [分皮肤]：未开启倒计时（归零自动开启）+ 已开启正文 + 开启动画 + 复制码 / 链接
- `CreatePage` [分皮肤]：表单内联；`OpenAtPicker`（快捷时长 + 日历 + 时间）、`AiAssist`（推荐主题 chip、换一批、AI 生成）、`SealControl`（长按或按钮）、`SealedReceipt`（封存完成，展示码）

**账号**

- `LoginForm` / `RegisterForm` / `PasswordChangeForm`
- `AvatarPicker`：10 宫格 + 选中态
- `Avatar`：按 `avatarId` 渲染单线徽记（§13）
- `NicknameField`：带唯一性异步校验
- `MeLayout` [分皮肤]：页头统计（`/me/stats`）+ 二级菜单（带数量）+ 内容区
- `MyCapsuleRow`：每行带「删除」按钮（含已开启），点击弹 `ConfirmDialog`

**关于**

- `AboutPage` [分皮肤]：文字来自 `spec/ui/copy.md`；技术栈只列本实现

### 9.5 界面测试钩子

UI 冒烟不再依赖类名、按钮文案和 DOM 结构，只依赖 `data-testid`。完整清单与交互约定见 [`spec/ui/testids.md`](../spec/ui/testids.md)。要点：

- 每个实现、每套皮肤 MUST 在等价元素上提供同名 `data-testid`；同一页面内的列表项用同名 testid 重复出现，并用 `data-code` 等属性携带标识
- 状态用 `data-state` 等属性表达（例如卡片的 `data-state="opened|sealed"`、收藏按钮的 `aria-pressed`），不让测试去读文案
- 长按类控件 MUST 同时响应键盘：按下空格开始、松开结束；长按时长 ≤ 1200ms。测试统一用 `press('Space', { delay: 1500 })` 触发，普通按钮天然满足
- `verify-ui-smoke.sh` 对每个前端 / 全栈在 `paper`、`amber` 两套皮肤下各跑一遍（通过预置 `localStorage` 的 `hellotime.skin` 切换）

### 9.6 胶囊专属色（琥珀）

琥珀给每枚胶囊一种颜色，由胶囊码算出，任何实现结果一致：

```
h   = FNV-1a 32 位哈希(code)            // 初值 0x811c9dc5，素数 0x01000193，按 UTF-16 码元逐个异或再乘
hue = h mod 360
hue2 = (hue + 40 + ((h >>> 9) mod 41)) mod 360

capLight = oklch(0.84 0.14 hue)          // 舱盖亮面
capDeep  = oklch(0.63 0.19 hue)          // 舱盖暗面
accent   = oklch(0.78 0.13 hue2)         // 点缀
glow     = oklch(0.72 0.17 hue / 0.34)   // 光晕
```

OKLCH 固定亮度与彩度、只变色相，任何色相看上去一样鲜亮。品牌默认色取 `hue = 68, hue2 = 300`。这些值属于"由数据算出的颜色"，是组件层不得硬编码色值规则的唯一例外，计算函数放在共享逻辑层。

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
- `PlazaService`：广场列表（sort / filter / 模糊搜索 q / 分页 + 是否已收藏投影）+ 广场统计（复用列表的过滤与搜索条件）
- `FavoriteService`：收藏 / 取消收藏 + 计数同步（2.0 起只校验胶囊存在）
- `MeService`（或并入 `CapsuleService`）：我的统计；删除自己的胶囊（连带收藏，同一事务）

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

> 2.0 起作者可以收藏自己的胶囊，因此"最热"里作者本人的那一票也算数。这是有意接受的结果，不做扣除。

### 12.1 统计查询（2.0）

**广场统计 `GET /plaza/stats`**：`counts` 与列表**同一套 WHERE**（`in_plaza` + 可选 `q`），只是不带 `filter`、改成条件计数；两个时刻不受 `q` 影响。

```sql
-- counts（与列表共用 q 条件；all = opened + unopened 恒成立）
SELECT count(*)                                   AS all,
       count(*) FILTER (WHERE c.open_at <= now()) AS opened,   -- SQLite：sum(CASE WHEN ... THEN 1 ELSE 0 END)
       count(*) FILTER (WHERE c.open_at >  now()) AS unopened
FROM capsules c JOIN users u ON c.owner_id = u.id
WHERE c.in_plaza = true
  AND ($q IS NULL OR lower(c.title) LIKE ... OR lower(u.nickname) LIKE ...);

-- 两个时刻（不带 q）
SELECT max(open_at)                              AS farthest_open_at,
       min(open_at) FILTER (WHERE open_at > now()) AS next_open_at
FROM capsules WHERE in_plaza = true;
```

- "现在"取一次，三处判断共用同一个时刻，避免边界上 `opened + unopened ≠ all`
- `q` 的 trim 与长度校验与列表完全相同，越界同样返回 `VALIDATION_ERROR`

**我的统计 `GET /me/stats`**：

```sql
SELECT count(*)                                     AS created,
       count(*) FILTER (WHERE open_at <= now())     AS opened,
       count(*) FILTER (WHERE open_at >  now())     AS unopened,
       count(*) FILTER (WHERE in_plaza)             AS in_plaza,
       coalesce(sum(favorite_count), 0)             AS favorites_received
FROM capsules WHERE owner_id = $me;

SELECT count(*) AS favorites_given FROM favorites WHERE user_id = $me;
```

- 胶囊数量包含 `in_plaza = false` 的胶囊
- `favorites_received` 直接对冗余计数求和，依赖不变式 I2

## 13. 内置头像

- 10 个头像，2.0 版放在 `spec/avatars/v2/`：`<id>.svg` + `catalog.json`。`id` 沿用 1.x（`neo`、`specter`、`glyph`、`pulse`、`circuit`、`nova`、`oracle`、`drift`、`echo`、`void`），**数据库与接口不变**
- 画法是**单线徽记**：24×24 视口、圆端点圆拐角，只用 `currentColor`，不含底色；文件里的描边 1.6 只是默认值。由皮肤决定怎么上色：时笺是主色淡底 + 主色线（描边 1.6），琥珀是主色渐变底 + 浅色线（描边 1.8）
- 因为用 `currentColor`，前端 SHOULD 内联 SVG（或用 CSS `mask-image` 着色），直接 `<img>` 引用时线条是黑色
- 每个头像有 `id`、中文名（如「新生」）、一句题记（如「破土的芽」）、主色。`spec/avatars/v2/catalog.json` 是 2.0 的事实源，`GET /api/v1/avatars` 直接返回其中的 `avatars`；返回形状不变（`id`、`name`、`primaryColor`、`svgUrl`），`svgUrl` 仍是 `/static/avatars/<id>.svg`，后端升级到 2.0 时把静态目录的来源换成 `spec/avatars/v2/`
- `spec/avatars/` 根目录下的 1.x 赛博头像与 `catalog.json` 暂留给尚未升级的桌面端与移动端，下一轮升级后删除，`v2/` 再上移到根目录
- 画法与原型 `2.0版原型byClaude-合集/assets/js/data.js` 的 `HT.AVATARS` 一致；本项目自制，不依赖外部资源

## 14. dev-manager v2（`scripts/hello`）

老项目的 `dev-manager.py` 已经很好，v2 在其基础上**合并端口代理切换**，统一入口为单个可执行：

### 14.1 CLI

```bash
./scripts/hello                    # Web UI (http://127.0.0.1:9090)
./scripts/hello status
./scripts/hello start <name>       # name 例 fastapi / react / next-ts
./scripts/hello stop <name>
./scripts/hello stop-external <name>
./scripts/hello restart-all
./scripts/hello switch <backend>   # 切换 :9080 → backend 端口
./scripts/hello doctor             # 检查环境依赖（JDK / Python / Go / ...）
./scripts/hello logs <name>        # 尾部日志
```

### 14.2 Web UI 页面

- 所有实现的启停 / 状态 / 日志
- 区分 hello 管理进程、外部监听进程、端口未就绪进程、健康检查结果
- `:9080` 当前指向、代理监听状态、目标后端可达性显示与切换
- DB_DRIVER 当前值显示与切换（切换时提示需要重启已启动的服务）
- 数据库连接配置；密码只保存在本机 state 文件，Web snapshot 只暴露“是否已配置”
- 一键打开前端 URL
- 健康检查聚合

### 14.3 技术选型

- Python 3.11+，单文件实现（沿用老项目路线）
- Web UI 后端使用 Python 标准库 `http.server`；前端使用原生 `fetch` + DOM，不引入 npm 依赖
- 进程管理：用 `subprocess.Popen(start_new_session=True)`，状态写入 `./data/.hello-state.json`
- 端口代理：轻量 Python TCP 代理；CLI/Web snapshot 同时检查代理监听与目标端口可达性
- dev-manager 自检：`./verification/scripts/verify-hello-manager.sh`

> 选择不依赖 `nginx` 等外部工具是为了**零依赖本地跑起来**。若读者愿意可以替换。

## 15. 测试与验证策略

### 15.1 三层

| 层 | 目标 | 工具 |
|---|---|---|
| 单元 | 各实现内部逻辑 | 栈原生（pytest / jest / go test / swift test / ...） |
| 契约 | 从外部黑盒验证 API 行为与 spec 一致 | 自研 `verify-contract.sh`（见下） + Schemathesis 辅助 |
| UI 冒烟 | 从外部跑一遍主流程 | Playwright（单一套用例，只依赖测试钩子，每套皮肤各跑一遍） |
| 令牌 | 样式只引用已声明的令牌、无硬编码色值 | `verify-design-tokens.sh`（静态扫描） |

### 15.2 契约验证脚本

`verification/scripts/verify-contract.sh <target>` 对一个后端 / 全栈跑完整脚本：

1. 启动目标（通过 `hello start`），等健康检查；确认 `version == "2.0.0"`，否则直接判红
2. 注册 2 个用户 → 登录 → 创建若干胶囊（含 `inPlaza=true/false`）
3. 跑 [`verification/contract/*.spec.ts`](../verification/contract/)（fetch + 断言）
4. 验证未到期 `content = null`
5. 验证广场只返回 `in_plaza = true`
6. 验证收藏：收藏自己的成功；凭码收藏 `inPlaza = false` 的成功并出现在「我收藏的」；不存在 404；非法 UUID 422；重复收藏与重复取消幂等
7. 验证删除：删除后按码查询 404，并从收藏者的「我收藏的」里消失；不能删除别人的
8. 验证统计：`/plaza/stats` 的 `counts` 与三种 `filter` 下列表的 `total` 一致、随 `q` 变化、`all = opened + unopened`；`/me/stats` 与「我创建的 / 我收藏的」的 `total` 一致、未登录 401
9. 验证热度排序正确
10. 清理

输出统一的绿 / 红报告。

### 15.3 UI 冒烟

`verification/scripts/verify-ui-smoke.sh <frontend>`：

- 对前端启动 dev 服务器
- 先跑一遍 `paper`，再跑一遍 `amber`（用 Playwright 的 `storageState` / `addInitScript` 预置 `localStorage['hellotime.skin']`），两遍都绿才算通过
- 用例只通过 `getByTestId` 与 `data-*` 状态属性定位，不读类名，不依赖按钮文案（清单见 `spec/ui/testids.md`）
- 主流程：注册 → 创建公开胶囊 → 登出 → 匿名浏览广场看到 → 再登另一用户 → 收藏 → 进"我收藏的"看到；另覆盖登录回跳、就地输码、删除确认、皮肤与明暗切换后状态保留、AI 推荐（route mock）

### 15.4 Design Token 验证

`verification/scripts/verify-design-tokens.sh` 静态比对：

- 读 `spec/styles/base.css` 与两套 `tokens.css` 的语义层（命名规则见 `build_tokens.py` 的 `SEMANTIC`）
- 扫描每个前端 / 全栈自己的样式源码：`var(--x)` 只能引用 `base.css` 刻度与语义层（实现内部以 `--_` 开头的局部变量除外），引用皮肤私有令牌即红灯
- 组件样式里不得出现十六进制、`rgb()`、`hsl()`、`oklch()` 色值字面量（`spec/styles` 本身与胶囊专属色计算函数除外）
- 两套皮肤的语义令牌必须同名同集合、`spec/tokens/skins.json` 必须是最新的：直接调用 `python3 spec/styles/build_tokens.py --check`
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
| 两套皮肤让视图层工作量翻倍 | 20 个实现 × 2 套视图 | 逻辑层只写一份；结构相同的组件只靠令牌换肤；只有标 [分皮肤] 的组件写两份（§9.4） |
| 两套皮肤行为悄悄分叉 | 某套皮肤缺功能 | 测试钩子 + 每套皮肤各跑一遍冒烟 |
| 时笺的网络字体在国内不可达 | 首屏字体闪烁或版式错乱 | 字体自托管，回退系统字体时版式不崩（§9.3） |
| 琥珀的粒子与毛玻璃在低端机上吃力 | 卡顿、耗电 | 页面不可见时暂停；`prefers-reduced-motion` 时关闭 |

## 18. 和 v1 的替换关系

**不共用**：仓库独立；数据库独立（`hellotime_pro`）；不迁移胶囊。

**可借鉴**：

- v1 `dev-manager.py` 的进程管理代码风格
- v1 `spec/styles/cyber.css` 的设计基因（色调、霓虹感）
- v1 各栈的项目脚手架（作为起手式，不是复制粘贴）

**必须重写**：鉴权、数据模型、前端路由、状态管理、首页信息架构。
