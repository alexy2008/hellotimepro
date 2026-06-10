# HelloTime Pro NestJS 后端技术手册与代码导读

本文面向已经熟悉 TypeScript 基本语法（类、装饰器、泛型、async/await、接口），但还没系统接触过 NestJS、TypeORM、Passport 这套 Node.js 企业级技术栈的读者。读完后，你应该能回答三件事：

- 一个 HTTP 请求进入后端后，代码按什么顺序执行。
- NestJS 模块系统、TypeORM、Passport JWT、class-validator 分别负责什么。
- 想新增一个接口、字段或业务规则时，应该改哪些文件。

> 阅读建议：第 1 节介绍技术栈与设计特色；第 2～4 节建立整体地图与入口；第 5 节集中讲 NestJS 的几个核心思想（模块、DI、装饰器、管道/守卫/拦截器/过滤器）；第 6～13 节按一次请求的生命周期分层细讲；第 14 节给出常见改动的步骤清单。

## 1. 技术选型与设计特色

HelloTime Pro 的 NestJS 后端实现基于 **Node.js + NestJS + TypeScript** 核心骨架，并选用 **TypeORM** 作为数据库对象关系映射工具、**Passport** 进行基于 JWT 的身份验证、**class-validator** 驱动声明式数据校验，同时支持 **PostgreSQL** 和 **SQLite** 双数据库驱动切换。其具体选型考量与设计特色如下：

* **NestJS 与 TypeScript（企业级模块化与强类型设计）**：采用 TypeScript 的强类型约束和面向对象元数据设计，借助 NestJS 强大的依赖注入（DI）容器与高度内聚的模块（Modules）系统，为 Node.js 环境提供企业级、高度可控的架构标准。
* **TypeORM 与跨库自适应（实体映射与方言自适应）**：选用现代化的 TypeORM 框架作为数据访问层，并设计了跨库列类型辅助机制（如 `timestampColumn` 在 PostgreSQL 和 SQLite 间自动适配类型）。数据库 schema 初始化、reset、seed 由仓库级 `scripts/db` 统一维护，Nest 服务只连接已经准备好的数据库；迁移类保留为 TypeORM schema 表达样例。
* **class-validator 与 ValidationPipe（声明式拦截与过滤）**：通过 DTO（数据传输对象）类的属性装饰器完成请求边界声明，依靠全局 `ValidationPipe` 拦截非法请求并自动过滤多余字段，在请求抵达业务层前构筑类型安全边界。
* **全周期的管道/守卫/拦截器/过滤器生态**：高度遵循 NestJS 标准的 AOP（面向切面编程）生命周期。采用 Passport JWT Strategy 配合守卫（Guards）实现鉴权拦截、拦截器（Interceptors）完成统一成功响应包装、全局过滤器（Filters）捕获异常并映射为契约约定的错误响应。

## 2. 先建立整体地图

HelloTime Pro 是一个时间胶囊应用。NestJS 后端的职责是：

- 提供 `/api/v1/*` HTTP API（与 `spec/api/openapi.yaml` 对齐）。
- 校验请求数据：邮箱格式、密码强度、胶囊开启时间等。
- 处理用户注册、登录、JWT access token、refresh token 轮转（含令牌族追踪）。
- 读写用户、胶囊、收藏、refresh token 等数据，并维护反规范化字段 `favorite_count`。
- 在 PostgreSQL 和 SQLite 之间无缝切换（通过环境变量），同一份业务代码两边都跑得动。
- 暴露 `spec/avatars/*`、`spec/icons/*` 作为静态资源，并提供 LLM 胶囊建议接口。

核心目录：

```text
backends/nest/
├── package.json / tsconfig.json           # Node.js 包描述 + TypeScript 配置
├── run / build / test                     # 三个 Bash 脚本，封装 npm 命令并注入数据库环境变量
└── src/
    ├── main.ts                            # 启动入口：创建 NestJS 应用，注册全局管道/过滤器/拦截器
    ├── app.module.ts                      # 根模块：把所有功能模块组合到一起
    ├── config/
    │   └── configuration.ts              # 环境变量 → AppConfig 对象（工厂函数）
    ├── database/
    │   ├── database.module.ts             # TypeORM 动态连接配置（PG / SQLite 二选一）
    │   ├── column-helpers.ts             # 跨库列类型辅助函数（timestamptz vs text）
    │   └── migrations/{postgres,sqlite}/ # TypeORM 迁移参考（默认不执行）
    ├── entities/                          # TypeORM 实体（对应数据库表）
    ├── common/
    │   ├── api.exception.ts              # 业务异常类 + 工厂函数
    │   ├── decorators/current-user.ts    # @CurrentUser 参数装饰器
    │   ├── filters/api-exception.filter.ts  # 全局异常过滤器 → 统一错误 JSON
    │   ├── guards/jwt-auth.guard.ts      # JWT 必须鉴权守卫
    │   └── guards/optional-jwt.guard.ts  # JWT 可选鉴权守卫
    │   └── interceptors/envelope.interceptor.ts  # 全局响应包装拦截器
    ├── auth/          # 注册 / 登录 / refresh / logout / 改密
    ├── capsules/      # 胶囊创建、按 code 查询
    ├── plaza/         # 广场列表 / 详情 / 我的胶囊 / 我的收藏
    ├── favorites/     # 收藏 / 取消收藏
    ├── me/            # 个人信息、删除胶囊
    ├── health/        # /health、/avatars
    └── capsule-suggestion/  # AI 生成胶囊内容
```

一次典型请求的流向：

```text
浏览器 / 前端
  │ HTTP
  ▼
Node.js HTTP Server（内嵌 Express 适配器）
  │
  ▼
NestJS 中间件层（CORS 等）
  │
  ▼
守卫（Guard）：JwtAuthGuard / OptionalJwtGuard
  │ Passport 解析 Bearer token → request.user
  ▼
管道（Pipe）：ValidationPipe
  │ class-validator 验证 DTO 字段
  ▼
控制器方法（Controller）
  │ @Body / @Param / @Query / @CurrentUser 取参数
  │ 调用 service
  ▼
服务层（Service）
  │ 业务规则，调用 TypeORM Repository
  ▼
TypeORM → 数据库驱动
  │
  ▼
PostgreSQL 或 SQLite
```

返回方向：service 返回 plain 对象，**EnvelopeInterceptor** 将其包装成 `{ success: true, data: ... }` 结构，写入响应。出错时任何地方 `throw ApiException`，**ApiExceptionFilter** 捕获并输出统一的 `{ success: false, errorCode: ..., message: ... }` 结构。

## 3. 如何运行和验证

开发运行：

```bash
cd backends/nest
DB_DRIVER=sqlite ./run      # SQLite，零依赖
./run                       # 默认 PostgreSQL（先启动 Postgres）
```

默认端口是 `29040`。启动后可访问：

- 健康检查：`http://127.0.0.1:29040/api/v1/health`
- 头像列表：`http://127.0.0.1:29040/api/v1/avatars`

契约验证：

```bash
DB_DRIVER=sqlite ../../verification/scripts/verify-contract.sh nest  # SQLite
../../verification/scripts/verify-contract.sh nest                    # PostgreSQL
```

构建编译产物：

```bash
./build   # tsc 编译，产物在 dist/
```

三个脚本做的事：

- `run`：根据 `DB_DRIVER` 设置 `DB_URL`，然后 `npx ts-node -r tsconfig-paths/register src/main.ts` 直接运行 TypeScript。
- `test`：用临时 SQLite 文件，`npm test`（若有单测）。
- `build`：`npm run build`（`tsc` 按 `tsconfig.json` 编译到 `dist/`）。

> 第一次运行需要 `npm install`（`run` 脚本会自动处理），下载依赖约 30～60 秒，之后缓存在 `node_modules/`。

## 4. 入口：`main.ts`

```typescript
async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['warn', 'error'],
  });

  app.enableCors({ origin: '*' });

  // 直接把仓库 spec/ 目录作为静态资源
  app.useStaticAssets(path.join(repoRoot, 'spec'), { prefix: '/static' });

  app.useGlobalFilters(new ApiExceptionFilter());           // 统一异常 → JSON
  app.useGlobalInterceptors(new EnvelopeInterceptor());     // 统一响应包装
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,      // 自动剥离 DTO 未声明的字段
    transform: true,      // 自动实例化 DTO 类（class-transformer）
    forbidNonWhitelisted: false,
  }));

  await app.listen(port, host);
}
bootstrap();
```

几个要点：

- **`NestFactory.create`**：创建一个 NestJS 应用实例。这里传了 `NestExpressApplication` 泛型，拿到 Express 特有的方法（如 `useStaticAssets`）。
- **全局注册顺序**：`Filters → Interceptors → Pipes → Guards → Handler`——这是 NestJS 的固定生命周期，全局注册的这些组件在每个请求上都会运行。
- **`whitelist: true`**：`ValidationPipe` 会自动去掉 DTO class 里没有对应装饰器的字段，防止意外字段进入业务代码（不等于「多余字段会报错」，那需要 `forbidNonWhitelisted: true`）。

## 5. NestJS 的几个关键思想

NestJS 在 TypeScript 生态里的定位和 Spring Boot 在 Java 里很像——都是「企业级约定」框架，给混乱的 Express/Node 世界加上结构。看懂这几个机制，剩下代码都是重复模式。

### 4.1 模块（Module）

NestJS 把代码组织成「模块」，每个功能域一个 `@Module` 类：

```typescript
@Module({
  imports:     [TypeOrmModule.forFeature([User, RefreshToken, Capsule]), JwtModule, PassportModule],
  controllers: [AuthController],
  providers:   [AuthService, JwtStrategy],
  exports:     [AuthService, JwtModule, PassportModule],
})
export class AuthModule {}
```

- **`imports`**：本模块需要用到的其他模块（把对方 `exports` 出来的东西引入进来）。
- **`providers`**：在本模块的 DI 容器里注册的类（Service、Strategy、Guard 等）。默认 `scope: Singleton`，整个应用只有一个实例。
- **`controllers`**：本模块的 HTTP 路由处理类。
- **`exports`**：本模块对外暴露的东西，其他模块 `imports` 本模块后才能用。

根模块 `AppModule` 把所有功能模块列在 `imports` 里，NestJS 启动时扫描整个模块树完成初始化。

> 与 Spring Boot 的 `@ComponentScan` 不同，NestJS **不自动扫描**文件——你必须显式在 `@Module` 里声明所有提供者和控制器。这是 NestJS 比 Spring 更显式的地方。

### 4.2 依赖注入（DI）

NestJS 的 DI 系统与 Spring 高度相似，但基于 TypeScript 元数据（`reflect-metadata`）：

```typescript
@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService<AppConfig>,
  ) {}
}
```

- `@Injectable()` 标记这个类可以被 NestJS 实例化和注入。
- **构造器注入**是最推荐的写法——依赖关系一目了然，也方便测试时传 mock。
- `@InjectRepository(User)` 是 TypeORM 的特殊注入令牌，告诉 DI 系统注入 `User` 实体对应的 `Repository<User>`。

### 4.3 装饰器驱动

NestJS 大量使用 TypeScript 装饰器：

| 装饰器 | 作用 |
|---|---|
| `@Controller('api/v1/auth')` | 声明控制器，设置路由前缀 |
| `@Get / @Post / @Patch / @Delete` | HTTP 方法 + 路径 |
| `@Body() dto: RegisterDto` | 从请求体反序列化并注入 |
| `@Param('id')` | URL 路径参数 |
| `@Query('sort')` | URL 查询参数 |
| `@UseGuards(JwtAuthGuard)` | 在此路由/控制器上启用指定守卫 |
| `@HttpCode(204)` | 强制响应码（默认 POST → 201，其他 → 200）|

装饰器本身是「标签」，真正干活的是 NestJS 在启动时扫描这些标签并构建路由表、注入规则。

### 4.4 管道、守卫、拦截器、过滤器

这四种「增强器」是 NestJS 的核心扩展点，请求生命周期中按以下顺序执行：

```
请求 → [过滤器监听整体] → 守卫 → 管道 → Handler → 拦截器 → 响应
                                                ↑ 出错时 →  过滤器
```

- **守卫（Guard）**：决定请求是否能通过。本项目用 `JwtAuthGuard`（必须登录）和 `OptionalJwtGuard`（登录可选）。
- **管道（Pipe）**：处理/验证/转换请求参数。全局 `ValidationPipe` 在每个 `@Body` 上运行 class-validator。
- **拦截器（Interceptor）**：环绕 Handler 执行，可以在 Handler 前后插入逻辑，也可以变换响应。`EnvelopeInterceptor` 用 RxJS `map` 把 Handler 返回值包进统一外壳。
- **过滤器（Filter）**：捕获异常，将其转换为 HTTP 响应。`ApiExceptionFilter` 标注了 `@Catch()` 即捕获所有未处理异常。

## 6. 配置层：`config/configuration.ts`

NestJS 官方的配置方案是 `@nestjs/config`。本项目用**工厂函数**模式：

```typescript
export default (): AppConfig => {
  const dbDriver = (process.env.DB_DRIVER || 'postgres') as 'postgres' | 'sqlite';
  const repoRoot = process.env.REPO_ROOT || path.resolve(__dirname, '../../..');
  // ...
  return {
    port: parseInt(process.env.PORT || '29040', 10),
    dbDriver,
    dbUrl,
    jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    // ... 更多配置
  };
};
```

工厂函数在 `AppModule` 的 `ConfigModule.forRoot({ load: [configuration] })` 里注册，NestJS 启动时调用一次并把返回值缓存进 DI 容器。任何需要配置的地方注入 `ConfigService<AppConfig>` 即可：

```typescript
const port = config.get('port', { infer: true }) ?? 29040;
```

`{ infer: true }` 让 TypeScript 能从 `AppConfig` 接口推断 `port` 的类型是 `number` 而不是 `unknown`。

## 7. 数据库层：TypeORM + 迁移

### 6.1 动态连接：`database.module.ts`

`TypeOrmModule.forRootAsync` 允许异步地（注入 `ConfigService` 后）构造连接选项：

```typescript
TypeOrmModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService<AppConfig>) => {
    const driver = config.get('dbDriver', { infer: true });
    if (driver === 'sqlite') {
      return {
        type: 'better-sqlite3',
        database: parseSqliteFile(dbUrl),
        entities,
        migrations: [`${migrationDir}/*.{ts,js}`],
        migrationsRun: false,   // 服务启动不修改 schema
        synchronize: false,     // 不使用 TypeORM 自动同步（schema 由 scripts/db 维护）
        prepareDatabase: (db) => {
          db.pragma('foreign_keys = ON');
          db.pragma('journal_mode = WAL');
        },
      };
    }
    // PostgreSQL 路径...
  },
})
```

关键选项：

- **`migrationsRun: false`**：服务启动只建立连接，不执行迁移；schema 初始化、reset、seed 统一由根目录 `scripts/db` 完成。
- **`synchronize: false`**：绝对不要在生产环境打开——它会根据实体自动修改数据库 schema，可能删表删列。本项目统一由 `scripts/db` 管理 schema。
- **`prepareDatabase`**：SQLite 专有的钩子，设置外键约束和 WAL 模式。

### 6.2 跨库列类型：`column-helpers.ts`

PostgreSQL 和 SQLite 对时间类型的支持不同：PG 有原生 `timestamptz`，SQLite 只有 `TEXT`。`column-helpers.ts` 封装了这一差异：

```typescript
const isSqlite = () => (process.env.DB_DRIVER || 'postgres') === 'sqlite';

const dateTransformer: ValueTransformer = {
  to: (v: Date) => v?.toISOString(),    // JS Date → 存入 SQLite 时转 ISO 字符串
  from: (v: string) => v ? new Date(v) : null,  // 从 SQLite 读出时转回 Date
};

export function timestampColumn(nullable = false): ColumnOptions {
  if (isSqlite()) return { type: 'text', nullable, transformer: dateTransformer };
  return { type: 'timestamptz', nullable };
}
```

实体里引用这些辅助函数，保持单一真相源：

```typescript
@Column({ name: 'created_at', ...timestampColumn() })
createdAt: Date;
```

`ValueTransformer` 是 TypeORM 提供的钩子，在读写时自动执行转换，业务代码始终拿到 `Date` 对象，感知不到数据库方言差异。

### 6.3 TypeORM 实体：`entities/*.entity.ts`

```typescript
@Entity('users')
@Index('users_email_uk', ['email'], { unique: true })
export class User {
  @PrimaryColumn(primaryUuidColumn())
  id: string;

  @Column({ type: 'varchar', length: 254 })
  email: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 100 })
  passwordHash: string;

  // ...
}
```

- `@Entity('users')`：映射到 `users` 表（显式指定表名，避免依赖默认复数化规则）。
- `@PrimaryColumn`：主键。本项目的 UUID 主键不靠数据库自增，由应用层用 `uuidv4()` 生成。
- `@Column({ name: 'password_hash' })`：当 TypeScript 字段名（camelCase）和数据库列名（snake_case）不一致时显式指定。
- 关联关系：`Capsule` 实体用 `@ManyToOne(() => User, { eager: false })` 定义 `owner` 关系，查询时按需 `relations: ['owner']` 加载（避免 N+1）。

### 6.4 常见 TypeORM 查询模式

来自本项目的真实用法：

```typescript
// 单行查询
const user = await this.userRepo.findOne({ where: { email: emailNorm } });

// 存在性检查
const exists = await this.userRepo.findOne({ where: { email } }) !== null;

// 插入（先 create 再 save，让 TypeORM 知道实体状态）
const user = this.userRepo.create({ id: uuidv4(), email, ... });
await this.userRepo.save(user);

// 原子 UPDATE（自增计数，不经过实体加载）
await this.capsuleRepo
  .createQueryBuilder()
  .update()
  .set({ favoriteCount: () => 'favorite_count + 1' })
  .where('id = :id', { id: capsuleId })
  .execute();

// QueryBuilder 链式查询
const rows = await this.capsuleRepo
  .createQueryBuilder('c')
  .innerJoinAndSelect('c.owner', 'u')  // JOIN 并把 owner 填入实体
  .where('c.inPlaza = :plaza', { plaza: true })
  .andWhere('LOWER(c.title) LIKE :pattern', { pattern: `%${q}%` })
  .orderBy('c.favoriteCount', 'DESC')
  .skip((page - 1) * pageSize)
  .take(pageSize)
  .getMany();

// 带总数的分页查询
const [rows, total] = await this.capsuleRepo.findAndCount({
  where: { ownerId: userId },
  relations: ['owner'],
  order: { createdAt: 'DESC' },
  skip: (page - 1) * pageSize,
  take: pageSize,
});

// 批量更新（如 token 族全部 revoke）
await this.tokenRepo
  .createQueryBuilder()
  .update()
  .set({ revokedAt: now })
  .where('family_id = :fid AND revoked_at IS NULL', { fid: row.familyId })
  .execute();
```

> **`create` + `save` vs 直接 `save`**：`create` 创建一个被 TypeORM「追踪」的实体实例，携带元数据信息；直接 `save` 一个 plain object 也可以，但失去了部分 TypeORM 生命周期钩子支持。本项目统一用 `create` + `save`。

### 6.5 迁移：`database/migrations/`

两套迁移文件（`postgres/` 和 `sqlite/`）各自独立，都是实现了 `MigrationInterface` 的 TypeScript 类：

```typescript
export class InitSchema1700000000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE users ( ... )`);
    // ...
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS ...`);
  }
}
```

当前运行配置不会自动执行这些迁移类。它们保留为 Nest/TypeORM 读者理解 schema 表达方式的参考：类名里的时间戳 `1700000000000` 是版本号，递增保证顺序。

要新增表或字段：先修改 `spec/db` 与仓库级维护脚本；如果需要保持 Nest 的迁移样例完整，再在两套目录下各新建一个 `<时间戳>-<描述>.ts`。**不要修改已发布的迁移样例**。

## 8. 错误处理：`common/api.exception.ts`

本项目定义了 `ApiException`，继承自 NestJS 内置的 `HttpException`：

```typescript
export class ApiException extends HttpException {
  readonly errorCode: ErrorCode;
  readonly details: ErrorDetail[] | null;

  constructor(code: ErrorCode, message: string, details = null, statusOverride?: number) {
    super(message, statusOverride ?? ERROR_TO_STATUS[code]);
    this.errorCode = code;
    this.details = details;
  }
}

// 工厂函数简化抛出
export function notFound(message = '资源不存在') {
  return new ApiException('NOT_FOUND', message);
}
export function conflict(message: string, field?: string) {
  return new ApiException('CONFLICT', message, field ? [{ field, message }] : null);
}
// ... 还有 unauthorized / forbidden / validationError / rateLimited 等
```

业务代码直接 `throw notFound('胶囊不存在')`，不需要关心 HTTP 状态码——`ERROR_TO_STATUS` 映射表已经定义了每种错误码对应的状态码。

`ApiExceptionFilter` 捕获所有异常，按类型分别处理：

```typescript
@Catch()                          // 无参 @Catch() = 捕获所有
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    if (exception instanceof ApiException) {
      response.status(exception.getStatus()).json({
        success: false, data: null,
        errorCode: exception.errorCode,
        message: exception.message,
        details: exception.details ?? null,
      });
      return;
    }
    // class-validator 400 → 转成 422 VALIDATION_ERROR
    if (exception instanceof HttpException && status === 400 && Array.isArray(body.message)) { ... }
    // 兜底：500 INTERNAL_ERROR
  }
}
```

> **为什么 class-validator 错误是 400 但 spec 要求 422？** `ValidationPipe` 默认在校验失败时抛 `BadRequestException`（400），但 spec 要求业务校验失败用 422。过滤器里识别这种特殊的 400 body 并转换成 422。

## 9. 响应包装：`EnvelopeInterceptor`

每个 controller 方法只需返回 plain 对象，`EnvelopeInterceptor` 负责在外面套上统一外壳：

```typescript
@Injectable()
export class EnvelopeInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    const response = ctx.switchToHttp().getResponse<Response>();
    return next.handle().pipe(
      map((data) => {
        if (response.statusCode === 204) return data;  // 204 No Content 不包装
        return { success: true, data, errorCode: null, message: null, details: null };
      }),
    );
  }
}
```

`next.handle()` 返回一个 RxJS `Observable`，`pipe(map(...))` 在流里变换值。NestJS 底层整合了 RxJS 作为异步流处理机制——这里只需要记住 `map` 的语义就够了。

## 10. 鉴权：Passport + JWT

NestJS 通过 `@nestjs/passport` 集成 Passport.js，鉴权流程分三层：

**第一层：Strategy（策略）**

```typescript
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService<AppConfig>) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),  // 从 Authorization: Bearer 提取
      ignoreExpiration: false,
      secretOrKey: config.get('jwtSecret', { infer: true }),
    });
  }

  validate(payload: JwtPayload): JwtPayload {
    return payload;   // 返回值会挂到 request.user 上
  }
}
```

`PassportStrategy(Strategy)` 是 Mixin 模式：把 `passport-jwt` 的 `Strategy` 类「混入」NestJS 的依赖注入体系里。`validate` 方法在 JWT 验签通过后被调用，返回值就是 `request.user`。

**第二层：Guard（守卫）**

```typescript
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any, info: any) {
    if (err || !user) throw unauthorized('未登录或凭证无效');
    return user;
  }
}

@Injectable()
export class OptionalJwtGuard extends AuthGuard('jwt') {
  handleRequest(_err: any, user: any) {
    return user ?? null;  // 验证失败也放行，user 为 null
  }
}
```

`AuthGuard('jwt')` 内部调用 `JwtStrategy`，`handleRequest` 处理结果——`JwtAuthGuard` 遇到无效 token 抛 401；`OptionalJwtGuard` 静默放行，让后续代码自己判断 user 是否为 null。

**第三层：参数装饰器**

```typescript
export const CurrentUser = createParamDecorator(
  (_data, ctx: ExecutionContext): JwtPayload | null => {
    const request = ctx.switchToHttp().getRequest();
    return request.user ?? null;
  },
);
```

`@CurrentUser()` 在 controller 方法参数上使用，从已经挂好的 `request.user` 取出当前用户，避免重复写 `req.user`。

## 11. DTO 与校验：`class-validator`

每个功能域的 DTO 放在各自模块的 `dto/` 子目录：

```typescript
export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @Length(8, 100)
  password: string;

  @IsString()
  @Length(2, 20)
  nickname: string;

  @IsString()
  @Matches(/^[a-z0-9_-]+$/, { message: 'avatarId must be alphanumeric' })
  avatarId: string;
}
```

- 装饰器（`@IsEmail`、`@Length`、`@Matches`）来自 `class-validator` 包，描述字段的校验规则。
- 全局 `ValidationPipe` 自动执行校验：先用 `class-transformer` 把 request body 的 plain JSON 实例化成 `RegisterDto` 类，再用 `class-validator` 跑装饰器里的规则。
- 校验失败时 `ValidationPipe` 收集所有不通过的规则，抛出 `BadRequestException`，再由 `ApiExceptionFilter` 转成 422。

> **`whitelist: true` 的作用**：若请求体里有 `RegisterDto` 不知道的字段（比如 `admin: true`），`ValidationPipe` 在实例化时自动剥除它们，确保 DTO 里只有已声明的字段流向 service。

## 12. 服务层：业务逻辑都在这里

controller 只做「取参数 → 调 service → 返回结果」，真正的业务在 `service/`。

### 11.1 `auth.service.ts`：注册、登录、refresh token 轮转

`register` 流程：

```typescript
async register(dto: { email; password; nickname; avatarId }): Promise<AuthTokens> {
  if (!ALLOWED_AVATAR_IDS.has(dto.avatarId)) throw validationError('头像 ID 不存在', 'avatarId');

  const emailNorm = dto.email.toLowerCase().trim();
  const existingEmail = await this.userRepo.findOne({ where: { email: emailNorm } });
  if (existingEmail) throw conflict('邮箱已被注册', 'email');

  const user = this.userRepo.create({ id: uuidv4(), email: emailNorm, ... });
  try {
    await this.userRepo.save(user);
  } catch (e: any) {
    // 唯一索引冲突兜底（并发注册竞态）
    if (e?.message?.includes('email')) throw conflict('邮箱已被注册', 'email');
    throw conflict('注册冲突');
  }

  const { tokenRow, ...tokens } = this.issueTokenPair(user);
  await this.tokenRepo.save(this.tokenRepo.create(tokenRow));
  return { ...tokens, user: this.toUserOut(user) };
}
```

`refresh` 的关键逻辑：

```typescript
async refresh(rawRefresh: string): Promise<AuthTokens> {
  const tokenHash = this.hashRefreshToken(rawRefresh);
  const row = await this.tokenRepo.findOne({ where: { tokenHash } });
  if (!row) throw unauthorized('refresh token 无效');
  if (row.expiresAt <= new Date()) throw unauthorized('refresh token 已过期');

  if (row.revokedAt !== null) {
    // 重放检测：整族 token 全部 revoke，然后返回 401
    await this.tokenRepo.createQueryBuilder()
      .update().set({ revokedAt: now })
      .where('family_id = :fid AND revoked_at IS NULL', { fid: row.familyId })
      .execute();
    throw unauthorized('refresh token 已失效');
  }

  // 正常路径：旧 token 标记 revoked，颁发新 token pair
  row.revokedAt = now;
  await this.tokenRepo.save(row);

  const { tokenRow, ...tokens } = this.issueTokenPair(user, row.familyId);  // 复用 familyId
  await this.tokenRepo.save(this.tokenRepo.create(tokenRow));
  return { ...tokens, user: this.toUserOut(user) };
}
```

注意：NestJS service 默认没有事务！这里「revoke 旧 token + 新增新 token」是两步独立操作，存在并发窗口。生产级实现应当用 `dataSource.transaction(async manager => { ... })` 包住，但教学项目里已足以演示 refresh token 轮转的语义。

### 11.2 `plaza.service.ts`：列表查询与 N+1 问题

`plazaList` 用 `innerJoinAndSelect` 在一次查询里同时拿到胶囊和 owner：

```typescript
const rows = await this.capsuleRepo
  .createQueryBuilder('c')
  .innerJoinAndSelect('c.owner', 'u')   // 一次 JOIN，不需要再单独查 user
  .where('c.inPlaza = :plaza', { plaza: true })
  // ...
  .getMany();
```

取完列表后，批量加载当前用户的收藏集合：

```typescript
const faved = await this.getFavoriteIds(capsuleIds, viewerId);  // 一次查询取全部

const items = rows.map((c) => this.toListItem(c, c.owner, faved.has(c.id)));
```

这是「批量预加载」模式，避免 N+1 查询（否则每行胶囊都要单独查一次 favorites 表）。

### 11.3 `favorites.service.ts`：幂等收藏与原子计数

```typescript
async addFavorite(userId: string, capsuleId: string) {
  const existing = await this.favoriteRepo.findOne({ where: { userId, capsuleId } });
  if (existing) return { ... };   // 幂等：已收藏直接返回

  await this.favoriteRepo.save(fav);

  // 原子 UPDATE，不经过实体加载，避免并发计数漂移
  await this.capsuleRepo
    .createQueryBuilder()
    .update()
    .set({ favoriteCount: () => 'favorite_count + 1' })
    .where('id = :id', { id: capsuleId })
    .execute();
}
```

`set({ favoriteCount: () => 'favorite_count + 1' })` 这里的箭头函数是 TypeORM 的「原始 SQL 片段」语法——括号里的字符串会直接插入 SQL，实现原子自增而不是读-改-写。

### 11.4 限流

```typescript
const loginFailures = new Map<string, number[]>();  // 进程内内存，重启清零

private checkRateLimit(email: string): void {
  const now = Date.now();
  const failures = (loginFailures.get(email) ?? []).filter((t) => now - t < 60_000);
  loginFailures.set(email, failures);
  if (failures.length >= limit) throw rateLimited();
}
```

按邮箱做滑动窗口限流，60 秒内超过阈值则 429。单进程内存实现，教学用途；生产应改用 Redis。

## 13. 测试

本项目的契约一致性由仓库级黑盒验证覆盖：

```bash
../../verification/scripts/verify-contract.sh nest
```

它会启动 NestJS 进程，按 `spec/api/openapi.yaml` 跑 HTTP 请求，验证响应格式、状态码和不变式。NestJS 的单元测试推荐使用 `@nestjs/testing` 包：

```typescript
const moduleRef = await Test.createTestingModule({
  providers: [AuthService, { provide: getRepositoryToken(User), useValue: mockRepo }],
}).compile();
const service = moduleRef.get(AuthService);
```

端到端测试用 `supertest`：

```typescript
const app = moduleRef.createNestApplication();
app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
await app.init();
await request(app.getHttpServer()).post('/api/v1/auth/register').send({...}).expect(201);
```

## 14. 常见改动指南

| 想做什么 | 改哪里 |
|---|---|
| 加一个新 HTTP 接口 | ① 在对应模块的 `*.controller.ts` 里加方法；② 如果是新模块，在对应 `*.module.ts` 里声明 controller，并在 `app.module.ts` 里 `imports` 新模块 |
| 加一个请求 / 响应字段 | 修改对应 `dto/*.dto.ts` 里的 class（记得加 class-validator 装饰器） |
| 加一个业务规则 | 在对应 `*.service.ts` 方法里加判断，`throw` 对应的 `ApiException` 工厂函数 |
| 加一张表 / 一列 | ① 先改 `spec/db` 与仓库级维护脚本；② 在 `entities/` 新增或修改实体；③ 如需保留样例，再同步 `database/migrations/{postgres,sqlite}/` |
| 加一个查询条件 | 在 service 里用 `.andWhere(...)` 追加；复杂查询用 `createQueryBuilder()` 链式构造 |
| 加一个配置项 | 在 `config/configuration.ts` 的 `AppConfig` 接口加字段，在工厂函数里从 `process.env` 读取 |
| 加一个跨切关注（日志、限流） | 写一个 `@Injectable()` 类实现 `NestInterceptor` 或 `CanActivate`，在 `main.ts` 用 `app.useGlobalInterceptors/Filters/Guards` 注册，或在 module/controller 上用 `@UseInterceptors/@UseGuards` 局部注册 |
| 改默认错误响应 | `common/filters/api-exception.filter.ts` 修改对应分支；错误码映射改 `common/api.exception.ts` 里的 `ERROR_TO_STATUS` |
| 临时调端口 / 数据库 | 设置环境变量：`PORT=29041 ./run`、`DB_DRIVER=sqlite ./run` |

## 15. 与其他栈的横向对比

理解 NestJS 的最佳方式之一是和本项目的其他实现对照：

| 概念 | Spring Boot | Go Gin | NestJS |
|---|---|---|---|
| 路由注册 | `@GetMapping` 注解 | `r.GET("/path", handler)` | `@Get('path')` 注解 |
| DI 容器 | Spring IoC（classpath 扫描） | 手动构造/传参 | NestJS DI（模块显式声明） |
| 请求验证 | Bean Validation（`@Valid`） | go-playground/validator + binding tag | class-validator + `ValidationPipe` |
| ORM | Spring Data JPA / Hibernate | GORM | TypeORM |
| schema 表达样例 | Flyway SQL（默认不自动执行） | 历史 SQL 迁移参考 | TypeORM MigrationInterface（默认不自动执行） |
| 鉴权 | Spring Security / 自定义 Filter | 中间件函数 | Passport Strategy + Guard |
| 全局异常 | `@RestControllerAdvice` | `middleware.RespondErr` | `@Catch()` ExceptionFilter |
| 响应包装 | controller 手动 `Envelope.ok(...)` | `dto.OK(...)` | `EnvelopeInterceptor` 自动包装 |

NestJS 的特色是**把 Express 的随意性与 Spring 的约定性结合**：模块系统让代码强制分层；装饰器让路由/校验/鉴权以声明式方式表达；但底层依然是 Node.js + Express，性能特征和调试体验都接近 Express。

## 16. 学到这里之后

读到这里，你已经掌握了 NestJS 项目最常见的 80%：Module/DI 体系、Controller + Guard + Pipe + Interceptor + Filter 五件套、TypeORM 实体与 QueryBuilder、class-validator DTO、Passport JWT 鉴权、统一异常处理、跨数据库列类型辅助。

下一步建议：

- 翻 `auth/auth.service.ts`，把 `refresh` 方法的逻辑跟 `backends/gin/internal/service/auth.go` 的 `Refresh` 对照读一遍，理解相同「令牌族」安全模型在 TypeScript 和 Go 里的不同写法。
- 在 `favorites/favorites.service.ts` 里故意去掉原子 UPDATE，改成「读 → +1 → save」，然后跑并发收藏测试，观察计数漂移现象——这是理解原子操作必要性的最直观方式。
- 研究 `database/column-helpers.ts` 的 `ValueTransformer`，再对照 `backends/spring-boot` 里的 `OffsetDateTimeStringConverter`——两者解决的是完全相同的跨库时间类型问题，但一个在 TypeORM 层，一个在 JPA 层。

之后可以深入研究 NestJS 的进阶话题：微服务传输层（`@nestjs/microservices`）、`AsyncLocalStorage` 实现请求级上下文追踪、`@nestjs/schedule` 定时任务、`DataSource.transaction` 显式事务管理。本项目刻意保持极简，把这些留给后续。
