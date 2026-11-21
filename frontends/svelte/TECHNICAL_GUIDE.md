# HelloTime Pro Svelte 5 前端技术手册与代码导读

本文面向已经熟悉 HTML / CSS / JavaScript 基本语法，但还没系统接触过 Svelte、TypeScript、单页应用（SPA）这套现代前端栈的读者。读完后，你应该能回答三件事：

- 用户在浏览器输入 URL 后，代码按什么顺序执行。
- Svelte 5 的 Runes、组件、context、附件、svelte-routing 与 spec/styles 分别在做什么。
- 想新增一个页面、状态或接口调用时，应该改哪些文件。

> 阅读建议：第 1 节介绍技术栈与设计特色；第 2～4 节建立整体地图与入口链路；第 5 节集中讲 Svelte 5 的核心概念（Runes、模板语法、片段、附件）；第 6 节是本项目最有 Svelte 味的部分——用「状态类 + context」实现「逻辑一份、视图按皮肤分」；第 7～13 节按一次「打开页面」的生命周期分层细讲；第 14～17 节是样式、测试、常见改动与框架对照。
> 同一个应用的 React 版本在 `frontends/react-ts`、Vue 版本在 `frontends/vue3-ts`、Angular 版本在 `frontends/angular`，对照着读，最能看出几个框架各自的思路。

## 1. 技术选型与设计特色

本前端基于 **Svelte 5**（Runes）+ **TypeScript**，构建用 **Vite 6**，路由用 **svelte-routing**，样式原样引入 `spec/styles` 的两套皮肤（2.0）。没有额外的状态管理库。

* **Svelte（编译器框架）**：`.svelte` 文件在构建期被编译成直接操作 DOM 的 JavaScript，运行时很小，没有虚拟 DOM。模板里读到的响应式值变了，编译器生成的代码只更新用到它的那个文本节点或属性。
* **Runes（显式的响应式）**：Svelte 5 用 `$state`、`$derived`、`$effect`、`$props` 这几个「符文」声明响应式。它们不只能写在组件里，也能写在 `.svelte.ts` 模块和 class 字段里——所以全局 store 和页面逻辑都是普通的 TypeScript class，不需要 Pinia / Zustand 这类库。
* **context**：Svelte 的「依赖注入」。父组件 `setContext`，子孙组件 `getContext`；`createContext<T>()` 直接给出一对带类型的 get / set。本前端用它把「路由页持有的状态」交给两套皮肤的视图（§6）。
* **附件（attachments）**：`{@attach fn}` 在元素挂上后运行 `fn(element)`，`fn` 里读到的响应式值变了就先清理再重跑。React 里散落各处的 `useEffect(() => { …el… })`，在这里收拢成一个个小函数（§11）。
* **svelte-routing**：一个轻量的声明式路由。`<Router>` 里平铺若干 `<Route path>`，`navigate()` 编程式跳转，`links` 动作接管页面里的 `<a>`。
* **双皮肤与设计令牌（2.0）**：「时笺」「琥珀」两套皮肤 × 明暗，全部样式来自 `spec/styles`（每条规则按 `:root[data-skin]` 限定，两套同时加载）。本前端几乎不写样式，只按 2.0 原型写出相同的 DOM 结构与类名；切换皮肤 / 明暗只改 `<html>` 上的两个属性。

## 2. 先建立整体地图

HelloTime Pro 是一个时间胶囊应用。这个前端的职责是：

- 渲染所有页面（首页广场 / 开启 / 详情 / 创建 / 我的 / 登录 / 注册 / 关于 / 404），每个页面都有「时笺」「琥珀」两套视图。
- 调用后端 `/api/v1/*`（经 `:9080` 反代），把 JSON 画成卡片、表单、详情；2.0 新增 `/plaza/stats`、`/me/stats`。
- 维护客户端状态：登录态、皮肤与明暗、广场查询条件、创建页草稿、各页面的表单。
- 守卫需要登录的路由（`/create`、`/me/*`），未登录跳 `/login?redirect=…`；access token 过期自动刷新并重放。

```
src/
├── main.ts / App.svelte   入口：恢复登录态、挂载；总布局与路由表
├── stores/      全局 .svelte.ts 单例：auth · ui · plaza · draft · feedback · clock · health
├── state/       页面状态类 + 它们的 context（CodeOpen、CapsuleState、CreateForm、LoginForm…）
├── pages/       路由页：创建本页状态、放进 context、按皮肤渲染视图；AuthGate 之外的守卫
├── components/  两套皮肤结构相同的部件
├── skins/       paper/ 与 amber/：两套视图
├── api/ · types/   接口客户端与类型
└── lib/         纯函数工具 + 附件（attach.ts）+ 抖一下（motion.svelte.ts）
```

一次「打开首页」的数据流：svelte-routing 匹配到 `<Route path="/">` → 渲染 `pages/PlazaPage.svelte` → 它调用 `provideCodeOpen()`（创建输码状态放进 context）和 `plazaHome()`（登记「进入时刷新」的 effect）→ 按 `ui.skin` 渲染 `AmberHomePage` → effect 调 `plaza.refreshAll()` → `api` 发请求 → `plaza` 单例的 `$state` 字段被赋值 → 读了这些字段的模板自动更新。换成时笺时，只有视图换成 `PaperHomePage`，它从 context 取到的仍是同一个 `CodeOpen`。

## 3. 如何运行和验证

```bash
cd frontends/svelte
./run                          # Vite dev server，端口 7176
./build                        # svelte-check（类型 + 模板）→ vite build 到 dist/
./test                         # vitest：纯函数、API 客户端、store 与页面状态类
```

`vite.config.ts` 把 `/api` 与 `/static` 代理到 `BACKEND_PROXY`（默认 `http://localhost:9080`）。也可以在仓库根目录用 `./scripts/hello start svelte`。

```bash
./verification/scripts/verify-ui-smoke.sh svelte        # UI 冒烟：44 条 × 两套皮肤
./verification/scripts/verify-design-tokens.sh svelte   # 自己的样式只用语义令牌
```

`svelte.config.js` 只配了 `vitePreprocess`，**没有**全局开 `runes: true`：本项目的 `.svelte` 文件都用了 Runes，编译器会按文件自动进入 Runes 模式；而 svelte-routing 自带的旧式组件仍要以兼容模式编译。

## 4. 入口链路：`index.html` → `main.ts` → `App.svelte`

### 4.1 `index.html`

只有一个 `<div id="app">` 和一段内联脚本：在第一帧画出来之前，从 `localStorage` 读出 `hellotime.skin` / `hellotime.theme`，写到 `<html data-skin data-theme>` 上，并同步地址栏颜色（`<meta name="theme-color">`）。这样刷新页面不会先闪一下另一套皮肤。

### 4.2 `main.ts`

```ts
authStore.hydrate();   // 登录态在挂载之前从 localStorage 恢复：守卫第一帧就能拿到 user
wireAuthApi();         // 把 auth store 注入到 api client（refresh 单飞、401 重放）
mount(App, { target: document.getElementById("app")! });
```

注意导入写的是 `./stores/auth.svelte.ts`——带 `.ts` 后缀（§9.4）。

### 4.3 `App.svelte`：总布局与路由表

```svelte
<PaperFilters />            <!-- 时笺的油墨毛边 SVG 滤镜 -->
<AmberBackdrop />           <!-- 琥珀的光晕与星空画布（时笺下由 shell.css 隐藏） -->
<a class="skip" href="#view" noroute>跳到正文</a>
<Router>
  <RouteMeta />             <!-- body[data-route] 与页面标题 -->
  {#if paper}<PaperHeader />{:else}<AmberHeader />{/if}
  <main id="view" tabindex="-1">
    <Route path="/"><PlazaPage /></Route>
    <Route path="/create"><AuthGate><CreatePage /></AuthGate></Route>
    <Route path="/capsules/:code" let:params>
      {#key params.code}<CapsulePage code={params.code} />{/key}
    </Route>
    …
    <Route><NotFoundPage /></Route>   <!-- 没有 path：兜底 -->
  </main>
  {#if paper}<PaperFooter />{:else}<AmberFooter />{/if}
  {#if paper}<PaperTabBar />{:else}<AmberTabBar />{/if}
</Router>
<ToastHost />
<DialogHost />
```

外壳的 DOM 约定照 2.0 原型：`header.hdr / main#view / footer.ftr / nav.tabbar` 是 `body` 的直接子项（皮肤样式里 `body` 是纵向 flex）。挂载点 `#app` 用 `:global(#app) { display: contents }` 不参与布局——这是本前端仅有的两条样式胶水之一。

`App.svelte` 里还有两件事：`$effect(() => links(document.body).destroy)` 让 svelte-routing 接管整页的站内链接（包括挂到 `body` 下的仪式层与确认框）；有 refresh token 时调一次 `authStore.refreshMe()` 确认登录态。

## 5. Svelte 5 的核心概念：Runes

### 5.1 `$state`：响应式状态

```ts
let open = $state(false);          // 组件里的局部状态
open = true;                       // 直接赋值就会触发更新
```

对象和数组会被包成深层代理，改 `errors.email = "…"`、`toasts.push(…)` 都能被追踪。不需要深层追踪、整体替换的数据（列表、接口返回的对象）用 `$state.raw`，更省。

`$state` 也能当 class 字段（本项目的 store 与页面状态都这么写）：

```ts
class PlazaStore {
  sort = $state<PlazaSort>("new");
  items = $state.raw<CapsuleListItem[]>([]);
  setSort(v: PlazaSort) { this.sort = v; this.page = 1; void this.fetchList(); }
}
export const plaza = new PlazaStore();
```

### 5.2 `$derived`：推导值

```ts
const opened = $derived(c.isOpened || ms(c.openAt) <= now);
const days = $derived.by(() => { … return list; });   // 多行计算用 .by
```

推导值是惰性的、有缓存的；依赖不变就不重算。Svelte 5 的推导值还**可写**：赋值会临时覆盖它，依赖一变又回到推导结果。这正好对应「外部数据驱动、本地可以改」的状态：

```ts
let on = $derived(capsule.favoritedByMe);   // 列表刷新了就跟上
on = !on;                                    // 点击时就地改写（乐观更新）
```

收藏按钮的 on / count、日历正在看的月份、时分输入框都这么写。

### 5.3 `$effect`：副作用

```ts
$effect(() => {
  if (!open) return;
  document.addEventListener("click", onDoc);
  return () => document.removeEventListener("click", onDoc);   // 清理：重跑前、销毁时
});
```

effect 在 DOM 更新之后运行，读到的响应式值变了就重跑。两个要点：

- **挂载时会先跑一次**（Vue 的 `watch` 默认不会）。「出错次数加一就抖一下」这类逻辑要记住上一次的值，只在变化时动作，否则换皮肤时新视图一挂载就会抖。
- **不想被追踪的读取**包进 `untrack(() => …)`。比如进入首页时刷新广场：只想跟着 `user.id` 变，不想因为 `refreshAll()` 内部读了别的状态而被反复触发。

在 class 构造函数里也能写 `$effect`——前提是这个实例在组件初始化期间创建，effect 就挂在那个组件上、随它销毁。`$effect(() => () => gen++)` 是「组件销毁时作废进行中的请求」的惯用写法。脱离组件的模块级 effect 用 `$effect.root`（§9.3）。

### 5.4 `$props` 与 `$bindable`

```ts
let { value = $bindable(""), label, error, trail }: Props = $props();
```

- 解构就是声明 prop，默认值写在解构里；`...rest` 收集剩下的属性（`CreateLink` 把 `class`、`data-testid` 原样放到 `<a>` 上）。
- `$bindable` 让父组件可以 `bind:value={f.email}` 双向绑定。
- 事件就是函数 prop：`onchange`、`oncomplete`，调用方写 `oncomplete={o.go}`。
- 名字叫 `state` 的 prop 要改名解构（`state: codeState`），否则和 `$state` 冲突（编译器会把 `$state` 当成对 `state` 的 store 订阅）。
- `$props.id()` 生成在本组件实例里唯一的 id，SVG 的渐变、`textPath` 用它防撞。

### 5.5 模板语法

```svelte
<div class={["field", { "is-error": error }, shake.on && "is-shake"]} style:--i={i}>
  {#if ui.skin === "paper"} … {:else} … {/if}
  {#each list.items as c, i (c.id)} <PaperCard {c} {i} /> {/each}
  {#each { length: 6 }, i (i)} <PaperCardSkeleton {i} /> {/each}
  {#key pop} <button class="fav is-pop">…</button> {/key}     <!-- pop 变了就重建，动画重播 -->
  {@const r = row(c)}                                          <!-- 块内局部常量 -->
  {@html ICONS[name]}                                          <!-- 仅用于构建期常量 -->
</div>
```

- `class` 接受数组和对象，不必手拼字符串；`style:--x={v}` 写 CSS 变量。
- 事件写成属性：`onclick={…}`、`onsubmit={…}`（表单要自己 `e.preventDefault()`）。
- `bind:value` 可以绑到对象属性（`bind:value={f.title}` 调用 class 的 setter），也可以写成**函数绑定** `bind:value={() => plaza.qInput, (v) => plaza.typeQ(v)}`——读写分别走两个函数，正好把输入框接到 store 的动作上。
- `bind:this={el}` 拿 DOM 元素，也能拿子组件实例（调用它 `export` 的函数，如输码框的 `set()`、长按封缄的 `reset()`）。

### 5.6 片段（snippet）

片段是模板里可传递的一段标记，取代了旧的插槽：

```svelte
<FormField id="p-nick" bind:value={p.nickname} label="昵称">
  {#snippet trail()}<NickState state={p.nick} />{/snippet}
</FormField>
```

`FormField` 里 `{@render trail?.()}`。组件标签之间的内容就是名为 `children` 的片段（`AuthGate`、`AmberBadge`、`PaperEnvelope` 都用它）。

## 6. 本项目的核心：用「状态类 + context」实现「逻辑一份、视图按皮肤分」

两套皮肤的同一个页面长得完全不同，但逻辑必须只有一份；切换皮肤时，正在填的表单、错误提示、已输入的胶囊码都不能丢（`spec/ui/testids.md` X5）。React 用「Hook + 全局 store」，Vue 用「组合式函数 + provide / inject」，Angular 用「组件级 provider」；Svelte 的写法是**页面状态类 + context**：

```ts
// state/account.svelte.ts —— 页面状态
export class LoginForm {
  email = $state("");
  password = $state("");
  errors = $state<Errors>({});
  busy = $state(false);
  readonly redirect = redirectParam();
  submit = async () => { … };          // 箭头函数：当回调传出去时 this 不丢
}
const [getLogin, setLogin] = createContext<LoginForm>();
export const provideLogin = () => setLogin(new LoginForm());
export const useLogin = getLogin;
```

```svelte
<!-- pages/LoginPage.svelte —— 路由页 -->
<script lang="ts">
  provideLogin();
</script>
{#if ui.skin === "paper"}<PaperLoginPage />{:else}<AmberLoginPage />{/if}

<!-- skins/paper/PaperLoginPage.svelte —— 视图 -->
<script lang="ts">
  const f = useLogin();
</script>
<FormField id="email" bind:value={f.email} error={f.errors.email} testId="login-email" />
```

于是：

- **切换皮肤**：只有 `{#if}` 的两个分支在换，路由页不动，`LoginForm` 还是那个实例——表单值原样还在。
- **离开页面**：路由换走路由页，实例随之丢弃，表单自然清空；实例里的 `$effect` 也跟着销毁（作废进行中的请求、停止 AI 打字）。
- **跨页面要留的东西**放在全局单例：登录态（`authStore`）、广场筛选（`plaza`）、创建页草稿（`draft`，离开再回来接着写）。

| 路由页 | 放进 context 的状态 | 谁在用 |
|---|---|---|
| `PlazaPage` | `CodeOpen`（另调用 `plazaHome()`） | 首页两套视图里的就地输码 |
| `OpenPage` | `CodeOpen` | 开启页两套视图（已输入的码切皮肤也不丢） |
| `CapsulePage` | `CapsuleState`（App 按 `code` 加了 `{#key}`） | 详情页两套视图 |
| `CreatePage` | `CreateForm`（外层 AuthGate 按 `user.id` 加了 `{#key}`） | 创建页两套视图 |
| `LoginPage` / `RegisterPage` | `LoginForm` / `RegisterForm` | 登录 / 注册两套视图 |
| `MePage` | `MeState` 包含页签、统计、资料表单和两份个人列表 | 「我的」两套视图及其页签 |

`MePage` 在三个页签之间切换时不重建（同一条路由、参数不同），所以 `ProfileForm` 一直活着；它用一个 effect 盯着 `tab`，离开「账号设置」就把资料改回当前值、清空密码框。进入列表页签时请求第一页。两套皮肤从同一路由取得列表，删除或取消收藏在换肤后仍作用于当前列表。加载失败时由视图显示重试入口。

## 7. 路由层：svelte-routing

### 7.1 路由表

全部 `<Route>` 平铺在同一个 `<Router>` 下（**不要嵌套**，嵌套的 Router 会让匹配与 effect 互相触发）。svelte-routing 按「静态段 > 动态段 > 通配」打分挑最匹配的一条，所以 `/me/:tab` 与 `/me/*` 可以共存。

路由内容用插槽写法：`<Route path="/capsules/:code" let:params>…</Route>`。`component={…}` 属性不能用——它会把不是 class 的值当作懒加载函数去调用，而 Svelte 5 组件本身就是函数。

### 7.2 链接

组件里直接写 `<a href="/open">`。`App.svelte` 把 `links` 挂在 `body` 上：同源、没有 `target`、没有 `noroute` 属性、没被 `preventDefault` 的点击，都改成 `navigate()`。所以：

- 需要拦截的链接（匿名点「创建」先确认）在自己的 `onclick` 里 `preventDefault()`——Svelte 的事件委托在 `#app` 上，比 `body` 上的 `links` 先执行（`CreateLink.svelte`）。
- 卡片上的收藏按钮在链接之上，点击时 `preventDefault` + `stopPropagation`。
- 「跳到正文」`href="#view"` 带 `noroute`，留给浏览器处理（类型扩充见 `src/svelte-elements.d.ts`）。

### 7.3 守卫

```svelte
<!-- components/AuthGate.svelte -->
<script lang="ts">
  const needCheck = !authStore.user && !!authStore.refreshToken;
  let checking = $state(needCheck);
  if (needCheck) void authStore.refreshMe().finally(() => (checking = false));   // 只剩 refresh token：先换回 user
  $effect(() => {
    if (!checking && !authStore.user) redirect(loginPath(location.pathname + location.search));
  });
</script>
{#if authStore.user}{#key authStore.user.id}{@render children()}{/key}{/if}
```

- 登录态中途丢了（refresh 失败、在别处登出）时 effect 重跑，同样会跳去登录。
- `{#key authStore.user.id}`：换了账号就重建里面的页面状态（创建表单、资料表单）。
- `GuestOnly` 只在进入时判断一次：已登录访问 `/login`、`/register` 直接去 `?redirect=`（或首页）。在本页登录成功后由表单自己跳转，不能让守卫抢先。
- `loginPath()` 用 `encodeURIComponent` 生成 `/login?redirect=%2Fcreate`；`navigate()` 原样写进地址栏。

**守卫类跳转要等 Router 挂好**：`Router` 在自己的 `onMount` 里才开始监听 history，而子组件的 effect / `onMount` 比父组件先运行。首屏直接打开受保护页面时，如果在子组件里立刻 `navigate()`，地址栏变了，页面却不跟着变。所以守卫、`/me` 补全、无效页签都调用 `lib/nav` 的 `redirect()`：

```ts
export function redirect(to: string) {
  void tick().then(() => navigate(to, { replace: true }));
}
```

### 7.4 标题、`data-route` 与回顶

`pages/RouteMeta.svelte` 用 `useLocation()`（一个 store，`$location` 自动订阅）在每次换页时写 `body[data-route]` 与 `document.title`；详情页的标题等胶囊取回来后由 `CapsuleState` 写。svelte-routing 每次激活路由都会 `scrollTo(0, 0)`，换页回顶不用另外处理。

## 8. 数据层：`api/client.ts`

与 React 版逐字对齐：

- `request<T>(path, opts)`：`fetch` + 统一响应解包（`{ success, data, message, errorCode, details }`），失败抛 `ApiError`（带 `status`、`errorCode`、字段错误 `details`）。
- 401 时自动用 refresh token 换新 token 再重放一次；`refreshing` 是一个共享的 Promise——同时有多个请求 401 时只刷新一次（单飞）。
- 与 store 解耦：客户端不 import store，而是由 `wireAuthApi()` 调用 `configureApi({ getAccessToken, getRefreshToken, onTokensRefreshed, onAuthLost })` 注入回调，避免循环依赖。

## 9. 状态层：`.svelte.ts` 单例

### 9.1 class 单例

`stores/*.svelte.ts` 每个文件导出一个 class 实例。字段是 `$state`，方法直接改字段；组件里 `import { plaza } from "@/stores/plaza.svelte.ts"`，在模板里读 `plaza.items` 就自动订阅。

| store | 内容 |
|---|---|
| `auth` | user、access / refresh token；`hydrate`、`setTokens`、`logout`、`refreshMe`（在同一登录会话内复用请求） |
| `ui` | 皮肤与明暗；`setSkin` / `toggleTheme` 用 View Transition，回调里改完状态 `await tick()` |
| `plaza` | 排序、筛选、搜索词（`qInput` 防抖 300ms 后写进 `q`）、页码、列表、数量、年鉴、精选 |
| `draft` | 创建页草稿；`patch()` 每次把 `revision` 加一，`reset()` |
| `feedback` | toast 队列与确认框；`copyText`、`share.code / share.link` |
| `clock` | 整秒节拍 `clock.now` |
| `health` | `/health`，页脚与关于页共用，只请求一次 |

`plaza` 保存搜索防抖计时器，换肤后尚未提交的输入仍会生效。新查询开始时清理上一查询的列表及分页，关键词变化时也清理筛选计数。请求失败时保留重试入口，计数请求失败时隐藏计数。

### 9.2 `createSubscriber`：有人用才走表

```ts
class Clock {
  #now = Date.now();
  #subscribe = createSubscriber((update) => {
    let timer = 0;
    const loop = () => { timer = setTimeout(() => { this.#now = Date.now(); update(); loop(); }, 1000 - (Date.now() % 1000) + 4); };
    loop();
    return () => clearTimeout(timer);      // 最后一个读者离开时调用
  });
  get now() { this.#subscribe(); return this.#now; }
}
```

页面上十几个倒计时读同一个 `clock.now`，对齐到整秒一起跳；离开有倒计时的页面，定时器自动停。

### 9.3 `$effect.root`：store 之间的联动

草稿属于写它的人：登出、换账号时清空。这是两个全局单例之间的关系，不属于任何组件，所以在 `draft.svelte.ts` 的模块顶层用 `$effect.root` 建一个常驻的 effect：

```ts
$effect.root(() => {
  let prev = untrack(() => authStore.user?.id);
  $effect(() => {
    const id = authStore.user?.id;
    untrack(() => { if (prev && id !== prev) draft.reset(); prev = id; });
  });
});
```

### 9.4 ⚠️ `.svelte.ts` 必须带 `.ts` 后缀导入

`import { authStore } from "@/stores/auth.svelte"` 与 `"@/stores/auth.svelte.ts"` 会被 Vite 当成两个不同的模块 id，单例就变成了两个实例（一处登录、另一处看不到）。全项目统一写 `.svelte.ts`（`tsconfig` 打开了 `allowImportingTsExtensions`）。

### 9.5 并发请求的「序列号」模式

```ts
async fetchList() {
  const my = ++this.#listSeq;
  const data = await api.plaza(…);
  if (my !== this.#listSeq) return;     // 期间又发了新请求：这次的结果作废
  this.items = data.items;
}
```

广场列表与数量、AI 推荐、输码查询（`generation` + `pending`）、「我的」列表（删除时把 `seq` 加一，作废进行中的「加载更多」）都用这个模式。

## 10. 页面逻辑层：`state/*.svelte.ts`

| 文件 | 做什么 | 值得看的写法 |
|---|---|---|
| `code-open.svelte.ts` | 凭码开启 | 输满 8 位自动查询；`input()` 作废旧查询；`pending === code` 防重复；构造函数里 `$effect(() => () => gen++)` 离页作废 |
| `capsule.svelte.ts` | 取数、`expired`、`awaitOpened(signal)` | `expired` 是读 `clock.now` 的 `$derived`；登录态变了重取（`favoritedByMe` 会变） |
| `create-form.svelte.ts` | 草稿字段、校验、AI 推荐与代笔、封存 | 字段是 getter / setter：写入时清错误、打断 AI 打字；提交前记下 `revision`，成功后草稿没再改过才清空 |
| `account.svelte.ts` | 登录、注册、资料、改密码、「我的」列表 | 字段错误映射：409 才标昵称「已被占用」；请求途中改了昵称就不再标；`MyList.loadMore` 按已显示条数推算下一页并按 id 去重 |
| `plaza-home.svelte.ts` | 首页刷新、到点刷新、热度榜、页码 | `due` 是 `$derived`，变真时 effect 刷新整页 |

### 10.1 详情页：倒数归零 → 等服务端确认

```ts
awaitOpened = async (signal: AbortSignal) => {
  const my = this.#gen;
  for (let i = 0; my === this.#gen && !signal.aborted; i++) {
    try {
      const d = await api.capsuleByCode(this.code);
      if (my !== this.#gen || signal.aborted) return null;
      if (d.isOpened) { this.capsule = d; return d; }
    } catch (e) {
      if (my !== this.#gen || signal.aborted) return null;
      if (e instanceof ApiError && e.status === 404) { this.status = "missing"; return null; }
    }
    await sleep(Math.min(1000 * (i + 1), 5000));
  }
  return null;
};
```

本机时钟可能比服务端快几秒，接口仍返回未开启——隔一会儿再问（1s、2s…最多 5s 一次）。开启动画归视图所有：视图在 `expired` 变真时创建 `AbortController` 播动画，`$effect(() => () => task?.abort())` 保证换皮肤、离开页面时取消。只有服务端确认 `isOpened` 后才换成信笺。加载失败显示「暂时无法加载」与重试按钮，404 显示 `detail-not-found`。

## 11. 附件与小工具：可复用的小行为

`lib/attach.ts` 里的附件（`{@attach …}`）：

| 附件 | 用在 | 做什么 |
|---|---|---|
| `slider(item, thumb, deps, hideWhenNone)` | 分段控件、「我的」页签、琥珀顶栏 | 量出当前项的位置，让滑块对齐过去；第一次不带过渡；`deps()` 里读到的值变了就重量，窗口尺寸变化、字体晚到也重量 |
| `slashFocus` | 广场搜索框 | 按 `/` 聚焦 |
| `countUp(to, from, format)` | 时笺年鉴 | 进入视口时从 from 数到 to，直接写元素文字；减少动效时直接显示终值 |
| `portal` | 时笺封缄仪式 | 把元素挪到 `<body>` 下（不受 `#view` 层叠上下文限制）；只用在块里单根的元素上 |
| `autofocus(delay)` | 表单首个字段、创建页标题 | 等入场动画再聚焦，不抢用户已经聚焦的控件 |
| 行内附件 | 琥珀星空画布 | `{@attach (c) => ui.skin === "amber" ? startSky(c, ui.theme !== "light") : undefined}`：换皮肤 / 明暗先停掉上一轮再重画 |

`lib/motion.svelte.ts` 的 `useShake(() => source)`：值变了就亮 480ms，视图加 `is-shake`（挂载时的初值不算）。

清空琥珀的日期时间控件会让共享草稿进入待选状态。两套皮肤都要求重新选定完整时刻才能封存。标题和正文按 Unicode 码点计数及校验，超限时在原字段提示。详情收藏成功后，回调同步更新路由持有的胶囊，换肤和启封后的视图继续使用最新状态。复制操作根据 Clipboard API 或兼容复制的实际结果提示用户。

## 12. 视图层：皮肤与组件

### 12.1 一个页面的三层

```
pages/CreatePage.svelte          provideCreateForm()，按皮肤二选一
  ├── skins/paper/PaperCreatePage.svelte    useCreateForm()：信笺 + 封缄台 + 长按封缄 + 封缄仪式
  └── skins/amber/AmberCreatePage.svelte    useCreateForm()：表单卡 + 实时预览 + 封存回执
```

视图只管长相：结构与类名照 2.0 原型（`2.0版原型byClaude-合集/<skin>/view-*.js`），数据与动作都来自 context 里的状态。Svelte 组件不产生宿主元素，模板里写什么，DOM 就是什么——原型的选择器（`.almanac__cell + .almanac__cell`、`.code__cell:nth-child(n)`）原样生效。

### 12.2 表单字段：`$bindable` + 片段

`FormField.svelte` 一份逻辑、两种外框（时笺是下划线信笺栏，琥珀是带图标的输入框）。值 `bind:value`，右侧小部件走 `trail` 片段，出错时自带 `field-error` 测试钩子并抖一下。`PasswordField` 包一层，`trail` 里放明文 / 密文切换的眼睛。

### 12.3 确认框：组件 + props

`confirmDialog({ title, body, mark, … })` 返回一个 Promise。`body` 是纯文本或 `{ component, props }`，`mark` 是 `{ component, props }`（时笺盖一枚朱文印，琥珀放一枚胶囊插画）。`DialogHost` 把它们当动态组件渲染：`<d.body.component {...d.body.props} />`。用户写的标题、胶囊码走插值，照常转义，不需要 `{@html}`。

### 12.4 输码框

- 时笺：8 个真实输入框（四四分组）。粘贴、自动填充或一次填入整码会分发到各格；格子由路由状态的 `value` 派生。输入值保留中间空位，换肤后字符仍在原来的格子，全部填满才自动查询。
- 琥珀：8 个展示格 + 一个盖在上面的透明原生输入框（键盘、粘贴、输入法都交给它）。整码粘贴从第一格覆盖，局部编辑时原生输入框用不换行空格表示中间空位。胶囊码完整且符合格式后才发起查询。

### 12.5 测试钩子

所有关键元素带 `spec/ui/testids.md` 规定的 `data-testid` 与 `data-state` / `data-value` / `data-count` 等状态属性。新增元素时先查这份清单，不要自己发明。

## 13. 工具层：`lib/`

| 文件 | 内容 |
|---|---|
| `fmt.ts` | 时间与数字的说法（与原型的 `HT.fmt` 一致）、农历、倒计时、等待进度、`reducedMotion`、`focusIfIdle`、`addCalendarYears` |
| `schedule.ts` | 开启时间上下限（≥ 此刻 + 61 秒，≤ 10 个日历年）、预设、校验文案 |
| `account.ts` | 邮箱、昵称（Unicode 字母数字、下划线、连字符，2–20）、密码规则 |
| `avatars.ts` | 构建期用 `import.meta.glob` 内联 `spec/avatars/v2/*.svg` |
| `palette.ts` | 由胶囊码算出专属色（琥珀卡片与插画） |
| `icons.ts` · `about.ts` | 线性图标路径；关于页与页脚的文字和前端技术栈 |
| `redirect.ts` | `safeRedirect`（只接受站内路径）、`loginPath` |
| `nav.ts` | 导航项、`data-route`、页面标题、`redirect()` |

## 14. 样式层：spec/styles

`src/styles/index.css` 引入 `@fontsource` 自托管字体，再按「base → 时笺三件 → 琥珀三件 → shell」的顺序引入 `spec/styles`。本前端只有两条样式胶水，写在用到它们的组件的 `<style>` 里：`App.svelte` 的 `:global(#app) { display: contents }`，`ListMore.svelte` 的「加载更多」居中。令牌检查会扫描 `.css` 文件与 `.svelte` 的 `<style>`：只能引用 `base.css` 刻度与语义令牌，不能写色值。

想改长相：改 `spec/styles/<skin>/*.css`（所有实现一起受益），并在原型里两套皮肤、明暗都看一遍。

## 15. 测试

- 单元测试（vitest + happy-dom，`./test`）：
  - `lib/lib.test.ts`：时间说法、日历年上限（含 2 月 29 日）、专属色确定性、登录回跳
  - `lib/account.test.ts`：邮箱、昵称、密码的校验规则
  - `api/client.test.ts`：refresh 单飞与重放
  - `stores/stores.test.ts`：草稿随登出 / 换账号清空、同一人刷新资料不清、`revision`；注册表单的 409 / 422 映射与「请求途中改了昵称」
  - 测试里用 `flushSync()` 让 effect 立刻跑完；`vitest.config.ts` 用 svelte 插件编译 `.svelte.ts`，并加了 `resolve.conditions: ["svelte", "browser"]`（svelte-routing 只声明了 `svelte` 条件）
- UI 冒烟（Playwright，`verification/ui`）：44 条用例 × 两套皮肤，靠测试钩子定位；`SKINS=paper` 可只跑一套。

## 16. 常见改动指南

- **新增一个页面**：在 `state/` 写状态类与 `createContext`（需要的话）→ 在 `pages/` 写路由页（创建状态、按皮肤 `{#if}`）→ 在 `skins/paper` 与 `skins/amber` 各写一份视图（照原型的结构与类名）→ 在 `App.svelte` 加 `<Route>`（需要登录就包 `<AuthGate>`），在 `lib/nav.ts` 加标题 → 按 `spec/ui/testids.md` 加测试钩子。
- **新增一个接口**：先改 `spec/api/openapi.yaml` → 在 `types/` 加类型 → 在 `api/client.ts` 加方法 → 在状态类或 store 里调用。
- **新增一份要跨皮肤保留的状态**：页面内的放进该页的状态类；要跨页面保留的放进 `stores/` 单例。
- **调整视觉**：改 `spec/styles`，不要在组件里写样式。

## 17. Svelte vs React vs Vue vs Angular 对照

| 概念 | React | Vue | Angular | Svelte |
|---|---|---|---|---|
| 局部状态 | `useState` | `ref` / `reactive` | `signal` | `$state` |
| 推导值 | `useMemo` | `computed` | `computed` | `$derived` |
| 外部驱动、本地可改 | `useState` + `useEffect` | `ref` + `watch` | `linkedSignal` | 可写 `$derived` |
| 副作用 | `useEffect` | `watch` / `watchEffect` | `effect` | `$effect` |
| 双向绑定 | 受控组件 | `v-model` / `defineModel` | `model()` + `[(x)]` | `$bindable` + `bind:` |
| 子树共享 | Context | `provide` / `inject` | 组件级 provider | `createContext` |
| 内容分发 | `children` / props | 插槽 | 内容投影 | 片段 `{#snippet}` / `{@render}` |
| 复用 DOM 行为 | 自定义 Hook + ref | 指令 / 组合式函数 | 指令 | 附件 `{@attach}` |
| 重建子树 | `key` | `:key` | 结构型指令 | `{#key}` |
| 全局状态 | Zustand | Pinia | NgRx Signal Store | `.svelte.ts` class 单例 |

## 18. 学到这里之后

读到这里，你已经掌握了 Svelte 5 应用最常见的 80%：Runes（含 class 字段、可写推导、`$effect.root`、`untrack`）、`$props` 与 `$bindable`、模板控制流与 `{#key}`、片段、附件、context、`createSubscriber`、函数绑定，以及 svelte-routing 的平铺路由与守卫。

下一步建议：

- 从 `state/create-form.svelte.ts` 跟读「填表 → AI 代笔 → 长按封缄 → 封缄仪式」整条路径，再对照两套创建页视图。
- 在 `pages/LoginPage.svelte` 的 `provideLogin()` 处打断点，切换皮肤，观察它没有被再次调用。
- 对照 `frontends/react-ts`、`frontends/vue3-ts`、`frontends/angular` 的同名页面：Hook、组合式函数、组件级 provider、状态类 + context 四种「共享页面逻辑」的写法，是这个项目最大的价值。

之后可以再深入：SvelteKit（文件路由、服务端渲染、`load` 函数）、`svelte/transition` 与 `animate:` 指令、`$inspect` 调试、`<svelte:boundary>` 错误边界与异步 `await` 表达式。本项目刻意保持极简，把这些留给后续。
