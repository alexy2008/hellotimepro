# HelloTime Pro · Spring Boot 后端

Java 21 + Spring Boot 3 + Spring Data JPA 实现，保留 Flyway 迁移文件作为本栈 schema 表达样例；端口 `29000`。

```bash
# PostgreSQL（默认）：先由仓库级脚本显式准备数据库
../../scripts/db reset --seed
./run

# SQLite
DB_DRIVER=sqlite ./run
```

常用命令：

| 场景 | 命令 |
|---|---|
| 开发运行 | `./run` |
| SQLite 测试 | `./test` |
| 编译打包 | `./build` |
| 指定端口 | `PORT=29001 ./run` |
| 准备数据库 | `../../scripts/db reset --seed` |

本实现对齐 `spec/api/openapi.yaml` 与 `spec/db/schema.sql`，静态头像与技术栈图标直接从仓库 `spec/` 暴露为 `/static/avatars/*`、`/static/icons/*`。
