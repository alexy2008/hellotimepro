# Dev Notes — 跨栈踩坑记录

本文件汇总了开发过程中各栈的已知坑、解决方案与约定，供所有 AI agent（Claude / Codex / Gemini）参考。
单次修复成本高、容易重踩的经验都记在这里，不分散到各实现目录。

> 更新规则：发现新坑后，直接在相应章节追加；带上发现日期和对应栈。

---

## 1. 项目质量策略

HelloTime Pro 以**教学 / 演示**为目的，以下类别问题不作为修复优先项，不要列为阻塞项或主动提出修复建议：

- JWT secret 默认值未强制校验
- 错误信息可能泄漏内部细节
- CORS `allow_origins=*`
- refresh token 存 localStorage
- 内存限流在多 worker 下失效
- Gin 并发锁不如 FastAPI 彻底（favorite / refresh 事务）
- 前端 401 恢复链的边缘情况

专注于各栈的惯用模式和 API 合约一致性即可。

---

## 2. 本地 PostgreSQL

**本机已装原生 EDB PostgreSQL 16，不要尝试启 Docker。**

| 配置项 | 值 |
|---|---|
| host | `127.0.0.1` |
| port | `5432`（注意：**不是** 55432） |
| database | `hellotime_pro` |
| user | `postgres` |
| password | 见 `data/.hello-state.json` |

`psql` 不在 PATH，完整路径为 `/Library/PostgreSQL/16/bin/psql`。

```bash
PGPASSWORD=<pw> /Library/PostgreSQL/16/bin/psql \
  -h 127.0.0.1 -p 5432 -U postgres -d hellotime_pro -c "SELECT ..."
```

- `./scripts/hello start <name>` 会自动从 `data/.hello-state.json` 读取并注入 `DB_URL`。
- 需要手动重建数据库：`DROP DATABASE` + `CREATE DATABASE`（不要 `docker compose down -v`）。
- `data/.hello-state.json` 由 hello web UI（`:9090`）维护；直接编辑也可以，确保 JSON 合法。

---

## 3. LLM 集成经验

参考实现：`backends/fastapi/app/services/llm_client.py`。

### 3.1 调用日志规范

每个后端 LLM 客户端模块必须在三个时机写结构化日志：

| 时机 | 级别 | 必含字段 |
|---|---|---|
| 请求发出前 | INFO | `model=`, `url=`, `attempt=N/M` |
| 响应成功 | INFO | `model=`, `elapsed_ms=`, `tokens=`（拿不到写 n/a） |
| 请求失败 | WARNING | `model=`, `elapsed_ms=`, `status=`（HTTP）或 `error=`（网络） |

前缀固定 `LLM request` / `LLM response` / `LLM error`，便于 `grep "LLM "` 过滤。

### 3.2 日志级别坑

框架默认 root logger 往往是 WARNING，应用自己的 INFO 日志会被吞，
表现为"代码写了日志却只看到失败、看不到成功"。

- **FastAPI/uvicorn**：uvicorn 只配自己的 `uvicorn.*` logger，不给 root 挂 handler。
  解决：`app/main.py:_configure_logging()` 给 `app` 命名空间单独挂 INFO StreamHandler，
  `propagate=False`，级别由 `LOG_LEVEL` 控制。
- 其它栈移植时，先确认应用日志级别确实是 INFO 且有输出目的地。

### 3.3 网关不稳定 → 必须重试

用户配置的网关（如 `opencode.ai/zen` DeepSeek）会**随机** SSL UNEXPECTED_EOF 掐断连接，
单次成功率约 50%。

- 在最底层 POST 处对**瞬时**错误（URLError / TimeoutError / OSError，含 SSL EOF）重试；
  HTTP 4xx/5xx 和坏 JSON **不重试**（非瞬时错误）。
- 默认：`LLM_MAX_RETRIES=2` + `LLM_RETRY_BACKOFF_MS=400`（线性退避）。
- 失败约 3–4 s 就返回（不等满超时），两次重试最坏约 13 s，成功率提到 ~87%。

### 3.4 Cloudflare error 1010

urllib 默认 UA 会被网关 Bot 防护封禁（HTTP 403, error_code 1010）。
解决：请求头带浏览器风格 `User-Agent`（可用 `LLM_USER_AGENT` 覆盖）。

### 3.5 调用风格 llm_api_style

多数兼容网关只支持 `/chat/completions`，不支持 `/responses`。
默认 `LLM_API_STYLE=chat` 直接走 chat，跳过 `/responses`（省一次请求、避免死端点挂超时）。
另有 `responses` / `auto`（先 responses 失败再回退 chat）两档可选。
本应用生成任务不需要推理，chat payload 固定 `thinking: {type: disabled}` 提速。

### 3.6 全栈用生产构建启动（next / nuxt）

next 的 `run` 脚本改为 `next build` + `next start`（而非 `next dev`）。
原因：`dev` 懒编译在 Playwright 下首次访问各路由时现场编译，本机负载下撞穿导航超时（4.5–7.4 min）。
生产构建预编译全部路由，整轮 smoke 约 14 s 稳定。nuxt 一直是生产构建。
热重载开发时仍用 `npm run dev`；`run` 脚本是给 hello CLI 和 smoke harness 用的。

### 3.7 整页 reload 序列误登出（next / nuxt）

**症状**：登录后整页导航序列（如 `/register → /`）回首页后用户态 chip 消失。

**根因**：启动时**急切拉取 `/me`**（next 的 `hydrate()` 调 `api.me()`；nuxt bootstrap 调 `refreshMe()`）
触发 refresh token 轮换。上一页轮换并吊销了 RT，但响应未及持久化就被下一次导航打断，
下一页用旧 RT 再刷新触发**重用检测 → 整族吊销 → `onAuthLost` 清空 user → chip 消失**。

**修复**：登录态由持久化的 `user`（zustand persist / Pinia store）渲染，
`hydrate()` 仅置 `isHydrated` 标志；token 改由真正的 authed 请求惰性刷新。

参考：`fullstacks/next/src/stores/auth-store.ts` / `fullstacks/nuxt/plugins/bootstrap.client.ts`。

### 3.8 React StrictMode 双触发（前端）

开发模式下 `<StrictMode>` 让 `useEffect` 跑两遍（mount→effect→cleanup→effect），
导致首屏副作用（如拉取推荐）发两次请求。**生产构建不会**。

- 轻量解法：`useRef` 闸门——effect 里 `if (inited.current) return; inited.current = true;`，只发一次。
  参考 `frontends/react-ts/src/pages/CreatePage.tsx` 的 `recoInited`。
- 推荐区"空列表不覆盖已有数据"：LLM 失败返回空数组时，前端保留现有 chip，避免把已显示内容闪没。

---

## 4. Svelte 特有坑（frontends/svelte）

### 4.1 `.svelte.ts` 单例必须带 `.ts` 后缀导入

```ts
// ✅ 正确
import { authStore } from "@/stores/auth.svelte.ts";

// ❌ 错误：跨组件变成两个不同实例
import { authStore } from "@/stores/auth.svelte";
```

不带 `.ts` 时，Vite + `@sveltejs/vite-plugin-svelte` 会把 `auth.svelte` 同时按两条链解析
（一次当 SFC、一次当 TS 模块），导致模块被加载两次、得到两个独立实例。表现：hydrate 写入
A 实例，AppHeader 订阅的是 B 实例，永远拿不到登录态；console 不报错，像"reactivity 不工作"。

本项目 `tsconfig` 已开 `allowImportingTsExtensions: true`，类型层无需额外配置。

### 4.2 svelte-routing 不能嵌套 Route

`svelte-routing@2.13` + Svelte 5 下，**不要在父 Route 的内容里嵌套子 Route**。
即便父用 `path="/*"` 通配，子 Route 挂载也会引发 `effect_update_depth_exceeded`，
页面只渲染到布局壳就停住。

正确写法：每条路径作为顶层 `<Route>`，layout 当普通组件多写几遍：

```svelte
<Router>
  <Route path="/"><MainLayout><PlazaPage /></MainLayout></Route>
  <Route path="/create"><MainLayout><AuthGate><CreatePage /></AuthGate></MainLayout></Route>
  <Route><MainLayout><NotFoundPage /></MainLayout></Route>
</Router>
```

另外 `svelte.config.js` **不要全局开** `compilerOptions.runes: true`，否则 svelte-routing 内部的
`Link.svelte`（用了 legacy `$$restProps`）会构建失败。Svelte 5 按文件自动识别 runes 模式。

---

## 5. Spring Boot 跨库 UUID / 时间戳映射

### 5.1 背景

spec schema 给 SQLite 和 Postgres 用不同存储格式：

| 字段类型 | SQLite | Postgres |
|---|---|---|
| UUID（id） | 32 位无横线 hex TEXT | 原生 `uuid` |
| 时间戳 | ISO-8601 TEXT，`+00:00` 偏移，无小数秒 | 原生 `timestamptz` |

Spring 实体映射若用 `@JdbcTypeCode(VARCHAR)` 或 OffsetDateTime↔Timestamp 转换器，
会破坏 Postgres 原生类型（`operator does not exist: uuid = character varying`）；
sqlite-jdbc 的 `getTimestamp` 解析不了带 `T`/偏移的 ISO 串（读成 null）。

### 5.2 解法

在实体字段上用自实现的 `@JdbcType` 注解，运行时按方言分流：

```java
@JdbcType(CrossDbUuidJdbcType.class)          // id 字段
@JdbcType(CrossDbOffsetDateTimeJdbcType.class) // 时间戳字段
```

- SQLite 路径：`getString` / `setString`，UUID 兼容带/不带横线，时间戳写出格式与 seed 一致。
- Postgres 路径：`setObject` / `getObject(UUID.class | OffsetDateTime.class)`。
- **必须自实现 `ValueBinder`**（不用 `BasicBinder`）：null 也要按方言 `setNull`，
  否则 Postgres 会把 VARCHAR null 写入 `timestamptz` 报错。

实现位置：`backends/spring-boot/src/main/java/.../db/`。

### 5.3 注意事项

- **改 spec schema / seed / db 脚本后，spring 是最脆的**，必须双驱动复验 `verify-contract.sh spring`。
- SQLite 外键 cascade 默认关；手动只 `seed --force` 不 reset 会残留旧测试数据干扰排查。
- `run` 脚本 SQLite URL 不需要 `?date_class=TEXT`（已走 `getString/setString`）。
- 验收：2026-06-02 双驱动各 `verify-contract.sh spring` **104/104**。

---

## 6. SSR 全栈（fullstacks/spring-mvc，Thymeleaf + HTMX）

服务端渲染全栈的通用经验，**对后续 rails / laravel 同样适用**。地基复用 `backends/spring-boot`，
跨库 JdbcType 等坑见第 5 节，这里只记 SSR 表现层特有的。

### 6.1 一个进程，两套接口 + cookie↔Bearer 桥

全栈要**同时**通过黑盒契约（104 例 JSON `/api/v1`，Bearer）与 UI 冒烟（25 例 Playwright，SSR 页面）。
SSR 这侧用 httpOnly cookie 承载会话，但部分 UI 写操作冒烟要求**直接命中 `/api/v1`**
（`me.spec` 显式 `waitForResponse(PATCH /api/v1/me)`）。

解法：一个请求包装过滤器，在 `/api/v1/*` 缺 `Authorization` 头但带 access cookie 时注入
`Bearer <cookie>`，让浏览器 fetch 复用同一套 JSON 控制器鉴权。**只在缺头时介入**——契约黑盒发真实
Bearer 时不动手，「无鉴权 → 401」也不受影响。（实现：`web/CookieTokenFilter`。）

登录态只在 access 缺失/过期时用 refresh 轮换**一次**（access JWT 自带有效期，导航不轮换），
规避「每次导航急切刷新 → refresh 重用检测 → 整族吊销 → 误登出」。

### 6.2 「点击后立刻导航」的写操作竞态 → 同步请求

冒烟里有 `点收藏 → goto('/me/favorites') → 期望出现` 这类序列。**导航会中止在途异步 XHR**，
且 SSR 目标页是静态的——收藏没在该页查询前提交就永远不显示，DOM 轮询也救不回。
PostgreSQL 上（收藏走 `SELECT ... FOR UPDATE` 行锁略慢）异步 fetch（含 `keepalive`）稳定输掉。

对**已登录**写操作用**同步 `XMLHttpRequest`**：阻塞到落库提交再返回，保证导航时已提交。
匿名分支纯客户端 `window.confirm` 跳登录、不发请求（按钮带 `data-anon`）。
> `keepalive` 只保证请求被发出，**不保证**提交早于下一页查询；要消除竞态得同步。
> next/nuxt 的收藏是非事务快路径，异步也能赢——保留 FOR UPDATE 正确性就得换同步。

### 6.3 Thymeleaf 两个坑

- **`th:replace` 优先级高于 `th:each`**：写在同一元素上时 replace 先执行、循环变量还不存在 →
  传进 fragment 的是 `null`（报 `Property 'xxx' cannot be found on null`）。必须外层 `th:each`、
  内层独立元素 `th:replace`；fragment 用**命名传参**且参数名与签名一致。
- Java `record` 属性访问在 Spring Boot 3.3（SpEL 6.1）下可用：`${capsule.title}` 直接读 record 组件。

### 6.4 HTMX 触发器与 Playwright

`hx-trigger` 监听 **`input`** 而非 `keyup`：Playwright `fill()` 只派发 `input` 事件，
用 `keyup` 会导致 HTMX 搜索/输入类交互永不触发。返回 JSON envelope 的端点（AI 灵感/生成）不适合
HTMX swap（它期望 HTML 片段），改用原生 `fetch`——与 Playwright `page.route` mock 天然兼容。

### 6.5 启动与就绪

- `hello start` **不注入 PORT**，`application.yml` 默认端口必须直接是登记端口（spring-mvc=7179），
  否则验证脚本按 `hello list` 取到的端口与实际监听不符。
- JVM 冷启动（`mvn spring-boot:run` 编译 + Spring）可达 ~60s，`verify-ui-smoke.sh` 就绪等待已
  30s→120s（`UI_READY_TIMEOUT` 可覆盖；命中即退出，不拖慢启动快的前端）。
- **沙箱**：本机 Bash 沙箱会拒绝 JVM 加载 `libmanagement.dylib`（Tomcat 静态资源扫描 / ManagementFactory）；
  经 `hello start`（分离会话）或 `dangerouslyDisableSandbox` 启动可绕过，契约/冒烟 harness 即走前者。

### 6.6 孤儿胶囊防御 + ./test schema

- SSR 首页 `/` 会查广场，比纯 JSON 后端更早暴露脏数据：owner 已删除的**孤儿胶囊**（SQLite 外键默认
  不级联，契约/冒烟清理用户后残留）会让 `mapper.listItem` 对 null owner 取 nickname 抛 NPE → 首页 500。
  `PlazaService` 渲染广场/收藏列表时跳过 null owner（等价 INNER JOIN 语义）。
- Flyway 随 db 解耦禁用后，`./test` 的测试库 schema 改由 `scripts/db init` 创建（与 app 运行一致），
  不再依赖已失效的 `db/migration/*` Flyway 脚本。

### 6.7 样式：Tailwind v4 CLI（仅构建期 Node）

JDK 全栈掺一个仅构建期的 Node 步骤：`package.json` 只含 `@tailwindcss/cli`，`build:css` 扫描
`templates/**` 生成 `static/css/app.css`；入口复用与 React 参考前端**完全相同**的 spec 样式链
（`palette + tokens + cyber + layout.css`，`layout.css` 从 react-ts 原样复制）。运行期不依赖 Node，
脚本在无 npm 时跳过、用已提交的 `app.css` 兜底。

- 验收：2026-06-04 双驱动各 `verify-contract.sh spring-mvc` **104/104**、`verify-ui-smoke.sh spring-mvc` **25/25**。

---

## 7. Ktor 后端（backends/ktor，Kotlin + Exposed）

第二个 JVM 后端，DSL 用 JetBrains 自家 Exposed（对应 Spring 的 JPA）。跨库 UUID/时间戳格式同 §5 的事实基准
（SQLite 32 位 hex + ISO TEXT / Postgres 原生 uuid+timestamptz）。

### 7.1 Exposed 跨库列类型

在同一套表定义上按方言分流读写，是 §5 `CrossDb*JdbcType` 的 Exposed 等价实现：自定义 `ColumnType`，
在 `valueFromDB` / `notNullValueToDB` 里读 `currentDialect is SQLiteDialect` 分支（SQLite 走
`String`，Postgres 走 `UUID` / `OffsetDateTime`）。时间戳 SQLite 写出格式必须与 seed 一致
（`yyyy-MM-dd'T'HH:mm:ss` + `+00:00`），靠字符串可比性支撑 `open_at <= :now`、`ORDER BY created_at`。
实现：`db/CrossDbColumns.kt`。

### 7.2 Exposed 版本与条件 lambda receiver

- 选 **Exposed 0.48.0**（untyped `ColumnType` API；0.50+ 改成泛型 `ColumnType<T>`，签名更绕）。
- **坑**：`Table.select { col eq x }` 的 lambda receiver 是 `SqlExpressionBuilder`（`eq`/`and` 可用），
  但 `deleteWhere`/部分 `update` 的 lambda receiver 不同，直接写 `eq` 会「Unresolved reference 'eq'」。
  **最稳写法**：用 `Op.build { (a eq b) and (c eq d) }` 预构建 `Op<Boolean>`，再 `deleteWhere { cond }`
  （lambda 忽略 receiver 只返回预构建条件，对任何签名都成立）。仓库里统一 `import org.jetbrains.exposed.sql.*`。
- 自定义列只在事务内用（`currentDialect` 需要事务上下文）；可空时间戳列从不绑定 null（insert 省略该列、
  update 只写非空值），规避自定义类型 `setNull` 的方言判定。

### 7.3 Gradle 构建目录与脚本同名冲突

本目录有可执行脚本 `build`，与 Gradle 默认输出目录 `build/` 冲突（报「Expected 'build' to be a directory
but it's a file」）。解决：`build.gradle.kts` 里 `layout.buildDirectory.set(layout.projectDirectory.dir("build-out"))`。

### 7.4 run 用 --no-daemon 保证 killpg 清理

`./gradlew run` 若走守护进程，应用 JVM 由 **daemon** fork、不在 `hello start` 的进程组里，`hello stop` 的
`killpg` 杀不掉 → 端口 29090 泄漏。`run` 脚本用 `./gradlew --no-daemon run`，让构建在 wrapper JVM 内进行，
fork 的应用 JVM 与之同组，可被连同清掉。`hello` 不注入 `PORT`，默认端口直接是登记端口 29090。

### 7.5 其它

- JSON 用 kotlinx.serialization：`explicitNulls=true` 让 `CapsuleDetail.content:null` 显式出现（契约要求
  字段存在且为 null），`encodeDefaults=true`。请求 DTO 字段全部可空带默认，所有「必填/格式」校验手写，
  统一 422；坏 JSON 由 `StatusPages` 接 `BadRequestException` → 422。
- LLM 客户端用 JVM 原生 `java.net.http.HttpClient`（非 Ktor client），日志/重试/UA 同 §3。
- 验收：2026-06-05 双驱动各 `verify-contract.sh ktor` **104/104**。

---

## 8. ASP.NET Core 后端（backends/aspnet，C# + EF Core）

端口 **29050**。数据访问选用 EF Core 8（.NET 旗舰 ORM）。跨库 UUID/时间戳格式同 §5 事实基准。

### 8.1 EF Core 跨库存储格式（最关键）

按 provider 在 `OnModelCreating` 里条件挂载值转换器（`Database.IsSqlite()` 改为构造时传入的 flag）：
- **SQLite**：给 id（`Guid`）挂 `ValueConverter<Guid,string>` → 32 位无横线 hex；给时间戳（`DateTimeOffset`）挂
  `ValueConverter<DateTimeOffset,string>`。**必须自定义**：EF Core SQLite 默认把 DateTimeOffset 存成
  **空格分隔 + 7 位小数** 的 TEXT（如 `2025-08-01 01:00:00.0000000+00:00`），与 seed 的 `T` 分隔、零小数不输出
  不一致，破坏字符串比较的 `open_at <= now` / `ORDER BY created_at`。写出格式固定为 `yyyy-MM-ddTHH:mm:ss[.fff…]+00:00`
  （零小数省略小数部分），与 seed 完全一致。
- **Postgres**：不挂转换器，Npgsql 原生 `Guid↔uuid`、`DateTimeOffset↔timestamptz`（始终以 UTC 存取）。
- EF 会把列上的值转换器同时套用到 LINQ 里的**参数**与 `ORDER BY`，故 `Where(c => c.OpenAt <= now)` 在 SQLite 下
  正确翻译成 TEXT 比较。实现：`src/Infrastructure/CrossDb.cs` + `AppDbContext`。
- **sqlite 判定必须单一事实源**：provider 选择（`DbUrl.Resolve`）、值转换器挂载、仓库 `FOR UPDATE` 分支、
  health 报告四处都要用同一规则 `DB_DRIVER==sqlite || DB_URL 以 sqlite:/// 开头`。早期 `AppConfig.IsSqlite`
  只看 `DB_DRIVER`，而 `DbUrl.Resolve` 还看 `DB_URL` 前缀——只传 `DB_URL=sqlite:///` 时会「选了 SQLite provider 却
  没挂值转换器」，plaza 报 `SQLite does not support expressions of type 'DateTimeOffset' in ORDER BY`、health 误报 PG。
  已收敛到 `AppConfig.ResolveIsSqlite(dbDriver, dbUrl)` 静态方法，两处共用。

### 8.2 EF 插入排序：必须声明 FK 依赖

`register` 同一个 `SaveChanges` 里插入 `user` + `refresh_token`。若不配置实体关系，EF **不知道依赖顺序**，
可能先插 token 后插 user → SQLite `FOREIGN KEY constraint failed`（500）。解决：在 `AppDbContext` 用
`e.HasOne<User>().WithMany().HasForeignKey(x => x.UserId)`（无导航属性的最简形式）声明
refresh_token/capsule/favorite 对 user/capsule 的 FK，EF 据此拓扑排序级联插入。不建迁移，仅用于排序与查询。

### 8.3 JWT 密钥位数

`Microsoft.IdentityModel`（System.IdentityModel.Tokens.Jwt 8.x）强制 HS256 密钥 **≥256 位**，而默认
`JWT_SECRET="dev-secret-change-me"` 只有 ~160 位 → 签发时 `ArgumentOutOfRangeException IDX10720`（500）。
解决：`SecurityService` 用 `SHA256.HashData(secret)` 把任意长度 secret 派生成固定 32 字节密钥。签发/校验同源，
契约不跨后端验签，安全语义不变。（java-jwt 不做此校验，故 Ktor/Spring 无此坑。）

### 8.4 其它

- 用 Controllers（presentation）→ Services（application/domain）→ EF 仓库（infrastructure）分层；DI 用内置容器。
- 禁用 `[ApiController]` 自动 400（`SuppressModelStateInvalidFilter=true`），所有「必填/格式」手写校验统一 422；
  坏 JSON 由 `ErrorHandlingMiddleware` 接 `JsonException`/`BadHttpRequestException` → 422。
- 统一响应外壳与中文：System.Text.Json `PropertyNamingPolicy=CamelCase` + `UnsafeRelaxedJsonEscaping`（中文不转义）；
  成功外壳含 `message:null,errorCode:null`，错误外壳 `details` 仅非空时出现（`JsonIgnore(WhenWritingNull)`）。
- Postgres 路径用 `FromSqlRaw("... FOR UPDATE")`（配 `ToListAsync` 避免被包子查询失效）序列化收藏/轮转；
  refresh 重用检测在事务内提交家族吊销、事务外抛 401（outcome 模式，等价 `noRollbackFor`）。
- `tests/` 子目录的测试工程需用主工程 `DefaultItemExcludes=$(...);tests/**` 排除，否则被默认 glob 一并编译。
- `run` 优先跑预构建 `bin/Release` DLL；`hello` 不注入 `PORT`/`REPO_ROOT`，默认端口 29050、`REPO_ROOT` 由 `run` 导出绝对路径。
- 验收：2026-06-06 双驱动各 `verify-contract.sh aspnet` **104/104**。

---

## 9. Rails 全栈（fullstacks/rails，Ruby on Rails + Hotwire）

第二个 SSR 全栈，与 §6 的 spring-mvc（Thymeleaf + HTMX）对照；交互改用 **Hotwire（Turbo + Stimulus）**。
架构同 §6：同进程双接口（`/api/v1` Bearer + SSR httpOnly cookie）+ cookie→Bearer 桥。

### 9.1 Ruby 版本与脚本 PATH

本机系统 ruby 是 **2.6**（太旧，跑不了 Rails 8），实际用 **Homebrew Ruby 4.x**（`/opt/homebrew/opt/ruby`）。
gem 可执行目录在 `/opt/homebrew/lib/ruby/gems/<ver>/bin`（不在默认 PATH）。`run`/`build`/`test` 都显式把
这两个目录 + `/opt/homebrew/opt/libpq/bin`（pg gem）加进 PATH——子进程不继承登录 shell 的 PATH。
`pg` / `bcrypt` 需本地编译（libpq 在 `/opt/homebrew/opt/libpq`）。

### 9.2 跨库 UUID / 时间戳：自定义 ActiveRecord::Type

同 §5 事实基准。仅在 SQLite 下给列挂自定义 `ActiveRecord::Type::Value`（`lib/cross_db.rb`）：
- UUID：`serialize` 去横线存 32 位 hex、`deserialize` 补横线还原（API 始终返回带横线 uuid）。
- 时间戳：`serialize` 输出 `yyyy-MM-ddTHH:mm:ss[.fff]+00:00`（零小数不输出、与 seed 一致），`deserialize` 用 `Time.iso8601`。
- Postgres 不挂转换器，AR 原生 `uuid` / `timestamptz`（读出带横线串 / `Time`）。
- **坑**：`in_plaza` 在 SQLite 是 INTEGER 0/1，Ruby 里 `0` 是真值——必须 `attribute :in_plaza, :boolean` 强制转布尔。
- **坑**：裸 SQL（`where("open_at <= ?", t)` / `update_all`）的时间戳绑定**不走**列的属性类型，要按方言手动给
  ISO 串（SQLite）/ `Time`（PG），否则 AR 默认格式破坏字符串可比性。`where(hash)` 条件则会走属性类型转换。

### 9.3 中间件不能用字符串名

Rails 8 `config.middleware.use "CookieTokenBridge"`（字符串）会 `"...".new` 报 NoMethodError——不再 constantize。
但 config 阶段 autoload 未就绪，直接写常量又找不到。解法：中间件放 `lib/middleware/`（从 `autoload_lib` 的
ignore 列表排除），`config/application.rb` 顶部 `require_relative` 后用常量 `config.middleware.use CookieTokenBridge`。

### 9.4 rescue_from 顺序：业务 422 被吞成 500

`rescue_from` 按「后注册先匹配」。若先 `rescue_from ApiError` 再 `rescue_from StandardError`，则 StandardError
（后注册）先命中、把 ApiError 子类也当 500 渲染——表现为所有校验类用例 422 变 500。**正确顺序：先 StandardError 兜底、后 ApiError。**

### 9.5 Hotwire 分工与坑

- 广场搜索走 **Turbo Frame**：`<turbo-frame id="plaza-grid" target="_top">`，搜索表单 `data-turbo-frame="plaza-grid"`
  GET `/ui/plaza/grid` 渲染同名 frame 局部替换。`target="_top"` 让 frame 内卡片链接整页导航（否则困在 frame）。
  Stimulus 防抖 `requestSubmit`（监听 `input`，Playwright `fill()` 只派发 input）。
- AI 推荐/生成、8 位码、头像选择、用户菜单、资料保存走 **Stimulus**（fetch 同源 `/api/v1` JSON，cookie 桥鉴权）。
  Playwright `page.route` mock 这些端点，原生 fetch 与 mock 天然兼容。
- **收藏切换用同步 XHR**（同 §4）：PG 下收藏走 `FOR UPDATE` 行锁更慢，「点完立刻导航」会赢竞态——同步请求
  阻塞到落库再返回。匿名点击纯客户端 `confirm` 跳登录（`data-favorite-anon-value`，不发请求）。
- 登录/注册/创建表单用 `form_with`（带 CSRF token，Turbo 处理重定向）；失败 `render status: :unprocessable_entity`
  让 Turbo 渲染错误。`/ui/*` 与 `/api/v1/*` 控制器 `skip_forgery_protection` / `ActionController::API`，由 cookie/Bearer 鉴权。
- 创建页隐藏 `openAt`（ISO）始终与可见 datetime-local 同步（预设/AI/change 都更新），不依赖提交时序。

### 9.6 其它

- 坏 JSON body：自定义 `ActionDispatch::Request.parameter_parsers[:json]` 降级为 `{}`（交给字段校验产出 422），
  避免 Rails 默认 400 ParseError 破坏统一外壳。
- `config.hosts.clear` 放开 Host 校验；`config.active_record.migration_error = false`（外部 schema、无 schema_migrations）。
- 开发态运行（`rails server -e development`）：Propshaft + importmap 动态服务资产，无需 precompile；冷启动快。
- 样式：Tailwind v4 CLI（构建期 Node）复用 spec 样式链，输出 `public/css/app.css`（已提交兜底），`layout.css` 自 spring-mvc 复用。
- 验收：2026-06-06 双驱动各 `verify-contract.sh rails` **104/104**、`verify-ui-smoke.sh rails` **25/25**。
