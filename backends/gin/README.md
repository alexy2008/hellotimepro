# HelloTime Pro · Gin 后端

M2 第一批扩散后端之一：**Go + Gin + GORM**。

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
| PostgreSQL（默认） | `postgresql://hellotime:hellotime@127.0.0.1:55432/hellotime_pro` |
| SQLite | `sqlite:///../../data/sqlite/hellotime.db` |

## 实现特色

- **极简依赖**：Gin（路由）+ GORM（ORM）+ JWT + bcrypt
- **显式数据库生命周期**：后端只打开连接；schema 初始化、reset、seed 统一交给根目录 `scripts/db`
- **refresh token rotate**：每次 `/auth/refresh` 发新、撤销旧；重放 revoked token 整族作废
- **改密吊销**：`POST /me/password` 成功后，该用户全部 refresh token 置 `revoked_at=now()`
- **收藏计数一致性**：事务内原子 `UPDATE favorite_count ± 1`
- **幂等约束**：收藏重复返回 200；取消不存在返回 204

## 契约验证

```bash
DB_DRIVER=sqlite ../../verification/scripts/verify-contract.sh gin
../../verification/scripts/verify-contract.sh gin
```

## 与 spec 的对齐

- 路由：[spec/api/openapi.yaml](../../spec/api/openapi.yaml)
- 模型：[spec/db/schema.sql](../../spec/db/schema.sql)
- 端口：29020
