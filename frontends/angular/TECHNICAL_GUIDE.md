# HelloTime Pro Angular 19 前端技术手册与代码导读

本文面向已经熟悉 HTML / CSS / JavaScript 基本语法，但还没系统接触过 Angular、TypeScript、单页应用（SPA）这套现代前端栈的读者。读完后，你应该能回答三件事：

- 用户在浏览器输入 URL 后，代码按什么顺序执行。
- Angular 的组件、依赖注入、Signals、路由、NgRx Signal Store 与 spec/styles 分别在做什么。
- 想新增一个页面、状态或接口调用时，应该改哪些文件。

> 阅读建议：第 1 节介绍技术栈与设计特色；第 2～4 节建立整体地图与入口链路；第 5 节集中讲 Angular 的核心概念（元数据、依赖注入、Signals、模板语法与控制流）；第 6 节是本项目最有 Angular 味的部分——用依赖注入的层级实现「逻辑一份、视图按皮肤分」；第 7～13 节按一次「打开页面」的生命周期分层细讲；第 14～16 节是样式、测试与常见改动。
> 同一个应用的 React 版本在 `frontends/react-ts`、Vue 版本在 `frontends/vue3-ts`，对照着读，最能看出三个框架各自的思路。

## 1. 技术选型与设计特色

本前端基于 **Angular 19**（standalone 组件 + Signals）+ **TypeScript**，构建用 `@angular/build`（esbuild），全局状态用 **NgRx Signal Store**，样式原样引入 `spec/styles` 的两套皮肤（2.0）。

* **Angular（全家桶框架）**：路由、依赖注入、模板编译、变更检测都是框架自带的，不需要另外挑库。组件是一个带 `@Component` 元数据的类，模板在构建期（AOT）编译成指令序列，并做严格的类型检查（`strictTemplates`）——模板里拼错一个属性名，`ng build` 就会失败。
* **Signals（细粒度响应式）**：`signal()` / `computed()` / `effect()` 是 Angular 17+ 的响应式原语。组件的输入输出也是信号（`input()`、`output()`、`model()`），模板读信号时自动登记依赖，配合 `OnPush` 只在真正变了的地方刷新。
* **依赖注入（DI）**：Angular 最有特色的能力。服务可以提供在根（全局单例），也可以提供在某个组件上（只在这棵子树里有效、随组件销毁）。本前端用后一种实现「逻辑一份、视图按皮肤分」（§6）。
* **NgRx Signal Store**：用 `signalStore(withState, withComputed, withMethods, withHooks)` 拼出一个 store，状态是信号，方法里用 `patchState` 改；`rxMethod` 把 RxJS 管道接进来（搜索防抖）。
* **双皮肤与设计令牌（2.0）**：「时笺」「琥珀」两套皮肤 × 明暗，全部样式来自 `spec/styles`（每条规则按 `:root[data-skin]` 限定，两套同时加载）。本前端不写组件样式，只按 2.0 原型写出相同的 DOM 结构与类名；切换皮肤 / 明暗只改 `<html>` 上的两个属性。

## 2. 先建立整体地图

HelloTime Pro 是一个时间胶囊应用。这个前端的职责是：

- 渲染所有页面（首页广场 / 开启 / 详情 / 创建 / 我的 / 登录 / 注册 / 关于 / 404），每个页面都有「时笺」「琥珀」两套视图。
- 调用后端 `/api/v1/*`（经 `:9080` 反代），把 JSON 画成卡片、表单、详情；2.0 新增 `/plaza/stats`、`/me/stats`。
- 维护客户端状态：登录态、皮肤与明暗、广场查询条件、创建页草稿、各页面的表单。
- 守卫需要登录的路由（`/create`、`/me/*`），未登录跳 `/login?redirect=…`；access token 过期自动刷新并重放。

```
src/app/
├── app.config.ts / app.routes.ts / app.component.ts   入口：配置、路由表、总布局
├── core/      全局服务与函数：守卫、TitleStrategy、Clock、HealthService、LoginPrompt、导航项
├── stores/    NgRx Signal Store：auth · ui · plaza · feedback · draft
├── pages/     每个路由：宿主页（提供 Facade）+ Facade（页面逻辑）
├── shared/    两套皮肤共用的组件、指令、管道
├── skins/     paper/ 与 amber/：两套视图
├── api/ · types/   接口客户端与类型
└── lib/       纯函数工具
```

一次「打开首页」的数据流：路由 `''` 懒加载 `HomePage` → 它在 `providers` 里提供 `HomeFacade`，按 `ui.skin()` 渲染 `<app-amber-home>` → 视图 `inject(HomeFacade)` → Facade 构造时的 `effect` 调 `plaza.refreshAll()` → `ApiService` 发请求 → Signal Store 的状态被 `patchState` 更新 → 读了这些信号的模板自动刷新。换成时笺时，只有视图换成 `<app-paper-home>`，它注入的仍是同一个 `HomeFacade`。

## 3. 如何运行和验证

```bash
cd frontends/angular
./run                          # ng serve，端口 7175
./build                        # ng build：AOT 编译 + 严格模板检查 + 打包到 dist/
./test                         # vitest：纯函数与 API 客户端
```

`./run` 会按 `BACKEND_PROXY`（默认 `http://localhost:9080`）生成 `proxy.conf.local.json`，把 `/api` 与 `/static` 转发到后端。也可以在仓库根目录用 `./scripts/hello start angular`。

```bash
./verification/scripts/verify-ui-smoke.sh angular        # UI 冒烟：44 条 × 两套皮肤
./verification/scripts/verify-design-tokens.sh angular   # 自己的样式只用语义令牌
```

`angular.json` 里值得留意的三处：`styles` 只引一个 `src/styles/index.css`；`loader` 把 `.svg` 当文本导入（头像内联）；`budgets` 放宽到 1.5 MB 警告（两套皮肤的样式全量加载）。

## 4. 入口链路：`index.html` → `main.ts` → `AppComponent`

### 4.1 `index.html`

整个应用只有一个 `<app-root>`。`<head>` 里有一段同步执行的内联脚本：在 Angular 启动之前从 `localStorage` 读出 `hellotime.skin` / `hellotime.theme`，写到 `<html data-skin data-theme>` 上，并设置地址栏颜色——首帧就是正确的皮肤和明暗。

### 4.2 `main.ts` 与 `app.config.ts`

```ts
bootstrapApplication(AppComponent, appConfig);
```

```ts
export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'top' })),
    { provide: TitleStrategy, useClass: SuffixTitleStrategy },
    provideAppInitializer(() => void inject(AuthStore)),
  ],
};
```

- 没有 NgModule：standalone 应用直接用一组 provider 启动。
- `withInMemoryScrolling`：每次导航后回到页面顶部。
- `TitleStrategy`：路由上写 `title: '登录'`，统一加上「 · HelloTime Pro」后缀（§7.3）。
- **`provideAppInitializer`**：在应用启动、第一次导航之前执行。这里只是注入一次 `AuthStore`——store 创建时的 `onInit` 会从 `localStorage` 恢复登录态。这样守卫在第一帧就知道用户是谁。

### 4.3 `AppComponent`：总布局

```ts
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, PaperHeaderComponent, AmberHeaderComponent, ...],
  template: `
    <app-paper-filters />
    <app-amber-backdrop />
    @if (ui.skin() === 'paper') {
      <header appPaperHeader></header>
    } @else {
      <header appAmberHeader></header>
    }
    <main id="view" tabindex="-1"><router-outlet /></main>
    ...
    <app-toast-host />
    <app-dialog-host />
  `,
})
export class AppComponent {
  protected readonly ui = inject(UiStore);
}
```

- **`imports`**：standalone 组件自己声明模板里要用到的组件 / 指令 / 管道。
- **`<header appPaperHeader>`**：页头组件的选择器是 `header[appPaperHeader]`——组件直接长在 `<header>` 元素上，DOM 里不会多出一层（§12.1）。
- 构造函数里还订阅了路由事件写 `body[data-route]`，并用两个 `effect` 校验登录态、在受保护页面上丢了登录态时跳登录页。

## 5. Angular 的核心概念

### 5.1 元数据驱动的组件

```ts
@Component({
  selector: 'span[appPaperSeal]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'seal', 'aria-hidden': 'true', '[class.seal--line]': "variant() === 'line'" },
  template: `{{ ch() }}`,
})
export class PaperSealComponent {
  readonly ch = input.required<string>();
  readonly variant = input<'solid' | 'line'>('solid');
}
```

- **`selector`**：模板里怎么用它。`app-xxx` 是元素选择器（`<app-xxx>`），`span[appPaperSeal]` 是属性选择器（`<span appPaperSeal>`）。
- **`host`**：给宿主元素加静态属性、绑定（`[class.x]`、`[attr.data-x]`、`[style.--i]`）和事件监听（`(window:scroll)`、`(document:keydown.escape)`）。
- **`OnPush`**：只有输入变了、组件里的事件触发了、或模板读到的信号变了才检查这个组件。本项目所有组件都是 `OnPush`。

### 5.2 依赖注入：`inject()`

```ts
export class FavButtonComponent {
  private readonly api = inject(ApiService);       // 根级单例
  private readonly plaza = inject(PlazaStore);     // 根级 Signal Store
}
```

`inject()` 只能在「注入上下文」里调用：字段初始化、构造函数、provider 工厂。Angular 沿着「元素注入器 → 组件 → 父组件 → … → 根」一层层找，先找到谁就用谁——这条查找链是 §6 的基础。

本项目还有几个「注入函数」：`injectNow()`、`injectNavKey()`、`injectMyList()`、`injectAvatarIds()`、`injectRedirectParam()`。它们在字段初始化时调用，内部用 `inject()` 拿服务、用 `DestroyRef` 登记清理，是 Angular 里组合逻辑的惯用写法。

### 5.3 Signals

```ts
const count = signal(0);                       // 可写信号
const double = computed(() => count() * 2);    // 派生信号，自动缓存
effect(() => console.log(count()));            // 读到的信号变了就重跑
count.set(1); count.update((n) => n + 1);
```

- 读信号要调用它：`count()`。模板里也一样：`{{ count() }}`。
- **`linkedSignal`**：一个「跟着源变、本地也能改」的信号。收藏按钮的 `on` / `count` 就是它：外部数据（列表刷新）变了自动跟上，点击时又能乐观地先改本地值。

  ```ts
  protected readonly on = linkedSignal(() => this.capsule().favoritedByMe);
  ```

- **`effect` + `untracked`**：effect 里只想让某几个信号触发重跑，其余读取包在 `untracked()` 里，避免意外的依赖。
- **信号输入 / 输出**：`input()`、`input.required()`、`output()`；`model()` 是可写的输入，支持 `[(value)]` 双向绑定。注意：信号输入在构造函数里还没绑定，要读它得等 `ngOnInit` 或 `afterNextRender`。

### 5.4 模板语法与控制流

| 写法 | 含义 | 例子 |
|---|---|---|
| `{{ expr }}` | 文本插值（转义） | `{{ c().title }}` |
| `[prop]="expr"` | 属性绑定（DOM property） | `[value]="d.title()"` |
| `[attr.x]="expr"` | 特性绑定（HTML attribute），`null` 时移除 | `[attr.data-testid]="error() ? 'field-error' : null"` |
| `[class.x]` / `[style.--x]` | 单个类名 / 样式（含 CSS 变量） | `[style.--i]="i"` |
| `(event)="stmt"` | 事件；`(keydown.escape)` 带按键过滤 | `(click)="toggle($event)"` |
| `[(value)]="sig"` | 双向绑定（`model()` 与可写信号） | `[(value)]="f.email"` |
| `#ref` | 模板引用变量 | `<input #search (input)="plaza.typeQ(search.value)">` |
| `x \| pipe: arg` | 管道 | `{{ c().openAt \| fmt: 'date' }}` |

内置控制流（Angular 17+）：

```html
@if (plaza.loading() && !p) {
  ...
} @else if (!plaza.items().length && p) {
  ...
} @else {
  @for (c of plaza.items(); track c.id; let i = $index) {
    <article appPaperCard [c]="c" [i]="i" [now]="h.now()"></article>
  }
}
@let p = plaza.pagination();      <!-- 模板里的局部变量 -->
@switch (me.tab()) { @case ('created') { ... } @default { ... } }
```

`@for` 必须写 `track`，告诉 Angular 列表项的身份——这与 React 的 `key`、Vue 的 `:key` 是同一个概念。

## 6. 本项目的核心：用依赖注入实现「逻辑一份、视图按皮肤分」

两套皮肤的同一个页面长得完全不同，但逻辑必须只有一份；切换皮肤时，正在填的表单、错误提示、草稿都不能丢（`spec/ui/testids.md` X5）。React 用「Hook + 全局 store」，Vue 用「组合式函数 + Pinia」；Angular 有一个更自然的工具：**组件级 provider**。

```ts
// pages/login/login.page.ts —— 路由宿主
@Component({
  selector: 'app-login-page',
  imports: [PaperLoginComponent, AmberLoginComponent],
  providers: [LoginFacade],                          // ← 只在这棵子树里有效
  host: CONTENTS,
  template: `@if (ui.skin() === 'paper') { <app-paper-login /> } @else { <app-amber-login /> }`,
})
export class LoginPage { protected readonly ui = inject(UiStore); }

// pages/login/login.facade.ts —— 页面逻辑
@Injectable()
export class LoginFacade {
  readonly email = signal('');
  readonly password = signal('');
  readonly errors = signal<Errors>({});
  async submit() { ... }
}

// skins/paper/account/login.component.ts —— 视图
export class PaperLoginComponent {
  protected readonly f = inject(LoginFacade);        // ← 沿注入链找到宿主提供的那一份
}
```

```html
<app-field fieldId="email" label="邮箱" testId="login-email" [(value)]="f.email" [error]="f.errors()['email']" />
```

于是：

- **切换皮肤**：只有 `@if` 的两个分支在换，宿主组件不动，`LoginFacade` 还是那个实例——表单值原样还在。
- **离开页面**：路由换走宿主组件，组件级 provider 随之销毁，表单值自然清空，不需要「判断是不是真的离开了」。
- **跨页面要留的东西**放在根级 Signal Store：登录态（`AuthStore`）、广场筛选（`PlazaStore`）、创建页草稿（`DraftStore`，离开再回来接着写）。

| 宿主页 | 提供的 Facade | 视图里注入 |
|---|---|---|
| `HomePage` | `HomeFacade` | 首页两套视图 |
| `OpenPage` | `OpenFacade`、`CodeOpener` | 开启页两套视图（输码状态切皮肤也不丢） |
| `CapsulePage` | `CapsuleFacade` | 详情页两套视图 |
| `CreatePage` | `CreateFacade` | 创建页两套视图、时笺的长按封缄组件 |
| `LoginPage` / `RegisterPage` | `LoginFacade` / `RegisterFacade` | 登录 / 注册两套视图 |
| `MePage` | `MeFacade`、`ProfileFacade` | 「我的」两套视图及其页签 |

`ProfileFacade` 在 `MePage` 上，切到别的页签时还活着——它用一个 `effect` 盯着 `me.tab()`，离开「账号设置」就清空、回来时从当前用户重新填好。

## 7. 路由层：`app.routes.ts` 与 `core/guards.ts`

### 7.1 路由表

```ts
export const routes: Routes = [
  { path: '', title: '把此刻寄给未来', loadComponent: () => import('@/pages/home/home.page').then((m) => m.HomePage) },
  { path: 'login', title: '登录', canActivate: [guestGuard], loadComponent: ... },
  { path: 'create', title: '写给未来', canActivate: [authGuard], data: { auth: true }, loadComponent: ... },
  { path: 'capsules/:code', loadComponent: ... },
  { path: 'me', pathMatch: 'full', redirectTo: 'me/created' },
  { path: 'me/:tab', title: '我的', canActivate: [authGuard, meTabGuard], data: { auth: true }, loadComponent: ... },
  { path: '**', title: '查无此页', loadComponent: ... },
];
```

- **`loadComponent`**：懒加载，每个页面单独一个 chunk（构建输出里能看到 `create-page`、`me-page`…）。
- **`me/:tab`**：三个页签是同一条路由，切页签只是参数变化，宿主组件复用、页头统计不重新请求；`canActivate` 在参数变化时也会重跑，`meTabGuard` 把不认识的页签重定向回「我创建的」。

### 7.2 函数式守卫

```ts
export const authGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthStore);
  const router = inject(Router);
  if (!auth.user() && auth.refreshToken()) await auth.refreshMe();
  return auth.user() ? true : router.parseUrl(loginPath(state.url));
};
```

- 守卫就是一个函数，可以 `inject()`，可以是 async。
- 返回 `true` 放行，返回 `UrlTree` 重定向。`router.parseUrl('/login?redirect=%2Fcreate')` 生成的 UrlTree 序列化回地址栏时，查询值仍是 `%2Fcreate`（Angular 的查询串编码会转义 `/`），满足 X7「redirect 原样保留」。
- `guestGuard`：已登录时访问登录 / 注册页，直接去 `?redirect=` 或首页。

### 7.3 标题与回顶

`SuffixTitleStrategy extends TitleStrategy`：路由上的 `title` 统一加后缀；详情页没有固定标题，`CapsuleFacade` 在胶囊取回来后用 `Title` 服务写。换页回顶由 `withInMemoryScrolling` 负责。

页面之间跳转：模板里 `<a routerLink="/open">`、带查询参数 `<a routerLink="/register" [queryParams]="{ redirect: … }">`；脚本里 `router.navigateByUrl(...)`。

## 8. 数据层：`api/api.service.ts`

`ApiService` 是根级服务，内部用原生 `fetch`（与 React / Vue 版本同构）：

- `request<T>(path, opts)`：自动设置 `Content-Type` / `Accept`、序列化 `body`、带上 `Authorization`；解开后端统一外壳 `{ success, data, message, errorCode }`，调用者只看到 `data`；失败抛 `ApiError`。
- **自动 refresh 单飞**：`refreshing` 保存进行中的 refresh Promise，一波 401 同时发生时只发一次 `/auth/refresh`，其余请求等同一个 Promise；拿到新 token 后重放原请求，`_retry` 防止无限循环。
- **与 store 解耦**：`ApiService` 不注入 `AuthStore`（store 反过来注入了 api，会循环）。`AuthStore` 在 `withHooks.onInit` 里调用 `api.configure({ getAccessToken, onTokensRefreshed, onAuthLost, ... })` 把自己注册进去。

> **为什么不用 `HttpClient` + 拦截器？** 那是 Angular 的原生做法：`provideHttpClient(withInterceptors([authInterceptor]))`，拦截器里用 RxJS 的 `catchError` + `switchMap` 处理 401 与重放、用 `shareReplay` 做单飞，`HttpContextToken` 标记公开端点。它更「Angular」，但 refresh 单飞在 Observable 上写起来明显更绕，且与其他实现的 `client.ts` 不再同构、单测也要改成 `HttpTestingController`。本项目把对比的重点放在组件、状态与 DI 上，接口层刻意保持与 React / Vue 一致；想改成 `HttpClient`，只需要换掉 `ApiService` 内部，调用方不用动。

## 9. 状态层：NgRx Signal Store

### 9.1 创建一个 store

```ts
export const PlazaStore = signalStore(
  { providedIn: 'root' },
  withState<PlazaState>({ sort: 'new', filter: 'all', q: '', qInput: '', page: 1, items: [], ... }),
  withMethods((store) => {
    const api = inject(ApiService);
    async function fetchList() {
      patchState(store, { loading: true });
      const data = await api.plaza({ sort: store.sort(), ... });
      patchState(store, { items: data.items, pagination: data.pagination, loading: false });
    }
    return { fetchList, setSort(sort: PlazaSort) { patchState(store, { sort, page: 1 }); void fetchList(); }, ... };
  }),
);
```

- `withState` 里的每个字段都变成一个信号：`store.sort()`、`store.items()`。
- `withMethods` 返回的函数就是 store 的方法；改状态一律 `patchState(store, {...})` 或 `patchState(store, (s) => ...)`。
- 组件里 `inject(PlazaStore)`，模板里 `plaza.items()`。

### 9.2 本项目的五个 store

| Store | 关心什么 | 持久化 |
|---|---|---|
| `AuthStore` | user / accessToken / refreshToken / hydrated | refreshToken + user → localStorage（`provideAppInitializer` 在第一次导航前恢复） |
| `UiStore` | skin · theme 及带转场的切换 | localStorage `hellotime.skin` / `hellotime.theme` |
| `PlazaStore` | 排序、筛选、搜索词、页码 + 列表、筛选数量、年鉴、精选 | 否；离开首页再回来还在 |
| `FeedbackStore` | Toast 队列与当前确认框 | 否 |
| `DraftStore` | 创建页草稿 | 否（只在内存）；封存成功、登出、换账号时清空 |

### 9.3 `withHooks`：store 的生命周期

```ts
// stores/draft.store.ts
withHooks({
  onInit(store) {
    const auth = inject(AuthStore);
    let prev = auth.user()?.id;
    effect(() => {
      const id = auth.user()?.id;
      untracked(() => {
        if (prev && id !== prev) store.reset();   // 登出 / 换账号：草稿属于写它的人
        prev = id;
      });
    });
  },
}),
```

`onInit` 在 store 创建时运行，处于注入上下文里，可以 `inject` 别的 store、可以建 `effect`。`AuthStore` 的 `onInit` 则把自己注册进 `ApiService` 并从 `localStorage` 恢复。

### 9.4 `rxMethod`：搜索防抖

```ts
const debounced = rxMethod<string | null>(
  pipe(
    switchMap((v) => (v === null ? EMPTY : timer(SEARCH_DEBOUNCE_MS).pipe(map(() => v)))),
    filter((v) => v !== store.q()),
    tap((v) => setQ(v)),
  ),
);
// typeQ(v)：先 patchState({ qInput: v })，再 debounced(v)；清空按钮 setQ('') 时 debounced(null) 取消正在等的那一次
```

`rxMethod` 把一个 RxJS 管道包成方法：每调用一次就往管道里推一个值。`switchMap` + `timer` 实现「新值来了就重新计时」，推 `null` 则切到 `EMPTY`，等于取消。防抖放在 store 里，所以输入后 300ms 内切换皮肤（视图被换掉）也不会丢字。

### 9.5 并发请求的「序列号」模式

```ts
let listSeq = 0;
async function fetchList() {
  const my = ++listSeq;
  const data = await api.plaza({ ... });
  if (my === listSeq) patchState(store, { items: data.items });   // 只有最后发起的请求能写状态
}
```

## 10. 页面逻辑层：Facade 与注入函数

| 文件 | 做什么 | 值得看的写法 |
|---|---|---|
| `pages/home/home.facade.ts` | 进入 / 换账号时刷新，到点刷新，热度榜 | 两个 `effect`：`auth.user()?.id` 变了、`due()` 变真了就 `refreshAll()` |
| `pages/capsule/capsule.facade.ts` | 取数、逐秒倒数、`expired`、`awaitOpened()` | 路由参数 `toSignal(route.paramMap)`；归零后以服务端 `isOpened` 为准，1s、2s…≤5s 退避重试 |
| `pages/create/create.facade.ts` | 草稿字段、校验、AI 推荐与代笔、封存 | AI 请求成功前不动正文，失败原文保留；`DestroyRef` 离开页面时停止打字 |
| `pages/login|register/*.facade.ts` | 表单值、校验、提交、回跳 | `injectRedirectParam()` 把 `?redirect=` 变成信号 |
| `pages/me/profile.facade.ts` | 资料与改密码 | `effect` 盯页签，离开「账号设置」就清空 |
| `pages/me/my-list.ts` | 我创建的 / 我收藏的：分页「加载更多」、删除、取消收藏 | 注入函数 `injectMyList(kind, onChange)` |
| `shared/code-opener.ts` | 凭码开启 | 组件级服务，首页就地输码与开启页各提供一份 |
| `core/clock.ts` | 全局整秒节拍 | `injectNow()` 登记使用者，`DestroyRef` 里减一，没人用就停表 |

### 10.1 详情页：倒数归零 → 等服务端确认

```ts
async awaitOpened(): Promise<CapsuleDetail | null> {
  const my = this.gen;                                // 换了码或离开页面 gen 会变
  for (let i = 0; my === this.gen; i++) {
    const d = await this.api.capsuleByCode(this.code());
    if (d.isOpened) { this.capsule.set(d); return d; }
    await sleep(Math.min(1000 * (i + 1), 5000));      // 本机时钟可能快几秒：隔一会儿再问
  }
  return null;
}
```

两套视图在 `effect` 里盯着 `f.expired()`，先播开启动画，再 `await f.awaitOpened()`；服务端没确认前停在动画末帧，不提前报「已开启」。

## 11. 指令与管道：可复用的小行为

指令（`@Directive`）是「没有模板的组件」，专门给已有元素加行为。React 里散落在各处的 `useEffect`，在这里收拢成一个个指令：

| 指令 | 用法 | 做什么 |
|---|---|---|
| `IconDirective` | `<svg appIcon="pen" class="ic--go"></svg>` | 写入图标路径（`DomSanitizer` 信任常量） |
| `ShakeDirective` | `<div class="field" [appShake]="f.shake().title">` | 值变了就加 `is-shake` 480ms |
| `SliderThumbDirective` | `<span class="seg__thumb" appSliderThumb=".seg__opt.is-active" [sliderKey]="…">` | 量当前项位置，滑块跟过去（`afterNextRender` 里量，`(window:resize)` 重量） |
| `SlashFocusDirective` | `<input appSlashFocus>` | `(document:keydown)` 里按「/」聚焦 |
| `CountUpDirective` | `<b [appCountUp]="n">` | 进入视口时数字数上来 |
| `PortalDirective` | 作为封缄仪式的 `hostDirectives` | `afterNextRender` 里把宿主挪到 `<body>` 下 |
| `CreateLinkDirective` | `<a appCreateLink class="btn">` | 已登录去 `/create`；匿名先弹确认框再去登录 |
| `AutofocusDirective` | `<input appAutofocus>` | 延迟聚焦，不抢已有焦点 |
| `KeyDirective` | `<span *appKey="d" class="cd__digit">` | 结构型指令：值变了就重建模板（React 的 `key`），用来重播入场动画 |

```ts
@Directive({ selector: '[appKey]' })
export class KeyDirective {
  readonly appKey = input<unknown>();
  constructor() {
    const vcr = inject(ViewContainerRef);
    const tpl = inject(TemplateRef);
    effect(() => {
      this.appKey();
      untracked(() => { vcr.clear(); vcr.createEmbeddedView(tpl); });
    });
  }
}
```

`*appKey="x"` 前面的星号是语法糖：Angular 把元素包进一个 `<ng-template>`，指令拿到 `TemplateRef` 和 `ViewContainerRef`，自己决定何时、渲染几份——`@if`、`@for` 背后也是同样的机制。

**管道** `fmt`：`{{ c.openAt | fmt: 'date' }}`、`{{ ms | fmt: 'span' }}`。纯管道只在输入变化时重算，比在模板里直接调函数更符合 Angular 的习惯。

## 12. 视图层：皮肤与组件

### 12.1 宿主元素与原型 DOM

Angular 会为每个组件渲染一个宿主元素。皮肤样式是照原型的 DOM 层级写的，比如 `.almanac__cell + .almanac__cell`（相邻兄弟）、`.badge + .badge`、`body` 的纵向 flex——多出来的宿主元素会让它们失效。两个办法：

1. **属性选择器**：只有一个根元素的部件，让组件直接长在那个元素上。

   ```ts
   @Component({ selector: 'article[appPaperCard]', host: { class: 'cap', '[attr.data-state]': "opened() ? 'opened' : 'sealed'" }, ... })
   ```
   ```html
   <article appPaperCard [c]="c" [i]="i" [now]="h.now()"></article>
   ```

2. **`display: contents`**：多根或结构复杂的组件（页面视图、字段、收藏按钮）仍用元素选择器，宿主统一设成不参与布局：`host: CONTENTS`（`shared/host.ts`）。

长在 `<svg>` 上的组件（邮戳、标志、胶囊插画）模板里的图形要写 `<svg:path>`、`<svg:circle>`，否则 Angular 会把它们建成 HTML 元素。

### 12.2 一个页面的三层

```
pages/create/create.page.ts        宿主：providers: [CreateFacade]，按皮肤渲染
pages/create/create.facade.ts      逻辑：草稿、校验、AI、封存
skins/paper/create/*.component.ts  视图：信笺 + 对数时间标尺 + 日历 + 长按火漆 + 封缄仪式
skins/amber/create/*.component.ts  视图：表单卡 + 实时预览 + 按钮 + 码牌回执
```

### 12.3 表单字段：`model()` + 内容投影

```ts
@Component({ selector: 'app-field', ... })
export class FieldComponent {
  readonly value = model('');                       // [(value)] 双向绑定
  readonly password = input(false);                 // 自带眼睛按钮
  private readonly trail = contentChild(TrailDirective);
}
```
```html
<app-field fieldId="nickname" label="昵称" testId="register-nickname" [(value)]="f.nickname">
  <span appNickState appTrail [state]="f.nick().state"></span>   <!-- 投影到输入框右侧 -->
</app-field>
```

字段内部按皮肤出两套外框（时笺是下划线信笺栏，琥珀是带图标的输入框）。输入框与投影位置各写成一个 `<ng-template>`，两个分支用 `ngTemplateOutlet` 放进去——`<ng-content>` 不能在两个分支里各写一份。

### 12.4 确认框：组件 + 输入

```ts
await feedback.confirm({
  title: '删除这枚胶囊？',
  body: { component: DeleteBodyComponent, inputs: { title: c.title, code: c.code } },
  tone: 'danger',
  mark: { component: AmberDeleteMarkComponent, inputs: { code: c.code } },
});
```

`DialogHost` 用 `*ngComponentOutlet="b.component; inputs: b.inputs"` 渲染。正文里有用户写的标题，走插值、照常转义，不用 `innerHTML`。

### 12.5 测试钩子

每个关键元素都带 `spec/ui/testids.md` 规定的 `data-testid` 与状态属性。条件出现的钩子用特性绑定：`[attr.data-testid]="error() ? 'field-error' : null"`——`null` 时整个属性被移除；布尔值会渲染成 `"true"` / `"false"`，正好满足 `data-selected`、`aria-pressed` 的要求。

## 13. 工具层：`lib/`

| 文件 | 内容 |
|---|---|
| `fmt.ts` | 时间说法、倒计时拆分、等待进度、农历、`reducedMotion()`、`focusIfIdle()`、`addCalendarYears()` |
| `schedule.ts` | 开启时间上下限（≥ 此刻 + 61 秒，≤ 10 个日历年，两头留余量）、预设、校验文案 |
| `account.ts` | 邮箱 / 昵称 / 密码的校验规则 |
| `icons.ts` | 24 网格线性图标的路径 |
| `avatars.ts` | 构建期内联 `spec/avatars/v2`（`angular.json` 的 svg 文本加载器） |
| `palette.ts` | 琥珀的胶囊专属色：FNV-1a + OKLCH |
| `about.ts` | 关于页文字、本前端的技术栈 |
| `redirect.ts` | 登录回跳：只接受站内路径 |

## 14. 样式层：spec/styles

`src/styles/index.css` 引入 `@fontsource` 自托管字体、按「base → 时笺 → 琥珀 → shell」的顺序引入 `spec/styles`，最后引入 `app.css`。`app.css` 只有两条胶水：`app-root` / `router-outlet` 不参与布局；「加载更多」居中。组件不写 `styles`、不用 Tailwind。令牌检查会扫描 `.css` 文件：只能引用 `base.css` 刻度与语义令牌，不能写色值。

想改长相：改 `spec/styles/<skin>/*.css`（所有实现一起受益），并在原型里两套皮肤、明暗都看一遍。

## 15. 测试

- 单元测试（vitest，node 环境，`./test`）：
  - `lib/lib.test.ts`：时间说法、日历年上限（含 2 月 29 日）、专属色确定性、登录回跳
  - `lib/account.test.ts`：邮箱、昵称、密码的校验规则
  - `api/api.service.test.ts`：refresh 单飞与重放
- UI 冒烟（Playwright，`verification/ui`）：44 条用例 × 两套皮肤，靠测试钩子定位；`SKINS=paper` 可只跑一套。

## 16. 常见改动指南

- **新增一个页面**：在 `pages/<name>/` 写 Facade 与宿主页（`providers: [XxxFacade]`，按皮肤 `@if`）→ 在 `skins/paper` 与 `skins/amber` 各写一份视图（照原型的结构与类名，单根部件用属性选择器）→ 在 `app.routes.ts` 登记（`loadComponent`、`title`，需要登录就加 `canActivate: [authGuard]`）→ 按 `spec/ui/testids.md` 加测试钩子。
- **新增一个接口**：先改 `spec/api/openapi.yaml` → 在 `types/` 加类型 → 在 `ApiService` 加方法 → 在 Facade 或 store 里调用。
- **新增一份要跨皮肤保留的状态**：页面内的放进该页的 Facade；要跨页面保留的放进 Signal Store。
- **调整视觉**：改 `spec/styles`，不要在组件里写样式。

## 17. 学到这里之后

读到这里，你已经掌握了现代 Angular 应用最常见的 80%：standalone 组件与元数据、依赖注入及其层级、Signals（含 `linkedSignal`）、模板绑定与内置控制流、信号输入输出与 `model()`、内容投影、指令与结构型指令、管道、函数式守卫与懒加载路由、NgRx Signal Store 与 `rxMethod`。

下一步建议：

- 从 `pages/create/` 跟读「填表 → AI 代笔 → 长按封缄 → 封缄仪式」整条路径，再对照两套创建页视图。
- 在 `HomeFacade` 的构造函数里打断点，切换皮肤，观察 Facade 没有被重新创建。
- 对照 `frontends/react-ts` 与 `frontends/vue3-ts` 的同名页面：Hook、组合式函数、组件级 provider 三种「共享页面逻辑」的写法，是这个项目最大的价值。

之后可以再深入：Zoneless 变更检测（`provideZonelessChangeDetection`）、`resource()` / `httpResource()` 声明式取数、`@defer` 延迟加载块、SSR 与水合、Angular CDK（Portal、Overlay、A11y）。本项目刻意保持极简，把这些留给后续。
