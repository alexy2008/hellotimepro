# Spring MVC Fullstack · 技术指南

> 面向：读完 `docs/01–03` 后想理解这个**服务端渲染（SSR）全栈**如何在保持 `/api/v1` 契约
> 不变的前提下，用 Thymeleaf + HTMX 把同一份产品做成「前后端不分离」形态的读者。

---

## 1. 定位：一个进程，两套接口

这是全栈实现里唯一的「服务端渲染」代表，刻意与「React/Vue SPA + FastAPI/Gin 后端」的分离式架构对照。
同一个 Spring Boot 进程在 **7179** 端口同时提供：

| 接口 | 消费者 | 鉴权 | 产出 |
|---|---|---|---|
| `/api/v1/*` JSON | 契约测试、浏览器 fetch | `Authorization: Bearer` | JSON envelope |
| SSR 页面 + `/ui/*` 片段 | 浏览器导航、HTMX | httpOnly cookie | HTML（整页 / 片段） |

**业务地基逐字复用** `backends/spring-boot`：`domain/` `repository/` `service/` `db/`（跨库 JdbcType）、
`web/` 下的 JSON 控制器全部照搬（仅改包名 `springmvc`）。新增的只有表现层：
`web/view/` 的 SSR 控制器、cookie 鉴权桥、Thymeleaf 模板、`app.js`、Tailwind 构建。

这样「同一份服务/仓库既支撑 JSON 契约、又支撑 SSR 页面」，正是本实现的教学价值。

---

## 2. 鉴权：cookie 与 Bearer 的双轨打通

SPA 把 token 放 localStorage、每个请求手动带 `Authorization` 头。SSR 这边换成 **httpOnly cookie**
（`ht_access` / `ht_refresh`），登录态由服务器按 cookie 渲染，天然规避「JS 能读到 token」。

难点在于：UI 上有些写操作（改资料、改密、AI 生成）冒烟测试要求**直接命中 `/api/v1/*`**
（例如 `me.spec` 显式 `waitForResponse(PATCH /api/v1/me)`）。而 JSON 控制器只认 Bearer 头。

解法是一个**请求包装过滤器** `web/CookieTokenFilter`：

```
若请求是 /api/v1/* 且没有 Authorization 头，但带 ht_access cookie
  → 包装请求，让 getHeader("Authorization") 返回 "Bearer <ht_access>"
```

于是浏览器对 `/api/v1/*` 的 `fetch`（自动带 cookie）被透明地转成 Bearer 鉴权，
**复用同一套 `AuthContext` / 控制器**，无需为 UI 另造接口。过滤器只在缺 Authorization 头时介入：
契约黑盒测试发真实 Bearer 头时它不动手，「无鉴权 → 401」用例也不受影响。

- `web/view/CookieAuthService`：读/写 cookie、解码 access、必要时用 refresh 轮换。
- `web/view/GlobalModelAttributes`（`@ControllerAdvice`）：给所有视图注入 `currentUser` / `authenticated`，头部 chip 与受保护页守卫据此渲染。

**只在 access 缺失/过期时才用 refresh 轮换一次**（access JWT 自带 1h 有效期，导航不轮换），
规避 next/nuxt 全栈那个「每次导航急切刷新 → 重用检测 → 整族吊销 → 误登出」的坑。

---

## 3. HTMX 与原生 JS 的分工

服务端渲染负责整页；需要「不整页刷新」的地方按性质分两类：

**走 HTMX（返回 HTML 片段，声明式属性触发）**

- 广场搜索：搜索框 `hx-get="/ui/plaza/grid" hx-trigger="input changed delay:300ms"`，
  局部替换 `#plaza-grid`。`FragmentController` 复用 `PlazaService` 渲染 `fragments/plaza-grid :: grid`。
  > 坑：trigger 必须是 `input` 而非 `keyup`——Playwright 的 `fill()` 只派发 `input` 事件，
  > 用 `keyup` 会导致搜索永不触发。
- 撤回胶囊：`hx-delete="/ui/capsules/{id}"`，删除后移除卡片。

**走原生 JS `static/js/app.js`（数据天然是 JSON，或纯浏览器行为）**

- AI 灵感/生成：`fetch /api/v1/capsule-recommendations`、`/api/v1/capsule-suggestion` 返回 JSON
  envelope（HTMX 期望 HTML 片段，不适用），逻辑照搬 React `CreatePage`：空标题+有推荐才显示 chip，
  点 chip 回填标题+正文，「换一批」序号守卫防竞态。Playwright 用 `page.route` mock 这两个端点，
  原生 fetch 与 mock 天然兼容。
- 8 位胶囊码输入（自动跳格 + 集齐跳转）、头像选择器、用户菜单下拉、主题切换、改密前端校验、
  创建页快速预设 + 提交时本地时间→ISO。
- **收藏切换**：见下一节。

---

## 4. 收藏切换：为什么用同步请求

收藏按钮的难点是冒烟用例 `plaza.spec:30`：

```js
await card.locator(".cy-capsule__fav").click();
await page.goto("/me/favorites");            // 紧接着导航
await expect(capsuleCard(page, title)).toBeVisible();
```

「点完立刻导航」会**中止在途的异步 XHR**，且服务端渲染的 `/me/favorites` 是静态页——
若收藏请求未在该页查询前提交，卡片就不会出现，且后续 DOM 轮询也救不回来。
异步 fetch（含 `keepalive`）在 PostgreSQL 上（收藏走 `SELECT ... FOR UPDATE` 行锁，略慢）
稳定输掉这个竞态。

`app.js` 因此对**已登录**的收藏点击用**同步 `XMLHttpRequest`**：阻塞到收藏落库提交、拿到
`{favorited, favoriteCount}` JSON 再返回，从而保证「导航发生时收藏已提交」。收藏是一次性轻量写，
主线程短暂阻塞可接受。**匿名**点击则纯客户端 `window.confirm("登录后才能收藏…")` 后跳登录
（按钮带 `data-anon`，不发请求）。端点 `POST /ui/capsules/{id}/favorite-toggle` 返回 JSON 新状态。

> 对照：next/nuxt 的收藏是非事务的快路径，异步 fetch 也能赢竞态。本实现保留了 FOR UPDATE 的并发正确性
> （契约要求），代价是收藏写更慢，于是改用同步请求消除竞态而不是放弃行锁。

---

## 5. Thymeleaf 两个必知坑

1. **`th:replace` 优先级高于 `th:each`**：不要把两者写在同一元素上——`replace` 会先于迭代执行，
   循环变量还不存在，传进 fragment 的就是 `null`。正确写法是外层 `th:each`、内层独立元素 `th:replace`：

   ```html
   <th:block th:each="cap : ${capsules}">
     <th:block th:replace="~{fragments/capsule :: card(capsule=${cap}, showCreator=true, hideFavorite=false)}"></th:block>
   </th:block>
   ```

2. **fragment 参数用命名传参**：`card(capsule=${cap}, ...)` 比位置传参稳；且 fragment 参数名必须与签名一致
   （曾把 `button(capsuleId,...)` 误传成 `capsule=...` → `Cannot resolve fragment` 500）。

3. Java `record` 的属性访问在 Spring Boot 3.3（SpEL 6.1）下**可用**：`${capsule.title}` 直接读
   record 组件，无需 `.title()`。

---

## 6. 样式：Tailwind v4 CLI（构建期 Node）

JDK 全栈里掺一个**仅构建期**的 Node 步骤：`package.json` 只含 `@tailwindcss/cli`，
`npm run build:css` 扫描 `templates/**` 生成 `static/css/app.css`，入口 `tailwind/app.css` 复用
与 React 参考前端**完全相同**的 spec 样式链：`palette.css` + `tokens.css` + `cyber.css` + `layout.css`
（`layout.css` 从 react-ts 原样复制，全是 token 化的 `cy-*` 结构样式）。运行期不依赖 Node；
`run`/`build` 脚本在无 npm 时跳过、用已提交的 `app.css` 兜底。

---

## 7. 端口与启动

- `application.yml` 默认 `server.port=${PORT:7179}`——`hello start` **不注入 PORT**，所以默认值必须直接是
  登记端口，否则 `hello list`/验证脚本拿到的端口与实际监听不符。
- JVM 冷启动（`mvn spring-boot:run` 编译 + Spring 启动）可达 ~60s，`verify-ui-smoke.sh` 的就绪等待
  已放宽到 120s（命中即退出，不影响启动快的前端）。

---

## 8. 一处防御性修复

`PlazaService` 渲染广场/收藏列表时，跳过 **owner 已删除的孤儿胶囊**（SQLite 默认外键不级联，
契约/冒烟清理用户后会残留），等价于 INNER JOIN 语义，避免对 `null` owner 取 nickname 抛 NPE。
这是 SSR 比纯 JSON 后端更早暴露的问题：根路由 `/` 会查广场，脏数据会让首页直接 500。

---

## 9. 目录速览

```
fullstacks/spring-mvc/
├── tailwind/{app.css, layout.css}              # Tailwind 输入（构建期）
├── package.json                                 # 仅 @tailwindcss/cli
├── run / build / test                           # 端口 7179；test 自动 scripts/db init
└── src/main/
    ├── java/com/hellotimepro/springmvc/
    │   ├── domain repository dto db service web  # ← 复用自 backends/spring-boot
    │   └── web/
    │       ├── CookieTokenFilter                 # cookie → Bearer 注入
    │       └── view/                             # SSR @Controller + cookie 鉴权 + Fmt + 全局模型属性
    └── resources/
        ├── templates/{*.html, fragments/*.html}  # Thymeleaf
        ├── static/{js/app.js, js/htmx.min.js, css/app.css, logo.svg}
        └── application.yml
```
