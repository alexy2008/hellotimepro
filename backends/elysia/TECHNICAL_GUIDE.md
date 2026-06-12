# HelloTime Pro Elysia 后端技术手册与代码导读

本文面向已经熟悉 TypeScript / JavaScript 基本语法（模块、async/await、对象类型、Promise），但还没系统接触过 Bun、Elysia、JWT、后端分层或 SQL 方言适配的读者。读完后，你应该能回答三件事：

- 一个 HTTP 请求进入 Elysia 后端后，代码按什么顺序执行。
- Elysia、Bun、Zod、jose、bcryptjs、PostgreSQL/SQLite 分别负责什么。
- 想新增一个接口、字段或业务规则时，应该改哪些文件。

> 阅读建议：第 1 节介绍技术栈与设计特色；第 2～4 节建立整体地图与入口；第 5 节集中讲 Elysia 的几个关键机制；第 6～13 节按一次请求的生命周期分层细讲；第 14 节给出常见改动的步骤清单。

## 1. 技术选型与设计特色

HelloTime Pro 的 Elysia 后端实现基于 **Bun + Elysia + Bun:sqlite / pg** 核心骨架，采用纯 TypeScript 编写，并选用 **Zod** 作为数据校验工具、**jose** 进行 JWT 处理、**bcryptjs** 处理密码哈希，同时支持 **PostgreSQL** 和 **SQLite** 双数据库驱动切换。其具体选型考量与设计特色如下：

* **Bun 与 Elysia（轻运行时与轻框架）**：依托 Bun 的原生 JavaScript/TypeScript 运行时和内置 HTTP 能力，Elysia 用链式 API 显式注册路由，样板代码很少。
* **TypeScript 与 Zod（显式边界校验）**：请求体不使用 Elysia `t` schema，而是统一走 Zod `parse(...)`，方便把错误转换成项目统一的 `details` 结构，也便于和 Nuxt/TS 生态对齐。
* **双数据库方言自适应与原生 SQL**：项目摒弃重量级 ORM，选用 `pg` + `bun:sqlite`，用 `query / one / tx` 三个数据库原语封装占位符适配、连接池和事务。schema 生命周期由仓库级 `scripts/db` 维护，应用启动不建表。
* **轻量函数式分层**：这不是 Spring/Nest 式严格四层架构，而是 Elysia 风格的轻量分层：`main.ts` 负责路由，`services/` 按业务域拆分规则，`db.ts` 只负责连接、查询和事务。

## 2. 先建立整体地图

HelloTime Pro 是一个时间胶囊应用。Elysia 后端的职责是：

- 提供 `/api/v1/*` HTTP API（与 `spec/api/openapi.yaml` 对齐）。
- 校验请求数据：邮箱格式、密码强度、胶囊开启时间、分页参数等。
- 处理用户注册、登录、JWT access token、refresh token 轮转（含令牌族追踪）。
- 读写用户、胶囊、收藏、refresh token 等数据，并维护反规范化字段 `favorite_count`。
- 在 PostgreSQL 和 SQLite 之间切换（通过环境变量），同一套业务逻辑两边都跑得动。
- 暴露 `spec/avatars/*`、`spec/icons/*` 作为静态资源，并提供胶囊建议接口。

核心目录：

```text
backends/elysia/
├── package.json / bun.lockb / tsconfig.json  # Bun 包配置、锁文件、TypeScript 配置
├── run / build / test                        # 三个 Bash 脚本，封装 Bun 命令
├── README.md                                 # 快速使用说明
└── src/
    ├── main.ts        # Elysia 应用入口、路由注册、静态资源服务
    ├── config.ts      # 环境变量 → env 配置对象
    ├── db.ts          # PostgreSQL / SQLite 连接、占位符适配、事务封装
    ├── services.ts    # 业务服务 barrel export
    ├── services/
    │   ├── auth.ts      # 注册、登录、refresh、profile、改密
    │   ├── capsules.ts  # 胶囊创建 / 查询 / 删除
    │   ├── plaza.ts     # 广场列表、我的胶囊、我的收藏
    │   ├── favorites.ts # 收藏 / 取消收藏
    │   └── ai.ts        # 胶囊建议与推荐
    ├── security.ts    # JWT、密码哈希、refresh token 原语
    ├── validation.ts  # Zod 请求 schema
    ├── envelope.ts    # 统一成功 / 错误响应壳
    ├── errors.ts      # ApiError 与 spec errorCode 映射
    ├── avatars.ts     # 读取 spec/avatars/catalog.json
    └── types.ts       # 数据库行 → 响应 DTO 的映射工具
```

一次典型请求的流向：

```text
浏览器 / 前端
  │ HTTP
  ▼
Bun.serve（由 Elysia 封装）
  │
  ▼
Elysia 路由匹配：method + path
  │
  ▼
src/main.ts 中的 route(...) / routeEmpty(...)
  │ 读取 body、params、query、headers
  │ Zod parse(...) 校验请求体
  │ requireClaims / readClaims 解析 Bearer token
  ▼
src/services/*
  │ 业务规则、事务、DTO 组装
  ▼
src/db.ts
  │ query / one / tx
  ▼
PostgreSQL 或 SQLite
```

返回方向：service 返回普通对象，`route(...)` 用 `ok(...)` 包成 `{ success: true, data, message: null, errorCode: null }`；出错时抛 `ApiError`，`errorResponse(...)` 输出统一错误壳。

## 3. 如何运行和验证

开发运行：

```bash
cd backends/elysia
DB_DRIVER=sqlite ./run      # SQLite，零外部服务依赖
../../scripts/db reset --seed # 显式准备数据库
./run                       # 默认 PostgreSQL
```

默认端口是 `29030`。启动后可访问：

- 健康检查：`http://127.0.0.1:29030/api/v1/health`
- 头像列表：`http://127.0.0.1:29030/api/v1/avatars`

类型检查：

```bash
./build
```

契约验证需要从仓库根目录运行：

```bash
DB_DRIVER=sqlite ./verification/scripts/verify-contract.sh elysia
./verification/scripts/verify-contract.sh elysia
```

三个脚本做的事：

- `run`：设置默认 `PORT=29030`；若没有 `node_modules` 则 `bun install`；最后 `bun src/main.ts`。
- `build`：安装依赖后执行 `bun run typecheck`，即 `tsc --noEmit`。
- `test`：安装依赖后执行 `bun test`，目前作为单元测试入口保留。

> 第一次运行会下载 npm 包到 `node_modules/`。Bun 自带 TypeScript 执行能力，所以开发运行不需要单独编译。

## 4. 入口：`src/main.ts`

`main.ts` 是整个 Web 服务的装配层。启动顺序是：

```typescript
const app = new Elysia()
  .onError(({ error }) => errorResponse(error))
  .get("/static/avatars/:file", ...)
  .get("/static/icons/:file", ...)
  .get("/api/v1/health", ...)
  .post("/api/v1/auth/register", ...)
  // ...
  .listen({ port: env.port, hostname: "0.0.0.0" });
```

几个要点：

- **启动只装配服务**：数据库 schema 由根目录 `scripts/db` 显式准备，`main.ts` 不在监听前建表或迁移。
- **路由集中注册**：Elysia 使用链式 API 注册路由，每个 `.get/.post/.patch/.delete` 都对应一个 HTTP 端点。
- **静态资源直读 spec**：`/static/avatars/:file` 和 `/static/icons/:file` 通过 `Bun.file(...)` 读取仓库 `spec/` 下的 SVG。
- **统一错误兜底**：`.onError(({ error }) => errorResponse(error))` 捕获没有被 `route(...)` 包住的异常。
- **204 特殊处理**：登出、改密、删除、取消收藏等端点用 `routeEmpty(...)` 返回空 body，满足契约测试对 204 的要求。

典型路由长这样：

```typescript
.post("/api/v1/capsules", ({ set, body, request }) =>
  route(set, async () => {
    const claims = await requireClaims(request.headers);
    return createCapsule(claims.id, parse(createCapsuleSchema, body));
  }, 201),
)
```

这段代码的顺序非常固定：

1. `requireClaims(...)` 要求登录。
2. `parse(createCapsuleSchema, body)` 校验请求体。
3. 调用 service 层 `createCapsule(...)`。
4. `route(..., 201)` 把结果包成成功响应，并设置 HTTP 201。

## 5. Elysia 的几个关键思想

Elysia 是 Bun 生态里的轻量 Web 框架。这个项目没有使用插件式 DI 或 ORM 装饰器，整体刻意保持显式：路由在 `main.ts`，业务按域拆到 `services/`，数据库在 `db.ts`。

### 4.1 路由上下文

Elysia handler 会收到一个上下文对象：

```typescript
({ set, body, params, request }) => { ... }
```

本项目常用字段：

| 字段 | 用途 |
|---|---|
| `set` | 设置响应状态码，例如 `set.status = 201` |
| `body` | JSON 请求体 |
| `params` | URL 路径参数，例如 `:code` / `:id` |
| `request` | 原生 Web `Request`，用于读 `headers` 和完整 URL |

查询参数没有专门包装，直接用标准 API：

```typescript
const s = new URL(request.url).searchParams;
const sort = s.get("sort") ?? "new";
```

### 4.2 显式包装响应

Elysia 可以直接返回对象，但 spec 要求所有 JSON 响应有统一 envelope。为避免每个路由手写重复结构，本项目封装了两个函数：

```typescript
route(set, async () => serviceCall(), 200)
routeEmpty(async () => serviceCall(), 204)
```

- `route`：成功时返回 `{ success: true, data, message: null, errorCode: null }`。
- `routeEmpty`：成功时返回 `new Response(null, { status: 204 })`。
- 两者都会捕获异常并交给 `errorResponse`。

### 4.3 为什么校验用 Zod 而不是 Elysia t

Elysia 自带 `t` schema，但本项目选择 Zod，原因是：

- 现有 Nuxt 全栈实现也用 Zod，校验规则更容易对齐。
- Zod 的 `safeParse` 很适合转换成 spec 的 `details: [{ field, message }]`。
- 复杂规则如昵称 Unicode 正则、密码强度、`minProperties` 更直观。

因此，请求体校验统一走：

```typescript
parse(registerSchema, body)
```

而不是把 schema 挂进 Elysia 路由配置。

## 6. 配置层：`src/config.ts`

配置对象 `env` 在模块加载时从环境变量读取：

```typescript
export const env = {
  port: num(process.env.PORT, 29030),
  serviceName: process.env.SERVICE_NAME ?? "hellotime-pro",
  dbDriver: (process.env.DB_DRIVER ?? "postgres").toLowerCase() as "postgres" | "sqlite",
  dbUrl: process.env.DB_URL ?? "...",
  jwtSecret: process.env.JWT_SECRET ?? "dev-secret-change-me",
  accessTokenTtlSeconds: num(process.env.ACCESS_TOKEN_TTL_SECONDS, 3600),
  refreshTokenTtlSeconds: num(process.env.REFRESH_TOKEN_TTL_SECONDS, 7 * 24 * 3600),
  // ...
};
```

几个约定：

- `DB_DRIVER=postgres` 是默认值。
- `DB_DRIVER=sqlite` 时，`scripts/hello` 会为每个实现派生独立 SQLite 文件，例如 `hellotime-elysia.db`。
- `DB_URL` 如果外部传入，会覆盖默认连接串。
- `LLM_ENABLED`、`LLM_BASE_URL`、`LLM_API_KEY`、`LLM_MODEL` 用于胶囊建议接口；未配置时走本地模板兜底。

## 7. 数据库层：`src/db.ts`

`db.ts` 做三件事：

- 根据 `env.dbDriver` 建立 PostgreSQL 或 SQLite 连接。
- 提供统一的 `query(...)`、`one(...)` 查询函数。
- 提供跨库事务封装 `tx(...)`。

### 6.1 连接建立

PostgreSQL 使用 `pg.Pool`：

```typescript
const pool = new pg.Pool({ connectionString: env.dbUrl });
```

SQLite 使用 Bun 内置模块：

```typescript
const sqlite = new Database(path);
sqlite.exec("PRAGMA foreign_keys = ON");
sqlite.exec("PRAGMA journal_mode = WAL");
```

Bun 的 `bun:sqlite` 是同步 API；PostgreSQL 的 `pg` 是异步 API。为了让 service 层不关心差异，`db.ts` 把两者都包成 async 函数。

### 6.2 SQL 占位符适配

业务层统一写 `?` 占位符：

```sql
SELECT * FROM users WHERE email = ?
```

SQLite 原生接受 `?`；PostgreSQL 的 `pg` 需要 `$1`、`$2`。`pgSql(...)` 会在执行前自动转换：

```typescript
function pgSql(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}
```

这样 service 层 SQL 不需要为两套数据库写两遍。

### 6.3 schema 生命周期

仓库当前约束是：schema 初始化、重建、seed 都由根目录 `scripts/db` 读取 `spec/db` 统一完成。Elysia 后端启动时只建立连接，不建表、不迁移、不导入数据。

因此 `db.ts` 不包含 `CREATE TABLE` 字符串，也不导出 `migrate()`。如果要理解 schema，请直接读 `spec/db/schema.sql` 和仓库级数据库维护脚本。

契约验证脚本会在启动前通过仓库级数据库脚本准备干净 schema，因此每次验证都从同一份 `spec/db` 出发。

### 6.4 事务封装

收藏计数必须和 favorites 行保持一致，所以 `addFavorite` / `removeFavorite` 必须在事务里执行。

PostgreSQL 路径：

```typescript
const client = await pool.connect();
await client.query("BEGIN");
// ...
await client.query("COMMIT");
```

SQLite 路径：

```typescript
sqlite.exec("BEGIN IMMEDIATE");
// ...
sqlite.exec("COMMIT");
```

`BEGIN IMMEDIATE` 会尽早拿写锁，适合本项目这种短事务，能避免并发收藏时读到过期计数。

## 8. 错误与响应壳

错误类型在 `src/errors.ts`：

```typescript
export class ApiError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public status: number,
    public details?: ErrorDetail[],
  ) { ... }
}
```

工厂函数统一生成 spec 允许的 errorCode：

```typescript
ERR.unauthorized("未登录")     // 401 UNAUTHORIZED
ERR.validation("...", "field") // 422 VALIDATION_ERROR
ERR.conflict("邮箱已被注册")    // 409 CONFLICT
```

`src/envelope.ts` 决定最终 HTTP 响应形状：

```json
{
  "success": false,
  "data": null,
  "message": "未登录",
  "errorCode": "UNAUTHORIZED"
}
```

Zod 校验失败会走 `zodToApiError(...)`，生成：

```json
{
  "success": false,
  "data": null,
  "message": "字段校验失败",
  "errorCode": "VALIDATION_ERROR",
  "details": [
    { "field": "password", "message": "密码须含字母与数字" }
  ]
}
```

## 9. 鉴权层：`src/security.ts`

本项目使用两类 token：

- access token：JWT HS256，短期有效，客户端放在 `Authorization: Bearer ...`。
- refresh token：随机 256-bit base64url 字符串，数据库只存 SHA-256 哈希。

### 8.1 密码哈希

注册和改密时：

```typescript
hashPassword(plain) -> bcrypt hash
```

登录和改密校验时：

```typescript
verifyPassword(plain, hashed) -> boolean
```

### 8.2 access token

签发时：

```typescript
new SignJWT({ nickname, avatarId })
  .setProtectedHeader({ alg: "HS256" })
  .setSubject(user.id)
  .setIssuedAt(now)
  .setExpirationTime(exp)
  .sign(secret);
```

解析时：

```typescript
readClaims(headers)
requireClaims(headers)
```

- `readClaims`：登录可选；没有 token 返回 `null`，token 非法返回 401。
- `requireClaims`：必须登录；没有 token 也返回 401。

广场列表和按 code 查询使用 `readClaims`，因为匿名也能访问，只是 `favoritedByMe` 固定为 `false`。`/me/*` 和创建胶囊使用 `requireClaims`。

### 8.3 refresh token 轮转

`services/auth.ts` 中的 `refresh(rawToken)` 流程：

1. 对 raw token 做 SHA-256。
2. 查 `refresh_tokens.token_hash`。
3. 若不存在或过期，返回 401。
4. 若已 revoked，说明发生重放，撤销同 `family_id` 下所有未撤销 token，并返回 401。
5. 若有效，撤销旧 token，签发新的 access + refresh，保留同一个 `family_id`。

改密成功后会撤销该用户所有未撤销 refresh token，强制客户端重新登录。

## 10. 业务层：`src/services/`

`src/services.ts` 只是一个 5 行的 barrel export，真正的业务规则按域拆在 `src/services/` 下。路由层只做参数提取和鉴权，真正的规则应该放在这些 service 文件里。

### 9.1 用户与认证

`services/auth.ts` 主要函数：

- `register(...)`
- `login(...)`
- `refresh(...)`
- `logout(...)`
- `getMe(...)`
- `updateProfile(...)`
- `changePassword(...)`

关键规则：

- email 入库前统一 `trim().toLowerCase()`。
- email 与 nickname 唯一冲突返回 `409 CONFLICT`。
- avatarId 必须存在于 `spec/avatars/catalog.json`。
- 登录失败有内存级限流，超过阈值返回 `429 RATE_LIMITED`。

### 9.2 胶囊

`services/capsules.ts` 主要函数：

- `createCapsule(...)`
- `getCapsuleByCode(...)`
- `getPlazaCapsuleById(...)`
- `deleteOwnCapsule(...)`

关键规则：

- `openAt` 必须大于当前时间 60 秒，且不超过 10 年。
- 胶囊 code 是 8 位大写字母数字，生成冲突时最多重试 5 次。
- 未开启胶囊的 `content` 永远返回 `null`，作者也没有特权预览。
- `inPlaza=false` 不出现在广场，也不能通过广场详情访问，但可以按 code 查询。
- 用户可以删除自己创建的胶囊；删除他人胶囊返回 403。

### 9.3 广场与分页

主要函数：

- `plazaList(...)`
- `myCapsules(...)`
- `myFavorites(...)`

分页规则：

- `page >= 1`
- `1 <= pageSize <= 50`
- 响应必须包含 `page`、`pageSize`、`total`、`totalPages`

广场排序：

- `sort=new`：按 `created_at DESC`
- `sort=hot`：按 `favorite_count DESC, created_at DESC`

广场过滤：

- `filter=all`
- `filter=opened`
- `filter=unopened`

搜索 `q` 会 trim，空字符串视为未传；非空时匹配 `title` 或 `creator.nickname`。

### 9.4 收藏与 favorite_count

主要函数：

- `addFavorite(...)`
- `removeFavorite(...)`

关键规则：

- 只能收藏 `in_plaza=true` 的胶囊。
- 不能收藏自己创建的胶囊，返回 `400 BAD_REQUEST`。
- 重复收藏幂等，返回 200 且计数不增加。
- 取消收藏幂等，未收藏也返回 204。
- favorites 行和 `capsules.favorite_count` 在同一事务里更新。

PostgreSQL 下 `addFavorite` 会对胶囊行加 `FOR UPDATE`：

```sql
SELECT ... FROM capsules WHERE id = ? FOR UPDATE
```

这样并发收藏时，多个事务会排队更新同一行，避免计数漂移。

### 9.5 胶囊建议

`suggestCapsule(...)` 优先尝试 OpenAI 兼容 chat completions：

- 读取 `spec/llm/capsule-suggestion.prompt.md`。
- 调用 `LLM_BASE_URL + /chat/completions`。
- 解析严格 JSON `{ content, openInDays }`。

如果 LLM 未配置、超时、返回错误或解析失败，就走本地模板兜底。该端点不缓存，响应中 `cached` 固定为 `false`。

## 11. DTO 映射：`src/types.ts`

数据库列名是 snake_case，例如 `favorite_count`；API 响应是 camelCase，例如 `favoriteCount`。映射逻辑集中在 `types.ts`：

```typescript
capsuleDetail(...)
capsuleListItem(...)
userDto(...)
pagination(...)
```

这层有两个重要职责：

- 把数据库行转换成 OpenAPI 中定义的响应 shape。
- 根据 `openAt <= now` 计算 `isOpened`，并决定是否返回 `content` / `contentPreview`。

列表项和详情项不同：

- 详情项有 `content` 字段，但未开启时为 `null`。
- 列表项没有 `content` 字段，只可能有 `contentPreview`。

## 12. 静态资源与头像

头像列表来自：

```text
spec/avatars/catalog.json
```

`avatars.ts` 会在首次调用时读取并缓存：

```typescript
listAvatars()
allowedAvatarIds()
```

路由层直接暴露 SVG：

```typescript
/static/avatars/:file
/static/icons/:file
```

文件名有白名单正则 `^[a-z0-9_.-]+\.svg$`，避免路径穿越。真实文件仍以 `spec/` 为单一事实源。

## 13. 为什么这里没有 ORM

Elysia 实现选择原生 SQL + 小型方言适配，而不是 Drizzle/TypeORM，主要是为了展示 Bun/Elysia 下更轻的后端写法：

- SQL 查询和字段映射清晰可见，容易对照 `spec/db/schema.sql` 理解运行时读写。
- 事务和锁语义显式，尤其适合解释 `favorite_count` 一致性。
- 业务代码只依赖 `query / one / tx` 三个数据库原语，迁移到 ORM 也有明确边界。

代价是 SQL 字段映射要手写，例如：

```sql
owner_id AS "ownerId"
favorite_count AS "favoriteCount"
```

这类映射必须谨慎维护，否则 TypeScript 类型看起来正确，运行时字段可能是 `undefined`。

## 14. 常见改动应该改哪里

### 13.1 新增一个公开 GET 接口

1. 在 `spec/api/openapi.yaml` 先定义路径、响应和错误码。
2. 在 `src/services/` 对应业务域文件里写业务函数，并从 `src/services.ts` 导出。
3. 在 `src/main.ts` 注册 `.get("/api/v1/...", ...)`。
4. 成功响应用 `route(set, ...)`，不要手写 envelope。
5. 增加或更新黑盒契约测试。

### 13.2 新增一个需要登录的接口

1. 路由里先调用 `const claims = await requireClaims(request.headers)`。
2. 把 `claims.id` 传给 service。
3. 未登录、token 非法、token 过期都应该返回 `UNAUTHORIZED`。
4. 204 响应用 `routeEmpty(...)`。

### 13.3 新增请求字段

1. 先改 `spec/api/openapi.yaml`。
2. 改 `src/validation.ts` 对应 Zod schema。
3. 改 `src/services/` 对应业务规则。
4. 如字段要持久化，先改 `spec/db` 与仓库级数据库维护脚本。
5. 改 `src/types.ts` DTO 映射。
6. 跑 SQLite 和 PostgreSQL 契约验证。

### 13.4 改数据库 schema

1. 以 `spec/db/schema.sql` 为事实源。
2. 同步修改仓库级数据库维护脚本。
3. 确认 SQLite 方言差异：UUID/TIMESTAMPTZ/BOOLEAN/CHECK/索引。
4. 跑：

```bash
DB_DRIVER=sqlite ../../verification/scripts/verify-contract.sh elysia
../../verification/scripts/verify-contract.sh elysia
```

### 13.5 改收藏逻辑

必须特别小心 `favorite_count`：

- favorites 行变化和 `favorite_count` 更新必须在同一 `tx(...)` 里。
- 重复收藏不能增加计数。
- 重复取消不能减少计数。
- PostgreSQL 并发路径应保留 `FOR UPDATE` 或等价机制。
- SQLite 并发路径应保留 `BEGIN IMMEDIATE` 或等价写锁。

## 15. 与契约验证的关系

本项目要求黑盒验证，不能写“知道实现细节”的捷径测试。Elysia 后端必须满足：

- 所有 API 路径、HTTP 方法、状态码与 `spec/api/openapi.yaml` 一致。
- 所有 JSON 成功/失败响应符合统一 envelope。
- SQLite 与 PostgreSQL 都通过同一套契约测试。
- `favorite_count` 与 favorites 实际行数保持一致。
- 未开启胶囊不泄露 content。

推荐每次较大修改后从仓库根目录跑：

```bash
DB_DRIVER=sqlite ./verification/scripts/verify-contract.sh elysia
./verification/scripts/verify-contract.sh elysia
```

如果只改 TypeScript 类型或文档，可以先跑：

```bash
cd backends/elysia
./build
```

## 16. 读代码的路线

第一次读 Elysia 后端，建议按这个顺序：

1. `src/main.ts`：看路由表和每个端点调用哪个 service。
2. `src/validation.ts`：看请求体怎么校验。
3. `src/envelope.ts` 和 `src/errors.ts`：看统一响应与错误码。
4. `src/security.ts`：看 JWT、密码、refresh token 原语。
5. `src/services/`：按 auth、capsules、plaza、favorites、ai 分文件读业务规则。
6. `src/db.ts`：最后看数据库连接、方言适配和事务。

这样读会比从 `db.ts` 开始更容易，因为你先知道“业务想做什么”，再看“底层如何支持”。
