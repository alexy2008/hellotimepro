# HelloTime Pro · Gin 后端

HelloTime Pro 2.0.0 后端：**Go + Gin + GORM**。

以 FastAPI 参考实现为行为基准，展示 Go 生态下显式、轻量的 HTTP 服务分层架构风格。

## 快速开始

```bash
# PostgreSQL（默认）：先由仓库级脚本显式准备数据库
../../scripts/db reset --seed

# 默认跑 Postgres（端口 29020）
./run

# 或跑 SQLite
DB_DRIVER=sqlite ./run
```

启动成功后访问：

- API 根：http://127.0.0.1:29020/api/v1/health

## 常用命令

| 场景 | 命令 |
|---|---|
| 开发运行 | `./run` |
| 单元测试（SQLite，零外部依赖） | `./test` |
| 生产构建（静态二进制） | `./build` |
| 切换 SQLite | `DB_DRIVER=sqlite ./run` |
| 指定端口 | `PORT=29021 ./run` |

## 目录结构

```
cmd/server/main.go     应用入口 + 路由注册 + 静态资源同步
internal/
├── config/            环境变量配置
├── core/              错误码（APIError）+ 鉴权原语（JWT/bcrypt/refresh token）
├── db/                DB 连接（schema 由仓库级 scripts/db 维护）
│   └── migrations/    历史 SQL 迁移参考（postgres / sqlite 各一套）
├── model/             GORM 数据模型
├── dto/               请求/响应 DTO
├── service/           业务逻辑（auth / avatar / capsule / favorite / plaza / user）
├── handler/           Gin 路由处理函数
└── middleware/        Bearer token 解析 + 统一错误响应
static/                运行时从 spec/ 同步（头像 + 图标 SVG）
```

## 数据库双驱动

| 驱动 | DB_URL 格式 |
|---|---|
| PostgreSQL（默认） | `postgresql://<用户>:<密码>@<主机>:<端口>/<库名>` |
| SQLite | `sqlite:///../../data/sqlite/hellotime.db` |

## 实现特色

- **极简依赖**：Gin（路由）+ GORM（ORM）+ JWT + bcrypt
- **显式数据库生命周期**：后端只打开连接；schema 初始化、reset、seed 统一交给根目录 `scripts/db`
- **refresh token rotate**：每次 `/auth/refresh` 发新、撤销旧；重放 revoked token 整族作废
- **改密吊销**：`POST /me/password` 成功后，该用户全部 refresh token 置 `revoked_at=now()`
- **收藏计数一致性**：允许收藏自己的、未公开或未开启的胶囊；事务内原子 `UPDATE favorite_count ± 1`，删除胶囊时先删关联收藏
- **幂等约束**：收藏重复返回 200；取消不存在返回 204

## 与 spec 的对齐

- 路由：[spec/api/openapi.yaml](../../spec/api/openapi.yaml)
- 模型：[spec/db/schema.sql](../../spec/db/schema.sql)
- 端口：29020

## 2.0 验证

2026-11-21，契约直接访问 Gin 的 `:29020`，未切换共享反代或读写默认数据库。

| 检查 | 数据库 | 结果 |
|---|---|---|
| `./test -count=1` | 涉及数据库的用例使用临时 SQLite 文件 | 4/4 顶层测试，含 9 个子用例 |
| 仓库契约套件 | 专用 PostgreSQL 测试库 `hellotime_contract_gin_*` | 117/117 |
| 同一仓库契约套件 | 临时 SQLite 文件 | 117/117 |

从仓库根目录复跑 PostgreSQL：预先建好专用库，显式设置 `DB_DRIVER=postgres` 和指向该库的 `DB_URL`，再运行 `./verification/scripts/verify-contract.sh gin`。SQLite 验证显式设置 `DB_DRIVER=sqlite` 和临时文件的绝对 URL，依次运行 `./scripts/db reset --seed --yes`、`./scripts/hello start gin`、`BASE_URL=http://127.0.0.1:29020 node --test verification/contract/*.spec.ts`，最后 `./scripts/hello stop gin`。不适用 UI 冒烟和设计令牌检查。

另验证了所有 10 个头像 URL 返回的 SVG 与 `spec/avatars/v2/` 一致，并确认旧 `SERVICE_VERSION` 环境变量不会覆盖健康接口的版本号。

## 2.0 迁移笔记

- 无数据库结构迁移。SQLite 演示行的 UUID 是无连字符的十六进制，新建的 Gin 胶囊则用带连字符格式。路径与收藏请求先校验并规范化 UUID；SQLite 查找时匹配两种存储格式，外键写入仍用原始主键。
- 广场的最远和最近开启时刻通过排序取 `open_at` 列，而不是扫描 `MAX/MIN` 表达式：SQLite 驱动能按列声明扫描为 `time.Time`，无记录则返回 `null`。
- SQLite 的收藏、取消收藏和删除均先读胶囊再写入；用 `_txlock=immediate` 避免并发事务从读锁升级时出现 `SQLITE_BUSY`。PostgreSQL 三条路径则统一先 `FOR UPDATE` 锁胶囊行。
- SQLite 契约包装脚本的清理步骤按共享状态推导文件路径，不一定采用传入的 `DB_URL`。本轮直接运行同一套黑盒用例，验证后仅清理临时数据库。
