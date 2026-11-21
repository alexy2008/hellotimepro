# HelloTime Pro · Vue 3 + TypeScript（2.0）

Vue 3.5 + TypeScript + Vite 6 + Pinia + Vue Router 4，两套皮肤「时笺」「琥珀」× 明暗。
全程 `<script setup lang="ts">` 单文件组件 + 组合式 API；视觉基准是 2.0 原型（`2.0版原型byClaude-合集/`），样式原样引入 `spec/styles`，契约见 `spec/api/openapi.yaml` 2.0.0。
功能与交互逐项对齐参考前端 `frontends/react-ts`，写法走 Vue 自己的路子（见下文「Vue 的写法」）。

## 快速开始

```bash
# 一次性：起一个后端（默认 FastAPI），把 :9080 指过去
cd ../../
./scripts/db init
./scripts/hello start fastapi
./scripts/hello switch fastapi

# 启动前端（端口 7173）
./scripts/hello start vue        # 或者：cd frontends/vue3-ts && ./run
# → http://localhost:7173
```

也可以跳过 :9080 反代直连后端：`BACKEND_PROXY=http://localhost:29010 ./run`

## 脚本

| 脚本 | 作用 |
|---|---|
| `./run` | 起 dev server（端口 7173） |
| `./build` | 类型检查（vue-tsc）+ 生产构建到 `./dist` |
| `./test` | 单元测试（vitest + happy-dom） |

UI 冒烟（两套皮肤各跑一遍）：`./verification/scripts/verify-ui-smoke.sh vue3-ts`
设计令牌：`./verification/scripts/verify-design-tokens.sh vue3-ts`

## 目录结构

```
src/
├── main.ts               ← 装 Pinia → 恢复登录态 → 装路由 → 挂载（守卫第一帧就有登录态）
├── App.vue               ← 总布局：按皮肤挑页头 / 页脚 / 底栏，main#view 放 <RouterView>
├── router/
│   ├── index.ts          ← 路由表 + 导航守卫（requiresAuth / guestOnly）+ 查询串编码
│   └── skinned.ts        ← skinned()：同一条路由按当前皮肤渲染两份视图之一
├── api/client.ts         ← fetch 封装、统一响应解包、401 自动 refresh 并重放（单飞）
├── types/                ← 与 openapi 2.0.0 对齐的类型（含 PlazaStats / MyStats）
├── stores/               ← Pinia（setup 风格）
│   ├── auth              登录态（access 在内存，refresh + user 在 localStorage）
│   ├── ui                皮肤 / 明暗，View Transition 转场
│   ├── plaza             广场条件、列表、数量、年鉴、精选；搜索防抖计时器也在这里
│   ├── feedback          Toast 与确认框
│   ├── draft             创建页草稿（换账号自动清空）
│   └── forms             登录 / 注册 / 资料 / 改密码的表单值（换账号自动清空）
├── composables/          ← 两套皮肤共用的业务逻辑（组合式函数）
│   ├── usePlazaHome      首页：进入刷新、/ 聚焦、到点刷新、v-model 用的 sort/filter/qInput、年鉴数数
│   ├── useCodeOpen       凭码开启（首页就地输码与开启页共用）
│   ├── useCapsule        详情：取数、逐秒倒数、到点后等服务端确认开启（awaitOpened）；我封存过的胶囊
│   ├── useCreateCapsule  创建：草稿字段（可写 computed）、校验、AI 推荐与代笔、封存
│   ├── useAccount        登录 / 注册 / 我的统计与列表（加载更多）/ 资料与密码；离开页面清表单
│   ├── useNow            全局整秒节拍
│   ├── useShell          当前导航项、页头滚动态、明暗切换、/health
│   ├── useMotion         useShake（抖一下）、useSlider（分段控件 / 页签 / 导航的滑块）
│   └── useLoginPrompt    匿名点收藏或创建：先确认再去登录
├── lib/                  ← 纯工具：时间说法、开启时间上下限与预设、图标、头像、专属色、关于页文字、登录回跳
├── components/           ← 结构两套相同、只靠样式换肤的部件：SegControl、FavButton、FormField…
├── skins/
│   ├── paper/            ← 「时笺」：外壳 · 首页 · 卡片 · 详情 · 开启 · 创建（标尺 / 日历 / 长按封缄 / 封缄仪式）· 账号 · 关于
│   └── amber/            ← 「琥珀」：同上 + 星空背景（AmberBackdrop / sky.ts）
└── styles/index.css      ← 自托管字体 + spec/styles（base → 时笺 → 琥珀 → shell）
```

## 路由

| 路由 | 页面 | 权限 |
|---|---|---|
| `/` | 首页：广场概览 + 就地输码 + 胶囊广场 | 公开 |
| `/open` | 凭码开启（登录后附「我封存过的胶囊」） | 公开 |
| `/capsules/:code` | 胶囊详情（倒计时归零自动开启） | 公开 |
| `/create` | 写一枚胶囊 | 登录 |
| `/login` · `/register` | 登录 / 注册（支持 `?redirect=`；已登录访问直接跳走） | 公开 |
| `/me/created` · `/me/favorites` · `/me/profile` | 我的（一条路由 `/me/:tab(created\|favorites\|profile)`） | 登录 |
| `/about` | 关于 | 公开 |
| 其他 | 404 | 公开 |

## 设计要点

- **逻辑一份，视图按皮肤分**：业务逻辑在 `composables/` 与 `stores/`；结构差异大的视图在 `skins/paper` 与 `skins/amber` 各一份；表单字段、分段控件、收藏按钮、Toast、确认框只写一份，靠 `spec/styles` 换肤。路由组件由 `skinned()` 生成，按 `ui.skin` 渲染对应视图。
- **皮肤与明暗**：`<html data-skin data-theme>`，首帧前由 `index.html` 内联脚本从 `localStorage`（`hellotime.skin` / `hellotime.theme`）写好；切换用 View Transition（回调里等 `nextTick()`，新画面才是 Vue 更新后的 DOM），减少动效时直接切。切换时路由、草稿、表单、广场筛选都不丢——它们都在 store 里。
- **样式**：不写组件样式，类名与 DOM 结构照 2.0 原型；本前端自己的胶水只有两处 SFC `<style>`（`App.vue` 让 `#app` 不参与布局，`ListMore.vue` 的居中），只用 `base.css` 刻度。不用 Tailwind。
- **测试钩子**：所有关键元素带 `spec/ui/testids.md` 规定的 `data-testid` 与状态属性；长按封缄可用键盘空格按住完成，完成由定时器驱动（后台标签页不会卡住）。
- **存储策略**：access token 在内存，refresh token 与 user 在 `localStorage`，在装路由之前恢复；XSS 权衡见 `docs/02-design.md §7.2`。
- **收藏与创建入口**：2.0 起任何胶囊都能收藏；乐观更新、失败回滚；匿名用户点收藏或任一「创建」入口（首页、导航、底栏、空状态、详情页）都先弹确认框，再带 `?redirect=` 去登录。

## Vue 的写法（与 React 参考实现对照）

| 关注点 | React 参考 | 本实现 |
|---|---|---|
| 共享逻辑 | 自定义 Hook | 组合式函数，返回 `ref` / `computed` / 函数；视图里 `reactive(useXxx())` 直接点属性 |
| 全局状态 | Zustand | Pinia setup store；「换账号清草稿 / 表单」是 store 内的 `watch(() => auth.user?.id)` |
| 整秒节拍 | `useSyncExternalStore` | 模块级 `ref` + 使用计数 + `onScopeDispose` 停表 |
| 路由守卫 | `<AuthGate>` 组件、`useGuestRedirect` | `router.beforeEach` + `meta.requiresAuth / guestOnly`，只有 refresh token 时先 `await refreshMe()` |
| 「我的」页签 | `/me/:tab` + 组件内 `Navigate` 兜底 | 正则参数 `/me/:tab(created\|favorites\|profile)` + `/me/:rest(.*)` 重定向 |
| 离开页面清表单 | 卸载时看 `location.pathname` | `onBeforeRouteLeave` / `onBeforeRouteUpdate`（换皮肤不过路由守卫，天然不误清） |
| 表单绑定 | 受控组件 `value` + `onChange` | `v-model`、`defineModel()`、可写 `computed`（写入时顺手清错误） |
| 字段尾部小部件 | `trail` prop 传 ReactNode | `#trail` 具名插槽 |
| 分段控件 | 泛型函数组件 | `<script setup generic="T extends string">` + `defineModel<T>()` |
| 拦截匿名「创建」 | 包一层 `<Link onClick>` | `RouterLink` 的 `custom` 插槽，自己渲染 `<a>` 并在 `navigate` 之前拦下 |
| 浮层 | `createPortal` | `<Teleport to="body">` |
| 确认框正文 | ReactNode | 函数式组件 `() => h(...)`，`<component :is>` 渲染（用户文字照常转义） |
| DOM 引用 | `useRef` | `useTemplateRef`（可以在组合函数里用，如搜索框、年鉴数字） |
| 滑块定位 | 四处 `useLayoutEffect` | 一个 `useSlider`（`watch(..., { flush: "post" })`） |
| SVG 渐变 id | `useId()` 去冒号 | Vue 3.5 `useId()`（`v-N`，可直接放进 `url(#…)`） |
| 按皮肤挑视图 | `pages/` 下 9 个入口组件 | `router/skinned.ts` 一个工厂函数 |

## 验证

- 单元测试：`./test`（时间说法、日历年上限、专属色、登录回跳、refresh 单飞与重放、草稿 / 表单随账号清空）
- UI 冒烟：44 条 × 两套皮肤 = 88 条
- 设计令牌：`./verification/scripts/verify-design-tokens.sh vue3-ts`（自己的样式只用刻度与语义令牌、无色值字面量）

## 2.0 验证

**2026-11-21 复核修复。** `skinned` 在路由的 `setup` 提供创建表单或输码状态，两套视图通过注入共用同一实例。`vue-tsc --noEmit` 已检查 TypeScript 和 Vue 模板。分页、昵称、AI 手动编辑和异常重试的共同行为见[升级指南第 2 节](../../docs/05-upgrade-2.0.md)。下列冒烟及其他运行记录均来自修复前，本轮仅做静态检查。

| 项目 | 结果 | 数据库 | 日期 |
|---|---|---|---|
| UI 冒烟（`verify-ui-smoke.sh vue3-ts`，paper 44 + amber 44） | ✅ 88/88 | PostgreSQL | 2026-11-21 |
| UI 冒烟（fastapi 以 `DB_DRIVER=sqlite` 重启后再跑，跑完已恢复 PostgreSQL） | ✅ 88/88 | SQLite | 2026-11-21 |
| 设计令牌（`verify-design-tokens.sh vue3-ts`，扫描 3 个样式文件） | ✅ 通过 | — | 2026-11-21 |
| `./build`（vue-tsc + vite build） | ✅ 通过 | — | 2026-11-21 |
| `./test`（vitest，3 个文件） | ✅ 17/17 | — | 2026-11-21 |

另在浏览器里目视过两套皮肤 × 明暗的首页、详情（未开启 / 查无此码）、创建页（含标尺键盘调整与日历），控制台无 Vue 警告。

## 2.0 迁移笔记

清单（`docs/05-upgrade-2.0.md` §2）之外，这次在 Vue 上踩到的：

1. **守卫返回的跳转目标会被 Vue Router 重新编码**：`beforeEach` 里 `return "/login?redirect=%2Fcreate"`，路由器会把它解析成对象再拼回去，默认的查询串编码保留 `/`，地址栏变成 `?redirect=/create`，X7 的冒烟（期望 `%2Fcreate`）失败。直接 `router.push(字符串)` 不受影响（保留原串），所以「确认后去登录」能过、守卫跳转不能过。解法：`createRouter({ stringifyQuery })` 换成 `encodeURIComponent` 编码，所有路由生成的查询串都与 `loginPath()` 一致。**Nuxt 同样基于 vue-router，升级时注意。**
2. **View Transition 要等 Vue 更新完 DOM**：`document.startViewTransition(cb)` 拍「新画面」的时机是 `cb` 返回（的 Promise 完成）之后；Vue 的 DOM 更新是异步批量的，`cb` 里改完状态要 `return nextTick()`，否则拍到的是旧皮肤。
3. **离开页面才清表单**：用 `onBeforeRouteLeave` 判断「真的离开」比卸载时看地址栏更贴 Vue；但 `/me/created ↔ /me/profile` 是同一条路由的参数变化，不触发 leave，资料 / 密码表单还要配 `onBeforeRouteUpdate`。
4. **`v-for` 里的字符串 ref 不保证顺序**：时笺 8 格输码要按下标跳焦点，改用函数式 ref `:ref="(el) => (inputs[i] = el)"`。
5. **拦截匿名点击「创建」**：给 `<RouterLink>` 加 `@click` 时，透传的监听器排在它自己的 `navigate` 之后，`preventDefault` 来不及；要用 `custom` 插槽自己渲染 `<a>`（`components/CreateLink.vue`）。
6. **搜索防抖的计时器放在 store 里**：视图里各自防抖的话，输入后 300ms 内切皮肤（视图被换掉）会丢掉最后几个字；放进 `plaza` store 后切皮肤不丢字。交互与 React 一致。
7. **删除确认框的正文不用 `v-html`**：正文里有用户写的标题，用函数式组件 `() => h("p", [...])` 描述，交给 `<component :is>` 渲染，文字照常转义。
8. **跑 SQLite 那轮时确认后端真的换了库**：`hello status` 显示的 `DB_DRIVER` 是保存的默认值，不是进程实际用的；以 `/api/v1/health` 的技术栈（出现 SQLite）或 `data/sqlite/hellotime-fastapi.db` 的写入时间为准。
