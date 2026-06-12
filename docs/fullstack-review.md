# HelloTime Pro · 五个全栈实现深度 Review 报告

> Review 日期:2026-06-11
> 范围:`fullstacks/next`、`fullstacks/nuxt`、`fullstacks/spring-mvc`、`fullstacks/rails`、`fullstacks/laravel`
> 视角:契约遵守、技术定位、特色展示充分度、代码规范、文档质量
> 姊妹篇:[frontend-review.md](frontend-review.md)(五前端)、[fullstack-comparison.md](fullstack-comparison.md)(横向技术对比,不打分)

## 0. 方法与验证

通读五家实现的服务层、数据层、鉴权链路、UI 层与全部文档,并在 review 当天实际执行:

| 验证项 | 结果 |
|---|---|
| `fullstacks/next/test`(tsc 类型检查) | ✅ 通过 |
| `fullstacks/nuxt/test`(nuxt typecheck) | ✅ 通过 |
| `fullstacks/rails/test`(CrossDb 不变式冒烟,8 断言) | ✅ 通过 |
| `fullstacks/laravel/test`(phpunit) | ⚠️ **0 个测试**,"No tests found" 仍报 passed |
| `verify-ui-smoke.sh laravel`(SQLite,本次补跑) | ✅ **25/25**(此前无记录) |

契约与 UI 冒烟历史记录(来自 CLAUDE.md / roadmap):五家全栈双驱动契约均 104/104;UI 冒烟 next / nuxt / spring-mvc(2026-06-04)、rails(2026-06-06)均 25/25,laravel 由本次 review 补齐 SQLite 25/25。

## 1. 总评

五个全栈整体成熟度高于预期:**契约全绿、双驱动全支持、LLM 日志规范五家全部合规、分层结构五家可逐文件对应**。两条技术路线泾渭分明且各自展示到位——next/nuxt 走「SPA 框架长出服务端」(API Routes + SSR/RSC),spring-mvc/rails/laravel 走「经典 MPA 服务端渲染 + 渐进增强」(Thymeleaf+HTMX / Hotwire / Blade+Alpine)。后写的三家 JVM/Ruby/PHP 实现在事务、测试、文档实事求是程度上反超先写的两家 Node 实现。

| 实现 | 技术路线 | 分数 | 一句话评价 |
|---|---|---|---|
| spring-mvc | Thymeleaf + HTMX MPA | **93** | 工程最扎实:真事务、真集成测试、cookie→Bearer 桥设计优雅;手册对招牌特色 HTMX 着墨偏少 |
| rails | Hotwire(Turbo + Stimulus) | **92** | 最框架地道:12 个职责单一的 Stimulus 控制器、行锁事务、跨库不变式冒烟直击风险点 |
| next | App Router + RSC | **89** | RSC 服务端取数展示真实充分,代码与注释一流;缺 README、动态 metadata 招牌能力未用 |
| nuxt | 混合渲染(SSR + SPA 孤岛) | **87** | routeRules 混合渲染是教科书级展示;但全站连 `<title>` 都没有,与"SSR 为了 SEO"的动机自相矛盾 |
| laravel | Blade + Alpine MPA | **86** | Eloquent 重构后数据层成为亮点;测试套件空转、UI 路由别名未随前端 S1 收敛 |

## 2. 共性强项(五家通用)

- **双入口架构表达一致**:同一进程同时暴露 `/api/v1/*`(Bearer,与黑盒契约逐字对齐)和 SSR UI(httpOnly cookie),且五家都写明了两通道如何复用同一套服务层。cookie→Bearer 的桥接三家 MPA 各有方案且注释互相引用(spring `CookieTokenFilter` ↔ rails `CookieTokenBridge` ↔ laravel `AuthService` 双通道)。
- **LLM 日志规范全员合规**:五家的 `LLM request / LLM response / LLM error` 三时机、必含字段(`model=`、`elapsed_ms=`、`tokens=`、`status=`/`error=`)全部落实,重试与禁用 thinking 的坑也全部移植到位。
- **服务层同构可并排阅读**:`AuthService / CapsuleService / PlazaService / FavoriteService / LlmClient…` 五家命名一一对应;next↔nuxt 的服务端代码刻意逐行同构(auth.ts 差异仅 41 行),是「换框架不换业务」的最好教材。
- **跨库双驱动各显神通**:Drizzle 双 schema(next/nuxt)、JPA `@JdbcType` 分流(spring)、`CrossDb` 模块 + 字符串序不变式(rails)、Eloquent 自定义 Cast + `HasCrossDbKey`(laravel)——同一道题五种解法,正是项目定位想要的。
- **取舍注释文化延续**:并发/事务的取舍都写成大段注释。值得表扬的反差:next/nuxt 文档化了「不做事务的原因」,而三家 MPA 直接给出生产级做法(`@Transactional`、`lock`/`lockForUpdate` + 行锁),两边互为教学参照。
- **文档结构统一**:五家手册都遵循「选型→地图→运行→核心思想→数据层→服务层→客户端→样式→跨栈对比→改动指南」骨架,且都含至少一章与其他全栈的并排对比。

## 3. 跨栈问题(不归咎于单家,但应收敛)

- **C1 · docker compose 残留**:next `run` 注释、nuxt `run` 注释 + README 仍写 `docker compose up -d postgres`。前端侧同类问题(R1/V2/S2)已在前端 review 中修掉,全栈侧漏网。三家 MPA 干净。
- **C2 · run 脚本注释与实际 SQLite 路径不符**:next/nuxt/spring-mvc 的 `run` 头注释写"使用 `data/sqlite/hellotime.db`",实际默认是 per-stack 文件(`hellotime-next.db` 等,与 `hello` CLI 的 `_sqlite_path_for` 约定一致)。rails/laravel 注释正确。
- **C3 · CLAUDE.md 验证清单滞后**:`verify-ui-smoke.sh` 的目标列表早已支持 laravel,但 CLAUDE.md 的清单没列;laravel UI 冒烟此前也无通过记录(本次已补 SQLite 25/25,PG 待补跑)。
- **C4 · layout.css 硬编码 `#ffffff`**:`.cy-btn--hero` 四处 `color: #ffffff`,九个实现(5 前端 + 4 全栈)共有,源头是共享的 layout.css。语义是「渐变底上的恒白文字」,不随主题翻转,建议在 tokens 中加 `--color-text-on-accent` 一次性收敛,或在 spec 里写明豁免。

## 4. 各家详评

### 4.1 next(89 / 100)

**定位**:React 全栈一体化——App Router、RSC、Route Handlers、`server-only` 编译期防火墙。

**强项**
- **RSC 不是摆设**:广场(`app/page.tsx`)与胶囊详情(`app/c/[code]/page.tsx`)在服务端直调 service 取数(无 HTTP 往返),searchParams 驱动排序/筛选,客户端孤岛只保留必要交互——这是五家中对「全栈消除前后端往返」展示最彻底的。
- **会话双通道注释典范**:`lib/server/session.ts` 用 10 行注释讲清「为什么 Bearer 之外还要加 httpOnly cookie」「对契约为什么无副作用」。
- 路由层薄如纸(`withApi` + zod `parseJson` + service 调用,一个 handler 十几行),错误信封统一。
- `services/auth.ts` / `favorites.ts` 的并发取舍注释给出了生产化 SQL(条件 UPDATE + RETURNING / UPSERT),教学价值高。

**问题**
- **N1(中)** 五家中唯一没有 `README.md` 的实现,运行/验证入口只能进 643 行的手册里找。
- **N2(中)** 整个应用只有根 layout 一个静态 `metadata`;胶囊详情页没用 `generateMetadata` 输出动态标题——Next 的招牌能力之一,且恰好能兑现「SSR 利于分享卡片」的承诺,目前缺席。
- **N3(低)** `run` 注释残留 docker compose(C1)。
- **N4(低)** 手册 §1 营销腔明显(「金融级的身份安全防范」「极佳的开发与部署一致性」),与代码注释的实事求是反差大;`session.ts` 里明写着 `secure: false // 教学项目本地 http`,「金融级」属于过度承诺。
- **N5(提示)** `db/index.ts` 双驱动句柄用 `any` + eslint-disable 绕开类型(统一假装成 PG 端类型),有注释、可接受,但与手册「全链路类型安全」的说法打架。
- `./test` 仅类型检查,无单元测试(与 nuxt 同;对比 spring/rails 偏弱)。

### 4.2 nuxt(87 / 100)

**定位**:Vue 全栈一体化——Nitro、约定式路由、`useAsyncData` 通用渲染、routeRules 混合渲染。

**强项**
- **混合渲染是教科书级展示**:`nuxt.config.ts` 的 `routeRules` 把 `/create`、`/me/**` 标成 SPA 孤岛,注释完整解释了「为什么鉴权页 SSR 有害无益」——这是 Nuxt 相对纯 SPA 的核心增量,讲透了。
- **SSR 数据一致性处理成熟**:首页/详情页 `useAsyncData` 服务端预取 + payload 注水,登录用户客户端补取一次纠正 `favoritedByMe` 投影,匿名用户零重复请求,注释把竞态和闪屏都讲清了。
- 服务端与 next 逐行同构(刻意设计),Nuxt vs Next 对比章(§10)是两份手册互相导流的好设计。
- README 的 Design Notes 坦诚记录 XSS 暴露面取舍。

**问题**
- **Nu1(中高)** **全站没有任何 `<title>`**:无 `app.head`、无任何页面 `useHead`/`useSeoMeta`。SSR 的动机明写着「利于 SEO 与分享卡片」,但页面连标题都不输出,浏览器标签页显示空白/URL。五家中唯一(next 至少有全局静态 title,三家 MPA 都有 per-page title)。详情页本可用 `useHead(() => ({ title: cap.value?.title }))` 一行展示招牌能力。
- **Nu2(中)** README + `run` 残留 docker compose(C1)。
- **Nu3(低中)** 全部 30 处链接用 `RouterLink` 而非 `NuxtLink`,放弃了视口预取等 Nuxt 增强;推测是为与 vue3-ts 前端同构,但手册未解释,读者会当成疏忽。
- **Nu4(低)** 手册 §1 与 next 同款营销腔(「打造了严密的用户身份与会话保护屏障」「完美契合」)。
- `./test` 仅类型检查。

### 4.3 spring-mvc(93 / 100)

**定位**:经典 Java 企业栈的现代化 MPA——Spring Boot 3 + Thymeleaf + HTMX,与「前后端分离」形成对照。

**强项**
- **工程成熟度五家之首**:`@Transactional` 全service 正确使用(含 `noRollbackFor` 细节);`SmokeTest` 是真正的 HTTP 层集成测试(注册→登录→建胶囊→refresh 轮转→改密),`./test` 用 SQLite 零依赖可跑。
- **CookieTokenFilter 设计优雅**:cookie→Authorization 头注入,让 SSR 侧浏览器 fetch 复用同一套 Bearer 控制器,「仅在缺 Authorization 时介入」保证契约用例不受影响;`CookieAuthService` 注释还点名了 next/nuxt「急切刷新误登出」的坑——跨实现互相引用是项目文档的最佳实践。
- 业务地基(实体/仓库/JWT/跨库 JdbcType/LLM 客户端)与 `backends/spring-boot` 复用,README 明说,避免双份分叉。
- `static/js/app.js`(406 行)的渐进增强定位讲得清楚:「只承载天然属于浏览器的交互」。

**问题**
- **S1(低中)** 手册 418 行为五家最短,§8「客户端交互:HTMX」仅 16 行——HTMX 恰是这家区别于其余四家的最大特色(`hx-get` 局部刷新、`hx-swap`、fragment 端点设计),值得扩到与 next 手册 §5 同等深度。
- 其余几乎挑不出实质问题;`#ffffff`(C4)与 run 注释路径(C2)为跨栈共性。

### 4.4 rails(92 / 100)

**定位**:Convention over Configuration 的全栈鼻祖——Rails 8 + Hotwire(Turbo + Stimulus),importmap 免构建。

**强项**
- **最框架地道**:12 个 Stimulus controller 各管一事(收藏/倒计时/头像选择/码输入/主题…),`static values` API 用得标准;Turbo 负责导航,JS 只做增强——Hotwire 哲学展示完整。
- **数据层注释教学价值最高**:`FavoriteService` 事务 + PG 行锁(`rel.lock unless AppConfig.sqlite?`)+「SQLite 依赖单写事务」的差异说明;同步 XHR 收藏的反直觉选择注明引用 `docs/dev-notes.md §4`。
- **冒烟测试直击风险点**:`script/smoke.rb` 固定跨库存储格式不变式(小数秒去尾零、seed 与 app 写入的字符串序即时序、uuid↔hex 往返)——量少但每条都是真坑的回归保险。
- README(106 行)五家最详尽;手册有两章对比(vs Next/Nuxt、vs Spring/Laravel),承上启下。

**问题**
- **R1(低)** 冒烟只覆盖 CrossDb 纯逻辑,无 HTTP 层用例(对比 spring 的 SmokeTest);依赖外部契约验证兜底,教学项目可接受。
- **R2(低)** `run`/`test` 里硬编码 homebrew ruby 路径(`/opt/homebrew/opt/ruby/bin`),跨机器可移植性差,但与「本机教学项目」定位一致。

### 4.5 laravel(86 / 100)

**定位**:PHP 现代全栈代表——Laravel 12 + Blade + Alpine.js,Eloquent ORM 为招牌。

**强项**
- **Eloquent 重构(2026-06-10)成色好**:Model + 关系(`with('capsule.owner')`)+ 自定义 Cast(`CrossDbBoolean`)+ `HasCrossDbKey` concern,`DB::transaction` + `lockForUpdate` 行锁正确;`myFavorites` 里「复刻原 INNER JOIN 语义」的过滤注释保留了重构前后的行为对照。
- 手册 §1 是五家中最实事求是的(表格列双入口、逐条说职责),无营销腔。
- `vite.config.js` 注释解释了 JS 为何不走 Vite 构建(避免双 JS 源混淆)——对非常规选择主动给出理由。
- `AuthService` 双通道(Bearer 优先、cookie 兜底)一处收口,对应 spring/rails 的 filter/middleware 方案,手册 §11 有三家对照表。

**问题**
- **L1(中高)** **测试套件空转**:`tests/` 只有空的 `TestCase.php`,`./test` 跑 `php artisan test` 输出 "No tests found" 却报 passed——绿灯没有任何含金量,五家最弱(spring 有集成测试、rails 有不变式冒烟、next/nuxt 至少跑类型检查,PHP 无类型检查兜底)。至少应补 `CrossDb`/`JwtCodec` 单测或一条 HTTP 冒烟。
- **L2(中)** `routes/web.php` 保留 `/capsules/{code}` 与 `/plaza/{id}` 两个旧 UI 路由别名——前端 review 的 S1 刚把五前端收敛到 `/c/:code` 并删除 `/plaza/:id`,其余四家全栈也只有 `/c/{code}`,laravel 是最后的离群值。
- **L3(低,已半解决)** UI 冒烟此前无任何通过记录;本次 review 补跑 SQLite 25/25,PG 侧待补。
- **L4(低)** API 鉴权用控制器内手工 `requireUser()` 而非 Laravel 习语(auth middleware + FormRequest);单控制器 176 行薄调度可接受,但手册没解释这个反习语选择(对照 vite 注释的好榜样)。

## 5. 修复建议(按优先级)

| # | 优先级 | 实现 | 建议 | 状态 |
|---|---|---|---|---|
| L1 | P1 | laravel | 补最小测试集:`CrossDb`/`JwtCodec` 单测或 HTTP 冒烟,让 `./test` 的绿灯有含金量 | ✅ 已修:12 个 phpunit 单测(CrossDb × 7 + JwtCodec × 5) |
| Nu1 | P1 | nuxt | `nuxt.config.ts` 加 `app.head` 默认 title;详情/广场等 SSR 页加 `useHead`(详情页动态标题) | ✅ 已修:config 加 titleTemplate + meta;全部 10 个页面加 useHead |
| N1 | P2 | next | 补 `README.md`(对齐其余四家:运行/验证/结构/设计要点) | ✅ 已修:新建 README.md |
| N2 | P2 | next | `app/c/[code]/page.tsx` 加 `generateMetadata` 动态标题,兑现 SSR 分享卡片承诺 | ✅ 已修:generateMetadata 输出胶囊标题 + description |
| L2 | P2 | laravel | 删除 `/capsules/{code}`、`/plaza/{id}` UI 路由别名,对齐前端 S1 收敛决定 | ✅ 已修:web.php 只保留 `/c/{code}` |
| C1 | P2 | next/nuxt | 清理 `run` 注释与 nuxt README 的 `docker compose up -d postgres` 残留,改为 `./scripts/db init` | ✅ 已修:next/nuxt run 注释 + nuxt README |
| N4/Nu4 | P3 | next/nuxt | 手册 §1 营销腔改为实事求是(参照 laravel §1 的表格风格) | ✅ 已修:改为表格式选型说明 + 取舍对照 |
| Nu3 | P3 | nuxt | `RouterLink` → `NuxtLink`,或在手册说明「与 vue3-ts 同构」的刻意取舍 | ✅ 已修:手册 §1 补充说明取舍理由 |
| S1 | P3 | spring-mvc | 手册 §8 扩写 HTMX 章(hx-* 属性、fragment 端点设计、与 Turbo 的对照) | ✅ 已修:§8 从 16 行扩写为 5 小节含属性表 + Turbo 对照表 |
| C2 | P3 | next/nuxt/spring-mvc | `run` 头注释的 SQLite 路径改为实际 per-stack 文件名 | ✅ 已修:next → hellotime-next.db；nuxt → hellotime-nuxt.db；spring-mvc 原本无偏差 |
| C3 | P3 | 根文档 | CLAUDE.md 验证清单补 laravel(UI smoke 目标列表 + 本次 SQLite 25/25 记录) | ✅ 已修:UI smoke 目标列表加 laravel；加 2026-06-11 SQLite 25/25 记录 |
| C4 | P3 | spec/全体 | `.cy-btn--hero` `#ffffff` 加豁免注释(渐变底色文字不随主题翻转) | ✅ 已修:9 个 layout.css 统一插入豁免注释 |
| L4 | P3 | laravel | 手册补一段「为何不用 auth middleware / FormRequest」的取舍说明 | ✅ 已修:§7.2 后追加「为何不用 Laravel auth middleware / FormRequest？」 |
