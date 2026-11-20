# HelloTime Pro · Angular 19 + TypeScript（2.0）

Angular 19（standalone 组件 + Signals）+ TypeScript + `@angular/build`（esbuild）+ NgRx Signal Store，两套皮肤「时笺」「琥珀」× 明暗。
视觉基准是 2.0 原型（`2.0版原型byClaude-合集/`），样式原样引入 `spec/styles`，契约见 `spec/api/openapi.yaml` 2.0.0。
功能与交互逐项对齐参考前端 `frontends/react-ts`，写法走 Angular 自己的路子（见下文「Angular 的写法」）。

## 快速开始

```bash
# 一次性：起一个后端（默认 FastAPI），把 :9080 指过去
cd ../../
./scripts/db init
./scripts/hello start fastapi
./scripts/hello switch fastapi

# 启动前端（端口 7175）
./scripts/hello start angular     # 或者：cd frontends/angular && ./run
# → http://localhost:7175
```

也可以跳过 :9080 反代直连后端：`BACKEND_PROXY=http://localhost:29010 ./run`（`./run` 按它生成 `proxy.conf.local.json`，Angular CLI 需要静态 JSON 代理文件）。

## 脚本

| 脚本 | 作用 |
|---|---|
| `./run` | 起 dev server（`ng serve`，端口 7175） |
| `./build` | 生产构建（`ng build`，AOT + 严格模板类型检查）到 `./dist` |
| `./test` | 单元测试（vitest，纯函数与 API 客户端） |

UI 冒烟（两套皮肤各跑一遍）：`./verification/scripts/verify-ui-smoke.sh angular`
设计令牌：`./verification/scripts/verify-design-tokens.sh angular`

## 目录结构

```
src/
├── index.html            ← 首帧前写好 <html data-skin data-theme> 的内联脚本
├── main.ts               ← bootstrapApplication(AppComponent, appConfig)
├── styles/               ← index.css：自托管字体 + spec/styles；app.css：唯一的样式胶水
└── app/
    ├── app.config.ts     ← 路由（回顶）· TitleStrategy · provideAppInitializer（第一次导航前恢复登录态）
    ├── app.routes.ts     ← 路由表：每条路由懒加载一个「宿主页」，守卫用函数式 CanActivateFn
    ├── app.component.ts  ← 总布局：按皮肤挑页头 / 页脚 / 底栏，<router-outlet> 放页面
    ├── api/              ← ApiService：fetch 封装、统一响应解包、401 自动 refresh 并重放（单飞）
    ├── types/            ← 与 openapi 2.0.0 对齐的类型（含 PlazaStats / MyStats）
    ├── stores/           ← NgRx Signal Store：auth · ui（皮肤 / 明暗）· plaza · feedback · draft
    ├── core/             ← 全局服务与函数：守卫、TitleStrategy、Clock（整秒节拍）、HealthService、LoginPrompt、导航项
    ├── pages/            ← 每个路由一个文件夹：宿主页（*.page.ts）+ 页面逻辑（*.facade.ts）
    │   ├── home          HomeFacade：进入 / 换账号刷新、到点刷新、热度榜
    │   ├── open          OpenFacade：我封存过的胶囊（输码状态在 shared/CodeOpener）
    │   ├── capsule       CapsuleFacade：取数、逐秒倒数、到点后等服务端确认开启（awaitOpened）
    │   ├── create        CreateFacade：草稿字段、校验、AI 推荐与代笔、封存
    │   ├── login · register  表单值、校验、提交
    │   ├── me            MeFacade（页签、统计）· ProfileFacade（资料与改密码）· injectMyList（分页加载更多）
    │   └── about · not-found
    ├── shared/           ← 两套皮肤结构相同的部件与指令：Field、Seg、FavButton、AvatarPicker、DialogHost…
    │                       指令：appIcon · appShake · appSliderThumb · appSlashFocus · appCountUp · appPortal · appCreateLink · *appKey
    │                       管道：fmt
    ├── skins/
    │   ├── paper/        ← 「时笺」：parts（印章 / 火漆 / 信封 / 邮戳 / 卡片 / 输码…）· shell · home · capsule · create · account · about
    │   └── amber/        ← 「琥珀」：同上 + shell/backdrop（星空粒子）
    └── lib/              ← 纯工具：时间说法、开启时间规则、账号校验、图标、头像（构建期内联 spec/avatars/v2）、专属色、关于页文字、登录回跳
```

## 路由

| 路由 | 页面 | 权限 |
|---|---|---|
| `/` | 首页：广场概览 + 就地输码 + 胶囊广场 | 公开 |
| `/open` | 凭码开启（登录后附「我封存过的胶囊」） | 公开 |
| `/capsules/:code` | 胶囊详情（倒计时归零自动开启） | 公开 |
| `/create` | 写一枚胶囊 | 登录（`authGuard`） |
| `/login` · `/register` | 登录 / 注册（支持 `?redirect=`；已登录访问直接跳走，`guestGuard`） | 公开 |
| `/me/created` · `/me/favorites` · `/me/profile` | 我的（一条路由 `me/:tab`，`meTabGuard` 只认三个页签） | 登录 |
| `/about` | 关于 | 公开 |
| `**` | 404 | 公开 |

## 设计要点

- **逻辑一份，视图按皮肤分——靠依赖注入**：每个路由的宿主页组件在 `providers` 里提供本页的 Facade，再按 `ui.skin()` 渲染时笺或琥珀的视图；两套视图 `inject()` 到的是同一个 Facade 实例。切换皮肤时宿主不动、Facade 还在（表单值、错误、推荐、回执都不丢，X5）；离开页面时宿主销毁、Facade 随之销毁（表单自然清空）。跨页面要留的状态（登录态、广场筛选、创建页草稿）放在根级 Signal Store 里。
- **皮肤与明暗**：`<html data-skin data-theme>`，首帧前由 `index.html` 内联脚本从 `localStorage`（`hellotime.skin` / `hellotime.theme`）写好；切换用 View Transition（回调里改完状态立刻 `appRef.tick()`，新画面才是更新后的 DOM），减少动效时直接切。
- **DOM 与原型一致**：Angular 会为组件多渲染一层宿主元素，而皮肤样式按原型的层级写（`.almanac__cell + .almanac__cell`、`.badge + .badge`、`:nth-child`…）。所以只有一个根元素的部件用**属性选择器**直接长在原型元素上（`<article appPaperCard>`、`<svg appIcon="pen">`、`<header appAmberHeader>`），其余宿主元素统一 `display: contents`（`shared/host.ts` 的 `CONTENTS`）。
- **样式**：不写组件样式、不用 Tailwind；本前端只有 `styles/app.css` 两条胶水，只用刻度令牌。时笺字体用 `@fontsource` 自托管。
- **测试钩子**：所有关键元素带 `spec/ui/testids.md` 规定的 `data-testid` 与状态属性；长按封缄可用键盘空格按住完成，完成由定时器驱动（后台标签页不会卡住）。
- **存储策略**：access token 在内存，refresh token 与 user 在 `localStorage`，`provideAppInitializer` 在第一次导航前恢复；XSS 权衡见 `docs/02-design.md §7.2`。
- **收藏与创建入口**：2.0 起任何胶囊都能收藏；乐观更新、失败回滚；匿名用户点收藏或任一「创建」入口（首页、导航、底栏、空状态、详情页）都先弹确认框，再带 `?redirect=` 去登录。

## Angular 的写法（与 React 参考实现对照）

| 关注点 | React 参考 | 本实现 |
|---|---|---|
| 页面逻辑 | 自定义 Hook，每套视图各调一次 | `@Injectable()` Facade，由路由宿主组件的 `providers` 提供，两套视图注入同一份 |
| 全局状态 | Zustand | NgRx Signal Store（`withState / withMethods / withHooks`）；草稿「换账号清空」是 `withHooks.onInit` 里的 `effect` |
| 搜索防抖 | 视图里的 `setTimeout` | `rxMethod` + `switchMap(timer(300))`，可取消；放在 PlazaStore 里，切皮肤不丢字 |
| 表单跨皮肤保留、离开清空 | 内存 store + 卸载时看地址栏 | Facade 的生命周期就是宿主页的生命周期，不需要额外判断 |
| 路由守卫 | `<AuthGate>` 组件、`useGuestRedirect` | 函数式 `CanActivateFn` 返回 `UrlTree`；`authGuard` 只剩 refresh token 时先 `await refreshMe()` |
| 页面标题 | 每页 `useEffect` 写 `document.title` | 路由 `title` + 自定义 `TitleStrategy` 统一加后缀 |
| 换页回顶 | Layout 里 `scrollTo` | `withInMemoryScrolling({ scrollPositionRestoration: 'top' })` |
| 首帧前恢复登录态 | `main.tsx` 里先 `hydrate()` | `provideAppInitializer(() => inject(AuthStore))` |
| 组件输入输出 | props / 回调 | `input()` / `input.required()` / `output()` / `model()`（`[(value)]` 双向绑定） |
| 字段尾部小部件 | `trail` prop 传 ReactNode | 内容投影 `<ng-content select="[appTrail]">` + `contentChild(TrailDirective)` |
| 复用的小行为 | 各处 `useEffect` / `useLayoutEffect` | 指令：`appShake`、`appSliderThumb`、`appSlashFocus`、`appCountUp`、`appPortal`、`appCreateLink` |
| 重建节点重播动画 | `key` | 结构型指令 `*appKey="value"` |
| 外部数据驱动的本地状态 | `useState` + `useEffect` 同步 | `linkedSignal`（收藏按钮的 on / count） |
| 确认框正文 | ReactNode | `*ngComponentOutlet` 渲染「组件 + 输入」（用户文字走插值转义） |
| 格式化 | 模板里调用 `fmt.*` | 纯管道 `{{ t | fmt: 'date' }}` |
| SVG 部件 | 函数组件返回 `<svg>` | 组件直接长在 `<svg>` 上，模板图形带 `svg:` 前缀 |
| DOM 引用 | `useRef` | `viewChild()` / `viewChildren()` 信号查询 |

## 验证

- 单元测试：`./test`（时间说法、日历年上限、专属色、登录回跳、账号校验规则、refresh 单飞与重放）
- UI 冒烟：44 条 × 两套皮肤 = 88 条
- 设计令牌：`./verification/scripts/verify-design-tokens.sh angular`

## 2.0 验证

| 项目 | 结果 | 数据库 | 日期 |
|---|---|---|---|
| UI 冒烟（`verify-ui-smoke.sh angular`，paper 44 + amber 44） | ✅ 88/88 | PostgreSQL | 2026-11-21 |
| UI 冒烟（fastapi 以 `DB_DRIVER=sqlite` 重启后再跑，`/health` 确认为 SQLite，跑完已恢复 PostgreSQL） | ✅ 88/88 | SQLite | 2026-11-21 |
| 设计令牌（`verify-design-tokens.sh angular`，扫描 2 个样式文件） | ✅ 通过 | — | 2026-11-21 |
| `./build`（`ng build`，AOT + `strictTemplates`，无警告） | ✅ 通过 | — | 2026-11-21 |
| `./test`（vitest，3 个文件） | ✅ 16/16 | — | 2026-11-21 |

另用 Playwright 在 1280×800 下截图看过两套皮肤的首页、广场、详情、注册、关于页，控制台无错误、无警告。

## 2.0 迁移笔记

清单（`docs/05-upgrade-2.0.md` §2）之外，这次在 Angular 上踩到的：

1. **宿主元素破坏原型的 DOM 层级**：每个组件多一层 `<app-xxx>`，`body` 的纵向 flex、`.almanac__cell + .almanac__cell`、`.spec + .spec`、`.badge + .badge`、`.code__cell:nth-child(n)` 都会受影响。单根部件改用属性选择器（组件就是那个 `<article>` / `<svg>` / `<header>`），其余宿主 `display: contents`。`host: CONTENTS` 引用外部常量，AOT 能静态求值。
2. **长在 `<svg>` 上的组件**：模板里的图形要写 `<svg:path>` 这类前缀，否则会被创建成 HTML 命名空间的元素、画不出来。
3. **用 `[(value)]` 再叠一个 `(valueChange)` 不稳妥**：需要「写入时顺手清错误」的字段改成显式的 `[value]` + `(valueChange)="facade.set(…)"`。
4. **信号输入在构造函数里还没绑定**：指令要读输入（比如自动聚焦的延迟），放到 `ngOnInit` 或 `afterNextRender` 里。
5. **`@if` 里的节点是「先创建、后插入」**：要把浮层挪到 `<body>`（封缄仪式）必须等 `afterNextRender`，在构造函数里挪会被随后的插入挪回去。
6. **重建节点别用 `@for (k of [x]; track k)`**：能用，但开发模式会刷 `NG0956`（整个集合被重建）的警告。写一个 `*appKey` 结构型指令（`ViewContainerRef.clear()` + `createEmbeddedView()`）更地道，控制台也干净。
7. **esbuild 没有 `import.meta.glob`**：内联 `spec/avatars/v2` 改用 `angular.json` 的 `"loader": { ".svg": "text" }` 加显式 import。
8. **构建预算**：两套皮肤的样式全量引入后，初始包约 1 MB（其中 CSS 约 650 KB），默认的 1 MB 上限会让 `ng build` 失败，预算调到 1.5 MB 警告 / 2.5 MB 报错。
9. **`hello status` 显示的 `DB_DRIVER` 是保存的默认值**：SQLite 那轮以 `/api/v1/health` 的技术栈出现 SQLite 为准。
10. **`proxy.conf.local.json` 是被跟踪的文件，`./run` 每次都会按 `BACKEND_PROXY` 重写它**：跑冒烟时会被改成 `127.0.0.1:9080`，提交前记得还原，别把它带进提交。
