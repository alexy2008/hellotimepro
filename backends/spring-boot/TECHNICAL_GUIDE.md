# HelloTime Pro Spring Boot 后端技术手册与代码导读

本文面向已经熟悉 Java 语法（类、接口、泛型、Lambda、`Optional`、`record`），但还没系统接触过 Spring Boot 的读者。读完后，你应该能回答三件事：

- 一个 HTTP 请求进入后端后，代码按什么顺序执行。
- Spring Boot、Spring MVC、Spring Data JPA、Hibernate、Flyway、Jackson、Bean Validation 分别在做什么。
- 想新增一个接口、字段或业务规则时，应该改哪些文件。

> 阅读建议：第 1 节介绍技术栈与设计特色；第 2～4 节建立整体地图与入口；第 5 节集中讲 Spring 的几个核心思想（IoC / 注解驱动 / AOP）；第 6～13 节按一次请求的生命周期分层细讲；第 14 节给出常见改动的步骤清单。

## 1. 技术选型与设计特色

HelloTime Pro 的 Spring Boot 后端实现基于 **Java 17 + Spring Boot 3 + Spring Data JPA** 核心骨架，并选用 **Hibernate** 作为 JPA 提供商、**Flyway** 管理数据库迁移、**Jackson** 负责 JSON 序列化、**Jakarta Bean Validation** 实现声明式数据校验，同时支持 **PostgreSQL** 和 **SQLite** 双数据库驱动切换。其具体选型考量与设计特色如下：

* **Spring Boot 3 与 IoC/DI（强大的依赖注入与自动装配）**：利用 Spring 核心的控制反转（IoC）与依赖注入（DI）容器，以单例模式管理 service、controller 和 repository 组件。通过 Spring Boot 强大的自动配置（Auto-Configuration）开箱即用，极大地提高了企业级后端系统的装配效率。
* **Spring Data JPA 与方言自适应（声明式数据访问与自适应时间列）**：选用 Spring Data JPA 作为持久层，通过方法名自动解析生成 SQL 查询。针对跨库（PostgreSQL 和 SQLite）在时间列时区支持上的硬件差异，自制了全局的 `OffsetDateTimeStringConverter` 属性转换器，并配置了 JPA 级别悲观锁（`PESSIMISTIC_WRITE`），确保了行级并发一致性。
* **Jakarta Bean Validation 与控制器路由（注解驱动拦截）**：通过在 DTO（记录类 record）属性上贴附 `@NotBlank`、`@Size`、`@Pattern` 等 Bean Validation 标准注解，配合 `@Valid` 开启请求边界拦截。结合 `@RestController` 和 `@PostMapping` 等注解声明式处理路由映射，简洁直观。
* **声明式事务管理与异常拦截（AOP 实践）**：基于 Spring 的 AOP（面向切面编程）机制，使用 `@Transactional` 实现无侵入的声明式事务管理。同时构建了 `@RestControllerAdvice` 全局异常处理器，将业务中抛出的 `ApiException` 或请求校验异常统一捕获并自动转换为契约约定的错误响应。

## 2. 先建立整体地图

HelloTime Pro 是一个时间胶囊应用。Spring Boot 后端的职责是：

- 提供 `/api/v1/*` HTTP API（与 `spec/api/openapi.yaml` 对齐）。
- 校验请求数据：邮箱格式、密码强度、胶囊开启时间等。
- 处理用户注册、登录、JWT access token、refresh token 轮转（含令牌族追踪）。
- 读写用户、胶囊、收藏、refresh token 等数据，并维护反规范化字段 `favorite_count`。
- 在 PostgreSQL 和 SQLite 之间无缝切换（通过环境变量），同一份业务代码两边都跑得动。
- 暴露 `spec/avatars/*`、`spec/icons/*` 作为静态资源，并提供 LLM 胶囊建议接口。

核心目录：

```text
backends/spring-boot/
├── pom.xml                                  # Maven 构建脚本（依赖、Java 版本、Spring Boot 父 POM）
├── run / build / test                       # 三个 Bash 脚本，封装 mvn 命令并注入数据库环境变量
├── src/main/resources/
│   ├── application.yml                      # 配置文件，所有可调参数都有 ${ENV:default}
│   └── db/migration/{postgres,sqlite}/      # Flyway 迁移脚本（按驱动分别一份）
└── src/main/java/com/hellotimepro/springboot/
    ├── HelloTimeProApplication.java         # main 入口，@SpringBootApplication
    ├── config/
    │   ├── AppProperties.java               # @ConfigurationProperties，把 yml 映射成 Java 对象
    │   └── WebConfig.java                   # 注册 CORS 和 /static/** 资源处理器
    ├── domain/                              # JPA 实体（@Entity），对应数据库表
    ├── repository/                          # Spring Data JPA 仓库接口，自动生成 SQL
    ├── service/                             # 业务层（@Service）：注册、胶囊、收藏、广场、JWT…
    ├── dto/Dtos.java                        # 请求 / 响应数据载体，全部为 record
    └── web/                                 # 控制器（@RestController）+ 全局异常 + 错误码
```

一次典型请求的流向：

```text
浏览器 / 前端
  │ HTTP
  ▼
内嵌 Tomcat（Spring Boot 启动时自带）
  │ Servlet 容器
  ▼
Spring MVC DispatcherServlet
  │ 按 URL 找到 @RestController 上的方法
  ▼
web/*Controller.java
  │ Bean Validation 校验 @Valid 标注的 @RequestBody
  │ AuthContext 把 Authorization 头解码成 UserEntity
  ▼
service/*Service.java （@Service / @Transactional）
  │ 调用仓库接口
  ▼
repository/*Repository.java （Spring Data JPA）
  │ Hibernate 生成 SQL
  ▼
PostgreSQL 或 SQLite
```

返回方向上，service 把实体转成 `Dtos.*` record，控制器再用 `Envelope.ok(...)` 包一层，Jackson 把对象序列化成 JSON 写回响应。

## 3. 如何运行和验证

开发运行：

```bash
cd backends/spring-boot
DB_DRIVER=sqlite ./run      # 用 SQLite，零依赖
./run                       # 默认 PostgreSQL（需要先 docker compose up -d postgres）
```

默认端口是 `29000`。启动后可访问：

- 健康检查：`http://127.0.0.1:29000/api/v1/health`
- 头像列表：`http://127.0.0.1:29000/api/v1/avatars`

测试（默认走 SQLite，无外部依赖）：

```bash
./test
```

构建可执行 JAR：

```bash
./build
# 产物在 target/spring-boot-backend-0.1.0.jar
```

三个脚本做的事：

- `run`：找到 `mvn`（兼容 sdkman/vmr/Homebrew），按 `DB_DRIVER` 注入 `SPRING_DATASOURCE_*` 环境变量，然后执行 `mvn spring-boot:run`。
- `test`：把临时 SQLite 文件清掉再 `mvn test`，跑的是 `SmokeTest`。
- `build`：`mvn -q -DskipTests package`，由 `spring-boot-maven-plugin` 打成可执行 JAR。

> 第一次启动会下载依赖（约 1～2 分钟），之后 Maven 会缓存到 `~/.m2/repository`。

## 4. 入口：`HelloTimeProApplication.java`

整个应用的 main 方法只有这一段：

```java
@SpringBootApplication
@EnableConfigurationProperties(AppProperties.class)
public class HelloTimeProApplication {
  public static void main(String[] args) {
    SpringApplication.run(HelloTimeProApplication.class, args);
  }
}
```

`@SpringBootApplication` 等于三件事的组合：

1. `@Configuration`：本类是一个「Java 配置类」，可以在里面用 `@Bean` 定义对象。
2. `@EnableAutoConfiguration`：根据 classpath 上有什么 jar，自动装配很多默认实现。比如发现 `spring-boot-starter-web` 就启动内嵌 Tomcat 并装上 Jackson；发现 `spring-boot-starter-data-jpa` 就装上 Hibernate 和事务管理器。
3. `@ComponentScan`：扫描本类所在包及其子包下所有带 `@Component / @Service / @Repository / @Controller / @RestController / @Configuration` 的类，纳入 Spring 容器管理。

`@EnableConfigurationProperties(AppProperties.class)` 告诉 Spring 把 `AppProperties` 这个 POJO 当作配置载体注册成 bean。

`SpringApplication.run(...)`：构造一个 `ApplicationContext`（Spring 容器），扫描所有 bean，按依赖关系实例化它们，启动内嵌 Tomcat 监听端口。整个过程通常 1～3 秒。

## 5. Spring 的几个关键思想

Spring Boot 没有「魔法」，但有 **三个核心机制** 是 Java 程序员第一次看 Spring 代码最容易困惑的地方。看懂它们，后面的注解就都是这三个机制的语法糖。

### 4.1 IoC（控制反转）与依赖注入

普通 Java 代码：

```java
class FavoriteService {
  private final CapsuleRepository capsules = new CapsuleRepository();   // 自己 new
}
```

Spring 风格：

```java
@Service
public class FavoriteService {
  private final CapsuleRepository capsules;
  public FavoriteService(CapsuleRepository capsules) {   // 由 Spring 注入
    this.capsules = capsules;
  }
}
```

`@Service` 让 Spring 在启动时把 `FavoriteService` 实例化成 **一个单例**（默认）放到容器里。看到它的构造函数需要一个 `CapsuleRepository`，Spring 会在容器里找到对应的 bean 传进来。本项目里所有的 service / controller / repository 都靠这种「构造器注入」拿依赖。

> **为什么这样写？** 单元测试时可以传 mock；切换实现时不用改调用方；类与类之间的关系一目了然，因为构造函数列出了所有依赖。

### 4.2 注解驱动 + 反射

`@RestController`、`@GetMapping`、`@Valid`、`@Transactional`…… 这些注解本身什么都不做。它们只是给类 / 方法贴上「标签」。真正干活的是 Spring 启动时扫描这些标签并注册行为：

- 看到 `@RestController` 类里的 `@PostMapping("/login")` 方法：把 `POST /login` 注册到 DispatcherServlet 的路由表。
- 看到 `@Transactional` 方法：用 CGLIB / JDK 动态代理生成一个子类，在方法前后插入「开启事务 → 执行 → 提交或回滚」。
- 看到 `@ConfigurationProperties(prefix = "app")` 类：把 `application.yml` 里 `app.*` 的值反射写入 setter。

后面看代码时，凡是看到注解，可以默念一句：「这是给 Spring 看的标签，行为在框架那边」。

### 4.3 AOP 代理：`@Transactional` 为什么能工作

`AuthService.register()` 上贴了 `@Transactional`，但代码里没有任何 `connection.commit()`。Spring 是怎么开事务的？

启动时，Spring 不直接把你写的 `AuthService` 放进容器，而是创建一个 **代理类**（运行时生成的子类），重写所有带 `@Transactional` 的方法：

```text
代理.register(req):
    txManager.begin()
    try {
      result = 原始.register(req)
      txManager.commit()
      return result
    } catch (RuntimeException e) {
      txManager.rollback()
      throw e
    }
```

调用方拿到的是代理实例，所以方法调用自动「被」事务化。

⚠️ **常见陷阱**：在同一个类内部调用另一个 `@Transactional` 方法 **不会** 走代理，事务不会生效。原因是 `this.foo()` 绕开了代理对象。本项目的写法都是外部进入服务的入口方法上加 `@Transactional`，避免这个坑。

## 6. 配置层：`application.yml` + `AppProperties`

`src/main/resources/application.yml` 是配置文件，YAML 语法（缩进表示层级）。Spring Boot 启动时会自动读取它。

每一项都写成 `${ENV:默认值}`，意思是「优先取环境变量 `ENV`，没有就用默认值」。例如：

```yaml
server:
  port: ${PORT:29000}
```

这让我们既能 IDE 里直接跑（用默认值），也能在生产 / 测试用环境变量改端口、数据库 URL、JWT 密钥而不用改代码。

`app.*` 这一段被映射成 `config/AppProperties.java`：

```java
@ConfigurationProperties(prefix = "app")
public class AppProperties {
  private String jwtSecret = "dev-secret-change-me";
  private int accessTokenTtlSeconds = 3600;
  ...
  private Llm llm = new Llm();
  // 一堆 getter/setter
}
```

`prefix = "app"` 表示从 yml 里 `app.jwt-secret`（kebab-case）映射到 Java 字段 `jwtSecret`（camelCase）。`Llm` 是一个嵌套的静态内部类，对应 `app.llm.*`。

要新增一个配置项：在 yml 加一行 → 在 `AppProperties` 加一个字段 + getter/setter → 注入 `AppProperties` 的地方就能 `props.getXxx()` 拿到。

### 5.1 跨数据库切换的关键开关

`run` 脚本根据 `DB_DRIVER` 设置三个核心环境变量：

| 环境变量 | PostgreSQL | SQLite |
|---|---|---|
| `SPRING_DATASOURCE_URL` | `jdbc:postgresql://...` | `jdbc:sqlite:.../hellotime.db` |
| `SPRING_DATASOURCE_DRIVER` | `org.postgresql.Driver` | `org.sqlite.JDBC` |
| `SPRING_JPA_DATABASE_PLATFORM` | `PostgreSQLDialect` | `SQLiteDialect` |

而 `spring.flyway.locations: classpath:db/migration/${DB_DRIVER:postgres}` 决定加载哪一套迁移脚本。Java 业务代码完全不感知数据库差异，只在两处（`AuthService.findRefreshTokenForRotation`、`FavoriteService.lockCapsule`）针对 Postgres 走更严格的行锁路径。

## 7. Web 层：控制器与请求映射

控制器都在 `web/` 包，每个文件对应一组相关接口。以 `AuthController` 为例：

```java
@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {
  private final AuthService auth;

  public AuthController(AuthService auth) {   // 构造器注入
    this.auth = auth;
  }

  @PostMapping("/register")
  @ResponseStatus(HttpStatus.CREATED)
  public Envelope<AuthTokens> register(@Valid @RequestBody RegisterRequest req) {
    return Envelope.ok(auth.register(req));
  }
}
```

逐个拆解：

- `@RestController` = `@Controller` + `@ResponseBody`：方法的返回值直接由 Jackson 序列化成 JSON 写到响应体，不走视图模板。
- `@RequestMapping("/api/v1/auth")`：类级别前缀，下面所有方法的路径都拼在它后面。
- `@PostMapping("/register")`：监听 `POST /api/v1/auth/register`。同理还有 `@GetMapping / @PutMapping / @PatchMapping / @DeleteMapping`。
- `@ResponseStatus(HttpStatus.CREATED)`：默认响应码 200，这里强制改成 201。
- `@RequestBody`：告诉 Spring 把请求体 JSON 反序列化成 `RegisterRequest`。
- `@Valid`：触发 Bean Validation。如果 `RegisterRequest` 上的 `@Email / @Size / @Pattern` 校验失败，会抛 `MethodArgumentNotValidException`（被 6.3 节的全局异常处理器接走）。

其他参数注解：

| 注解 | 作用 | 例子 |
|---|---|---|
| `@PathVariable` | URL 占位符 | `@GetMapping("/{code}") ... @PathVariable String code` |
| `@RequestParam` | URL 查询参数 | `@RequestParam(defaultValue = "1") int page` |
| `@RequestHeader` | HTTP 头 | `@RequestHeader(value = "Authorization", required = false) String authorization` |
| `@RequestBody` | 请求体 JSON | `@RequestBody CreateCapsuleRequest req` |

### 6.1 统一响应外壳 `Envelope`

`Dtos.Envelope` 是一个 record：

```java
public record Envelope<T>(boolean success, T data, String message, String errorCode) {
  public static <T> Envelope<T> ok(T data) { return new Envelope<>(true, data, null, null); }
}
```

所有成功返回都用 `Envelope.ok(...)` 包裹，序列化出来形如：

```json
{ "success": true, "data": {...}, "message": null, "errorCode": null }
```

错误返回则由 `GlobalExceptionHandler` 用 `ErrorEnvelope` 构造。这套外壳格式来自 `spec/api/openapi.yaml`，前端不论调用哪个后端实现都能拿到相同结构。

### 6.2 鉴权：`AuthContext`

控制器不直接解析 JWT，统一调用 `AuthContext`：

```java
UserEntity user = auth.required(authorization);                    // 必须登录
String viewerId = auth.optional(authorization)                    // 登录可选（影响 favoritedByMe）
    .map(u -> u.getId().toString()).orElse(null);
```

`AuthContext`：

1. 解析 `Authorization: Bearer xxx` 头。
2. 调 `SecurityService` 用 JWT 库验签、检查过期。
3. 拿 `subject`（用户 UUID）去数据库取 `UserEntity`。
4. 出错就抛 `ApiException.unauthorized(...)`。

> 一开始可能会觉得「让每个方法手动取 token 太啰嗦，为什么不在过滤器里塞到 SecurityContext？」本项目刻意不引入 `spring-boot-starter-security`，只用它的 `BCryptPasswordEncoder`，让鉴权流程一眼看穿，便于教学。生产项目通常用 Spring Security 的过滤链 + `@AuthenticationPrincipal`。

### 6.3 全局异常处理：`GlobalExceptionHandler`

`@RestControllerAdvice` 标注的类是一个跨所有控制器的「异常拦截器」。Spring 会把控制器方法抛出的异常按类型路由到 `@ExceptionHandler` 标注的方法：

```java
@ExceptionHandler(ApiException.class)
public ResponseEntity<ErrorEnvelope> api(ApiException ex) { ... }

@ExceptionHandler(MethodArgumentNotValidException.class)
public ResponseEntity<ErrorEnvelope> validation(...) { ... }

@ExceptionHandler(Exception.class)            // 兜底：500
public ResponseEntity<ErrorEnvelope> unexpected(Exception ex) { ... }
```

业务代码因此可以放心地 `throw ApiException.notFound("胶囊不存在")`，最终响应体会是统一的 `ErrorEnvelope` 结构。`ApiException` 是自己定义的 unchecked 异常，带上 HTTP 状态、错误码、字段级 details。

### 6.4 跨域与静态资源：`WebConfig`

```java
@Configuration
public class WebConfig implements WebMvcConfigurer {
  @Override public void addCorsMappings(CorsRegistry registry) { ... }
  @Override public void addResourceHandlers(ResourceHandlerRegistry registry) { ... }
}
```

- `addCorsMappings`：允许所有来源跨域访问（教学项目）。
- `addResourceHandlers`：把 `/static/avatars/**` 和 `/static/icons/**` 映射到仓库根目录下的 `spec/avatars`、`spec/icons` 文件夹，前端可以直接 `<img src="/static/icons/java.svg">`。

`WebMvcConfigurer` 是 Spring MVC 提供的扩展点接口，里面有十几个可选方法（拦截器、参数解析器、消息转换器等）。

## 8. DTO 层：`dto/Dtos.java`

整个 DTO 集中写在 `Dtos.java` 里，所有都是 Java 16+ 的 `record`：

```java
public record RegisterRequest(
    @NotBlank @Email @Size(max = 254) String email,
    @NotBlank @Size(min = 8, max = 128)
    @Pattern(regexp = "^(?=.*[A-Za-z])(?=.*\\d).{8,128}$") String password,
    @NotBlank @Size(min = 2, max = 20) @Pattern(...) String nickname,
    @NotBlank @Size(min = 2, max = 20) @Pattern(...) String avatarId
) {}
```

要点：

- `record` 自动生成 final 字段、构造函数、`equals/hashCode/toString` 和访问器 `email()`。
- 注解（`@NotBlank`、`@Email`、`@Size`、`@Pattern`）是 Jakarta Bean Validation 规范。控制器方法参数加 `@Valid`，Spring 启动时检测到 classpath 上有 `spring-boot-starter-validation`（背后是 Hibernate Validator），就会自动执行校验。
- Jackson 默认按字段名（即 record component 名）做反序列化。`application.yml` 里 `jackson.property-naming-strategy: LOWER_CAMEL_CASE` 让响应键保持驼峰风格。
- 集中写在一个文件里只是教学项目的取舍：方便一眼看到全部数据契约。生产项目通常一个文件一个 DTO。

> 校验失败会抛 `MethodArgumentNotValidException`，被全局异常处理器转换成 HTTP 422 + `VALIDATION_ERROR`，details 列出每个不通过的字段。

## 9. 领域层：`domain/*Entity.java`

这里是 JPA 实体类，对应数据库的表。`UserEntity` 示例：

```java
@Entity
@Table(name = "users")
public class UserEntity {
  @Id
  @JdbcTypeCode(SqlTypes.VARCHAR)
  private UUID id;

  private String email;

  @Column(name = "password_hash")
  private String passwordHash;
  ...
}
```

注解的含义：

- `@Entity`：被 Hibernate 视为持久化对象。
- `@Table(name = "users")`：映射到表 `users`。
- `@Id`：主键字段。
- `@Column(name = "...")`：字段名和列名不一致时显式指定。
- `@JdbcTypeCode(SqlTypes.VARCHAR)`：把 `UUID` 当 VARCHAR 存（让 PostgreSQL 和 SQLite 行为一致——schema 里 id 都是 `VARCHAR(36) / TEXT`）。

`FavoriteEntity` 用复合主键 `(user_id, capsule_id)`，做法是把主键封装成 `@Embeddable` 类 `FavoriteId`，再在实体里用 `@EmbeddedId` 引用：

```java
@Entity @Table(name = "favorites")
public class FavoriteEntity {
  @EmbeddedId
  private FavoriteId id;
  ...
}
```

### 8.1 `OffsetDateTimeStringConverter`：解决跨库时区差异

SQLite 没有原生时间类型，JDBC 驱动用 TEXT 存。这个类是一个全局 `@Converter(autoApply = true)`：

- 写入：把 `OffsetDateTime` 转成 `Timestamp`（UTC）。
- 读出：再把 `Timestamp` 还原成 UTC 的 `OffsetDateTime`。

`autoApply = true` 意味着所有实体里的 `OffsetDateTime` 字段都会自动经过它，业务代码不用关心。

> 业务代码统一用 `OffsetDateTime.now(ZoneOffset.UTC)` 拿当前时间，避免时区问题。

## 10. 持久层：Spring Data JPA Repository

Spring Data JPA 是 JPA 的「神奇加成」：你只写接口，框架根据方法名自动生成 SQL。

```java
public interface UserRepository extends JpaRepository<UserEntity, UUID> {
  Optional<UserEntity> findByEmail(String email);
  boolean existsByEmail(String email);
  boolean existsByNickname(String nickname);
}
```

继承 `JpaRepository<T, ID>` 就自动拥有 `save / findById / findAll / delete / count` 等通用方法。

`findByEmail(String)`：Spring 解析方法名 `findBy + Email`，知道要根据 `email` 字段查询，生成 `SELECT ... WHERE email = ?`。`exists / count / deleteBy...` 都是同样的解析规则。

要嵌套字段时用属性路径，如 `findByIdUserIdOrderByCreatedAtDesc` 表示「id.userId 排序 createdAt 倒序」，对应 `FavoriteEntity.id.userId`。

### 9.1 自定义 JPQL：`@Query`

`CapsuleRepository.findPlazaPage`：

```java
@Query("""
    select c from CapsuleEntity c
    where c.inPlaza = true
      and ( :filter = 'all'
            or ( :filter = 'opened'   and c.openAt <= :now )
            or ( :filter = 'unopened' and c.openAt >  :now ) )
      and ( :q is null
            or lower(c.title) like :q
            or exists (
                 select 1 from UserEntity u
                  where u.id = c.ownerId and lower(u.nickname) like :q
               ) )
    """)
Page<CapsuleEntity> findPlazaPage(@Param("filter") String filter,
                                  @Param("now") OffsetDateTime now,
                                  @Param("q") String qPattern,
                                  Pageable pageable);
```

注意：

- `@Query` 写的是 **JPQL**（不是 SQL），操作的是「实体名」而非「表名」——`from CapsuleEntity c` 而不是 `from capsules c`。
- `:filter / :now / :q` 是命名参数，对应 `@Param`。
- 返回 `Page<T>` + 方法形参带 `Pageable`：Spring 自动加 `LIMIT/OFFSET`，并额外执行一次 `count(*)` 查询，包成 `Page` 对象（`getContent / getTotalElements / getTotalPages`）。
- 在调用方用 `PageRequest.of(page - 1, pageSize, sort)` 构造（Spring 的页码从 0 开始）。

### 9.2 写操作：`@Modifying` + `@Query`

```java
@Modifying(clearAutomatically = true, flushAutomatically = true)
@Query("update CapsuleEntity c set c.favoriteCount = c.favoriteCount + 1 where c.id = :id")
int incrementFavoriteCount(@Param("id") UUID id);
```

- `@Modifying` 告诉 JPA 这是写语句，需要执行 `executeUpdate` 而不是 `getResultList`。
- `flushAutomatically = true`：执行前先把持久化上下文里挂起的变更刷到数据库，避免「脏写」。
- `clearAutomatically = true`：执行后清空持久化上下文缓存，因为我们直接改了数据库，缓存里的实体已过期。

用「原子 UPDATE」而不是「load → +1 → save」是为了让并发收藏不丢计数。

### 9.3 行锁：`@Lock(PESSIMISTIC_WRITE)`

```java
@Lock(LockModeType.PESSIMISTIC_WRITE)
@Query("select c from CapsuleEntity c where c.id = :id")
Optional<CapsuleEntity> findByIdForUpdate(@Param("id") UUID id);
```

对应 SQL 的 `SELECT ... FOR UPDATE`。`FavoriteService.addFavorite` 在 Postgres 路径上调用它，确保两个并发收藏请求会串行化访问同一行胶囊，`favorite_count` 不会漂移。SQLite 没有行锁，但其单写事务模型本身就足够。

## 11. 服务层：业务逻辑都在这里

控制器只做「校验 + 取 user + 转 DTO」，真正的业务在 `service/`。

### 10.1 `AuthService`：注册、登录、refresh token 轮转

`register` 流程：

```java
@Transactional
public AuthTokens register(RegisterRequest req) {
  if (!avatars.exists(req.avatarId())) throw ApiException.validation(...);
  if (users.existsByEmail(email)) throw ApiException.conflict(...);
  if (users.existsByNickname(req.nickname())) throw ApiException.conflict(...);

  UserEntity user = new UserEntity();
  ... // 填字段
  user.setPasswordHash(security.hashPassword(req.password()));
  users.saveAndFlush(user);
  return issueTokenPair(user, null);
}
```

`refresh` 是最复杂的一段，关键点：

- `@Transactional(noRollbackFor = ApiException.class)`：默认 unchecked 异常会触发回滚，但「重放检测时把整族 revoke 然后抛 401」需要把 revoke 的写入提交掉，所以告诉 Spring 别为 `ApiException` 回滚。
- `findRefreshTokenForRotation` 在 Postgres 上用 `SELECT ... FOR UPDATE` 串行化；SQLite 退化成普通 `findByTokenHash`。
- 检测到 `revokedAt != null` ⇒ 视作令牌重放，立刻 `revokeFamily()` 让整个令牌族失效（refresh token 轮转的标准做法）。
- 正常情况下：旧 token 标记 revoked → 用同一个 `familyId` 颁发新对儿，旧 token 永远不能再用。

`rateLimit`：用 `ConcurrentHashMap<String, Deque<Long>>` 实现的简易滑动窗口，按邮箱限流登录失败。教学实现，生产应用 Redis。

### 10.2 `CapsuleService`、`FavoriteService`、`PlazaService`

- `CapsuleService.create`：校验 openAt → 重试 5 次生成 8 位随机码（避免冲突）→ 插入。
- `FavoriteService.addFavorite`：拿胶囊行锁 → 检查不能收藏自己 → 已收藏则幂等 → 插 favorites 行 + 原子 UPDATE 计数。
- `PlazaService.plazaList`：参数校验 → 查询胶囊页 → 批量加载 owner / 当前用户的收藏集合 → 用 `MapperService` 拼成 DTO。批量加载避免「N+1 查询」。

### 10.3 `SecurityService`、`AvatarService`、`MapperService`

- `SecurityService`：包装 BCrypt 密码哈希、JWT 签发与解码、refresh token 的 SHA-256 哈希。`@Service` 注入，单例。
- `AvatarService`：`@PostConstruct` 在 bean 初始化后立刻执行，读取 `spec/avatars/catalog.json` 缓存到内存，避免每次请求都读文件。
- `MapperService`：实体 → DTO 的纯函数。集中放在这里，避免 service 里重复拼装。

> `@PostConstruct` 是 Jakarta 标准注解，Spring 会在依赖注入完成后调用该方法。

### 10.4 LLM 客户端：`LlmClientService` + `CapsuleSuggestionService`

`LlmClientService` 用 JDK 自带 `java.net.http.HttpClient` 调 OpenAI 兼容接口，先尝试 `/responses` 端点（带 JSON Schema 校验），失败再退到 `/chat/completions`。两层降级都失败时 `CapsuleSuggestionService` 用本地模板兜底——`@Service` 之间通过抛/接异常做明确的降级路径。

值得学习的写法：

- `ObjectMapper` 是 Spring Boot 自动配置的 bean，构造器注入即可拿到。
- `record SchemaSpec(...)` 当作纯数据描述常量。
- 自定义 `LlmClientException`（unchecked），调用方不必声明 `throws`。

## 12. 数据库迁移：Flyway

`src/main/resources/db/migration/{postgres,sqlite}/` 各一份 `V1__initial_schema.sql`。

- 文件名规范 `V<版本号>__<描述>.sql`。
- 启动时 Spring Boot 检测到 `flyway-core` 在 classpath，自动执行 `flyway migrate`：建立 `flyway_schema_history` 表记录已应用的版本，按版本顺序执行尚未运行的脚本。
- `spring.flyway.locations: classpath:db/migration/${DB_DRIVER:postgres}` 让两套 SQL 物理隔离——Postgres 用 `TIMESTAMPTZ`、check 约束含正则、`pg_trgm` GIN 索引；SQLite 用 `TEXT` 存时间、简化约束。

要新增表 / 字段：再放一个 `V2__add_xxx.sql`（两套都加），重启即可。**不要修改已经发布的 V1 脚本**——已经应用过的环境会因校验和不匹配而启动失败。

## 13. 测试：`SmokeTest`

```java
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class SmokeTest {
  @Autowired TestRestTemplate http;
  @Autowired ObjectMapper mapper;
  @Autowired JdbcTemplate jdbc;
  @LocalServerPort int port;
  ...
}
```

- `@SpringBootTest`：启动完整 Spring 容器跑测试。
- `RANDOM_PORT`：内嵌 Tomcat 监听随机端口，避免端口冲突；用 `@LocalServerPort` 拿到实际端口。
- `@Autowired` 是字段注入：仅在测试代码里推荐，生产代码用构造器注入。
- `TestRestTemplate` 是 Spring 提供的 HTTP 客户端，根 URL 自动指向被测服务。
- `@BeforeEach reset()` 直接用 `JdbcTemplate` 清表，让测试相互独立。

测试做的是端到端 smoke：注册 → 创建胶囊 → 校验未到点的胶囊 content 为 null → 第二个用户收藏 → 校验 hot 排序 → refresh 轮转后旧 token 与新 token 都被废（重放检测）。这一组用例覆盖了 spec 里最关键的几条不变式（I2 计数一致、I3 胶囊到点前不可见、refresh 一次性）。

## 14. 常见改动指南

| 想做什么 | 改哪里 |
|---|---|
| 加一个新 HTTP 接口 | 在 `web/` 新增 / 编辑 `@RestController`，方法体调用 service |
| 加一个请求 / 响应字段 | 在 `dto/Dtos.java` 修改对应 record（加校验注解） |
| 加一个业务规则 | 在对应的 `*Service` 方法里加判断，必要时 `throw ApiException.xxx(...)` |
| 加一张表 / 一列 | ① `src/main/resources/db/migration/{postgres,sqlite}/V<n>__*.sql` 各一份；② `domain/` 新增 `@Entity`；③ `repository/` 新增 `JpaRepository` |
| 加一个查询条件 | 仓库接口里加 `findByXxx...` 方法，或 `@Query` 自定义 JPQL |
| 加一个配置项 | `application.yml` 加 key → `AppProperties` 加字段 + getter/setter |
| 加一个跨切关注（日志、指标、限流） | 写一个实现 `HandlerInterceptor` 的 bean，在 `WebConfig.addInterceptors` 注册；或写 `@RestControllerAdvice` 拦异常 |
| 改默认错误响应 | `web/GlobalExceptionHandler.java` 增加 / 修改 `@ExceptionHandler` |
| 临时调端口 / 数据库 | 设置环境变量即可，不用改代码（见 §6） |

## 15. 学到这里之后

读到这里，你已经掌握了 Spring Boot 项目最常见的 80%：IoC 容器、`@RestController`、Bean Validation、Spring Data JPA、事务、全局异常、配置注入、Flyway、内嵌 Tomcat 测试。

下一步建议：

- 翻 `web/` 里你最感兴趣的接口，对照 `service/` 读完一条完整的请求路径。
- 用 `./test` 跑一次 `SmokeTest`，断点打在 `AuthService.refresh` 看 refresh 轮转的事务行为。
- 比较一下 `backends/fastapi` 的同名实现，理解相同业务在 Python 生态下怎么写——这是这个项目最大的价值。

之后再深入研究 Spring Security（鉴权过滤链）、Spring AOP（自定义切面）、`@ConditionalOnXxx`（自动配置如何按需启用）即可。本项目刻意不引入这些进阶特性，保证主线代码足够直白。
