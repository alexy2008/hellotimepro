# HelloTime Pro · Svelte 5 + TypeScript（2.0）

Svelte 5（Runes）+ TypeScript + Vite 6 + svelte-routing，两套皮肤「时笺」「琥珀」× 明暗。
视觉基准是 2.0 原型（`2.0版原型byClaude-合集/`），样式原样引入 `spec/styles`，契约见 `spec/api/openapi.yaml` 2.0.0。
功能与交互逐项对齐参考前端 `frontends/react-ts`，写法走 Svelte 自己的路子（见下文「Svelte 的写法」）。

## 快速开始

```bash
# 一次性：起一个后端（默认 FastAPI），把 :9080 指过去
cd ../../
./scripts/db init
./scripts/hello start fastapi
./scripts/hello switch fastapi

# 启动前端（端口 7176）
./scripts/hello start svelte      # 或者：cd frontends/svelte && ./run
# → http://localhost:7176
```

也可以跳过 :9080 反代直连后端：`BACKEND_PROXY=http://localhost:29010 ./run`。

## 脚本

| 脚本 | 作用 |
|---|---|
| `./run` | 起 dev server（Vite，端口 7176） |
| `./build` | `svelte-check`（类型与模板检查）+ 生产构建到 `./dist` |
| `./test` | 单元测试（vitest：纯函数、API 客户端、store 与页面状态类） |

UI 冒烟（两套皮肤各跑一遍）：`./verification/scripts/verify-ui-smoke.sh svelte`
设计令牌：`./verification/scripts/verify-design-tokens.sh svelte`

## 目录结构

```
src/
├── index.html            ← 首帧前写好 <html data-skin data-theme> 的内联脚本
├── main.ts               ← hydrate 登录态 → 注入 API 客户端 → mount(App)
├── App.svelte            ← 总布局：按皮肤挑页头 / 页脚 / 底栏；svelte-routing 的平铺路由表
├── styles/index.css      ← 自托管字体 + spec/styles（本前端的两条样式胶水在 App / ListMore 的 <style> 里）
├── api/                  ← fetch 封装、统一响应解包、401 自动 refresh 并重放（单飞）
├── types/                ← 与 openapi 2.0.0 对齐的类型（含 PlazaStats / MyStats）
├── stores/               ← 全局 .svelte.ts 单例：auth · ui（皮肤 / 明暗）· plaza · draft · feedback · clock（整秒节拍）· health
├── state/                ← 页面状态类（$state 字段 + 方法）与它们的 context：
│   ├── code-open         CodeOpen：就地输码 / 开启页（输入、查询、作废旧查询）
│   ├── capsule           CapsuleState：取数、expired、awaitOpened；MySealed
│   ├── create-form       CreateForm：草稿字段、校验、AI 推荐与代笔、提交锁与回执
│   ├── account           LoginForm · RegisterForm · ProfileForm · MyStatsState · MyList（加载更多）
│   ├── plaza-home        进入 / 换账号刷新、到点刷新、热度榜、页码
│   └── login-prompt      匿名点收藏 / 创建时的确认框
├── pages/                ← 路由页：创建本页的状态、放进 context，再按皮肤渲染视图；AuthGate 之外的守卫与跳转
├── components/           ← 两套皮肤结构相同的部件：FormField、SegControl、FavButton、AvatarPicker、DialogHost、UserMenu、AuthGate…
├── skins/
│   ├── paper/            ← 「时笺」：印章 / 火漆 / 信封 / 邮戳 / 卡片 / 输码 / 标尺 / 日历 / 长按封缄 · 外壳 · 各页
│   └── amber/            ← 「琥珀」：胶囊插画 / 翻牌倒计时 / 卡片 / 输码 · 外壳（星空粒子背景）· 各页
└── lib/                  ← 纯工具：时间说法、开启时间规则、账号校验、图标、头像（构建期内联 spec/avatars/v2）、
                            专属色、关于页文字、登录回跳、导航项；attach.ts（附件）· motion.svelte.ts（抖一下）
```

## 路由

| 路由 | 页面 | 权限 |
|---|---|---|
| `/` | 首页：广场概览 + 就地输码 + 胶囊广场 | 公开 |
| `/open` | 凭码开启（登录后附「我封存过的胶囊」） | 公开 |
| `/capsules/:code` | 胶囊详情（倒计时归零自动开启；按 `code` 加 `{#key}`） | 公开 |
| `/create` | 写一枚胶囊 | 登录（`<AuthGate>`） |
| `/login` · `/register` | 登录 / 注册（支持 `?redirect=`；已登录访问直接跳走，`<GuestOnly>`） | 公开 |
| `/me/created` · `/me/favorites` · `/me/profile` | 我的（一条路由 `/me/:tab`，只认三个页签，其余回到 `/me/created`） | 登录 |
| `/about` | 关于 | 公开 |
| 其他 | 404 | 公开 |

## 设计要点

- **逻辑一份，视图按皮肤分——靠 context**：每个路由页（`pages/*.svelte`）在初始化时创建本页的状态类实例，用 `createContext` 放进 context，再按 `ui.skin` 渲染时笺或琥珀的视图；两套视图取到的是同一个实例。切换皮肤时只换视图，路由页不动，状态还在（表单值、错误、推荐、回执、已输入的胶囊码都不丢，X5）；离开页面时路由页销毁，状态随之丢弃（表单自然清空）。跨页面要留的状态（登录态、广场筛选、创建页草稿）放在 `stores/` 的全局单例里。
- **皮肤与明暗**：`<html data-skin data-theme>`，首帧前由 `index.html` 内联脚本从 `localStorage`（`hellotime.skin` / `hellotime.theme`）写好；切换用 View Transition（回调里改完状态再 `await tick()`，新画面才是更新后的 DOM），减少动效时直接切。
- **DOM 与原型一致**：Svelte 组件不产生宿主元素，模板照原型的结构与类名写即可；挂载点 `#app` 用 `display: contents` 不参与布局。
- **样式**：不用 Tailwind；本前端只有两条胶水（`App.svelte` 的 `:global(#app)`、`ListMore.svelte` 的居中），只用刻度令牌。时笺字体用 `@fontsource` 自托管。
- **测试钩子**：所有关键元素带 `spec/ui/testids.md` 规定的 `data-testid` 与状态属性；长按封缄可用键盘空格按住完成，完成由定时器驱动（后台标签页不会卡住）。
- **存储策略**：access token 在内存，refresh token 与 user 在 `localStorage`，`main.ts` 在挂载前恢复；XSS 权衡见 `docs/02-design.md §7.2`。
- **收藏与创建入口**：2.0 起任何胶囊都能收藏；乐观更新、失败回滚；匿名用户点收藏或任一「创建」入口（首页、导航、底栏、空状态、详情页）都先弹确认框，再带 `?redirect=` 去登录。

## Svelte 的写法（与 React 参考实现对照）

| 关注点 | React 参考 | 本实现 |
|---|---|---|
| 页面逻辑 | 自定义 Hook，每套视图各调一次 | `.svelte.ts` 里的状态类（`$state` 字段 + 箭头函数方法），路由页创建一份、`createContext` 交给两套视图 |
| 全局状态 | Zustand | `.svelte.ts` 模块单例（class + `$state`）；草稿「换账号清空」是模块级 `$effect.root` |
| 表单跨皮肤保留、离开清空 | 内存 store + 卸载时看地址栏 | 状态的生命周期就是路由页的生命周期，不需要额外判断 |
| 写入时顺手清错误 | `set` 函数 | 类的 getter / setter，视图里直接 `bind:value={f.title}` |
| 把输入接到 store 的动作 | `onChange={(e) => setQ(e.target.value)}` | 函数绑定 `bind:value={() => plaza.qInput, (v) => plaza.typeQ(v)}` |
| 外部数据驱动的本地状态 | `useState` + `useEffect` 同步 | 可写的 `$derived`（收藏按钮的 on / count、日历当前月、时分输入框） |
| 路由守卫 | `<AuthGate>`、`useGuestRedirect` | `<AuthGate>` / `<GuestOnly>` 包住路由内容；跳转用 `lib/nav` 的 `redirect()`（等 Router 挂好再 `navigate`） |
| 站内链接 | `<Link>` | 普通 `<a href>`，由挂在 `body` 上的 svelte-routing `links` 统一接管 |
| 换账号重建页面状态 | `key={user.id}` | `{#key authStore.user.id}`（AuthGate 内）；详情页 `{#key params.code}` |
| 全局整秒节拍 | 模块级订阅 + `useSyncExternalStore` | `createSubscriber`：有人读 `clock.now` 才走表，没人读就停 |
| 字段尾部小部件 | `trail` prop 传 ReactNode | `trail` 片段（`{#snippet trail()}…{/snippet}`） |
| 复用的小行为 | 各处 `useEffect` / `useLayoutEffect` | 附件 `{@attach …}`：`slider`、`slashFocus`、`countUp`、`portal`、`autofocus`、星空画布启停 |
| 重建节点重播动画 | `key` | `{#key}` 块；`{#each … (key)}` 的键 |
| SVG 内的唯一 id | `useId()` | `$props.id()` |
| 确认框正文 | ReactNode | 「组件 + props」，`DialogHost` 里当动态组件渲染（用户文字走插值转义） |
| 子组件暴露方法 | `useImperativeHandle` | 组件里 `export function set()` / `reset()`，父组件 `bind:this` 调用 |

## 验证

- 单元测试：`./test`（时间说法、日历年上限、专属色、登录回跳、账号校验规则、refresh 单飞与重放、草稿随账号清空、注册昵称错误的映射）
- UI 冒烟：44 条 × 两套皮肤 = 88 条
- 设计令牌：`./verification/scripts/verify-design-tokens.sh svelte`

## 2.0 验证

2026-11-21 完成 Svelte 复核修复，覆盖封存时间、Unicode 字数、会话回写、详情收藏、个人列表、广场搜索、8 格输码及复制反馈。修复后以 Svelte 模板、TypeScript 和 Git 差异检查验证，新增的会话竞态用例留待运行验证。

下表为 2.0 升级当时的运行记录。

| 项目 | 结果 | 数据库 | 日期 |
|---|---|---|---|
| UI 冒烟（`verify-ui-smoke.sh svelte`，paper 44 + amber 44） | ✅ 88/88 | PostgreSQL | 2026-11-21 |
| UI 冒烟（fastapi 以 `DB_DRIVER=sqlite` 重启后再跑，`/health` 确认为 SQLite，跑完已恢复 PostgreSQL） | ✅ 88/88 | SQLite | 2026-11-21 |
| 设计令牌（`verify-design-tokens.sh svelte`，扫描 3 个样式文件） | ✅ 通过 | — | 2026-11-21 |
| `./build`（`svelte-check` 0 错误 0 警告 + `vite build`） | ✅ 通过 | — | 2026-11-21 |
| `./test`（vitest，4 个文件） | ✅ 24/24 | — | 2026-11-21 |

PostgreSQL 第一轮是 87/88（迁移笔记第 4 条），修复后重跑通过。另用 Playwright 在 1280×800 下看过两套皮肤、明暗的首页、开启、详情、创建、登录、注册、我的三个页签、关于、404，匿名与已登录各一遍：控制台只有查询不存在的胶囊时接口返回的 404，没有其他错误或警告。

## 2.0 迁移笔记

清单（`docs/05-upgrade-2.0.md` §2）之外，这次在 Svelte 上踩到的：

1. **首屏守卫跳转只改了地址栏**：svelte-routing 的 `Router` 在自己的 `onMount` 里才开始监听 history，而子组件的 `$effect` / `onMount` 先于父组件运行。直接打开 `/create`、`/me`，或已登录打开 `/login` 时立刻 `navigate()`，URL 变了，页面却停在原地（主体空白）。冒烟只断言 URL，所以测不出来。守卫类跳转统一走 `lib/nav` 的 `redirect()`：先 `await tick()` 再 `navigate(…, { replace: true })`。
2. **`<Route component={…}>` 不能用**：svelte-routing 判断传进来的不是 class 就当作懒加载函数调用 `c()`，而 Svelte 5 组件本身就是函数。改用插槽写法 `<Route path="…" let:params>…</Route>`，顺带可以在里面加 `{#key params.code}`、`<AuthGate>`。路由仍然平铺在同一个 `Router` 下，不要嵌套。
3. **vitest 解析不到 svelte-routing**：它的 `exports` 只声明了 `svelte` 条件。`vitest.config.ts` 里加 `resolve.conditions: ["svelte", "browser"]`。
4. **琥珀输码框：换皮肤后立刻整码 fill，新码接在了旧码后面**（冒烟「开启页换肤保留半截胶囊码」）：Playwright 的 fill 先 `select()` 再 `focus()`，但 Chrome 对没有焦点的输入框，`select()` 不生效。其他实现靠 350ms 后的自动聚焦先发生而过关；Svelte 换皮肤是同步的，测试步骤快于 350ms，就输了这场竞争。改成与时笺一样「一次进来一整串 8 位码就从头填」（看 `InputEvent.data`），不再依赖时序。
5. **名为 `state` 的 prop 撞上 `$state` rune**：编译器会把 `$state` 当成对 `state` 的 store 订阅。解构时改名：`let { state: codeState } = $props()`。
6. **`$props.id()` 只能作为顶层变量的初始化表达式**：`const uid = $props.id(); const id = \`pm-${uid}\``，不能直接写进模板字符串。
7. **`$effect` 会在挂载时先跑一次，Vue 的 `watch` 不会**：「出错次数加一就抖一下」「校验失败就滚到出错字段」如果不跳过初值，换皮肤时新视图一挂载就会抖、会滚。这几处记住上一次的值，只在变化时动作。
8. **只想取初值的 prop**：输码格从 `value` 初始化、详情页的 `code`（外面已按 code 加 `{#key}`）都只需要初值，直接读会报 `state_referenced_locally`，用 `untrack(() => …)` 表明意图。
9. **portal 附件**：把元素挪到 `<body>` 之后，Svelte 卸载块时是沿兄弟节点从起点删到终点的，所以只用在块里单根的元素上（封缄仪式层），附件的清理函数里再 `el.remove()`。
10. **没有 `<script>` 的纯标记组件**：被 TS 导入时 `svelte-check` 报隐式 any，补一个空的 `<script lang="ts">`。
11. **`noroute` 属性**：svelte-routing 的 `links` 会接管所有站内 `<a>`，「跳到正文」的 `href="#view"` 要带 `noroute`；它不在 `svelte/elements` 的类型里，用 `src/svelte-elements.d.ts` 扩充 `HTMLAnchorAttributes`。
12. **`/me` 重复请求**：启动时的登录态校验和 `AuthGate` 会同时要 `/me`，`authStore.refreshMe()` 做成单飞。
13. **`hello status` 显示的 `DB_DRIVER` 是保存的默认值**：SQLite 那轮以 `/api/v1/health` 的技术栈出现 SQLite 为准。
