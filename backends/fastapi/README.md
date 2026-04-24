# HelloTime Pro · FastAPI 参考后端

这是 HelloTime Pro 的**参考后端实现**（M1 交付物）。其他 9 个后端都以本实现的 API 形状与行为为事实基准。

## 快速开始

```bash
# 可选：启动 Postgres
docker compose -f ../../docker-compose.yml up -d postgres

# 默认跑 Postgres
./run

# 或跑 SQLite（自动落盘到 ../../data/sqlite/hellotime.db）
DB_DRIVER=sqlite ./run
```

启动成功后访问：

- API 根：http://127.0.0.1:29010/api/v1/health
- Swagger UI：http://127.0.0.1:29010/docs

## 常用命令

| 场景 | 命令 |
|---|---|
| 开发运行 | `./run` |
| 单元测试（SQLite，零外部依赖） | `./test` |
| 一致性构建（锁安装 + import） | `./build` |
| 切换 SQLite | `DB_DRIVER=sqlite ./run` |
| 指定端口 | `PORT=29011 ./run` |
| 生成新迁移 | `uv run alembic revision -m "msg" --autogenerate` |
| 手动 upgrade | `uv run alembic upgrade head` |

## 目录结构

```
app/
├── api/v1/        路由层（FastAPI router）
├── services/      业务层（编排 + 事务）
├── repositories/  （本实现为薄层，直接在 service 里用 SQLAlchemy）
├── models/        ORM 实体（User/Capsule/Favorite/RefreshToken）
├── schemas/       Pydantic I/O DTO（对应 openapi components）
├── core/          config / errors / security 原语
├── db/            引擎 + Session
├── deps.py        FastAPI Depends（current_user_* / get_db）
└── main.py        应用入口 + 错误处理 + 静态资源挂载

alembic/           迁移脚本（以 spec/db/schema.sql 为基准）
tests/             pytest 单测
static/            启动时从 spec/ 同步（gitignored）
```

## 数据库双驱动

| 驱动 | DB_URL 例子 |
|---|---|
| PostgreSQL（默认） | `postgresql+psycopg://hellotime:hellotime@127.0.0.1:55432/hellotime_pro` |
| SQLite | `sqlite:///../../data/sqlite/hellotime.db` |

差异处理：
- UUID：SQLAlchemy 2.0 的 `Uuid` 类型在 PG 用原生 UUID，在 SQLite 存 CHAR(32)
- DateTime(timezone=True)：PG 原生 TIMESTAMPTZ；SQLite 存 ISO 字符串
- 扩展与 GIN 索引：仅 PG（见 [alembic/versions/0001_initial.py](alembic/versions/0001_initial.py)）
- favorite_count 事务：PG 用 `SELECT ... FOR UPDATE` 行锁；SQLite 依赖 `journal_mode=WAL` + 默认串行写

## 实现特色

- **统一响应壳**：`APIError` + exception handler 自动序列化为 `{success,data,message,errorCode,details?}`
- **refresh token rotate**：每次 `/auth/refresh` 都发新、撤销旧；重放已 revoked token 触发整 family 作废
- **改密吊销**：`POST /me/password` 成功后，该用户全部未过期 refresh 均置 `revoked_at=now()`
- **收藏计数一致性**：事务内 `favorite_count ± 1` 与 favorites 行变更原子完成
- **幂等约束**：收藏重复返回 200（不 409）；取消收藏不存在返回 204

## 契约验证

```bash
../../verification/scripts/verify-contract.sh fastapi
```

## 与 spec 的对齐

- 路由：[spec/api/openapi.yaml](../../spec/api/openapi.yaml)
- 模型：[spec/db/schema.sql](../../spec/db/schema.sql)
- 头像：[spec/avatars/catalog.json](../../spec/avatars/catalog.json)（启动时拷到 `static/avatars/`）
- 图标：[spec/icons/](../../spec/icons/)（启动时拷到 `static/icons/`）
