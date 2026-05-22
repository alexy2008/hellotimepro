# HelloTime Pro — NestJS 后端

NestJS 11 + TypeORM + Passport JWT 实现，Node.js 生态企业级框架的标准范式。端口 **29040**。

## 快速开始

```bash
# PostgreSQL（需先启动 Postgres）
./run

# SQLite（无需依赖）
DB_DRIVER=sqlite ./run
```

## 技术栈

| 层次 | 技术 |
|------|------|
| 框架 | NestJS 11（Express 适配器） |
| ORM | TypeORM 0.3 |
| 数据库 | PostgreSQL 16 / SQLite 3（via better-sqlite3 12） |
| 鉴权 | @nestjs/passport + passport-jwt（JWT HS256） |
| 验证 | class-validator + class-transformer |
| 语言 | TypeScript 5 / Node.js 26 |

## 目录结构

```
src/
├── auth/            # 注册/登录/refresh/logout/改密
├── capsules/        # 胶囊创建、按 code 查询
├── plaza/           # 广场列表、广场详情、我的胶囊、我的收藏
├── favorites/       # 收藏/取消收藏
├── me/              # 个人信息、改密、删除胶囊
├── health/          # /health、/avatars
├── capsule-suggestion/ # AI 生成胶囊内容
├── entities/        # TypeORM 实体
├── database/        # DataSource 配置、迁移
└── common/          # 拦截器/过滤器/守卫/装饰器
```

## 与 Spring Boot 的结构对比

NestJS 的模块/控制器/服务与 Spring Boot 的 Component 体系高度对应：

| Spring Boot | NestJS |
|-------------|--------|
| `@RestController` | `@Controller` |
| `@Service` | `@Injectable` + Service |
| `@Autowired` | Constructor 注入（NestJS DI） |
| `@Component` / `@Bean` | `@Injectable` / `@Module` providers |
| Spring Security JWT Filter | PassportStrategy + AuthGuard |
| JPA Repository | TypeORM Repository |
| Flyway | TypeORM MigrationInterface |

## 切换数据库

```bash
DB_DRIVER=sqlite ./run     # SQLite（默认路径：data/sqlite/hellotime-nest.db）
DB_DRIVER=postgres ./run   # PostgreSQL

# 自定义连接串
DB_URL=postgresql://user:pass@localhost:5432/mydb ./run
```

## 验证

```bash
# 契约验证
DB_DRIVER=sqlite ./verification/scripts/verify-contract.sh nest
./verification/scripts/verify-contract.sh nest  # postgres
```
