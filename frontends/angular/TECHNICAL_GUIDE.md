# HelloTime Pro Angular 19 前端技术手册与代码导读

本文面向已经熟悉 HTML / CSS / JavaScript 基本语法，但还没系统接触过 Angular、TypeScript、单页应用（SPA）这套现代前端栈的读者。读完后，你应该能回答三件事：

- 用户在浏览器输入 URL 后，代码按什么顺序执行。
- Angular、TypeScript、NgRx Signal Store、Angular Router、装饰器、依赖注入分别在做什么。
- 想新增一个页面、状态或接口调用时，应该改哪些文件。

> 阅读建议：第 1 节介绍技术栈与设计特色；第 2～4 节建立整体地图与入口链路；第 5 节集中讲 Angular 的几个核心概念（装饰器、依赖注入、Signals、模板语法）；第 6 节快速过 TypeScript；第 7～14 节按一次「打开页面」的生命周期分层细讲；第 15 节给出常见改动的步骤清单。

> 如果你已经读过这个项目的 React 或 Vue 版技术手册，**§5 (装饰器+DI)**、**§10 (NgRx Signal Store)** 与 **§11 (模板的新控制流 @if/@for)** 是 Angular 与其他两套最不一样的地方。

## 1. 技术选型与设计特色

HelloTime Pro 的 Angular 前端实现基于 **Angular 19 + TypeScript** 核心骨架，并选用 **Angular Router** 控制路由、**NgRx Signal Store** 进行企业级响应式状态管理、**Tailwind CSS v4** 配合 **Design Tokens**（设计令牌）定制视觉系统。其具体选型考量与设计特色如下：

* **Angular 19（企业级单页应用架构）**：利用 Angular 强大的依赖注入（DI）系统、模块化服务（Services）与独立组件（Standalone Components）设计，提供业界最严谨的架构范式。配合 Angular Router 实现高性能、零刷新的单页应用（SPA）。
* **Angular Signals（细粒度响应式更新）**：原生集成最新的 **Signals** 响应式系统。通过细粒度依赖追踪，实现模板与数据之间的精准重绘，彻底告别传统的 zone.js 暴力脏检查。
* **TypeScript（高度集成的语言优势）**：作为 Angular 的一等公民，TypeScript 在项目中被深度集成。通过静态类型检查使前端数据结构与后端的 OpenAPI 合约保持高度一致，在编写代码阶段拦截绝大多数运行时异常。
* **NgRx Signal Store（极具结构性的状态管理）**：选用轻量但功能强大的 NgRx Signal Store。其内置生命周期钩子（如 `onInit`）能在服务初始化时自动执行状态水合，比 React/Vue 的手动触发更加优雅，同时为企业级应用提供了极佳的可扩展性。
* **Design Tokens 与 Tailwind CSS v4（规范化视觉与主题）**：将颜色、字号等样式规范抽离为跨前端通用的设计令牌（CSS 变量）。配合 Tailwind v4 使得暗/亮主题切换和视觉一致性的维护变得十分高效。

## 2. 先建立整体地图

HelloTime Pro 是一个时间胶囊应用。Angular 前端的职责是：

- 渲染所有 UI 页面（广场 / 开启 / 创建 / 我的 / 登录 / 注册 / 关于）。
- 通过 HTTP 调用后端 `/api/v1/*` 接口，把 JSON 渲染成卡片、表单、详情。
- 维护客户端状态：登录态、主题、广场筛选条件、我创建的 / 收藏的列表。
- 守卫需要登录的路由（`/create`、`/me/*`），自动用 refresh token 续期 access token。
- 跑在浏览器里，是一个 **单页应用**（SPA）：所有跳转都不刷新页面。

核心目录：

```text
frontends/angular/
├── angular.json                # Angular CLI 工程配置：构建器、资源、入口
├── package.json                # 依赖与 npm 脚本
├── proxy.conf.local.json       # 由 ./run 生成的 API 代理配置
├── tsconfig*.json              # TypeScript 编译配置
├── run / build / test          # 三个 Bash 脚本
└── src/
    ├── index.html              # SPA 唯一的 HTML，只有 <app-root></app-root>
    ├── main.ts                 # 入口：bootstrapApplication(AppComponent, appConfig)
    ├── styles/                 # 全局 CSS 入口（导入 spec/styles 的设计令牌）
    └── app/
        ├── app.component.ts    # 根组件：模板就是 <router-outlet />
        ├── app.config.ts       # 应用级 providers：router、change detection
        ├── app.routes.ts       # 路由表：URL → 组件（懒加载）+ 守卫
        ├── types/index.ts      # 与后端 openapi.yaml 对齐的 TS 类型
        ├── api/api.service.ts  # @Injectable 的 fetch 封装 + 自动 refresh
        ├── stores/             # NgRx Signal Store：auth / theme / plaza / capsule
        ├── guards/auth.guard.ts# 路由守卫（CanActivateFn）
        ├── utils/              # 倒计时 / 时间格式化 / 头像 URL（纯函数）
        ├── components/         # 通用组件（每个组件一个文件夹）
        └── pages/              # 路由对应的页面组件
```

一次「打开广场页」的流向：

```text
浏览器
  │ GET /
  ▼
Angular CLI dev server（开发） / 静态文件（生产）
  │ 返回 index.html
  ▼
浏览器解析 HTML → 加载 /main.js (Angular CLI 已打包)
  │
  ▼
main.ts: bootstrapApplication(AppComponent, appConfig)
  │ 注册全局 providers（Router、Change Detection）
  ▼
AppComponent
  │ 构造时 inject(AuthStore) / inject(ThemeStore)
  │ AuthStore 的 onInit hook 自动 hydrate localStorage
  │ 模板 <router-outlet />
  ▼
app.routes.ts 按 URL 匹配 → MainLayoutComponent + PlazaComponent
  │ loadComponent 懒加载（按需 import）
  ▼
PlazaComponent.ngOnInit 调 plaza.fetch()
  │
  ▼
ApiService.plaza({...}) → fetch("/api/v1/plaza/capsules")
  │ Angular CLI dev server 反代到 :9080
  ▼
后端返回 JSON → patchState(store, { items, ... }) → signal 变更 → Angular 自动重渲染
```

> Angular 的核心心智模型：**所有依赖通过 `inject()` 拿到**，**状态用 signal 表达**，**模板里直接调用 signal 函数读值**。`@Component` 装饰器把 TS 类、HTML 模板、CSS 样式绑定到一起，CLI 编译时把这些信息生成成执行代码。

## 3. 如何运行和验证

```bash
cd frontends/angular
./run                          # 开发模式，端口 7175
./build                        # 生产构建到 dist/
./test                         # 单元测试（vitest run）+ 类型检查
```

打开浏览器访问 `http://localhost:7175`。`./run` 做的事：

1. 检查 `node_modules` 是否存在，没有就 `npm install`。
2. **根据 `BACKEND_PROXY` 环境变量生成 `proxy.conf.local.json`**——这是 Angular CLI 的代理配置文件，需要静态 JSON。
3. 执行 `npm run dev`（即 `ng serve`），CLI 启动 dev server，**修改文件自动热更新**。

`angular.json` 把 `proxy.conf.local.json` 配置给了 dev server，所有 `/api/*`、`/static/*` 转发到 `BACKEND_PROXY`（默认 `http://localhost:9080`）。可以直连某后端：`BACKEND_PROXY=http://localhost:29010 ./run`。

生产构建（`./build`）：

```bash
ng build                        # 产物到 dist/
# CLI 内部用 @angular/build:application：esbuild 编译 TS、内联模板/样式、tree-shake
```

## 4. 入口链路：`index.html` → `main.ts` → `AppComponent`

### 3.1 `index.html`：SPA 的唯一 HTML

```html
<!doctype html>
<html lang="zh-CN" data-theme="dark">
  <head>
    <base href="/" />
    <title>HelloTime Pro</title>
  </head>
  <body>
    <app-root></app-root>
  </body>
</html>
```

- `<app-root>` 是一个自定义元素（custom element selector）。`AppComponent` 类的 `@Component({ selector: 'app-root', ... })` 告诉 Angular「在这个标签的位置渲染我」。
- `<base href="/">` 让 Angular Router 知道 URL 的根路径，处理 history 模式。
- 这里**没有内联 `<script>` 抢先设主题**——本项目 Angular 版没做这一步，所以暗/亮主题切换偶尔会有微小闪烁。生产项目通常也加一段同 React/Vue 版的早注入脚本。

### 3.2 `main.ts`：bootstrap

```ts
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';
import './styles/index.css';

bootstrapApplication(AppComponent, appConfig).catch((err) => console.error(err));
```

- `bootstrapApplication(rootCmp, config)` 是 Angular 14+ 的「standalone bootstrap」——不再需要 `NgModule`。
- `appConfig` 集中放应用级的 providers（依赖注入的「全局服务」）。

`app.config.ts`：

```ts
export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding()),
  ],
};
```

- `provideZoneChangeDetection`：启用 zone.js 的变更检测（Angular 默认机制；后续可换成 zoneless）。`eventCoalescing` 把同一帧内的事件合并，减少重渲染。
- `provideRouter(routes, ...)`：装上路由系统，`withComponentInputBinding()` 让路由参数（`:code` 等）能直接以 `input()` 形式注入到组件。

### 3.3 `AppComponent`：根组件

```ts
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `<router-outlet />`,
})
export class AppComponent implements OnInit {
  private auth = inject(AuthStore);
  private theme = inject(ThemeStore);

  constructor() {
    effect(() => {
      if (this.auth.hydrated() && this.auth.refreshToken()) {
        void this.auth.refreshMe();
      }
    });
  }

  ngOnInit() {
    this.theme.hydrate();
    // auth store 的 hydrate 在 withHooks.onInit 中已自动触发
  }
}
```

做的事：

1. `inject(AuthStore)` / `inject(ThemeStore)`：从依赖注入容器拿到 store 单例。
2. 构造函数里注册一个 `effect`：自动追踪用到的 signal（`hydrated`、`refreshToken`），任一变化就重跑。这等价于「水合完成且有 refresh token 就拉一次 /me」。
3. `ngOnInit` 是 Angular 生命周期钩子，组件首次创建后调用一次。
4. 模板 `<router-outlet />`：路由出口，由当前匹配的页面替换。

## 5. Angular 的核心概念

Angular 没有「魔法」，但有 **五个核心概念** 是 HTML/JS 老兵第一次写 Angular 时最容易困惑的地方。

### 4.1 装饰器 + 元数据驱动

```ts
@Component({
  selector: 'app-plaza',
  standalone: true,
  imports: [RouterLink, PlazaToolbarComponent, ...],
  template: `<section class="cy-hero-block">...</section>`,
})
export class PlazaComponent implements OnInit { ... }
```

`@Component({...})` 是 TypeScript 装饰器：编译时把 `{ selector, template, imports }` 这些 **元数据**附在 `PlazaComponent` 类上，Angular CLI 读取这些元数据生成执行代码（视图渲染函数、变更检测）。

| 装饰器 | 用途 |
|---|---|
| `@Component({...})` | 声明 UI 组件，附带 selector / template / imports / styles |
| `@Injectable({...})` | 声明可注入的服务（`ApiService`） |
| `@Input()` / `input()` | 声明组件接收的 prop（新 signal API 推荐用 `input()`） |
| `@Output()` / `output()` | 声明组件向外触发的事件 |
| `@HostListener('document:keydown', ['$event'])` | 监听挂载元素或全局事件 |
| `@ViewChild('menuRef')` | 取模板里 `#menuRef` 标记的元素引用 |

### 4.2 依赖注入：`inject()`

Angular 有一个全局的「依赖注入容器」。任何标了 `@Injectable({ providedIn: 'root' })` 的类，整个应用共享一个实例。组件想用就 `inject(...)`：

```ts
export class PlazaComponent implements OnInit {
  plaza = inject(PlazaStore);          // NgRx 的 store
  auth = inject(AuthStore);
  ngOnInit() { if (this.auth.hydrated()) void this.plaza.fetch(); }
}
```

`inject()` 必须在 **「injection context」** 里调用——构造函数、字段初始化、`@Injectable` 的工厂函数中。本项目把所有 `inject(...)` 都写成字段初始化器，简洁明确。

| | React/Vue | Angular |
|---|---|---|
| 拿状态 | `useAuthStore()` Hook | `inject(AuthStore)` |
| 拿路由 | `useNavigate()` / `useRouter()` | `inject(Router)` |
| 拿 API | `import { api }` 顶层单例 | `inject(ApiService)` |

> **为什么用 DI 而不是 import？** DI 让单元测试时可以「换掉」某个服务（用 mock 替换真 ApiService），还允许在不同作用域提供不同实例（比如某个路由树共享一个 store）。本项目所有 store / service 都是 `providedIn: 'root'`（全局单例），DI 的高级用法基本没用到，但写法保留。

### 4.3 Signals：Angular 17+ 的细粒度响应式

Angular 17 引入了 **signals**，让响应式不再依赖 zone.js 的「脏检查」。

```ts
import { signal, computed, effect } from '@angular/core';

const count = signal(0);              // 创建一个 signal
console.log(count());                 // ← 像调用函数一样读值
count.set(5);                         // 写
count.update((c) => c + 1);           // 函数式更新

const doubled = computed(() => count() * 2);   // 派生值，依赖自动追踪
effect(() => console.log("count:", count()));  // 副作用，依赖任何 signal 变化就重跑
```

特点：

- **读 signal 是函数调用**：`count()`，不是 `count.value`（Vue）或解构（React）。
- **写 signal 用 `.set()` / `.update()`**：直接 `=` 不可能（signal 是函数）。
- **自动追踪依赖**：`computed`、`effect`、模板内只要调了 signal，就成为它的订阅者。
- **细粒度更新**：和 Vue 一样，只重跑用到的部分，**不需要整组件重渲染**。

模板里也是直接调函数：

```html
<button [disabled]="busy()">{{ busy() ? '登录中…' : '登录' }}</button>
@if (auth.user(); as user) { <span>{{ user.nickname }}</span> }
```

> Angular 同时保留了「旧式 `@Input()` 装饰器属性」和「新式 `input()` signal」两套 API。本项目统一用新版的 `input()`、`output()`、`signal()`，更现代也对 zoneless 友好。

### 4.4 模板语法：绑定与事件

```html
<!-- 插值 -->
<h1>{{ user.nickname }}</h1>

<!-- 属性绑定（property binding）：把 JS 值绑到 DOM property -->
<img [src]="avatarUrl(user.avatarId)" />
<button [disabled]="busy()">提交</button>
<button [class]="active() ? 'is-active' : ''">收藏</button>
<button [style.color]="active() ? 'red' : 'gray'">♥</button>

<!-- 属性绑定（attribute binding）：DOM 没有对应 property 时用 attr -->
<button [attr.aria-expanded]="menuOpen()">菜单</button>

<!-- 事件绑定 -->
<button (click)="toggle()">点</button>
<form (ngSubmit)="submit()">  <!-- ngSubmit：FormsModule 提供的语义化 submit -->

<!-- 双向绑定（banana-in-a-box: [()] = [] + () 组合）-->
<input [(ngModel)]="email" name="email" />  <!-- 需 imports: [FormsModule] -->
```

不像 Vue 的 `v-model` 和 React 的 `value/onChange`，Angular 的 `[(ngModel)]` 由 `FormsModule` 提供，组件必须把它加进 `imports` 数组才能用：

```ts
@Component({
  imports: [FormsModule, RouterLink, AlertComponent],
  ...
})
```

### 4.5 新控制流：`@if` / `@for` / `@switch`

Angular 17+ 推出了模板新语法，逐步替代旧的 `*ngIf` / `*ngFor`：

```html
@if (loading() && items().length === 0) {
  <div class="cy-empty"><p>加载中…</p></div>
} @else if (!loading() && items().length === 0) {
  <ng-content select="[empty]" />
} @else {
  <div class="cy-grid">
    @for (c of items(); track c.id) {
      <app-capsule-card [capsule]="c" />
    }
  </div>
}
```

要点：

- 看起来像 JS 控制流，可读性比 `*ngIf="..." *ngFor="let c of items"` 强很多。
- **`@for` 必须有 `track`**：告诉 Angular 用什么字段做 diff key（对应 React/Vue 的 `:key`）。
- 嵌套自然，不需要旁路 `<ng-container>`。
- `@if (auth.user(); as user) { {{ user.nickname }} }` 是「绑定别名」，相当于 if + 局部变量。

## 6. TypeScript 快速概览

`.ts` 文件本质是带类型注解的 JavaScript。Angular CLI 用 TS 编译器把它转成 JS。读代码时几乎可以「把冒号后面的内容当注释」忽略。

```ts
interface User { id: string; email: string; nickname: string; ... }
type ErrorCode = "VALIDATION_ERROR" | "UNAUTHORIZED" | ...;
capsule = input.required<CapsuleListItem>();         // 泛型 + 强制必填
e instanceof ApiError                                 // 运行时类型守卫
```

Angular **强制依赖 TypeScript**：装饰器元数据、模板类型检查（`strictTemplates`）、`input.required<T>()` 等核心 API 都用了 TS 类型。生产构建不像 React/Vue 可以裸 JS——Angular 项目几乎一定是 TS。

## 7. 路由层：`app.routes.ts`

```ts
export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('@/components/main-layout/main-layout.component').then((m) => m.MainLayoutComponent),
    children: [
      { path: '',         loadComponent: () => import('@/pages/plaza/plaza.component').then((m) => m.PlazaComponent) },
      { path: 'open',     loadComponent: () => import('@/pages/open/open.component').then((m) => m.OpenComponent) },
      { path: 'login',    loadComponent: () => import('@/pages/login/login.component').then((m) => m.LoginComponent) },
      { path: 'create',   canActivate: [authGuard],
                          loadComponent: () => import('@/pages/create/create.component').then((m) => m.CreateComponent) },
      { path: 'c/:code',  loadComponent: () => import('@/pages/capsule-by-code/capsule-by-code.component').then((m) => m.CapsuleByCodeComponent) },
    ],
  },
  { path: 'me', canActivate: [authGuard],
                loadComponent: () => import('@/components/me-layout/me-layout.component').then((m) => m.MeLayoutComponent),
                children: [
                  { path: '',          redirectTo: 'created', pathMatch: 'full' },
                  { path: 'created',   loadComponent: () => import('@/pages/me-created/me-created.component').then((m) => m.MeCreatedComponent) },
                  ...
                ] },
  { path: '**', loadComponent: () => import('@/pages/not-found/not-found.component').then((m) => m.NotFoundComponent) },
];
```

要点：

- **`loadComponent: () => import(...).then(m => m.XxxComponent)`**：每个页面用 ESM 动态 `import` **懒加载**，初始 bundle 不包含 `/me/*` 等冷门页面，访问时才下载。React/Vue 也能做但项目里没做；Angular 是默认范式。
- **嵌套路由 + Layout**：父对象的 `loadComponent` 是布局，子路由的页面填到布局的 `<router-outlet />`。
- **守卫 `canActivate: [authGuard]`**：进入路由前调用一个函数判断；返回 `false` 或 `UrlTree` 跳走。
- **404 兜底**：`path: '**'`，放在数组末尾。

模板里跳转：

```html
<a routerLink="/login">登录</a>
<a [routerLink]="['/c', code]">{{ code }}</a>   <!-- 数组形式拼路径 -->
<a routerLink="/" routerLinkActive="cy-nav__active" [routerLinkActiveOptions]="{ exact: true }">广场</a>
```

代码里跳转：

```ts
this.router.navigate(['/me/created'], { replaceUrl: true });
```

## 8. 关键模式：守卫与布局

### 7.1 `MainLayoutComponent` / `MeLayoutComponent`：共享外壳

```ts
@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, AppHeaderComponent, AppFooterComponent],
  template: `
    <app-header />
    <router-outlet />
    <app-footer />
  `,
})
export class MainLayoutComponent {}
```

`<router-outlet />` 由当前匹配的子路由组件替换，类似 React 的 `<Outlet />` / Vue 的 `<RouterView />`。

### 7.2 `authGuard`：函数式守卫

```ts
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthStore);
  const router = inject(Router);

  if (!auth.hydrated()) return true;            // 水合前放行
  if (auth.user() || auth.refreshToken()) return true;

  void router.navigate(['/login'], { state: { from: state.url } });
  return false;
};
```

- Angular 14+ 推荐 **函数式守卫**（`CanActivateFn`）：一个普通函数，配合 `inject()` 获取依赖。比旧式的 `@Injectable class Guard implements CanActivate` 简洁多了。
- 允许只有 `refreshToken` 的用户进入——下一次 API 调用会自动 refresh（详见 §9.2）。

## 9. 数据层：`api/api.service.ts`

跟 React/Vue 版几乎对等的逻辑，区别是用 `@Injectable` 类封装：

```ts
@Injectable({ providedIn: 'root' })
export class ApiService {
  private getAccessToken: () => string | null = () => null;
  private refreshing: Promise<string | null> | null = null;

  configure(opts: {...}) { this.getAccessToken = opts.getAccessToken; ... }

  private async tryRefresh(): Promise<string | null> {
    if (this.refreshing) return this.refreshing;            // 并发去重
    ...
  }

  private async request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json', ... };
    const accessToken = await this.accessTokenForRequest(useAuth);
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
    const res = await fetch(path, { ..., headers, body: ... });
    if (res.status === 204) return undefined as T;
    const env = (await res.json()) as Envelope<T>;
    if (!res.ok || !env.success) {
      if (this.shouldTryRefresh(res, env, useAuth, opts._retry)) {
        const newAt = await this.tryRefresh();
        if (newAt) return this.request<T>(path, { ...opts, _retry: true });
      }
      throw new ApiError(env.message ?? '请求失败', res.status, env.errorCode, env.details);
    }
    return env.data as T;
  }

  // ---------- 端点封装 ----------
  health = () => this.request<HealthData>('/api/v1/health', { auth: false });
  login = (body: LoginRequest) => this.request<AuthTokens>('/api/v1/auth/login', { method: 'POST', body, auth: false });
  plaza = (q: PlazaQuery = {}) => { ... };
  // ...
}
```

要点：

- **`@Injectable({ providedIn: 'root' })`** 让 Angular DI 容器全局共享一个 `ApiService` 实例。
- **用原生 `fetch` 而非 Angular 的 `HttpClient`**：刻意与 React/Vue 版同构，让三套实现的 API client 核心算法对应阅读。生产 Angular 项目通常用 `HttpClient` + interceptor。
- **自动 refresh**：与 React/Vue 版完全一致——`refreshing` 单例 Promise 去重，重放原请求时打 `_retry` 标记防死循环。
- **`configure(...)` 解耦循环依赖**：`ApiService` 不能 `inject(AuthStore)`（store 反过来注入了 service），所以由 AuthStore 的 `onInit` hook 主动调用 `api.configure({...})`。

### 9.1 延伸：HttpClient + Interceptor 的 Angular 原生写法

> 本节是**对照阅读**，不是本项目的实际代码。读完可以理解"为什么生产项目几乎都用 HttpClient"，以及它与 fetch 方案的差异在哪里。

#### 为什么 Angular 有 HttpClient？

`HttpClient` 是 Angular 内置的 HTTP 客户端，封装了 `XMLHttpRequest`（或 `fetch`，Angular 18+ 可选）。它返回 **RxJS Observable** 而非 Promise，这让请求可以在任何时机 `.pipe(takeUntilDestroyed())` 自动取消、可以用操作符链式转换结果。更重要的是，它内置了**拦截器（Interceptor）机制**：所有经过 `HttpClient` 的请求/响应都会流过一个拦截器管道，这是处理 auth header 注入和 token 刷新的 Angular 原生方案。

#### 整体架构

```
HttpClient.get('/api/v1/me')
    │
    ▼ 经过拦截器管道
authInterceptor          ← 注入 Bearer header；捕获 401 后刷新并重放
    │
    ▼
实际 HTTP 请求
    │
    ▼ 拦截器管道（响应方向）
Observable<Envelope<User>>
    │
    ▼
组件 / store .pipe(map(env => env.data!))
```

#### 第一步：配置 `provideHttpClient`

```ts
// app.config.ts
import { provideHttpClient, withInterceptors, withFetch } from '@angular/common/http';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(
      withInterceptors([authInterceptor]),
      withFetch(),           // Angular 18+：HttpClient 底层改用 fetch（可选）
    ),
  ],
};
```

#### 第二步：标记公开端点（`HttpContextToken`）

`HttpContextToken` 是一个"请求级元数据"机制——给某一次请求打上标签，拦截器读取后决定是否处理：

```ts
// api/auth.interceptor.ts
import { HttpContextToken } from '@angular/common/http';

// 默认 false = 需要鉴权；调用时 .set(SKIP_AUTH, true) 标记为公开端点
export const SKIP_AUTH = new HttpContextToken<boolean>(() => false);
```

使用方：
```ts
this.http.get('/api/v1/health', {
  context: new HttpContext().set(SKIP_AUTH, true),
})
```

#### 第三步：函数式 Auth Interceptor

```ts
// api/auth.interceptor.ts
import {
  HttpInterceptorFn, HttpRequest, HttpHandlerFn,
  HttpErrorResponse, HttpContext,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { AuthStore } from '@/stores/auth.store';
import { SKIP_AUTH } from './auth.interceptor';

// 模块级 Promise 去重：多个并发请求同时 401 时，只发一次 refresh
let refreshingPromise: Promise<string | null> | null = null;

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthStore);

  // 1. 注入 Bearer header（公开端点跳过）
  const authed = !req.context.get(SKIP_AUTH) && auth.accessToken()
    ? req.clone({ setHeaders: { Authorization: `Bearer ${auth.accessToken()}` } })
    : req;

  return next(authed).pipe(
    catchError((err: unknown) => {
      // 2. 捕获 401：尝试 refresh 后重放一次
      if (
        err instanceof HttpErrorResponse &&
        err.status === 401 &&
        !req.context.get(SKIP_AUTH) &&
        auth.refreshToken() &&
        !req.url.includes('/auth/refresh')  // 防止 refresh 本身也被拦截
      ) {
        return from(doRefresh(auth)).pipe(
          switchMap((newToken) => {
            if (!newToken) return throwError(() => err);
            const retried = req.clone({
              setHeaders: { Authorization: `Bearer ${newToken}` },
            });
            return next(retried);
          }),
        );
      }
      return throwError(() => err);
    }),
  );
};

async function doRefresh(auth: InstanceType<typeof AuthStore>): Promise<string | null> {
  // 并发去重：复用同一个飞行中的 Promise
  if (refreshingPromise) return refreshingPromise;

  refreshingPromise = (async () => {
    try {
      const res = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: auth.refreshToken() }),
      });
      const env = await res.json();
      if (!res.ok || !env.success || !env.data) {
        patchState(auth, { user: null, accessToken: null, refreshToken: null });
        return null;
      }
      patchState(auth, {
        accessToken: env.data.accessToken,
        refreshToken: env.data.refreshToken,
      });
      return env.data.accessToken as string;
    } catch {
      return null;
    } finally {
      refreshingPromise = null;
    }
  })();

  return refreshingPromise;
}
```

> **注意**：`doRefresh` 里仍然用了原生 `fetch` 直接调 `/auth/refresh`，目的是绕过拦截器管道——如果用 `HttpClient` 发 refresh，会再次经过同一个拦截器，遇到新的 401 又会触发 refresh，造成无限循环。这是 HttpClient 拦截器方案里一个常见的微妙之处。

#### 第四步：ApiService 改用 HttpClient

```ts
@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);

  // 公开端点：传 context 跳过 auth 拦截
  health = () =>
    this.http
      .get<Envelope<HealthData>>('/api/v1/health', {
        context: new HttpContext().set(SKIP_AUTH, true),
      })
      .pipe(map((env) => env.data!));

  // 登录后端点：拦截器自动注入 Bearer，无需手写 header
  me = () =>
    this.http.get<Envelope<User>>('/api/v1/me').pipe(map((env) => env.data!));

  plaza = (q: PlazaQuery = {}) =>
    this.http
      .get<Envelope<PaginatedCapsules>>('/api/v1/plaza/capsules', {
        params: new HttpParams({ fromObject: filterEmpty(q) }),
      })
      .pipe(map((env) => env.data!));
}
```

组件里消费 Observable：

```ts
// 选项 A：.subscribe（命令式，记得在 ngOnDestroy 取消订阅）
this.api.me().subscribe((user) => this.user.set(user));

// 选项 B：转为 Promise，跟现有 async/await 代码风格统一
const user = await firstValueFrom(this.api.me());

// 选项 C：配合 takeUntilDestroyed() 自动取消
this.api.plaza().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(...);
```

#### 两种方案对比

| | 本项目（原生 fetch） | HttpClient + Interceptor |
|---|---|---|
| **返回类型** | `Promise<T>` | `Observable<T>`（可转 Promise） |
| **Auth header** | `request<T>` 内部手写 | 拦截器统一注入，ApiService 无感 |
| **401 处理** | `request<T>` 里条件判断 + 递归重放 | `catchError` 操作符 + `switchMap` |
| **并发 refresh 去重** | `refreshing: Promise` 单例 | 同上，只是放在拦截器模块里 |
| **公开端点标记** | `opts.auth: false` 参数 | `HttpContextToken` |
| **请求取消** | `AbortController`（需手写） | `.pipe(takeUntilDestroyed())` 自动 |
| **测试** | `vi.stubGlobal("fetch", mock)` 直接 | `HttpClientTestingModule` + `HttpTestingController` |
| **跨栈对比可读性** | ✅ 与其余四家逐行等价 | ❌ 需要先懂 RxJS |
| **Angular 生产惯用法** | ❌（非典型） | ✅ |

#### 本项目的选择

本项目刻意选择 fetch 方案，因为五家前端（React/Vue/Angular/Svelte/Solid）的 API 客户端**核心算法同构**——同样的 refresh 去重、同样的 `_retry` 防死循环、同样的 `configureApi` 回调解耦——读者可以把 React 的 `api/client.ts` 和 Angular 的 `api/api.service.ts` 并排，差别只在"函数模块 vs 可注入 class"，HTTP 层本身是同一道题。一旦换成 RxJS 管道，这一层的对比价值就消失了。

如果你在真实 Angular 项目里复刻这套逻辑，HttpClient + Interceptor 是更正确的方向。

## 10. 状态层：NgRx Signal Store

[`@ngrx/signals`](https://ngrx.io/guide/signals) 是 NgRx 的现代化 store——基于 signals，没有 reducer/action 样板代码。本项目用它做四个 store：`AuthStore`、`PlazaStore`、`ThemeStore`、`CapsuleStore`。

### 9.1 创建一个 store

```ts
export const PlazaStore = signalStore(
  { providedIn: 'root' },                                  // 注册到 DI 容器
  withState<PlazaState>({                                  // 初始状态
    sort: 'new', filter: 'all', q: '', page: 1, pageSize: 15,
    items: [], pagination: null, loading: false, error: null,
  }),
  withMethods((store) => {                                 // 方法
    const api = inject(ApiService);
    async function doFetch() {
      const myId = ++fetchSeq;
      patchState(store, { loading: true, error: null });
      try {
        const data = await api.plaza({ sort: store.sort(), filter: store.filter(), ... });
        if (myId !== fetchSeq) return;
        patchState(store, { items: data.items, pagination: data.pagination, loading: false });
      } catch (e) { ... }
    }
    return {
      async fetch() { await doFetch(); },
      setSort(sort: PlazaSort) { patchState(store, { sort, page: 1 }); void doFetch(); },
      setFilter(filter: PlazaFilter) { ... },
      patchFavorited(capsuleId: string, favorited: boolean, count: number) {
        patchState(store, {
          items: store.items().map((it) => it.id === capsuleId
            ? { ...it, favoritedByMe: favorited, favoriteCount: count }
            : it),
        });
      },
    };
  }),
);
```

要点：

- **`signalStore` 是一个工厂函数**：组合 `withState` / `withMethods` / `withHooks` / `withComputed` 等「feature」生成一个 `@Injectable` 类。
- **状态字段自动暴露为 signal**：`store.items()` 调用一次拿到当前列表，模板里写 `[items]="plaza.items()"`。
- **`patchState(store, partial)`** 浅合并写入。**不能 `store.items = ...`**——signal 是只读读取器。
- **`inject(ApiService)` 在 `withMethods` 工厂里调用** ：这里也是 injection context，能拿到任何 `@Injectable`。

### 9.2 `withHooks`：生命周期钩子

`AuthStore` 用了 `withHooks` 注册 `onInit`：

```ts
export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState<AuthState>({...}),
  withMethods((store) => { ... }),
  withHooks((store) => {
    const api = inject(ApiService);
    return {
      onInit() {
        api.configure({
          getAccessToken: () => store.accessToken(),
          getRefreshToken: () => store.refreshToken(),
          onTokensRefreshed: (a, r) => { patchState(store, { accessToken: a, refreshToken: r }); ... },
          onAuthLost: () => { patchState(store, {...}); clearPersisted(); },
        });
        store.hydrate();
      },
    };
  }),
);
```

`onInit` 在 store 首次被 inject 时调用一次。这里做了两件事：

1. 把 store 的读取/回调注册到 `ApiService`，让 client 能拿 token、写回新 token、清除丢失态。
2. `store.hydrate()`：从 localStorage 读出持久化的 user/refreshToken。

> 对比 React 版的 `configureApi(...)` 写在 `stores/auth.ts` 模块顶层、Vue 版要 `wireAuthApi()` 显式触发：Angular 版**最优雅**——`onInit` 由 DI 容器自动触发，使用方完全无感。

### 9.3 在组件里用 store

```ts
export class PlazaComponent implements OnInit {
  plaza = inject(PlazaStore);
  auth = inject(AuthStore);
  ngOnInit() { if (this.auth.hydrated()) void this.plaza.fetch(); }
}
```

模板里：

```html
<app-capsule-grid [items]="plaza.items()" [loading]="plaza.loading()" />
<app-pagination
  [page]="plaza.page()"
  [totalPages]="plaza.pagination()?.totalPages ?? 0"
  (onChange)="plaza.setPage($event)" />
```

注意 **`plaza.items()` 是函数调用**。这一点与 React（`items` 直接是值）和 Vue（`items.value`）不同。

### 9.4 跨 store 联动 + 并发序列号

`FavoriteButton.toggle()` 收藏成功后，**直接调** `plaza.patchFavorited(...)`：

```ts
this.plaza.patchFavorited(this.capsule().id, true, r.favoriteCount);
```

Signal Store 是模块级单例，互调不破坏响应式。

`PlazaStore` 也用了「序列号」模式防并发覆盖：

```ts
let fetchSeq = 0;                              // 模块级闭包变量，不是 signal
async function doFetch() {
  const myId = ++fetchSeq;
  ...
  const data = await api.plaza({...});
  if (myId !== fetchSeq) return;               // 我已被淘汰
  patchState(store, { items: data.items, ... });
}
```

## 11. 页面层与组件层

### 10.1 一个页面的典型骨架

```ts
@Component({
  selector: 'app-plaza',
  standalone: true,
  imports: [RouterLink, PlazaToolbarComponent, CapsuleGridComponent, PaginationComponent],
  template: `
    <section class="cy-hero-block">...</section>
    <main class="cy-container">
      <app-plaza-toolbar />
      <app-capsule-grid [items]="plaza.items()" [loading]="plaza.loading()">
        <div empty class="cy-empty">广场暂无胶囊…</div>
      </app-capsule-grid>
      <app-pagination
        [page]="plaza.page()"
        [totalPages]="plaza.pagination()?.totalPages ?? 0"
        (onChange)="plaza.setPage($event)" />
    </main>
  `,
})
export class PlazaComponent implements OnInit {
  plaza = inject(PlazaStore);
  auth = inject(AuthStore);
  ngOnInit() { if (this.auth.hydrated()) void this.plaza.fetch(); }
}
```

模式：

- `@Component` 的 `imports` 数组列出本组件用到的所有指令、子组件——standalone 模式下，不在 imports 里的 selector 无法使用。
- 类的字段就是模板里能用的状态/动作。
- `ngOnInit` 触发首次副作用。
- 子组件用 `[input]="..."` 传数据、`(output)="..."` 接事件。

### 10.2 子组件：`input()` / `output()`

```ts
export class FavoriteButtonComponent implements OnChanges {
  capsule = input.required<{ id: string; favoritedByMe: boolean; favoriteCount: number }>();
  size = input<'sm' | 'md'>('sm');
  onChange = output<{ favorited: boolean; count: number }>();

  private auth = inject(AuthStore);
  private router = inject(Router);
  private plaza = inject(PlazaStore);
  private api = inject(ApiService);

  active = signal(false);
  count = signal(0);
  busy = signal(false);

  ngOnChanges(changes: SimpleChanges) {
    if (changes['capsule']) {
      this.active.set(this.capsule().favoritedByMe);
      this.count.set(this.capsule().favoriteCount);
    }
  }

  async toggle() {
    ...
    this.onChange.emit({ favorited: true, count: r.favoriteCount });
  }
}
```

- **`input()` 返回的是 signal**：模板里写 `capsule()` 调用一次拿当前值。`.required<T>()` 表示父必须传，否则编译报错。
- **`output()` 返回 `OutputEmitterRef`**：调 `.emit(value)` 触发，父组件用 `(onChange)="..."` 监听。
- **`ngOnChanges`** 在父传入的 input 变化时调用，这里把变化同步到本地 signal——和 React/Vue 版同构的「props → local state」模式，避免父外部更新后子仍显示旧值。

### 10.3 Content Projection：父往子塞模板

`CapsuleGridComponent`（子）：

```html
@else if (!loading() && items().length === 0) {
  <ng-content select="[empty]" />     <!-- 投放父组件里 [empty] 属性标记的节点 -->
} @else {
  <div class="cy-grid">
    @for (c of items(); track c.id) {
      <app-capsule-card [capsule]="c" [rightTemplate]="rightTemplate()" />
    }
  </div>
}
```

`PlazaComponent`（父）：

```html
<app-capsule-grid [items]="plaza.items()" [loading]="plaza.loading()">
  <div empty class="cy-empty">
    <div class="cy-empty__emoji">🌌</div>
    <p>广场暂无胶囊 —— 来当第一个写信给未来的人？</p>
  </div>
</app-capsule-grid>
```

`<ng-content select="[empty]">` 是 Angular 的 **「内容投影」**——对应 Vue 的具名 slot、React 的 `children`/render-props。

更复杂的场景用 `<ng-template>` + `NgTemplateOutlet`：`CapsuleCardComponent` 接收一个 `rightTemplate = input<TemplateRef<unknown> | null>(null)`，用 `<ng-template [ngTemplateOutlet]="rightTemplate()!" ...>` 渲染出来。

### 10.4 表单：`[(ngModel)]`

```html
<form class="cy-form" (ngSubmit)="submit()">
  <input class="cy-input" id="email" type="email" required [(ngModel)]="email" name="email" />
  <input class="cy-input" id="pwd"   type="password" required [(ngModel)]="password" name="password" />
  <button type="submit" [disabled]="busy()">{{ busy() ? '登录中…' : '登录' }}</button>
</form>
```

- `imports: [FormsModule]` 必须加，否则 `[(ngModel)]` 不可用。
- `[(x)]="y"` 是 `[x]="y" + (xChange)="y = $event"` 的语法糖（「banana-in-a-box」）。
- 此处 `email` / `password` 是普通字段（不是 signal）——表单的双向绑定不需要 signal。

### 10.5 `@HostListener` + `@ViewChild`：DOM 交互

`AppHeader` 的下拉菜单需要「点击外部关闭」与「Esc 关闭」：

```ts
export class AppHeaderComponent {
  @ViewChild('menuRef') menuRef!: ElementRef<HTMLDivElement>;
  menuOpen = signal(false);

  @HostListener('document:pointerdown', ['$event'])
  onPointerDown(e: PointerEvent) {
    if (this.menuOpen() && !this.menuRef?.nativeElement.contains(e.target as Node)) {
      this.menuOpen.set(false);
    }
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') this.menuOpen.set(false);
  }
}
```

模板：

```html
<div class="cy-user-menu" #menuRef>...</div>
```

- `#menuRef` 是「模板引用变量」，被 `@ViewChild('menuRef')` 抓住。
- `@HostListener('document:keydown', ...)` 让 Angular 帮你 add/remove 全局事件监听器，组件销毁时自动清理——比 React 的 `useEffect` 手动 add/remove 还省一行。

## 12. 工具函数：`utils/format.ts` 等

纯函数，没有 Angular 依赖，直接 import 用：

```ts
countdownTo(iso)               // 返回 { days, hours, minutes, seconds, expired }
fmtDateTime(iso)
localInputToIso(local)         // <input type="datetime-local"> → ISO UTC
avatarUrl(avatarId)            // → "/static/avatars/<id>.svg"
```

`CapsuleCardComponent` 的倒计时实现是一个值得对照的例子（用 signal + `setInterval`，没有引入额外 composable，因为 Angular 的「逻辑复用单元」是 service / function，组合方式与 Vue composable 不同）：

```ts
cd = signal(countdownTo(''));
private ticker: ReturnType<typeof setInterval> | null = null;

ngOnInit() {
  this.cd.set(countdownTo(this.capsule().openAt));
  if (!this.capsule().isOpened) {
    this.ticker = setInterval(() => {
      this.cd.set(countdownTo(this.capsule().openAt));
    }, 1000);
  }
}

ngOnDestroy() {
  if (this.ticker) clearInterval(this.ticker);
}
```

每秒 `set` 一次 signal，模板里 `{{ cd().days }}` 自动重渲染。已开启的胶囊不设 interval。

## 13. 样式层：Tailwind + 设计令牌

```css
/* src/styles/index.css */
@import "tailwindcss/index.css";
@import "../../../../spec/styles/palette.css";    /* 色阶变量 --brand-500 等 */
@import "../../../../spec/styles/tokens.css";     /* 语义令牌 --color-text-primary 等 */
@import "../../../../spec/styles/cyber.css";      /* 共享类 cy-btn / cy-card / cy-capsule */
@import "./layout.css";
```

- `spec/styles/tokens.css` 是 **设计系统的单一来源**。所有前端实现共用同一份。修改 token 一次，所有前端生效。
- 主题切换靠 `data-theme="dark" | "light"`：tokens.css 里用 `[data-theme="dark"] { --color-text-primary: ... }` 重写变量。
- 组件用 **`cy-*` 共享类**（如 `cy-btn cy-btn--primary`），底层是 CSS 变量。
- Tailwind v4 通过 `@tailwindcss/postcss` 接入（在 `postcss.config.mjs` 里）。
- 内联 `style="..."` 或 `[style.color]="..."` 仅用于一次性微调。
- **Angular 默认开启 `ViewEncapsulation.Emulated`**：组件 `styles: [...]` 里写的 CSS 会被加属性选择器（如 `[_ngcontent-abc-123]`）做作用域隔离，不会泄漏到其他组件。本项目大部分组件没写组件级样式，全靠全局 `cy-*` 类。

## 14. 测试

`./test` 跑 **vitest run**，覆盖两个文件共 7 个用例：

| 文件 | 用例 | 测什么 |
|---|---|---|
| `src/app/api/api.service.test.ts` | 3 | `ApiService` 的 refresh 重放：missing access token → refresh → 重发；401 过期 → refresh → 重放；logout 不触发 refresh |
| `src/app/utils/format.test.ts` | 4 | `countdownTo` 分解秒数、过期判断；`fmtNumber` 千分位；local ↔ iso 往返 |

这两类是全栈前端测试里**最值得测**的东西：auth refresh 是有副作用的并发逻辑，format 工具是跨组件复用的纯函数。

vitest 直接 `new ApiService()` 实例化（无需 TestBed），用 `vi.stubGlobal("fetch", ...)` mock 网络，与其他四家前端的测试口径完全一致，可并排对比。

Angular 的其他测试选项：组件渲染可用 [Angular Testing Library](https://testing-library.com/docs/angular-testing-library/intro/) + `TestBed`；E2E 用 Playwright（项目 `verification/ui/` 已有 25 个黑盒冒烟用例覆盖全流程）。

## 15. 常见改动指南

| 想做什么 | 改哪里 |
|---|---|
| 加一个新页面 | ① `src/app/pages/xxx/xxx.component.ts` 写组件；② `src/app/app.routes.ts` 用 `loadComponent: () => import(...)` 加路由 |
| 加一个登录后才能访问的页面 | 同上，路由配置加 `canActivate: [authGuard]` |
| 加一个 API 端点 | ① `src/app/types/index.ts` 加请求/响应类型；② `src/app/api/api.service.ts` 在 `ApiService` 类里加方法 |
| 加一个状态域 | `src/app/stores/xxx.store.ts` 用 `signalStore({ providedIn: 'root' }, withState(...), withMethods(...))` |
| 加一个可复用 UI | `src/app/components/xxx/xxx.component.ts`，用 `input()` / `output()` 声明接口；用方记得加进 `imports: [...]` |
| 加一个表单字段 | 在组件类加字段（普通或 signal），模板 `<input [(ngModel)]="x" name="x" />`，确保 `imports: [FormsModule]` |
| 改 API 代理目标 | `BACKEND_PROXY=http://localhost:29010 ./run`（脚本会重写 `proxy.conf.local.json`） |
| 改主题色 / 间距 | 修改 `spec/styles/tokens.css`，所有前端同步生效 |
| 全局监听键盘 / 点击 | 组件类加 `@HostListener('document:keydown', ['$event'])` 方法，自动清理 |
| 想在 service 之外读 store | 任何 `@Injectable` 服务里都能 `inject(AuthStore)`；DI 容器全局共享 |

## 16. 学到这里之后

读到这里，你已经掌握了 Angular SPA 最常见的 80%：装饰器 + 元数据、`inject()` 依赖注入、Standalone Component + `imports` 数组、Signals 三件套（`signal` / `computed` / `effect`）、新控制流 `@if`/`@for`、`input()`/`output()` signal API、`<router-outlet>` + 函数式守卫 + 懒加载、NgRx Signal Store（`signalStore` / `withState` / `withMethods` / `withHooks`）、内容投影 `<ng-content>`、`@HostListener`/`@ViewChild`。

下一步建议：

- 翻 `src/app/pages/create/create.component.ts`（最复杂的页面），跟读「填表单 → 调 AI 建议 → 提交 → 跳详情」整条路径。
- 把项目同时启起来：`hello start angular`、`hello start react-ts`、`hello start vue3-ts`，三个并排对比同一页面。React 走 Hook + 重渲染、Vue 走 ref + 模板指令、Angular 走装饰器 + signal——理念差异一目了然。
- 在 `AuthStore.refreshMe` 加 `console.log`，刷新页面观察「水合 → effect 触发 → /me 调用」的连锁反应。

之后可以再深入研究 Angular 的几个常见进阶主题：`HttpClient` + interceptor（原理和与本项目 fetch 方案的对比见 §9.1）、Reactive Forms（替代 `[(ngModel)]` 的 Template Driven Forms）、`OnPush` 变更检测策略（性能优化）、RxJS Observables（异步流的 Angular 原生范式）、SSR / Hydration（`@angular/ssr`）、zoneless 模式。本项目刻意保持极简，把这些留给后续。
