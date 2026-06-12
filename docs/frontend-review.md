# HelloTime Pro · 五个前端实现深度 Review 报告

> Review 日期:2026-06-11。对象:`frontends/` 下 React、Vue 3、Angular、Svelte 5、SolidJS 五个实现。
> 视角:教学与技术展示项目的定位 —— 契约遵守、定位清晰度、技术特色展示、代码规范、文档注释、工程化。
> 姊妹篇:[`frontend-comparison.md`](frontend-comparison.md) 回答"五个框架差异在哪";本文回答"每个实现做得怎么样、扣分扣在哪"。

---

## 0. 方法与验证

本次 review 实际执行了以下检查(非纯阅读):

- 逐家通读 API 客户端、auth/plaza/theme store、路由表、守卫、创建页、胶囊详情、倒计时/防抖工具;
- 对照 `spec/api/openapi.yaml` 18 个端点逐一核对客户端封装与 `auth` 标志;
- 全量扫描组件层硬编码色值(`#hex` / `rgb()`);比对五家 `layout.css` 的 md5;
- 实跑五家 `npm run lint`(类型检查)与四家 `npm test`(vitest);
- 核对 `verification/ui/tests` 对前端路由的假设;
- 通读五份 README 与五份 TECHNICAL_GUIDE 的结构与抽样内容。

结果:**5/5 类型检查通过;4/4 有单测的实现 7/7 用例全过**(Angular 无单测,见 §4.3)。

---

## 1. 总评

这是一组完成度和一致性都**非常高**的多栈实现:同一产品、同一契约、同一视觉系统,五份代码的目录结构、文件粒度、注释风格、错误处理策略全部对齐,总代码量 2.8k–3.5k 行高度接近,跨栈对照学习的体验是真实成立的。共性强项(§2)远多于问题;发现的问题(§3、§4)几乎都集中在"边角不一致"而非功能或质量缺陷。

**评分(满分 100)**

| 维度(权重) | react-ts | vue3-ts | angular | svelte | solid |
|---|---|---|---|---|---|
| 契约与跨栈一致性 (30) | 30 | 29 | 27 | 26 | 28 |
| 技术特色展示 (25) | 22 | 23 | 19 | 24 | 22 |
| 代码规范与简洁 (20) | 18 | 19 | 19 | 19 | 19 |
| 文档与注释 (15) | 13 | 13 | 14 | 13 | 14 |
| 工程化:脚本/测试/构建 (10) | 9 | 9 | 6 | 9 | 7 |
| **总分** | **92** | **93** | **85** | **91** | **90** |

> 分差很小是事实而非和稀泥:五家的底子几乎一样好。Angular 的缺口(无单测 + 放弃 HttpClient)和 Svelte 的路由偏离是仅有的两类"原则性"问题。

---

## 2. 共性强项(五家通用)

1. **契约遵守扎实**。响应外壳 `{success, data, message, errorCode}` 统一解包;401 + `UNAUTHORIZED` → 单航班 refresh(并发请求合并到同一个 `refreshing` Promise)→ 重放一次;204 直接返回;错误统一抛 `ApiError`。五家逻辑逐行等价,且有 `client.test.ts` 验证 refresh 重放(Angular 除外)。
2. **设计令牌纪律满分**。组件层硬编码色值 **0 处**;`layout.css` 五家 **md5 完全一致**;统一 `@import` spec 的 `palette/tokens/cyber.css`。"同一盒乐高"的承诺真实兑现。
3. **状态方案按设计文档 §9.2 各栈各味**:Zustand / Pinia setup store / @ngrx/signals signalStore / Svelte 5 runes class / solid-js createStore,且都附带"为什么这样接 API 客户端"的解耦注释(configureApi 回调注入,避免循环依赖)。
4. **关键工程细节处处到位**:搜索 300ms 防抖五家一致;倒计时 interval 全部正确清理;LLM 推荐失败静默降级、保留旧数据;React/Solid 还做了请求序号防乱序覆盖;React 显式处理 StrictMode 双触发并注释说明。
5. **文档分量在教学项目里属上乘**。每家 README(~100 行)+ TECHNICAL_GUIDE(601–843 行),16/17 章结构统一,从入口链路讲到测试;Svelte 有三框架对照表,Solid 有"无虚拟 DOM 渲染原理"章和实测踩坑 FAQ(质量很高)。
6. **注释风格统一且有信息量**:文件头块注释交代职责与取舍,行内注释解释"为什么"(竞态、StrictMode、静默降级)而非复述代码。

---

## 3. 跨栈问题(不归咎于单家,但应收敛)

| # | 问题 | 影响 | 建议 |
|---|---|---|---|
| C1 | **设计文档 §9.3 的 Tailwind 流水线不存在**:`scripts/build-tokens.mjs`、tailwind preset 均无;五家语义 Tailwind 类(`bg-surface-1` 等)实际使用 **0 处**,真实方案是 `cy-*` 共享类 + CSS 变量内联 style。Tailwind 被 `@import` 但形同虚设 | 文档误导读者;每家构建多背一个无用依赖 | 二选一:要么移除 Tailwind 依赖并改写 §9.3,要么真做 preset。倾向前者(现方案已自洽) |
| C2 | **§9.4 要求的 `CapsuleForm` 组件五家都内联在 CreatePage**(react README 倒是诚实标注"CreatePage 内联") | 文档与实现漂移 | 改 §9.4 措辞即可,不必抽组件 |
| C3 | **`GET /plaza/capsules/{id}` 端点只有 Svelte 消费**,其余四家广场卡片直接走 `/c/:code`。契约端点本身由后端测试覆盖,但前端行为不一致(见 S1) | 五家交互不完全"肉眼可比" | 与 S1 一并决策:全收敛到有详情页,或全无 |
| C4 | **单测口径薄且 Angular 缺位**:四家各 7 例(client 3 + format 4),store/组件零测试 | 教学项目可接受,但"测试"章节示范有限 | 至少给 Angular 补齐同口径 7 例(见 A3) |

---

## 4. 各家详评

### 4.1 react-ts(参考实现)— 92

**亮点**
- 参考实现的职责完成得很好:其余四家的 client/store/页面结构都能看出以它为模板,模式原创性记在它头上。
- `api/client.ts` 是五家中注释最完整的版本;CreatePage 的 AI 生成流(空标题回填、竞态序号、StrictMode 防重)是全项目交互处理的最佳示范。
- react-router 7 `createBrowserRouter` data router + 布局嵌套路由,守卫用组件式 `AuthGate`(水合前渲染 null,持 refreshToken 放行),符合 React 生态习惯。

**问题**
- R1(文档):README 快速开始仍写 `docker compose up -d postgres`,与项目现行"本地原生 PG + `scripts/db`"约定冲突(vue/svelte 同病,angular/solid 已改)。
- R2(规范):内联 `style={{...}}` 用量偏大(CreatePage 尤甚),虽然全部走 CSS 变量、令牌合规,但与 `cy-*` 类的分工边界模糊;CreatePage 292 行是五家同页最长。
- R3(复用):倒计时 interval 逻辑在 CapsuleCard 与 CapsuleDetail 各写一遍,Vue/Svelte 的 composable 抽取在这点上做得更好——作为参考实现可以示范 `useCountdown` hook。

### 4.2 vue3-ts — 93(最高分)

**亮点**
- 执行最干净的一份:`useCountdown` / `useDebouncedRef` / `useClickOutside` 三个 composable 抽取得当、注释带用法示例;`CalendarUnit.vue` 独立成 SFC 承载翻页动画。
- Pinia setup store + `wireAuthApi()` 显式接线,并注释了"Pinia store 必须在 app 创建后才能用"这一模块加载顺序坑——教学价值高。
- Composition API、`defineProps` 泛型、`computed`/`watch` 用法全程地道。

**问题**
- V1(一致性):设计文档 §9.2 写明 Vue 用 Pinia "auth / capsule / plaza store",实际没有 capsule store(我创建的/收藏的逻辑在页面内)。无行为影响,但文档与实现不符。
- V2(文档):README 同 R1,docker compose 指引过时。

### 4.3 angular — 85

**亮点**
- 现代 Angular 展示到位:standalone 组件、`@ngrx/signals` signalStore(`withState/withMethods/withHooks`)、函数式 `CanActivateFn` 守卫、`@for/@if` 新控制流、inline template。五家中总代码量最紧凑(2794 行)。
- AuthStore 用 `withHooks.onInit` 完成 API 接线 + 水合,是 signalStore 生命周期的好示例。

**问题**
- A1(特色展示,最大缺口):`ApiService` 用原生 fetch 逐行复刻 React 客户端,注释言明"与 React/Vue 保持同构"。这是有意取舍,但 **HttpClient + `withInterceptors` 恰是 Angular 网络层的看家惯用法**,auth/refresh 拦截器是其最经典的教学场景。对"技术展示"定位,这一刀砍掉了 Angular 最该展示的东西之一。建议:至少在 TECHNICAL_GUIDE 里给出 interceptor 等价写法对照,或直接改用 HttpClient。
- A2(契约细节):`suggestCapsule` 是五家中唯一没传 `auth: false` 的(spec 中该端点 `security: []`)。登录态下会多带 Authorization 头,token 过期时还会先触发一次不必要的 refresh。一行修复。
- A3(工程):**无单元测试**。`./test` 实际是 `tsc --noEmit`,与 `lint` 完全重复;其余四家有 vitest 7 例。client 的 refresh 重放逻辑(全项目最值得测的前端逻辑)在 Angular 没有任何保护。
- A4(行为差异):`proxy.conf.local.json` 没有四家 vite 配置都有的 60s `proxyTimeout`(为 LLM 建议接口延长),慢 LLM 时 dev 模式可能先超时。
- A5(视觉):详情页倒计时无翻页 fold/unfold 动画(react/vue/svelte 有),见 S/So 同项。

### 4.4 svelte — 91

**亮点**
- Svelte 5 特性展示是五家中最"新"最完整的:runes class store(`$state` 类字段)、`.svelte.ts` 单例、`Snippet` children、`$effect` 守卫、`createCountdown`/`createDebounced` runes 工具,全部地道。
- TECHNICAL_GUIDE 843 行五家最长,含 Svelte vs React vs Vue 对照表;`.svelte.ts` 导入必须带后缀的坑也已沉淀进 dev-notes。

**问题**
- S1(一致性,本次 review 最重要的单项发现):**路由偏离**——其余四家 `/c/:code`,Svelte 用 `/capsules/:code`,且独有 `/plaza/:id` 详情页(也是唯一消费 `GET /plaza/capsules/{id}` 的前端)。后果:`verification/ui/tests/_helpers.ts:67` 被迫写了 `FRONTEND_TARGET === "svelte" ? "/capsules/" : "/c/"` 的**实现感知特判**,同时违反 `docs/02-design.md` "对外行为(路由)必须一致"与 CLAUDE.md "黑盒验证不加实现感知捷径"两条项目级原则。`frontend-comparison.md` §405 已承认此事但未收敛。建议:把 Svelte 路由改成 `/c/:code`,`/plaza/:id` 要么五家补齐、要么移除,然后删掉验证特判。
- S2(文档):README 同 R1,docker compose 指引过时。

### 4.5 solid — 90

**亮点**
- 细粒度响应式展示充分:模块级 `createStore` + 闭包请求序号(注释解释"为什么不放 store 里——避免多余订阅"),`patchPlazaFavorited` 定点更新,`Show` 嵌套守卫。
- TECHNICAL_GUIDE 是五家中"独家内容"最多的:§14 渲染原理(无 VDOM 更新去哪了)、§17 实测踩坑 FAQ(解构丢响应性、style kebab-case、Accessor 收窄……),教学价值突出。
- README/文档没有 docker 过时问题。

**问题**
- So1(工程):**缺顶层 `./test` 包装脚本**(CLAUDE.md 约定每实现有 `run/build/test` 三件套;vitest 与 `npm test` 都在,只缺壳)。统一工具链/CI 会漏跑它的测试。几行 shell 修复。
- So2(视觉):详情页倒计时 `CalendarUnit` 为内联简化版,无翻页动画(同 A5)。
- So3(文档漂移,记到设计文档头上):§9.2 说 Solid 用 "createSignal + createContext",实际用模块级 `createStore`——实现的选择更实用,该改的是文档。

---

## 5. 修复建议(按优先级)

| 优先级 | 项 | 动作 | 状态 |
|---|---|---|---|
| P0 | S1 | Svelte 路由收敛 `/c/:code`，移除 `/plaza/:id` 和 PlazaDetailPage，删 `_helpers.ts` 特判 | ✅ 已完成 |
| P0 | A3 | Angular 补 vitest 7 例，`./test` 改跑真测试 | ✅ 已完成 |
| P1 | So1 | Solid 补 `./test` 包装脚本 | ✅ 已完成 |
| P1 | A2 | Angular `suggestCapsule` 加 `auth: false` | ✅ 已完成 |
| P1 | R1/V2/S2 | react-ts/vue3-ts/svelte README 移除 docker compose，改为 `scripts/db init` | ✅ 已完成 |
| P2 | A4 | Angular 代理补 60s 超时 | ✅ 已完成 |
| P2 | A5/So2 | Angular/Solid 详情页倒计时补翻页 fold/unfold 动画 | ✅ 已完成 |
| P2 | C1 | `02-design §9.3` 改写为现行实际方案（cy-* 类 + CSS 变量） | ✅ 已完成 |
| P3 | C2/V1/So3 | `02-design §9.2/§9.4` 与实现对齐（Vue store 说明、Solid createStore、CapsuleForm 内联注记） | ✅ 已完成 |
| P3 | A1 | Angular 网络层 interceptor 对照（文档或实现） | 待决策，工作量中 |
