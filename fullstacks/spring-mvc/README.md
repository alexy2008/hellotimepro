# HelloTime Pro · Spring MVC 全栈（2.0）

Java 21 + Spring Boot 3 + **Spring MVC + Thymeleaf + HTMX** 的服务端渲染全栈实现（端口 **7179**）。

与「SPA 框架长出服务端」（Next.js / Nuxt）对照，本实现采用传统 Java SSR 路径：页面由服务端模板直接输出 HTML，HTMX 承担列表与揭晓片段的局部刷新，少量渐进增强原生 JS 负责换肤、星空画布、8 格码、倒计时与创建页仪式感交互。同一个 Spring Boot 进程**同时**提供：

- **双皮肤服务端渲染 UI**（`paper` 时笺 / `amber` 琥珀 × 明暗），样式原样引入 `spec/styles`（不再使用 Tailwind），会话由 httpOnly Cookie 承载；
- **完整的 `/api/v1/*` 2.0 JSON 契约**（`Authorization: Bearer` 鉴权），通过 `CookieTokenFilter` 桥接同源浏览器的 Cookie，与独立后端 `backends/spring-boot` 保持同构。

完整架构与代码导读见 [`TECHNICAL_GUIDE.md`](TECHNICAL_GUIDE.md)。

## 技术栈

| 角色 | 选型 |
|---|---|
| 语言与运行时 | Java 21 + Spring Boot 3.4 |
| Web 与视图 | Spring MVC（`@Controller` / `@RestController`）+ Thymeleaf 3.1 + HTMX 2.0 + JavaScript ES2023 |
| 样式与字体 | `spec/styles` 2.0 双皮肤（无 Tailwind）+ `@fontsource` 自托管字体 |
| 持久层 | Spring Data JPA + Hibernate + 自定义跨库 `JdbcType`（PostgreSQL / SQLite 双驱动） |
| 鉴权 | HS256 JWT + BCrypt + Refresh Token 轮换与家族追踪；SSR 使用 httpOnly Cookie |

## 快速开始

```bash
# 仓库根目录：建表后通过 dev-manager 启动（自动注入数据库与 LLM 配置）
./scripts/db init
./scripts/hello start spring-mvc                   # PostgreSQL（默认）
DB_DRIVER=sqlite ./scripts/hello start spring-mvc  # SQLite
# → http://127.0.0.1:7179
```

也可以在本目录直接运行：

```bash
cd fullstacks/spring-mvc
./run                      # 如有源码变更则增量打包 jar 后启动（端口 7179）
DB_DRIVER=sqlite ./run
```

> 数据库 schema 与演示数据由仓库级 `./scripts/db` 维护；`run` 脚本只负责构建/启动服务，不建表、不迁移、不写种子数据。

## 脚本

| 脚本 | 作用 |
|---|---|
| `./run` | 增量检查并启动预打包的 `target/spring-mvc-fullstack-2.0.0.jar`（端口 7179） |
| `./build` | 安装 `@fontsource` 字体依赖（如缺失）并执行 `mvn package` 生成可执行 jar |
| `./test` | 在临时 SQLite 库上初始化 `spec/db/schema.sqlite.sql` 并运行 JUnit 单元与集成测试 |

## 路由

| 路由 | 页面 | 权限 | 说明 |
|---|---|---|---|
| `/` | 首页 | 公开 | 广场概览（`/plaza/stats`）+ 就地 8 格输码 + 胶囊广场（HTMX 局部刷新） |
| `/open` | 凭码开启 | 公开 | 8 格胶囊码（满位自动跳转）；登录后附「我封存过的胶囊」 |
| `/capsules/{code}` | 胶囊详情 | 公开 | 未开启显示逐秒倒计时并隐藏正文，到点轮询服务端确认后原地揭晓；`/c/{code}` 兼容跳转 |
| `/create` | 写一枚胶囊 | 登录 | 分用户草稿、AI 推荐与打字机代笔、时笺对数标尺+长按封缄 / 琥珀星轨时钟+两步揭晓 |
| `/login` · `/register` | 登录 / 注册 | 公开 | 支持 `?redirect=` 并拦截外站跳转；已登录再访问不破坏当前会话 |
| `/me/created` · `/me/favorites` · `/me/profile` | 个人中心 | 登录 | `/me` 重定向到 `/me/created`；统计来自 `/me/stats`，列表支持去重分页加载更多 |
| `/about` | 关于 | 公开 | 展示后端与前端（Thymeleaf / HTMX / ES2023）技术栈卡片 |

## 目录结构

```text
fullstacks/spring-mvc/
├── pom.xml · package.json · run · build · test
└── src/
    ├── main/
    │   ├── java/com/hellotimepro/springmvc/
    │   │   ├── config/          AppProperties · WebConfig（静态挂载 spec/styles、avatars/v2、icons、@fontsource）
    │   │   ├── db/              CrossDbUuidJdbcType · CrossDbOffsetDateTimeJdbcType
    │   │   ├── domain/          UserEntity · CapsuleEntity · FavoriteEntity · RefreshTokenEntity
    │   │   ├── repository/      User/Capsule/Favorite/RefreshTokenRepository（含 FOR UPDATE 行锁与统计查询）
    │   │   ├── service/         Auth · Capsule · CapsuleIds · Plaza · Favorite · User · Avatar · LLM · HealthStack
    │   │   └── web/
    │   │       ├── *Controller.java       /api/v1/* JSON 接口 · CookieTokenFilter · GlobalExceptionHandler
    │   │       └── view/                  Public/Auth/Create/MeViewController · FragmentController · ViewErrorController · CookieAuthService · Fmt
    │   └── resources/
    │       ├── application.yml
    │       ├── templates/                 plaza · open · capsule-detail · create · login · register · me · about · not-found
    │       │   └── fragments/             layout · parts · cards · plaza-grid · capsule-detail · me-rows
    │       └── static/
    │           ├── css/app.css            双皮显隐与布局胶水（仅语义令牌、零色值字面量）
    │           └── js/                    app.js · create.js · htmx.min.js
    └── test/java/com/hellotimepro/springmvc/
        ├── SmokeTest.java                 API + SSR 404 + SQLite 删胶囊不依赖外键级联回归
        └── service/CapsuleServiceTest.java  非法 UUID 422 · 10 历年闰日收紧边界单测
```

## 2.0 验证

验证日期：**2026-11-24**。全部验证使用独立隔离库（PostgreSQL `hellotime_contract_spring_mvc`、SQLite `/tmp/hellotime-contract-spring-mvc.db`）。

| 项目 | PostgreSQL | SQLite |
|---|---|---|
| 契约 `verify-contract.sh spring-mvc` | ✅ 117/117 | ✅ 117/117 |
| UI 冒烟 `verify-ui-smoke.sh spring-mvc`（44 条 × 时笺 / 琥珀） | ✅ 88/88 | ✅ 88/88 |
| 设计令牌 `verify-design-tokens.sh spring-mvc` | ✅ 通过（扫描 1 份样式表） | — |
| 单元与集成测试 `./test` | — | ✅ 7/7 通过 |
| 生产打包 `./build` | ✅ 通过 | — |

复现命令：

```bash
./verification/scripts/verify-design-tokens.sh spring-mvc
cd fullstacks/spring-mvc && ./test && ./build && cd ../..
./verification/scripts/verify-contract.sh spring-mvc
DB_DRIVER=sqlite ./verification/scripts/verify-contract.sh spring-mvc
./verification/scripts/verify-ui-smoke.sh spring-mvc
DB_DRIVER=sqlite ./verification/scripts/verify-ui-smoke.sh spring-mvc
```

## 2.0 迁移笔记

升级指南第 1、2 节清单已逐条对齐，以下是 Spring MVC 技术栈在 2.0 迁移中特有的取舍与踩坑记录：

1. **双皮肤 SSR 与唯一 `data-testid`（`syncSkinDom`）**：首次访问时皮肤偏好只在 `localStorage['hellotime.skin']`，而 `spec/ui/testids.md` 禁止页面同时出现两个同名 `data-testid` 或 `[data-code-cell]`（即便被隐藏）。Thymeleaf 将两套皮肤视图渲染在 `data-skin-view="paper|amber"` 容器内，CSS 按 `<html data-skin>` 首帧零闪屏切换显隐，`app.js` 在首帧末尾、换肤及 `htmx:afterSwap` 后同步运行 `syncSkinDom()`，将非激活皮肤的测试钩子暂存至 `data-ht-testid` / `data-ht-code-cell` 并移除原属性，确保 DOM 钩子始终唯一且切皮肤不丢表单状态。
2. **移除 Tailwind，直连 `spec/styles` 与 `@fontsource`**：删除 1.x 的 `tailwind/` 构建链路，`WebConfig` 直接挂载 `spec/styles`、`spec/avatars/v2`、`spec/icons` 和 `node_modules/@fontsource`，自定义样式收缩为极简的 `static/css/app.css`（零色值字面量）。
3. **异常拦截边界隔离（404 不被吞成 500 JSON）**：`GlobalExceptionHandler` 限定为 `@RestControllerAdvice(annotations = RestController.class)`，仅接管 `/api/v1/*`；新增 `ViewErrorController` 实现 `ErrorController`，未知页面路径返回 HTTP 404 与双皮 `not-found.html`。
4. **单请求 Cookie 鉴权缓存**：同一次 SSR 请求里 `GlobalModelAttributes` 与视图控制器都会读取当前登录用户。`CookieAuthService` 将解析结果缓存在 `HttpServletRequest` attribute 中，避免 access 刚过期时同一次请求重复触发 refresh token 轮换而误触家族吊销。
5. **取消同步 XHR 收藏与竞态控制**：1.x 为防“点收藏后立刻跳 `/me/favorites`”曾使用同步 XHR；2.0 改为 `await fetch('/api/v1/me/favorites')` 确认落库后再更新 `aria-pressed` 与计数，既避免同步 XHR 阻塞主线程，也避免乐观更新在 PostgreSQL `FOR UPDATE` 事务提交前就触发页面跳转。
6. **跨库删除与严格 UUID 校验**：`CapsuleIds.parse()` 先做标准 36 位 UUID 正则校验再解析（规避 `UUID.fromString("1-1-1-1-1")` 宽容解析），非法返回 422；`CapsuleService.deleteOwn()` 在事务内先锁胶囊行再显式批量删除收藏，确保 SQLite 未启用 `PRAGMA foreign_keys = ON` 时也不留孤儿收藏。
7. **增量构建可执行 jar**：`run` 改为检测源码/配置变更后直接执行 `target/spring-mvc-fullstack-2.0.0.jar`，大幅缩短冷启动耗时（就绪从数十秒降至约 1–2 秒）。

## 切换 :9080 代理

全栈自带 UI + API，无需 `hello switch`。前端 SPA 实现才需要代理指向某个后端。
