# HelloTime Pro — NestJS 后端

NestJS 11 + TypeORM + Passport JWT 实现，Node.js 生态企业级框架的标准范式。端口 **29040**。

## 快速开始

```bash
# PostgreSQL（默认）：先由仓库级脚本显式准备数据库（后端不建表/迁移/seed）
../../scripts/db reset --seed
./run

# SQLite（无需外部依赖）
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

## 切换数据库驱动

```bash
DB_DRIVER=sqlite ./run     # SQLite（默认路径：data/sqlite/hellotime-nest.db）
DB_DRIVER=postgres ./run   # PostgreSQL

# 自定义连接串
DB_URL=postgresql://user:pass@localhost:5432/mydb ./run
```

## 实现特色

- **装饰器 + DI 纵切**：每个域是一个 Module（Controller / Service / Module 三件套），结构最规整；构造器注入贯穿全栈。
- **统一响应壳**：`common/interceptors` 把成功响应包成 `{ success, data, message }`，`common/filters` 把 `ApiError` 与异常映射成 spec errorCode。
- **Passport JWT 鉴权链**：`@nestjs/passport` + `passport-jwt` 解析 Bearer，`common/guards` 守卫受保护端点；公开端点忽略无效 token 按匿名处理。
- **跨库列适配**：`database/column-helpers.ts` 用 TypeORM `ValueTransformer` 处理 SQLite 字符串 ↔ `Date`、UUID 文本互转，PG 走原生类型。
- **refresh token rotate + family**：每次 `/auth/refresh` 发新撤旧、family 延续；重放已撤销 token 整族作废；改密吊销该用户全部 refresh token。
- **收藏计数事务一致**：收藏 / 取消在事务内原子更新 `favorite_count`；幂等约束（重复收藏 200、取消不存在 204）。

## 验证

```bash
# 契约验证
DB_DRIVER=sqlite ./verification/scripts/verify-contract.sh nest
./verification/scripts/verify-contract.sh nest  # postgres
```

通过记录：PostgreSQL & SQLite 各 **104/104**。

更完整的代码导读见 [`TECHNICAL_GUIDE.md`](TECHNICAL_GUIDE.md)。
