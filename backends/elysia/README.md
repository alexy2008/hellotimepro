# HelloTime Pro · Elysia 后端

M2 扩散后端之一：**Bun + Elysia + TypeScript + 原生 SQL**。端口 **29030**。

以 FastAPI 参考实现和 `spec/` 为行为基准，提供 `/api/v1/*` REST API，支持 PostgreSQL 与 SQLite 双驱动。

## 快速开始

```bash
# 可选：启动 Postgres
docker compose -f ../../docker-compose.yml up -d postgres

# 默认跑 Postgres（端口 29030）
./run

# 或跑 SQLite
DB_DRIVER=sqlite ./run
```

启动成功后访问：

- API 根：http://127.0.0.1:29030/api/v1/health
- 头像目录：http://127.0.0.1:29030/api/v1/avatars

## 常用命令

| 场景 | 命令 |
|---|---|
| 开发运行 | `./run` |
| 类型检查 / 构建验证 | `./build` |
| 单元测试入口 | `./test` |
| 切换 SQLite | `DB_DRIVER=sqlite ./run` |
| 指定端口 | `PORT=29031 ./run` |
| 自定义数据库连接 | `DB_URL=postgresql://user:pass@localhost:5432/db ./run` |

## 技术栈

| 层次 | 技术 |
|---|---|
| 运行时 | Bun 1 |
| 框架 | Elysia 1 |
| 语言 | TypeScript 5 |
| 数据库 | PostgreSQL 16 / SQLite 3（Bun 内置 `bun:sqlite`） |
| SQL 访问 | 原生 SQL + 轻量方言适配 |
| 鉴权 | `jose` JWT HS256 + 不透明 refresh token |
| 密码哈希 | `bcryptjs` |
| 请求校验 | Zod |

## 目录结构

```
src/
├── main.ts        Elysia 应用入口、路由注册、静态资源服务
├── config.ts      环境变量配置
├── db.ts          PostgreSQL / SQLite 连接、迁移、事务封装
├── services.ts    auth / me / capsules / plaza / favorites / suggestion 业务逻辑
├── security.ts    JWT、密码哈希、refresh token 原语
├── validation.ts  Zod 请求 schema
├── envelope.ts    统一响应壳与错误响应
├── errors.ts      APIError 与 spec errorCode 映射
├── avatars.ts     读取 spec/avatars/catalog.json
└── types.ts       响应 DTO 映射工具
```

## 数据库双驱动

| 驱动 | DB_URL 格式 |
|---|---|
| PostgreSQL（默认） | `postgresql://hellotime:hellotime@127.0.0.1:55432/hellotime_pro` |
| SQLite | `sqlite:///../../data/sqlite/hellotime.db` |

差异处理：

- UUID：应用层以 `randomUUID()` 生成 UUID。PostgreSQL 使用 `UUID` 列类型（schema 中以 `gen_random_uuid()` 为默认值），SQLite 使用 `TEXT` 列存储。
- 时间：应用层统一写入 ISO 8601 字符串；PostgreSQL 使用 `TIMESTAMPTZ`，SQLite 使用 `TEXT`。
- 迁移：服务启动时在 `db.ts` 执行对应方言的 `CREATE TABLE IF NOT EXISTS` schema。
- 收藏计数：`addFavorite` / `removeFavorite` 在事务内更新 favorites 行和 `favorite_count`；PostgreSQL 使用 `SELECT ... FOR UPDATE`，SQLite 使用 `BEGIN IMMEDIATE`。

## 实现特色

- **统一响应壳**：所有 JSON 响应符合 `{ success, data, message, errorCode, details? }`。
- **refresh token rotate**：每次 `/auth/refresh` 发新、撤销旧；重放 revoked token 会撤销整族。
- **改密吊销**：`POST /me/password` 成功后吊销该用户全部未撤销 refresh token。
- **胶囊不可提前泄露**：未到 `openAt` 时详情与列表预览均不返回正文内容。
- **收藏幂等**：重复收藏返回 200，重复取消返回 204。
- **静态资源直读 spec**：`/static/avatars/*` 与 `/static/icons/*` 从仓库 `spec/` 提供。

## 契约验证

从仓库根目录运行：

```bash
DB_DRIVER=sqlite ./verification/scripts/verify-contract.sh elysia
./verification/scripts/verify-contract.sh elysia
```

当前实现已通过 SQLite 与 PostgreSQL 两套契约验证。

## 与 spec 的对齐

- 路由：[spec/api/openapi.yaml](../../spec/api/openapi.yaml)
- 模型：[spec/db/schema.sql](../../spec/db/schema.sql)
- 头像：[spec/avatars/catalog.json](../../spec/avatars/catalog.json)
- 图标：[spec/icons/](../../spec/icons/)
- 端口：29030
