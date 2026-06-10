# HelloTime Pro · 五个全栈实现全面对比

> 对比对象：`fullstacks/` 下已完成、且**同时**通过契约验证与 UI 冒烟验证的 5 个全栈
> —— **Next.js**、**Nuxt**、**Laravel**、**Rails**、**Spring MVC**。
> 数据采集与复核日期：2026-06-10（全部行数已重新核对；laravel 当日实测 PG + SQLite 契约 104/104）。代码量为物理行（`wc -l`，含注释空行），统计口径见 §4。
> 姊妹篇：前端对比见 [`docs/frontend-comparison.md`](frontend-comparison.md)，后端对比见 [`docs/backend-comparison.md`](backend-comparison.md)；单栈深读见各全栈目录下的 `TECHNICAL_GUIDE.md`。

---

## 0. 这篇文章怎么读

前端对比问的是「状态怎么变成 DOM」，后端对比问的是「同一道题五种母语怎么解」。全栈对比要问的，是一个把前两者**揉到一个进程里**之后才会出现的新问题：

> **同一个进程既要当前端又要当后端，那么前后端的边界到底画在哪里？
> ——HTML 在哪一侧生成、应用状态住在哪一侧、浏览器最终拿到多少 JavaScript？**

这是全栈框架最根本的分野，也是本文的灵魂。如果你只想快速建立印象，读 §1～§3 就够了——§3 把五个框架的「定位 + 一句话设计哲学 + 它在优化什么、又拿什么去换」摊开，并给出一条从「同构 JS」到「服务端模板 + 增强」的谱系。
如果你要逐层对照，§5～§9 按「双入口架构 → 渲染模型 → 数据层跨库 → 鉴权双身份 → 客户端增强」的顺序，把每一层的五种写法并排放在一起。§11 是「招牌坑」，§12 给出「该先读哪一个」的导航。

阅读时请始终记住一件事：**这五个全栈的页面、路由、交互、视觉、API 契约全都一样**，所以你看到的每一处差异，都纯粹是框架对「前后端边界」的不同主张，而非需求不同。

---

## 1. 为什么这五个能放在一起比

它们实现的是**同一个产品**，共享 `spec/` 这一份单一事实来源，并且比前端/后端多扛一层约束：

- 同一份 **API 契约**（`spec/api/openapi.yaml`），响应外壳 `{ success, data, message, errorCode }` 完全一致；
- 同一套**数据库 schema 语义**（`spec/db/schema.sql`），每个全栈都要同时跑通 **PostgreSQL 和 SQLite**；
- 同一套**设计令牌与组件类**（`spec/styles/*` 的 `cy-*` 类，禁止硬编码色值）；
- 同一组 **104 个黑盒契约用例** + **25 个 Playwright UI 冒烟用例**，前者验 JSON API、后者用真实浏览器验 SSR 页面与交互。

最后一条是全栈独有的强约束，也是它与「前端」「后端」最不一样的地方：

> **每个全栈都是一个进程，却要同时长出两张脸——一张是给契约测试和浏览器 `fetch` 用的 JSON API，一张是给浏览器导航用的 SSR HTML 页面。**

于是五者之间的差异，纯粹来自**框架对「全栈一体化」的不同实现哲学**，而非需求差异。
全部 5 个全栈均已通过 `verify-contract`（PG + SQLite 双驱动各 **104/104**）与 `verify-ui-smoke`（各 **25/25**）。

> 一个隐藏的强约束：因为契约和视觉系统都是共享的，**没有任何一个框架能用「功能更全」或「样式更好写」来取巧**——大家做的是同一个产品、同一组像素。区别只在「这个产品被切成前后两半时，刀口落在哪里」。这把对比聚焦在了全栈框架最核心的能力：**前后端边界的位置与形态**。

---

## 2. 技术栈速览

| 维度 | Next.js | Nuxt | Laravel | Rails | Spring MVC |
|---|---|---|---|---|---|
| 语言 | TypeScript | TypeScript | PHP 8.3 | Ruby | Java 21 |
| 框架版本 | Next 15 + React 19 | Nuxt 3 + Vue 3 | Laravel 13 | Rails 8.1 | Spring Boot 3.3 |
| 渲染模型 | **RSC + 客户端孤岛** | **SSR + 混合渲染** | 整页 SSR + 孤岛 | 整页 SSR + 片段 | 整页 SSR + 片段 |
| 视图/模板 | React 组件（`.tsx`） | Vue SFC（`.vue`） | Blade | ERB | Thymeleaf |
| 局部刷新机制 | Client Component | Vue 客户端状态 | Alpine.js + fetch | **Turbo Frame/Stream** | **HTMX** |
| 客户端小状态 | Zustand | Pinia | Alpine.js | Stimulus | 原生 JS |
| 数据访问 | Drizzle ORM | Drizzle ORM | Eloquent ORM | Active Record | Spring Data JPA |
| 跨库适配 | 双 schema + 动态驱动 | 双 schema + 动态驱动 | 自定义 Cast + `CrossDb` | AR Type + `CrossDb` | Hibernate `JdbcType` |
| 鉴权双身份桥 | `ht_session` cookie | server middleware | Service 双读 | Rack 中间件 | Servlet Filter |
| 运行形态 | Node（`.next/`） | Node（`.output/`） | PHP-FPM / `php artisan` | Puma（Rack） | 胖 JAR（JVM） |
| 端口 | 7177 | 7178 | 7182 | 7181 | 7179 |

一句话画像（详细展开见 §3）：

- **Next.js** — 同构 JS 的极致，服务端组件（RSC）是默认，前后端边界「模糊」到同一棵组件树里。
- **Nuxt** — Vue 的同构方案，通用渲染 + 按路由选渲染方式（Hybrid Rendering），边界由 `routeRules` 一行决定。
- **Laravel** — PHP 现代全栈，Blade 服务端渲染为主，Alpine.js 做轻量孤岛，边界「锐利」。
- **Rails** — Hotwire 哲学，把「HTML 片段」当成线缆协议（HTML over the wire），几乎不写客户端数据渲染。
- **Spring MVC** — 传统 JVM SSR，Thymeleaf + HTMX，用声明式属性把片段替换变成 HTML 的一部分。

---

## 3. 技术栈定位与设计哲学

如果说 §2 的表格是「参数」，这一节就是「人格」。每个框架都在回答同一个问题——「同一个进程同时当前后端，HTML 在哪生成、浏览器拿到多少 JS？」——但它们的答案背后，是两种世界观、五种取舍。

先把谱系画出来，后面所有差异都挂在这条轴上：

```
同构 JS（前后端同一种语言，服务端渲染后 hydration 成客户端应用）
  Next.js ───────── Nuxt
        │
        │  ← 边界越往左越「模糊」：JS 同时跑在两端，客户端要接管整棵树
        │  ← 边界越往右越「锐利」：服务端渲 HTML，浏览器只做局部增强 →
        │
  Spring MVC ─── Rails ─────────── Laravel
服务端模板 + 增强（后端语言渲 HTML，少量 JS 做交互）
        HTMX        Turbo         Alpine + fetch
       （片段）    （片段）      （孤岛为主）
```

### 3.1 Next.js —— 「服务端和客户端是同一棵树的两种节点」

- **一句话设计哲学**：用 React Server Components 把「在服务端跑」变成组件的一种默认属性。一个页面默认是 Server Component（能直接 `await` 查数据库），需要交互的部分标 `"use client"` 变成客户端孤岛——服务端与客户端在**同一棵组件树**里无缝拼接。
- **定位**：同构全栈的**当代标准答案**。生态最大、概念最前沿（RSC 是 React 团队押注的方向），把「前端框架」长成了「全栈框架」。
- **它在优化什么**：**消除前后端的接缝**。同一份 TypeScript 类型、同一个进程、同源无 CORS；公开读页用 RSC 在服务端直接调服务层取数（首屏即数据，利于 SEO/分享），交互页用 Client Component。`"server-only"` 是编译期防火墙，保证数据库连接绝不泄漏到浏览器。
- **它拿什么去换**：**「这段代码到底在哪跑」的认知负担**与**水合（hydration）的隐式复杂度**。Server / Client 的边界要时刻在脑子里维护；服务端无 localStorage，识别当前用户得另设 httpOnly `ht_session` cookie（本项目 §4.5 的真实改造）；客户端最终要下载 React 运行时 + 你的客户端组件并 hydrate。
- **本项目里的体现**：广场页 / 胶囊详情页是 `async function Page()` 直接 `import` 服务层（RSC 取数），`AuthGate`、`FavoriteButton` 等是 `"use client"` 孤岛；登录态靠 `getServerViewer()` 读 `ht_session` cookie 在服务端识别用户。

### 3.2 Nuxt —— 「渲染方式应该能按路由逐个选」

- **一句话设计哲学**：默认开启通用渲染（Universal Rendering）——页面先在服务端 SSR 出带数据的 HTML，再 hydrate 成 Vue 应用；但**每条路由都能单独选**是 SSR 还是纯客户端，由 `routeRules` 一行声明。
- **定位**：Vue 生态的**同构全栈方案**，与 Next.js 几乎一一对应（Nitro 对 Next Server、`useAsyncData` 对 RSC 取数）。比 Next 少了 Server Component 这一等公民，多了「自动导入」与「按路由切渲染」的 DX。
- **它在优化什么**：**渲染策略的细粒度可调**。公开读页（广场/详情）走 SSR，`useAsyncData` 在服务端直接命中同进程的 Nitro 处理器取数；鉴权与强交互页（创建/个人中心）用 `routeRules: { ssr: false }` 退回客户端渲染，避开 localStorage 鉴权在服务端的 hydration 难题。自动导入让组件/composable/store 免手写 `import`。
- **它拿什么去换**：**SSR 的「两端都要能跑」约束**与**一批暗规则**。`window`/`document` 必须用 `import.meta.client` 守卫，否则 SSR 期 500；`ClientOnly` 包裹 localStorage 驱动的 UI 防 hydration mismatch；`.client.ts` 后缀对 plugin/component 有效、**对路由 middleware 无效**（本项目 §4.4 踩过的真坑）。
- **本项目里的体现**：`index.vue` 用 `useAsyncData` 服务端预取广场数据、`onMounted` 仅为登录用户补取以校正 `favoritedByMe`；`nuxt.config.ts` 的 `routeRules` 把 `/create`、`/me/**` 标成 `ssr:false`。

### 3.3 Laravel —— 「服务端把数据备好、把 HTML 渲完，浏览器只点睛」

- **一句话设计哲学**：一次请求进来，Controller 把数据准备好，Blade 模板在服务端把 HTML 整页渲完吐给浏览器；需要即时反馈的局部，才用 Alpine.js 在客户端补一撮状态。**前后端边界锐利**——服务端负责「页面长什么样」，客户端只负责「点一下有反应」。
- **定位**：PHP 现代全栈的**最佳代表**。约定优于配置、电池全包（路由/ORM/模板/队列/校验），是「服务端渲染 + 渐进增强」这条老而弥坚路线的当代标杆。
- **它在优化什么**：**直觉与一致性**。页面就是「数据 → 模板 → HTML」，没有客户端 store 驱动的 SPA 心智；API 与页面**共用同一套 Service**，避免 JSON 行为和页面行为分叉。数据层用 Eloquent ORM（模型 + 关系 + Cast），是 Laravel 的招牌。
- **它拿什么去换**：**复杂局部交互要自己拼**。没有 Turbo/HTMX 那种「HTML 片段协议」，局部刷新主要靠整页 SSR + Alpine `fetch`；状态散落在 Alpine 组件里，强交互页的体验上限不如同构 SPA。
- **本项目里的体现**：`Web/*Controller` 备数据 → Blade 渲染；收藏、主题、8 位码输入等用 Alpine `data/store`；数据层本轮从裸 SQL 迁移到 Eloquent（`Capsule`/`User`/`Favorite` 模型 + `CrossDbBoolean` Cast + `HasCrossDbKey` trait）。

### 3.4 Rails —— 「HTML 本身就是 API，片段就是线缆协议」

- **一句话设计哲学**：Hotwire 的主张——服务端继续渲染 HTML，但把「局部更新」也变成 HTML：Turbo Frame 替换一个框、Turbo Stream 推送「删除这一行/追加那一段」的 HTML 指令。浏览器不解析 JSON 再渲染，而是**直接吞服务端发来的 HTML 片段**。Stimulus 只管那些 HTML 表达不了的小交互。
- **定位**：「HTML over the wire」哲学的**旗手**。它质疑「为什么局部更新一定要在客户端用 JSON 重渲染一遍」，主张把渲染权牢牢留在服务端。
- **它在优化什么**：**用最少的客户端 JS 拿到接近 SPA 的局部刷新体验**。列表搜索、删除胶囊都用 Turbo 局部替换，不把列表/详情重写成客户端数据渲染；Active Record 是 ORM 界的元老，迁移/关系/回调一应俱全。
- **它拿什么去换**：**片段协议的心智**与**约定的厚度**。要理解 Turbo Frame/Stream 的工作方式、`turbo_stream.remove/append` 的语义；Rails 的「约定优于配置」对新手是黑魔法（命名一变行为就变）。
- **本项目里的体现**：广场搜索用 Turbo Frame `plaza-grid` + Stimulus，撤回胶囊用 `turbo_stream.remove`；收藏刻意用**同步 XHR**（见 §9）；`CookieTokenBridge` Rack 中间件把同源 cookie 注入成 Bearer，让浏览器 fetch 复用 API 控制器。

### 3.5 Spring MVC —— 「传统 JVM SSR，用 HTMX 给老架构补上局部刷新」

- **一句话设计哲学**：经典的 `@Controller` + Thymeleaf 服务端渲染整页，再用 HTMX 这个「HTML 属性扩展」把局部刷新声明在标签上（`hx-get`/`hx-delete` + swap）。服务端返回 HTML 片段，HTMX 负责换进 DOM——**不写 JS 就能局部刷新**。
- **定位**：**企业级 JVM SSR 的当代形态**。在「Spring Boot 全家桶 + 模板引擎」这套最稳的大型团队架构上，用 HTMX 这味轻量调料补齐现代交互，而不引入完整前端框架。
- **它在优化什么**：**可治理性与渐进现代化**。类型系统、依赖注入、Spring Data JPA、`@ControllerAdvice` 统一异常——大型团队要的结构和约束都在；HTMX 让旧 SSR 应用不重写就能有局部刷新。
- **它拿什么去换**：**运行时重量**与**抽象在边界处的反咬**。JVM 冷启动最慢、胖 JAR 最重；JPA/Hibernate 抽象最厚，跨库时要一路下沉到自定义 `JdbcType`（PG 原生 `uuid` vs SQLite 32-hex）——这正是 backend-comparison §6「抽象层厚度与跨库成本成正比」的全栈复刻。
- **本项目里的体现**：`@RestController` 承载 JSON 契约、`@Controller` + Thymeleaf 渲页、`FragmentController` 返回 HTMX 片段；`CookieTokenFilter` 做 cookie→Bearer 桥；跨库靠 `CrossDbUuidJdbcType` / `CrossDbOffsetDateTimeJdbcType`。

### 3.6 五句话速记

> - **Next.js**：服务端组件是默认——边界最模糊、同构最彻底，代价是「这段在哪跑」的认知负担与 hydration。
> - **Nuxt**：渲染方式按路由可选——混合渲染最灵活，代价是 SSR 两端兼容的暗规则。
> - **Laravel**：服务端渲完、客户端点睛——心智最直觉，代价是复杂局部交互要自己拼。
> - **Rails**：HTML 即协议——客户端 JS 最省、局部刷新优雅，代价是片段协议与约定的厚度。
> - **Spring MVC**：JVM SSR + HTMX 补刷新——最可治理，代价是运行时重量与跨库下沉。

---

## 4. 代码量对比

**统计口径**：仅计入各全栈自己编写的实现源码，排除 `node_modules / vendor / target / .next / .output / .nuxt` 等依赖与产物，排除单测。
**关键在于分三栏看**：服务端业务代码、模板/视图代码、**客户端 JS 代码**——最后一栏直接暴露「前后端边界画在哪」。

| 全栈 | 语言 | 服务端业务行 | 模板/视图行 | **客户端 JS 行** | 数据/迁移 |
|---|---|---:|---:|---:|---|
| **Spring MVC** | Java | `service`1511 + `web`1197 + `repo`110 + `domain`223 ≈ **3563** | Thymeleaf 751 | **406**（`static/js`） | — |
| **Next.js** | TS | `services`1172 + `lib`732 + `db`305 + `app/api`423 ≈ **2632** | RSC 页面/布局 1461 | **1517**（`components`+`stores`，**另需 React 运行时 + hydrate**） | Drizzle SQL 168 |
| **Nuxt** | TS | `server/*` 2162 | SSR 页面/组件 2235 | **2647**（`pages`+`components`+`stores`+…，**另需 Vue 运行时 + hydrate**） | Drizzle SQL 303 |
| **Laravel** | PHP | `Services`1099 + `Http`397 + `Models`175 + `Support`342 + `Casts`33 ≈ **2046** | Blade 663 | **190**（`public/js`） | routes 68 |
| **Rails** | Ruby | `services`1127 + `controllers`543 ≈ **1670** | ERB 773 | **495**（Stimulus/JS） | models 57 |

> 注：Next/Nuxt 因为同构，「客户端」和「模板/视图」的界限本就模糊——它们的 `.tsx`/`.vue` 既是服务端渲染的模板、又是客户端 hydrate 的组件，所以两栏会有重叠，这里按目录归类仅作示意。Laravel/Rails/Spring 的三栏则是物理隔离的（PHP/Ruby/Java 在服务端，`.js` 在浏览器）。

### 怎么读这张表

把目光锁定在**「客户端 JS 行」**这一栏，两大阵营立刻现形：

- **同构阵营（Next / Nuxt）的客户端代码上千行（1517 / 2647），而且这还只是冰山一角**——浏览器真正下载的是「你的客户端组件 + 整个 React/Vue 运行时 + 水合逻辑」。同构的代价，是把一个完整的前端框架运送到客户端再「激活」一遍。
- **服务端模板阵营（Laravel / Rails / Spring）的客户端 JS 只有 190 ~ 495 行**——因为浏览器拿到的是渲好的 HTML，JS 只是「一撮增强」：Alpine 的几个 `data`、Stimulus 的几个 controller、HTMX 的几个属性处理。Laravel 最极端（190 行），几乎把交互全压给了服务端 SSR + Alpine 孤岛。

服务端业务行的排序（Spring 3563 > Next 2632 > Laravel 2046 > Nuxt …… > Rails 1670）则复刻了 backend-comparison 的结论：**Java 的类型样板最重、Ruby/PHP 的表达力让服务端最紧凑**。Spring 的 `service` 一层就 1511 行，和它在后端对比里的「全家桶最厚」一脉相承。

### 一个值得玩味的对照

```
客户端 JS：  Laravel 190 < Rails 495 ≈ Spring 406  <<  Next 1517 < Nuxt 2647
```

这条排序，几乎就是 §3 那条谱系轴的数字投影：**越靠「服务端模板」端，运到浏览器的 JS 越少；越靠「同构」端，客户端越重**。
而且这笔账还没算运行时——Laravel 浏览器侧只多一个 Alpine（~15KB），Next/Nuxt 则要整个框架运行时。**「同构」省掉的是前后端分离的接缝，换来的是客户端的体量与水合的复杂度**。又一次：抽象的成本不会消失，只会换地方出现（与前端 §4、后端 §6 同源）。

---

## 5. 双入口架构：一个进程，两套接口

这是全栈区别于「纯前端」「纯后端」的结构性特征，五栈**无一例外**地共享同一个骨架：

> **同一个进程，同时暴露两张脸：一张 `/api/v1/*` 的 JSON API（给契约测试 + 浏览器 `fetch`），一张 SSR HTML 页面（给浏览器导航）。两张脸共用同一套业务 Service。**

| 全栈 | JSON API 入口 | SSR 页面入口 | 共用业务层 |
|---|---|---|---|
| Next.js | `app/api/v1/**/route.ts` | `app/**/page.tsx`（RSC） | `src/services/*` |
| Nuxt | `server/api/v1/**.<method>.ts` | `pages/**.vue`（SSR） | `server/services/*` |
| Laravel | `routes/api.php` → `HelloTimeApiController` | `routes/web.php` → `Web/*Controller` + Blade | `app/Services/*` |
| Rails | `Api::V1::*Controller`（`ActionController::API`） | 页面 `Controller` + ERB / `/ui/*` | `app/services/*` |
| Spring MVC | `@RestController` | `@Controller` + Thymeleaf / `/ui/*` | `service/*` |

**为什么必须有两张脸？** 因为本项目的 104 个契约用例是黑盒打 JSON API 的，而 25 个 UI 冒烟用例是真浏览器点页面的——一个全栈要同时满足两者，就必须同进程提供两套接口。**而把它们粘在一起、不让行为分叉的，是「共用同一套 Service」这条铁律**：无论你是 `POST /api/v1/capsules` 还是在创建页提交表单，最终都落到同一个 `createCapsule()`。这正是全栈相对「前端 SPA + 独立后端」的最大结构红利——业务逻辑只有一份。

> 五栈的技术手册都把这张「双入口」表放在 §1，可见它是全栈心智的起点。读任何一个全栈，先找到它的「两个入口 + 一套 Service」，地图就立住了。

---

## 6. 渲染模型：HTML 到底在哪里生成

这是五个框架最深层的差异，也是其余一切（客户端 JS 多少、状态住哪、SEO/首屏、怎么做局部刷新）的根因。按「HTML 生成位置」可分成三大阵营：

### ① 同构 SSR + 水合（Next / Nuxt）

服务端先把带数据的 HTML 渲出来（首屏即内容、利于 SEO），送到浏览器后再 hydrate 成一个完整的前端应用接管交互。HTML 在**两端都会生成**：首屏在服务端，之后的更新在客户端。

- **Next**：RSC 是默认，`async function Page()` 直接 `await` 服务层；交互部分 `"use client"`。
- **Nuxt**：`useAsyncData` 在服务端预取，`routeRules` 决定哪条路由 SSR、哪条退回 CSR。

### ② HTML-over-the-wire 片段（Rails / Spring）

整页由服务端模板渲染；**局部刷新也由服务端渲染成 HTML 片段**，浏览器收到后直接换进 DOM，不在客户端用 JSON 重渲染。

- **Rails / Turbo**：搜索 → Turbo Frame 替换 `plaza-grid`；删除 → `turbo_stream.remove` 推送 HTML 指令。
- **Spring / HTMX**：`hx-get`/`hx-delete` 触发，`FragmentController` 返回 Thymeleaf 片段，HTMX swap 进去。

### ③ 整页 SSR + 客户端孤岛（Laravel）

整页由 Blade 渲染；交互用 Alpine.js 在局部「点亮」一小块客户端状态，需要契约行为时 `fetch /api/v1/*`。比起 ②，它更少依赖「服务端发 HTML 片段」，更多是「客户端孤岛各自为政」。

### 同一个倒计时，两种世界观

胶囊卡片要每秒刷新倒计时，这个需求把渲染模型的差异放在了显微镜下：

- **同构阵营（Next/Nuxt）**：倒计时是**客户端**的事——`setInterval` 改一个响应式值，订阅它的 DOM 自动更新（和前端对比 §6 的五种写法同源，因为 hydrate 之后就是一个 SPA）。Nuxt 还要用 `import.meta.client` 守卫，避免 SSR 期 `setInterval` 在没有 `window` 的服务端炸掉。
- **服务端模板阵营（Laravel/Rails/Spring）**：服务端只渲出**初始** HTML（带 `openAt`），秒级跳动交给浏览器里那一小撮 JS（Alpine 的 `x-data` 计时器 / Stimulus controller / 原生 `setInterval`）。服务端不可能每秒重渲染整页——这类「纯浏览器行为」天然落在客户端增强层。

> 同一个「每秒刷新」，同构阵营在客户端响应式系统里解决，模板阵营靠局部 JS 点睛——根因全在「这个框架认为 HTML 应该在哪生成、客户端该拿多少主动权」。

---

## 7. 数据层与跨库：同一道难题的五种解法

每个全栈都要让**同一份业务代码同时支持 PG 与 SQLite**，而两者在 **UUID** 和 **时间戳**（外加布尔）上语义不同（PG 有原生 `uuid`/`timestamptz`，SQLite 只有 `TEXT`/`0,1`）。这与 backend-comparison §6 是**同一道题**，五个全栈给出五种解法，且呈现同一条规律。

| 全栈 | 数据访问 | 跨库适配机制 |
|---|---|---|
| Next / Nuxt | Drizzle ORM | **双 schema**（`schema-pg.ts` / `schema-sqlite.ts`）+ 按 `DB_DRIVER` 动态 import 驱动 |
| Laravel | Eloquent ORM | **自定义 Cast**（`CrossDbBoolean`）+ `HasCrossDbKey` trait + `CrossDb` 边界换算器 |
| Rails | Active Record | **自定义 Type**（`SqliteUuidType` / `SqliteTimestampType`）+ `CrossDb` |
| Spring MVC | Spring Data JPA | **Hibernate `JdbcType`**（`CrossDbUuidJdbcType` / `CrossDbOffsetDateTimeJdbcType`）+ 自实现 `ValueBinder` |

**两端规律一致**（呼应后端结论）：

- **Drizzle（Next/Nuxt）贴近 SQL**，跨库 = 维护两份 schema 文件 + 动态选驱动，直白；
- **Eloquent / Active Record（Laravel/Rails）在 ORM 类型层加适配器**（Cast / Type），中等成本；
- **Spring 的 JPA 抽象最厚、最自动，平时最省心，但要拗它跨库时必须一路下沉到 Hibernate 的 `JdbcType`/`ValueBinder` 这种底层 SPI**——抽象帮你挡住的复杂度，在边界处原样还回来。

### 一个全栈特有的跨库细节：id 为什么「不能」被 ORM 强类型化

Laravel 本轮迁移到 Eloquent 时踩到一个微妙点：**id 在模型里必须保持「存储格式」，不能用 Eloquent 的标准 UUID cast**。因为 SQLite 存的是 32 位无横线 hex，PG 存的是带横线 uuid——若在模型层就 cast 成统一 UUID，关系的 `JOIN`/`WHERE` 绑定会用错值。正确做法是：**id 在模型里原样存储，只在「对外输出」（Mapper）和「入参解析」（CrossDb）两个边界做转换**。Rails 的 `SqliteUuidType` 同理。

> 这是全栈版比纯后端更刁钻的一处：ORM 越想帮你把「数据库的值」自动变成「漂亮的对象」，跨库时越容易在关系绑定上翻车。**边界换算要显式、要集中（`CrossDb`），而不是散落在 ORM cast 里。**

（Spring 双驱动、Laravel Eloquent 的这两段经验，也记录在项目记忆与 `docs/dev-notes.md`。）

---

## 8. 鉴权与会话：Bearer 契约 + cookie SSR 的双重身份

全栈鉴权比纯后端难，难就难在 §5 的「双入口」：

> **同一个用户，在契约测试眼里是 `Authorization: Bearer <token>`，在浏览器导航眼里却是一个 httpOnly cookie。一个全栈要让这两种身份指向同一套鉴权逻辑。**

五栈的解法是同一个模式——**cookie → Bearer 桥**：浏览器登录后服务端种一个 httpOnly cookie，之后浏览器的 `fetch`/导航带着 cookie 来，框架在入口处把 cookie「翻译」成 Bearer，让它复用与契约测试完全相同的鉴权链路。

| 全栈 | cookie→Bearer 桥 | 形态 |
|---|---|---|
| Spring MVC | `CookieTokenFilter` | Servlet Filter，在过滤器链最前把 cookie 注入成 `Authorization` 头 |
| Rails | `CookieTokenBridge` | Rack 中间件（`lib/middleware/`），同源 cookie → Bearer |
| Laravel | `AuthService` 双读 | Service 同时接受 Bearer 与 httpOnly cookie |
| Next.js | `ht_session` cookie | 登录/刷新/登出时种 httpOnly cookie，RSC 用 `getServerViewer()` 在服务端识别用户 |
| Nuxt | server middleware | Nitro 端读 cookie，SSR 页面据此取数 |

> 这套「桥」的精妙之处：**JSON API 那一侧完全不用为浏览器特殊处理**——它永远只认 Bearer，cookie 的事在更外层（Filter/中间件）就翻译完了。一套鉴权逻辑，两种身份入口，桥在中间。这是全栈把「前后端粘在一起」时，在鉴权层兑现「业务逻辑只有一份」的具体瞬间。

五栈底层都是同一套 **JWT(HS256) + refresh token 家族轮换**（`refresh_tokens` 表的 `family_id`/`revoked`），与五个后端一致——全栈只是在外面多包了一层「cookie 身份」。

---

## 9. 客户端增强：从「整个框架」到「一撮属性」

§4 的「客户端 JS 行」已经量化了差异，这里看它们各自的形态——同一个「点一下有反应」的需求，五种增强机制：

| 全栈 | 客户端增强机制 | 典型用法 |
|---|---|---|
| Next.js | Client Component（`"use client"`） | 一棵 React 子树在浏览器接管，完整响应式 |
| Nuxt | Vue 客户端组件 + Pinia | hydrate 后即完整 Vue SPA |
| Laravel | Alpine.js `data`/`store` | 标签上写 `x-data`，轻量响应式孤岛 |
| Rails | Stimulus controller | `data-controller` 绑定，命令式小交互 |
| Spring MVC | HTMX 属性 + 原生 JS | `hx-*` 声明式触发 + `app.js` 兜底纯浏览器行为 |

### 一个跨栈的共享教训：收藏为什么用「同步 XHR」

Rails 和 Spring MVC 在「收藏切换」这一处，都**刻意逆潮流而行**——广场搜索、撤回胶囊都走 HTMX/Turbo 的优雅局部替换，唯独收藏按钮用最「土」的**同步 XHR**。原因藏在一个真实的竞态里：

> 收藏的典型操作是「点收藏 → 立刻导航到 /me/favorites」。若用异步请求，这次导航会 `abort` 掉尚未完成的收藏请求，事务来不及提交，跳过去就看不到刚收藏的那条。**同步 XHR 阻塞到事务提交后才返回，保证后续导航能看到刚写入的数据。**

这是全栈交互设计里一个反直觉但正确的取舍，也是 §3 那句「不是所有交互都适合声明式局部刷新」的注脚。Laravel 的搜索框则用 `document.activeElement === $el` 焦点守卫解决了另一个同源的竞态（debounce 整页跳转撞上收藏点击）。

> 这些坑的共同主题：**当「服务端渲染」遇上「客户端导航」，时序就会咬你一口**。同构阵营靠客户端路由器统一调度规避，模板阵营则要在「服务端跳转 vs 在途请求」的接缝处手动处理。

---

## 10. 依赖与运行形态

| 全栈 | 运行时 | 构建产物 | 启动 | 冷启动直觉 |
|---|---|---|---|---|
| Laravel | PHP-FPM / `php artisan serve` | 无需编译（解释执行） | `php artisan serve` | 快 |
| Rails | Puma（Rack） | 无需编译 | `bin/rails server` | 快 |
| Next.js | Node | `.next/`（Next 自己跑） | `next start` | 中 |
| Nuxt | Node | `.output/server/index.mjs`（普通 Node 应用） | `node .output/server/index.mjs` | 中 |
| Spring MVC | JVM | 胖 JAR | `java -jar` | **最慢**（JVM 预热，UI 冒烟 readiness 给到 120s） |

- **Laravel / Rails 在「轻启动」上是一类**：解释型语言、无构建步骤，改完即跑。
- **Next / Nuxt 居中**：要走 Node 构建产物，但产物形态干净（Nuxt 的 `.output` 就是个普通 Node 应用，`nitro.preset` 还能一键换 Vercel/Cloudflare/容器/static 等部署目标）。
- **Spring 的胖 JAR + JVM 启动最慢**但运维生态最成熟，是大型团队的稳态选择——这也是 `verify-ui-smoke` 对 JVM 全栈把 readiness 等待放宽到 120s 的原因。

---

## 11. 各框架的「招牌坑」（来自本轮改造与项目记忆）

| 框架 | 招牌坑 | 规避 |
|---|---|---|
| **Next.js** | RSC 服务端没有 localStorage，无法识别登录用户；8 位胶囊码输完跳转触发导航自我 `abort` 循环 | 设 httpOnly `ht_session` cookie + `getServerViewer()`；导航去抖/去重 |
| **Nuxt** | `window`/`document` 在 SSR 期无定义 → 500；localStorage 鉴权致 hydration mismatch；`.client.ts` 后缀对**路由 middleware 无效**；`useAsyncData` 里 `$fetch` 相对 URL 在服务端无 origin | `import.meta.client` 守卫；`<ClientOnly>` 包裹；鉴权页 `routeRules: { ssr:false }`；SSR 取数走同进程 Nitro |
| **Laravel** | Eloquent 给 id 上标准 UUID cast 会让关系 `JOIN`/`WHERE` 用错值；PDO pgsql 布尔返回 `'t'/'f'`，原生 boolean cast 把 `'f'` 判成 `true`；`with('owner')` 是左连接，会漏掉孤儿胶囊的 `INNER JOIN` 语义 | id 不 cast、只在边界换算；写 `CrossDbBoolean` Cast；列表查询补 `has('owner')` |
| **Rails** | Turbo/Stimulus 的「服务端跳转 vs 在途 fetch」时序竞态 | 收藏用同步 XHR；局部刷新优先 Turbo 片段 |
| **Spring MVC** | JPA 抽象最厚，跨库 UUID/时间戳要下沉到 Hibernate `JdbcType` + 自实现 `ValueBinder` 处理 `null` | 集中在 `CrossDb*JdbcType`；改 db 脚本后必须双驱动复验 |

> 这些坑的共同主题，仍然是 §6 的渲染模型：**每个框架「把前后端边界画在哪」，决定了它会在哪里咬你一口。**
> 同构阵营在「服务端没有浏览器 API / 水合不一致」处咬你，模板阵营在「ORM 跨库 / 片段时序」处咬你。

---

## 12. 横向总结与「该读哪一个」

| 你是… | 推荐先读 | 会学到 |
|---|---|---|
| 想要同构全栈的当代标准 | **Next.js** | RSC + Client 孤岛，前后端边界最模糊的一体化；以及「这段在哪跑」的心智 |
| Vue 背景 / 想要可调渲染 | **Nuxt** | 通用渲染 + `routeRules` 混合渲染 + 自动导入；SSR 两端兼容的暗规则 |
| 想要直觉的服务端渲染 | **Laravel** | 「数据→模板→HTML」最直觉的全栈 + Eloquent ORM；Alpine 孤岛 |
| 想体验「HTML 即协议」 | **Rails** | Hotwire（Turbo Frame/Stream + Stimulus），客户端 JS 最省的局部刷新 |
| Java / 企业团队 | **Spring MVC** | JVM SSR + HTMX + JPA；以及「重型 ORM 在跨库边界的代价」 |

**贯穿全文的三条主线**：

1. **全栈的本质是「把前后端边界收进一个进程」**——而这条边界画在哪，是这五栈最大的分野。同构阵营（Next/Nuxt）让边界模糊到同一种语言、同一棵树；模板阵营（Laravel/Rails/Spring）让边界锐利地落在「服务端渲 HTML / 客户端做增强」之间。读懂 §3 那条谱系，五栈的脾气就都解释得通了。
2. **渲染模型决定一切**——「HTML 在哪生成」直接决定了客户端 JS 多少（§4 那一栏从 190 到 2647）、状态住在哪一侧、首屏与 SEO、以及局部刷新用什么机制。这是全栈版独有的、比前端/后端都更上位的那个变量。
3. **抽象的成本只会换地方出现**（与前端 §4、后端 §6 完全同源）——同构框架省掉了「前后端分离」的接缝，换来客户端运行时的体量与水合的复杂度；模板框架省掉了客户端的重量，换来局部交互要靠 HTMX/Turbo/Alpine 一处处补；JPA 省掉了平时的 SQL，换来跨库时下沉到底层 SPI。没有免费的午餐，只有不同的账单。

这正是这套多栈教学项目想让你亲手摸到的东西——全栈、前端、后端三篇对比，是同一个道理的一体三面。

---

### 附：复现本文数据

```bash
# 服务端业务行（以 spring-mvc 的 service 层为例，其余替换路径/扩展名）
find fullstacks/spring-mvc/src/main/java -path '*/service/*' -name '*.java' | xargs wc -l | tail -1
# 客户端 JS 行（Laravel/Rails/Spring 分别在 public/js、app/javascript、static/js）
find fullstacks/laravel/public/js -name '*.js' | xargs wc -l | tail -1
# 模板/视图行（Blade / ERB / Thymeleaf）
find fullstacks/rails/app/views -name '*.erb' | xargs wc -l | tail -1

# 契约验证（双库各 104 用例）
./verification/scripts/verify-contract.sh <next|nuxt|laravel|rails|spring-mvc>
DB_DRIVER=sqlite ./verification/scripts/verify-contract.sh <…>
# UI 冒烟（25 个 Playwright 用例）
./verification/scripts/verify-ui-smoke.sh <next|nuxt|rails|spring-mvc>   # laravel 同理（已注册）
```
