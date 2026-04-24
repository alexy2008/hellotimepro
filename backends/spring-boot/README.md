# HelloTime Pro · Spring Boot 后端

Java 21 + Spring Boot 3 + Spring Data JPA + Flyway 实现，端口 `29000`。

```bash
# PostgreSQL（默认）
docker compose -f ../../docker-compose.yml up -d postgres
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

本实现对齐 `spec/api/openapi.yaml` 与 `spec/db/schema.sql`，静态头像与技术栈图标直接从仓库 `spec/` 暴露为 `/static/avatars/*`、`/static/icons/*`。
