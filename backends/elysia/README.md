# HelloTime Pro · Elysia 后端

HelloTime Pro 2.0.0 后端：**Bun + Elysia + TypeScript + 原生 SQL**。端口 **29030**。

以 FastAPI 参考实现和 `spec/` 为行为基准，提供 `/api/v1/*` REST API，支持 PostgreSQL 与 SQLite 双驱动。

## 快速开始

```bash
# PostgreSQL（默认）：先由仓库级脚本显式准备数据库
../../scripts/db reset --seed

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
├── db.ts          PostgreSQL / SQLite 连接、占位符适配、事务封装
├── services.ts    业务服务 barrel export
├── services/      auth / capsules / plaza / favorites / ai 分域业务逻辑
├── security.ts    JWT、密码哈希、refresh token 原语
├── validation.ts  Zod 请求 schema
├── envelope.ts    统一响应壳与错误响应
├── errors.ts      APIError 与 spec errorCode 映射
├── avatars.ts     读取 spec/avatars/v2/catalog.json
└── types.ts       响应 DTO 映射工具
```

## 数据库双驱动

| 驱动 | DB_URL 格式 |
|---|---|
| PostgreSQL（默认） | `postgresql://<用户>:<密码>@<主机>:<端口>/<库名>` |
| SQLite | `sqlite:///../../data/sqlite/hellotime.db` |

差异处理：

- UUID：应用层以 `randomUUID()` 生成 UUID。PostgreSQL 使用 `UUID` 列类型（schema 中以 `gen_random_uuid()` 为默认值），SQLite 使用 `TEXT` 列存储。
- 时间：应用层统一写入 ISO 8601 字符串；PostgreSQL 使用 `TIMESTAMPTZ`，SQLite 使用 `TEXT`。
- schema 生命周期：服务启动只连接数据库；初始化、reset、seed 由根目录 `scripts/db` 显式完成。
- 收藏计数：收藏 / 取消在事务内更新收藏行和 `favorite_count`；PostgreSQL 的收藏、取消和删除统一先锁胶囊行，SQLite 使用 `BEGIN IMMEDIATE`。

## 实现特色

- **统一响应壳**：所有 JSON 响应符合 `{ success, data, message, errorCode, details? }`。
- **refresh token rotate**：每次 `/auth/refresh` 发新、撤销旧；重放 revoked token 会撤销整族。
- **改密吊销**：`POST /me/password` 成功后吊销该用户全部未撤销 refresh token。
- **胶囊不可提前泄露**：未到 `openAt` 时详情与列表预览均不返回正文内容。
- **收藏幂等**：重复收藏返回 200，重复取消返回 204。
- **静态资源直读 spec**：`/static/avatars/*` 读取 `spec/avatars/v2/`；`/static/icons/*` 读取 `spec/icons/`。
- **轻量函数式分层**：路由集中注册，业务按域拆分到 `src/services/`，数据访问使用 `query / one / tx`。

## 与 spec 的对齐

- 路由：[spec/api/openapi.yaml](../../spec/api/openapi.yaml)
- 模型：[spec/db/schema.sql](../../spec/db/schema.sql)
- 头像：[spec/avatars/v2/catalog.json](../../spec/avatars/v2/catalog.json)
- 图标：[spec/icons/](../../spec/icons/)
- 端口：29030

## 2.0 验证

2026-11-21 直接验证 `:29030`，未切换共享反代或使用默认数据库。

| 检查 | 数据库 | 结果 |
|---|---|---|
| `./test` | 涉及数据库的用例使用内存 SQLite | 5/5 |
| 仓库契约 | 专用 PostgreSQL 库 `hellotime_contract_elysia_*` | 117/117 |
| 同一仓库契约 | 临时 SQLite 文件 | 117/117 |

另验证 `./build` 类型检查通过，10 个头像 URL 的 SVG 均与 v2 规范一致。UI 冒烟、设计令牌检查不适用于纯后端。

## 2.0 迁移笔记

- 无 schema 迁移。广场列表和统计复用参数化 WHERE，`LIKE` 的转义与占位符分开；最远和最近开启时刻直接从公开胶囊取值，不受搜索词影响。PostgreSQL 的计数可能是字符串，组装响应时统一转为数字。
- SQLite 演示胶囊主键用无连字符的十六进制，应用创建的主键带连字符。HTTP 返回规范 UUID，查找时匹配两种存储形态，写入收藏或删除时用实际主键。
- PostgreSQL 的三条写路径共用胶囊行锁；删除在事务内先显式清理关联收藏。回归测试关闭 SQLite 外键，确保不依赖级联。
- PostgreSQL 复测显式设置 `DB_DRIVER=postgres` 和专用 `DB_URL` 后执行 `./verification/scripts/verify-contract.sh elysia`。SQLite 包装脚本的清理路径不一定采用 `DB_URL`，因此显式指定临时库，通过 `scripts/db` 初始化和 `scripts/hello` 启停，再执行 `BASE_URL=http://127.0.0.1:29030 node --test verification/contract/*.spec.ts`。
