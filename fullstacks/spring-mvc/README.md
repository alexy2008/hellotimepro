# HelloTime Pro · Spring MVC Fullstack

Java 21 + Spring Boot 3 + **Spring MVC + Thymeleaf + HTMX** 的服务端渲染全栈实现（端口 **7179**）。

与「前后端分离」的纯前端 + 纯后端组合形成对照：页面由服务器拼装 HTML 直接返回，
HTMX 负责局部刷新，少量渐进增强 JS 处理天然属于浏览器的交互。同一个进程**同时**对外暴露：

- **服务端渲染 UI**（Thymeleaf 模板 + HTMX），会话用 httpOnly cookie 承载；
- **完整的 `/api/v1/*` JSON 契约**（Bearer 鉴权），与独立的 `backends/spring-boot` 后端逐字一致。

业务地基（领域模型 / 仓库 / 服务 / 跨库 JdbcType / JWT 鉴权 / LLM 客户端）复用自 Spring Boot 参考后端。

## 运行

```bash
# PostgreSQL（默认，连接信息见 data/.hello-state.json）
./scripts/hello start spring-mvc

# SQLite
DB_DRIVER=sqlite ./scripts/hello start spring-mvc
```

打开 <http://127.0.0.1:7179>。

> 启动前数据库 schema 由仓库级 `./scripts/db init` 维护；`run` 脚本只负责启动服务
> （先用 Tailwind CLI 生成 `static/css/app.css`，再 `mvn spring-boot:run`）。

## 构建 / 测试

```bash
./build      # Tailwind 生成样式 + mvn package（可执行 jar）
./test       # SQLite 上跑 SmokeTest（自动 scripts/db init 建 schema）
```

## 验证

```bash
# 黑盒契约（104 例，与纯后端共用）
./verification/scripts/verify-contract.sh spring-mvc
DB_DRIVER=sqlite ./verification/scripts/verify-contract.sh spring-mvc

# UI 冒烟（25 例 Playwright，全栈同源）
./verification/scripts/verify-ui-smoke.sh spring-mvc
DB_DRIVER=sqlite ./verification/scripts/verify-ui-smoke.sh spring-mvc
```

验收：契约 PG/SQLite 各 **104/104**，UI 冒烟 PG/SQLite 各 **25/25**。

## 技术栈与目录

| 层 | 选型 |
|---|---|
| 视图 | Thymeleaf 模板（`templates/`）+ HTMX 局部片段（`templates/fragments/`） |
| 渐进增强 | 原生 JS（`static/js/app.js`）：头像选择、8 位码、AI 灵感、表单校验、收藏 |
| 样式 | Tailwind v4 CLI 构建（`tailwind/` → `static/css/app.css`）+ spec 设计令牌 |
| 控制器 | `web/view/` SSR `@Controller` · `web/` JSON `@RestController`（复用后端） |
| 鉴权 | SSR：httpOnly cookie；JSON：Bearer。`CookieTokenFilter` 把 cookie 注入成 Bearer 打通两侧 |
| 持久层 | Spring Data JPA + Hibernate，跨库 UUID/时间戳 `@JdbcType`（PG 原生 / SQLite TEXT） |

实现要点、踩坑与取舍详见 [`TECHNICAL_GUIDE.md`](TECHNICAL_GUIDE.md)。

## 切换 :9080 代理

全栈自带 UI + API，无需 `hello switch`。前端 SPA 实现才需要代理指向某个后端。
