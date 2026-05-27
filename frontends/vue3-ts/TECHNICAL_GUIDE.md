# HelloTime Pro Vue 3 + TypeScript 前端技术手册与代码导读

本文面向已经熟悉 HTML / CSS / JavaScript 基本语法，但还没系统接触过 Vue、TypeScript、Vite、单页应用（SPA）这套现代前端栈的读者。读完后，你应该能回答三件事：

- 用户在浏览器输入 URL 后，代码按什么顺序执行。
- Vue 3、TypeScript、Vite、Vue Router、Pinia、Tailwind 分别在做什么。
- 想新增一个页面、状态或接口调用时，应该改哪些文件。

> 阅读建议：第 1 节介绍技术栈与设计特色；第 2～4 节建立整体地图与入口链路；第 5 节集中讲 Vue 的几个核心概念（SFC、Composition API、响应式、模板指令）；第 6 节快速过 TypeScript；第 7～14 节按一次「打开页面」的生命周期分层细讲；第 15 节给出常见改动的步骤清单。

> 如果你已经读过这个项目的 React 版技术手册，建议从 **§5 (响应式 vs 重渲染)** 与 **§10 (Pinia setup store)** 看起——这是两套生态最不同的地方。

## 1. 技术选型与设计特色

HelloTime Pro 的 Vue 3 前端实现基于 **Vue 3 + TypeScript + Vite** 核心骨架，并选用 **Vue Router** 控制路由、**Pinia** 进行轻量级状态管理、**Tailwind CSS v4** 配合 **Design Tokens**（设计令牌）定制视觉系统。其具体选型考量与设计特色如下：

* **Vue 3 与 Vue Router（细粒度响应式与单页体验）**：利用 Vue 3 的 Composition API 和细粒度响应式系统，实现更直观的逻辑复用。配合 Vue Router 的全局守卫与嵌套路由，用户在切换页面时无需刷新浏览器即可获得流畅的单页应用（SPA）体验。
* **TypeScript（强类型约束与契约对齐）**：通过静态类型检查，使前端数据结构与后端的 OpenAPI 合约（`openapi.yaml`）保持高度一致。在编写代码阶段即可拦截绝大多数因字段拼写错误或未处理空值（null/undefined）导致的运行时异常。
* **Vite 构建（极速的开发与编译体验）**：基于原生 ESM 的极速热更新（HMR）特性，能实现代码改动的即时响应，大幅提升开发效率，并在生产环境下输出高度优化的静态资源。
* **Pinia（轻量且高效的状态管理）**：避开繁重的旧版 Vuex 架构，选用 setup 风格的 Pinia 进行状态管理。其响应式 ref 字段和直接突变的 action 机制十分符合 Vue 3 的心智模型，同时非常易于在 Vue 组件外部进行调用。
* **Design Tokens 与 Tailwind CSS v4（规范化视觉与主题）**：将颜色、字号等样式规范抽离为跨前端通用的设计令牌（CSS 变量）。配合 Tailwind v4 使得暗/亮主题切换和视觉一致性的维护变得十分高效。

## 2. 先建立整体地图

HelloTime Pro 是一个时间胶囊应用。Vue 前端的职责是：

- 渲染所有 UI 页面（广场 / 开启 / 创建 / 我的 / 登录 / 注册 / 关于）。
- 通过 HTTP 调用后端 `/api/v1/*` 接口，把 JSON 渲染成卡片、表单、详情。
- 维护客户端状态：登录态、主题（暗/亮）、广场筛选条件、我创建的 / 收藏的列表。
- 守卫需要登录的路由（`/create`、`/me/*`），自动用 refresh token 续期 access token。
- 跑在浏览器里，是一个 **单页应用**（SPA）：所有跳转都不刷新页面，由 JS 重新渲染。

核心目录：

```text
frontends/vue3-ts/
├── index.html                  # SPA 唯一的 HTML 文件，里面只有一个 <div id="app"></div>
├── vite.config.ts              # Vite 配置：dev server、API 代理、路径别名
├── package.json                # 依赖与 npm 脚本
├── tsconfig*.json              # TypeScript 编译配置
├── run / build / test          # 三个 Bash 脚本，封装 npm 命令
└── src/
    ├── main.ts                 # 入口：createApp + Pinia + Router + 挂到 #app
    ├── App.vue                 # 应用根：hydrate auth/theme + 渲染 <RouterView />
    ├── router/index.ts         # 路由表 + 全局守卫 beforeEach
    ├── styles/                 # 全局样式入口（导入 spec/styles 的设计令牌）
    ├── types/index.ts          # 与后端 spec/api/openapi.yaml 对齐的 TypeScript 类型
    ├── api/client.ts           # fetch 封装 + 解响应包装 + 自动 refresh
    ├── stores/                 # Pinia：auth · theme · plaza（setup 风格）
    ├── composables/            # 可复用组合函数：useCountdown / useDebouncedRef / useClickOutside
    ├── utils/                  # 倒计时 / 时间格式化 / 头像 URL（纯函数）
    ├── components/             # 14 个 .vue 通用组件
    └── pages/                  # 11 个 .vue 路由页面
```

一次「打开广场页」的流向：

```text
浏览器
  │ GET /
  ▼
Vite dev server（开发） / 静态文件（生产）
  │ 返回 index.html
  ▼
浏览器解析 HTML → 加载 /src/main.ts
  │ ESM 动态加载所有 import 的模块（vite 按需编译 .vue / .ts）
  ▼
main.ts: createApp(App).use(pinia).use(router).mount("#app")
  │
  ▼
App.vue (script setup)
  │ onMounted: useThemeStore.hydrate() / useAuthStore.hydrate()
  │ 模板渲染 <RouterView />
  ▼
router/index.ts 按 URL 匹配 → <MainLayout><PlazaPage /></MainLayout>
  │
  ▼
PlazaPage.vue 的 onMounted 调 plaza.fetch()
  │
  ▼
api.plaza({...}) → fetch("/api/v1/plaza/capsules")
  │ Vite dev server 反代到 :9080
  ▼
后端返回 JSON → Pinia store 的 ref.value = ... → Vue 自动重渲染
```

返回方向上完全相反：用户点收藏按钮 → `FavoriteButton @click` → `api.favorite(id)` → 收到新计数 → `active.value = true; count.value = r.favoriteCount` → Vue 检测到响应式变量变化，**局部**更新对应 DOM。

> Vue 的核心心智模型：**你不直接操作 DOM，你修改响应式变量；Vue 负责把这些变更精确地映射到 DOM 上**。这是和原生 JS 写法最大的差别。

## 3. 如何运行和验证

```bash
cd frontends/vue3-ts
./run                          # 开发模式，端口 7173
./build                        # 生产构建到 dist/（先跑 vue-tsc 类型检查）
./test                         # vitest 单测
```

打开浏览器访问 `http://localhost:7173`。`./run` 做的事：

1. 检查 `node_modules` 是否存在，没有就 `npm install`。
2. 执行 `npm run dev`，即 `vite --host 0.0.0.0 --port 7173`。
3. Vite 启动一个开发服务器，按需编译 `.ts/.vue`，**修改文件自动热更新**（HMR），组件状态尽可能保留。

API 代理由 `vite.config.ts` 配置：所有 `/api/*` 和 `/static/*` 转发到 `BACKEND_PROXY`（默认 `http://localhost:9080`，即仓库的反向代理；可以用环境变量直连某个后端：`BACKEND_PROXY=http://localhost:29010 ./run`）。

生产构建（`./build`）：

```bash
vue-tsc -b       # Vue 风味的 tsc，会理解 .vue 文件里的 <script lang="ts">
vite build       # 打包到 dist/（HTML + 1 个 JS bundle + CSS + 静态资源）
```

## 4. 入口链路：`index.html` → `main.ts` → `App.vue`

### 3.1 `index.html`：SPA 的唯一 HTML

```html
<!doctype html>
<html lang="zh-CN" data-theme="dark">
  <head>
    <script>
      (function () {                          // 提早注入主题，避免首屏闪白
        try {
          var t = localStorage.getItem("hellotime.theme");
          if (t === "dark" || t === "light") {
            document.documentElement.setAttribute("data-theme", t);
          }
        } catch (e) {}
      })();
    </script>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- 整个应用只有一个 `<div id="app"></div>`，所有页面都在它内部渲染。这就是 SPA 的「单页」含义。
- 内联 `<script>` 在 Vue 启动前就同步设 `data-theme`——避免 Vue 渲染前看到 dark 闪到 light 的「主题闪白」。
- `<script type="module" src="/src/main.ts">`：Vite 直接把 TS / Vue 当成 ES Module 加载。

### 3.2 `main.ts`：组装 Vue 应用

```ts
import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import { router } from "./router";
import { wireAuthApi } from "./stores/auth";
import "./styles/index.css";

const app = createApp(App);
app.use(createPinia());           // 装上状态管理
app.use(router);                  // 装上路由
wireAuthApi();                    // Pinia 就绪后，把 auth store 注入到 api client
app.mount("#app");
```

- `createApp(App)`：用根组件 `App` 创建一个 Vue 应用实例。
- `app.use(plugin)`：Vue 的「插件机制」，往应用上挂能力。Pinia 让所有组件能 `useXxxStore()`；Vue Router 让 `<RouterView />` / `<RouterLink />` / `useRouter()` 全局可用。
- `app.mount("#app")`：把应用挂载到 DOM 节点。从此 Vue 接管这个节点内部的所有渲染。

> 顺序很重要：`Pinia` 必须在 `wireAuthApi()` 之前装好，因为 `wireAuthApi` 会调用 `useAuthStore()`，而 store 只有在 Pinia 已经注册到 app 上时才能用。

### 3.3 `App.vue`：单文件组件（Single-File Component）

```vue
<script setup lang="ts">
import { onMounted, watch } from "vue";
import { storeToRefs } from "pinia";
import { useAuthStore } from "@/stores/auth";
import { useThemeStore } from "@/stores/theme";

const auth = useAuthStore();
const theme = useThemeStore();
const { hydrated, refreshToken } = storeToRefs(auth);

onMounted(() => {
  theme.hydrate();
  auth.hydrate();
});

watch(
  [hydrated, refreshToken],
  ([h, rt]) => {
    if (h && rt) void auth.refreshMe();
  },
  { immediate: true },
);
</script>

<template>
  <RouterView />
</template>
```

这是 Vue 最有辨识度的「**单文件组件**（SFC）」格式——一个 `.vue` 文件里有三块：

| 区块 | 内容 |
|---|---|
| `<script setup lang="ts">` | 组件的 JS 逻辑（imports、状态、函数） |
| `<template>` | 组件的 HTML 模板 |
| `<style scoped>`（可选） | 组件作用域的 CSS |

`<script setup>` 是 Vue 3.2+ 的语法糖：**整个 script 块就是 setup 函数体**，里面声明的所有变量自动暴露给模板，不用手动 `return { ... }`。

整个 App.vue 做的事跟 React 版完全对应：挂载时 hydrate auth/theme，一旦有 refresh token 就拉一次 `/me`，然后渲染路由出口 `<RouterView />`。

## 5. Vue 的核心概念

Vue 没有「魔法」，但有 **四个核心概念** 是 HTML/JS 老兵第一次写 Vue 时最容易困惑的地方。看懂它们，剩下都是 JS + 模板语法。

### 4.1 响应式：`ref` / `reactive` 与 `.value`

```ts
import { ref, computed } from "vue";

const email = ref("");           // 响应式变量
const len = computed(() => email.value.length);  // 派生值，依赖自动追踪

email.value = "hi@x.com";        // ← 必须用 .value 写，否则只是替换了普通字段
console.log(email.value);        // ← 在 JS 里读也要 .value
```

- `ref(initial)` 返回一个对象 `{ value: initial }`，对它的 `.value` 任何读写都会被 Vue 追踪。
- 在 **模板**里直接写 `{{ email }}`，模板编译器会自动加 `.value`，所以模板里看不到这个语法噪音。
- **`.value` 是 Vue 3 最显眼的写法**，初学者经常忘加，导致 `email = "..."` 把 ref 整个变成普通字符串，从此失去响应式。

Vue 用的是 **「细粒度依赖追踪」**：每个响应式变量记录自己被哪些 effect 读过；变量变化时只通知这些 effect 重新跑。**Vue 不像 React 那样把整个组件函数重跑一遍**——它只重跑受影响的 `computed` 与模板里用到这个变量的那块 DOM 更新。

| | React | Vue |
|---|---|---|
| 状态 | `useState(0)` 返回 `[value, setter]` | `ref(0)` 返回 `{ value }` |
| 修改 | `setCount(c + 1)` | `count.value++` |
| 重渲染 | 整个组件函数重跑 | 只重跑依赖此变量的 effect/DOM |
| 派生 | `useMemo(() => ..., [deps])` 手动列依赖 | `computed(() => ...)` 自动追踪 |

> 这一节最值得记住：**Vue 是细粒度响应式，不是按组件重渲染**。`v-model="email"`、`@click="busy = true"` 这些都是直接突变响应式变量，Vue 自己负责精确更新。

### 4.2 单文件组件与模板指令

Vue 模板看起来像 HTML，但有几个特殊 **指令**（`v-` 前缀）：

| 指令 | 作用 | 例子 |
|---|---|---|
| `v-if` / `v-else` | 条件渲染（创建/销毁元素） | `<p v-if="!opened">…</p>` |
| `v-show` | 条件显示（保持元素，切换 `display`） | `<div v-show="open">` |
| `v-for` | 列表渲染（必须配 `:key`） | `<button v-for="s in SORTS" :key="s.key">` |
| `v-model` | 双向绑定输入框 | `<input v-model="email" />` |
| `v-bind:x` / `:x` | 把 JS 表达式绑到 attribute | `<img :src="avatarUrl(id)" />` |
| `v-on:click` / `@click` | 事件监听 | `<button @click="toggle">` |
| `v-html` | 危险地把字符串当 HTML 渲染 | 项目里没用，避免 XSS |

数据插值用 `{{ ... }}`：

```html
<h3 class="cy-capsule__title">{{ capsule.title }}</h3>
<p>⏳ 还剩 {{ fmtNumber(cd.days) }} 天</p>
```

对照 React 的 `{xxx}`，Vue 的 `{{ }}` 只允许表达式不允许语句。

#### `v-model` 是 Vue 的杀手锏

```html
<input v-model="email" />
```

等价于：

```html
<input :value="email" @input="email = $event.target.value" />
```

「绑值 + 监听 input」一次写完，让表单代码极短。本项目 `LoginPage`、`RegisterPage`、`CreatePage`、`MeProfilePage` 的输入框全部用 `v-model`。

### 4.3 Composition API：`<script setup>` 与组合函数

Composition API 是 Vue 3 引入的「函数式」组件写法。**它最大的价值是逻辑复用**：把一段相关的状态 + 副作用打包成一个普通函数（叫 **composable**），多个组件直接复用。

例如 `composables/useCountdown.ts`：

```ts
export function useCountdown(active: () => boolean) {
  const now = ref(Date.now());
  let timer: number | undefined;

  function start() { timer = window.setInterval(() => { now.value = Date.now(); }, 1000); }
  function stop()  { if (timer !== undefined) window.clearInterval(timer); timer = undefined; }

  watch(active, (on) => { on ? start() : stop(); }, { immediate: true });
  onUnmounted(stop);
  return { now };
}
```

任何组件想要每秒刷新一次的「现在」，都可以：

```ts
const { now } = useCountdown(() => !opened.value);
const cd = computed(() => countdownTo(props.capsule.openAt, now.value));
```

`CapsuleCard.vue` 就是这么用的。`onUnmounted(stop)` 保证组件被销毁时清掉定时器，**这一行就是 Vue 版本「在哪个组件里调用就跟谁的生命周期」的约定**——必须在 setup 期间同步调用，不能放到异步回调里。

本项目的三个 composables：

| Composable | 作用 |
|---|---|
| `useCountdown(active)` | 提供响应式的「当前时间戳」，仅 `active` 为 true 时开 interval |
| `useDebouncedRef(source, delay)` | 把一个 ref 防抖成另一个 ref |
| `useClickOutside(ref, active, cb)` | 点击外部区域时触发回调（用于关闭下拉菜单） |

> 对照 React：React 的「自定义 Hook」也是同样思想。但 Vue composable 不受「Hook 调用规则」（必须在顶层、按顺序）束缚——可以在条件分支里调用，因为响应式追踪是基于变量身份而非调用顺序。

### 4.4 单向数据流：props 与 emits

父传子用 props，子传父靠「触发自定义事件」：

```ts
// 子组件 FavoriteButton.vue
const props = withDefaults(defineProps<{ capsule: ...; size?: "sm" | "md" }>(), { size: "sm" });
const emit = defineEmits<{ (e: "change", favorited: boolean, count: number): void }>();

emit("change", false, next);     // 通知父组件
```

```html
<!-- 父组件 -->
<FavoriteButton :capsule="c" @change="(fav, n) => onChange(fav, n)" />
```

- `defineProps<...>()`、`defineEmits<...>()` 是编译器宏，只能在 `<script setup>` 里用。Vue 编译时识别它们，运行时不会真正调用。
- `:capsule="c"` 是 `v-bind:capsule`，把 JS 变量绑到 prop。
- `@change="..."` 是 `v-on:change`，监听子组件 emit 的自定义事件。
- **props 是只读的**——子组件直接改 `props.capsule.favoritedByMe` 会被 Vue 警告。`FavoriteButton` 内部用 `ref(props.capsule.favoritedByMe)` 复制成本地 state，再用 `watch(() => props.capsule, ...)` 同步父变化。

#### Slot：占位 + 默认内容

```html
<!-- 父：PlazaPage -->
<CapsuleGrid :items="items">
  <template #empty>
    <div class="cy-empty">广场暂无胶囊…</div>
  </template>
</CapsuleGrid>

<!-- 子：CapsuleGrid -->
<slot name="empty">
  <div class="cy-empty">暂无数据</div>
</slot>
```

Slot 是「让父组件往子组件里塞模板片段」的机制，对照 React 是 `children`/render-props。`CapsuleCard` 也有一个具名 slot `right` 用来替换右下角按钮。

## 6. TypeScript 快速概览

`.ts` 与 `.vue`（内含 `<script lang="ts">`）文件本质是带类型注解的 JavaScript。Vue/Vite/编译器会把它们去掉类型转成 JS。读代码时几乎可以「把冒号后面的内容当注释」忽略。

```ts
interface User { id: string; email: string; nickname: string; ... }
type ErrorCode = "VALIDATION_ERROR" | "UNAUTHORIZED" | ...;   // 联合类型
const user = ref<User | null>(null);                          // 泛型参数
const cd = computed<Countdown>(() => countdownTo(...));
e instanceof ApiError                                          // 运行时类型守卫
```

Vue 的 `defineProps` / `defineEmits` 都接受 TS 泛型，编辑器自动补全、类型校验非常顺。生产构建第一步是 `vue-tsc -b` 跑类型检查——**类型错的代码无法构建**。

> 类型不影响运行行为。删掉所有 TS 注解，代码行为不变；类型的价值在于编辑器和 CI 提前发现「字段拼错」「忘了处理 null」等错误。

## 7. 路由层：`router/index.ts`

```ts
export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      component: MainLayout,                                  // 公共布局：Header + RouterView + Footer
      children: [
        { path: "",         component: PlazaPage },
        { path: "open",     component: OpenPage },
        { path: "login",    component: LoginPage },
        { path: "create",   component: CreatePage, meta: { requiresAuth: true } },
        { path: "c/:code",  component: CapsuleByCodePage },
      ],
    },
    {
      path: "/me",
      component: MeLayout,
      meta: { requiresAuth: true },
      children: [
        { path: "",          redirect: "/me/created" },
        { path: "created",   component: MeCreatedPage },
        ...
      ],
    },
    { path: "/:pathMatch(.*)*", component: NotFoundPage },
  ],
  scrollBehavior() { return { top: 0 }; },
});

router.beforeEach((to) => {                                   // 全局守卫
  if (!to.matched.some((r) => r.meta.requiresAuth)) return true;
  const auth = useAuthStore();
  if (auth.user || auth.refreshToken) return true;
  return { path: "/login", query: { from: to.fullPath } };
});
```

要点：

- **嵌套路由 + Layout**：父项给 `component: MainLayout`、子项填在它的 `<RouterView />` 里。
- **路径参数**：`/c/:code` 在页面里用 `useRoute().params.code` 取出。
- **`meta.requiresAuth`**：把鉴权策略写在路由配置里，由全局 `beforeEach` 统一拦截。比 React 版的 `<AuthGate>` HOC 更集中、更声明式。
- **`createWebHistory()`**：H5 history 模式，URL 没有 `#`。
- **404 兜底**：`/:pathMatch(.*)*` 匹配任意 URL，放在数组末尾。

页面之间的跳转用：

```html
<RouterLink to="/login">登录</RouterLink>                          <!-- 模板里 -->
```

```ts
const router = useRouter();                                       // 编程式
router.push("/me/created");
router.replace(route.query.from ?? "/me/created");                // 不留历史记录
```

`router.beforeEach` 是「全局前置守卫」，每次路由变化（包括首次进入）都触发。返回 `true` 放行，返回 `{ path, query }` 重定向。**它在 Pinia 装好之后才能调用 `useAuthStore()`**——所以放在 `main.ts` 的 `app.use(pinia)` 之后即可。

## 8. 关键模式：守卫与布局

### 7.1 `MainLayout.vue` / `MeLayout.vue`：共享外壳

```vue
<template>
  <AppHeader />
  <RouterView />
  <AppFooter />
</template>
```

`<RouterView />` 是 Vue Router 的占位组件，由当前匹配的子路由的 `component` 替换。URL 切换时只重渲染 `<RouterView />` 内部，Header 状态保留。

### 7.2 鉴权流程

与 React 版用「`<AuthGate>` 包页面」不同，Vue 版**把鉴权完全交给 `router.beforeEach`**：

1. 路由切到 `/me/created`。
2. `beforeEach` 看到 `meta.requiresAuth: true`，检查 `auth.user || auth.refreshToken`。
3. 不满足 → 重定向 `/login?from=/me/created`。
4. `LoginPage` 登录成功后 `router.replace(route.query.from ?? "/me/created")` 回跳。

只允许有 `refreshToken` 的用户进入是为了「页面刷新场景」：access token 在内存里丢了，refresh token 还在 localStorage，下一次 API 调用会自动 refresh，用户无感（详见 §9.2）。

## 9. 数据层：`api/client.ts`

跟 React 版几乎一致——这套代码刻意写成与框架无关，方便各前端复用思路。

### 8.1 通用 `request<T>(path, opts)`

```ts
async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers = { Accept: "application/json", ... };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";

  const accessToken = await accessTokenForRequest(useAuth);
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

  const res = await fetch(`${BASE}${path}`, { ..., headers, body: ... });
  if (res.status === 204) return undefined as T;

  const env = (await res.json()) as Envelope<T>;
  if (!res.ok || !env.success) {
    if (shouldTryRefresh(...)) {
      const newAt = await tryRefresh();
      if (newAt) return request<T>(path, { ...opts, _retry: true });
    }
    throw new ApiError(env.message ?? "请求失败", res.status, env.errorCode, env.details);
  }
  return env.data as T;
}
```

- 自动拼 `Authorization`、序列化 `body`、解开后端外壳 `{ success, data, message, errorCode }`，**调用者只看到 `data`**。
- 失败时抛 `ApiError`，带 HTTP status、errorCode、字段级 details。
- **泛型 `<T>`**：`api.plaza()` 返回 `Promise<PaginatedCapsules>`，TS 全程校验字段名。

### 8.2 自动 refresh：去重 + 重放

```ts
let refreshing: Promise<string | null> | null = null;

async function tryRefresh() {
  if (refreshing) return refreshing;            // 并发请求都拿到同一个 Promise
  refreshing = (async () => { ...POST /auth/refresh... })();
  return refreshing;
}
```

模块级单例变量 `refreshing`：当一波 401 同时发生时（比如同时调了 3 个接口），只发一次 refresh 请求，其他人 `await` 同一个 Promise。

整体流程：

```text
fetch → 401 + UNAUTHORIZED → tryRefresh()
                                ├── 拿到新 accessToken → 重放原请求
                                └── refresh 也失败 → onAuthLost() 清状态
```

`_retry` 标记防止「refresh 后重放又 401」陷入无限循环。

### 8.3 与 store 解耦：`configureApi(...)`

`api/client.ts` 没有 `import { useAuthStore }`。原因是 `stores/auth.ts` 反过来 import 了 `api`，会形成循环。解法是「依赖注入」：

```ts
// api/client.ts
let getAccessToken: () => string | null = () => null;
export function configureApi(opts: {...}) { getAccessToken = opts.getAccessToken; ... }

// stores/auth.ts —— 由 main.ts 的 wireAuthApi() 触发
export function wireAuthApi() {
  const store = useAuthStore();
  configureApi({
    getAccessToken: () => store.accessToken,
    onTokensRefreshed: (a, r) => store.patchTokens(a, r),
    ...
  });
}
```

> 注意 React 版能在模块顶层调 `configureApi(...)`，因为 Zustand store 用 `create()` 直接返回 hook、无需「app 实例」。Vue 的 Pinia store 必须在 `app.use(createPinia())` 之后才能 `useXxxStore()`——所以包成 `wireAuthApi()`，在 `main.ts` 显式触发。这是两套生态的微妙差异。

## 10. 状态层：Pinia

[Pinia](https://pinia.vuejs.org/) 是 Vue 官方推荐的状态管理库（取代了旧的 Vuex）。本项目用 **setup 风格**——store 写起来就跟一个 Composition 函数完全一样。

### 9.1 创建 store

```ts
export const useAuthStore = defineStore("auth", () => {
  // 状态：用 ref
  const user = ref<User | null>(null);
  const accessToken = ref<string | null>(null);
  const refreshToken = ref<string | null>(null);
  const hydrated = ref(false);

  // 动作：普通函数
  function hydrate() { ... user.value = persisted.user; ... }
  function setTokens(t: AuthTokens) { ... }
  async function logout(callServer = true) { ... }
  async function refreshMe() { ... }

  // 显式返回的字段才会暴露给消费者
  return { user, accessToken, refreshToken, hydrated, hydrate, setTokens, logout, refreshMe };
});
```

`defineStore(id, setupFn)` 是 Pinia 的「setup store」语法：

- 第一个参数是 store 的唯一 ID（DevTools 里显示）。
- 第二个参数就是一个 Composition 风格的函数：里面的 `ref` 是 state，函数是 action，`computed` 是 getter。
- **返回的对象决定了 store 暴露哪些字段**——没 return 就是私有的。

在组件里用：

```ts
import { storeToRefs } from "pinia";

const auth = useAuthStore();
const { user, hydrated } = storeToRefs(auth);    // 把 ref 字段单独取出，仍然是响应式
auth.setTokens(...);                              // 动作直接调
```

> **为什么要 `storeToRefs`？** 直接 `const { user } = auth` 会丢响应式（解构出的是 `User | null` 普通值，不再追踪变化）。`storeToRefs` 把每个状态字段还原成 ref，模板里写 `user` 自动追踪、JS 里访问要加 `.value`。这是 Pinia 最容易踩的坑之一。

也能在组件之外用：

```ts
useAuthStore().refreshToken            // setup 之外（router 守卫、API client）
```

但 **必须等 Pinia 装到 app 之后**，否则会报 "no active Pinia"。

### 9.2 本项目的三个 store

| Store | 关心什么 | 持久化 |
|---|---|---|
| `useAuthStore` | user / accessToken / refreshToken / hydrated | refreshToken + user → localStorage |
| `useThemeStore` | "dark" / "light" | localStorage `hellotime.theme` |
| `usePlazaStore` | sort / filter / q / page + items / pagination / loading | 否（每次进页面重新拉） |

### 9.3 跨 store 联动

`FavoriteButton` 收藏成功后，**直接调** `plaza.patchFavorited(...)` 更新广场列表里这条胶囊的 `favoritedByMe / favoriteCount`：

```ts
plaza.patchFavorited(props.capsule.id, true, r.favoriteCount);
```

Pinia store 是模块级单例，互相 import 不会破坏响应式。

### 9.4 并发请求的「序列号」模式

```ts
let fetchSeq = 0;                                  // 闭包变量，不是 ref（不需要触发 UI）
async function fetch() {
  const myId = ++fetchSeq;
  loading.value = true;
  const data = await api.plaza({...});
  if (myId !== fetchSeq) return;                   // 我已经被新请求淘汰了
  items.value = data.items;
  // ...
}
```

用户快速切 sort/filter 时连发好几个请求，网络响应顺序不一定与发起顺序一致。`fetchSeq` 保证「只有最后发起的那个请求才能写状态」。

## 11. 页面层与组件层

### 10.1 一个页面的典型骨架

```vue
<script setup lang="ts">
import { onMounted, watch } from "vue";
import { storeToRefs } from "pinia";
import { usePlazaStore } from "@/stores/plaza";
import { useAuthStore } from "@/stores/auth";

const plaza = usePlazaStore();
const auth = useAuthStore();
const { items, loading, pagination, page } = storeToRefs(plaza);
const { hydrated } = storeToRefs(auth);

onMounted(() => { if (hydrated.value) void plaza.fetch(); });
watch(hydrated, (v) => { if (v) void plaza.fetch(); });
</script>

<template>
  <section class="cy-hero-block">...</section>
  <main class="cy-container">
    <PlazaToolbar />
    <CapsuleGrid :items="items" :loading="loading">
      <template #empty>...</template>
    </CapsuleGrid>
    <Pagination
      :page="page"
      :total-pages="pagination?.totalPages ?? 0"
      @change="plaza.setPage($event)"
    />
  </main>
</template>
```

模式：

- 顶部从 store 取状态和动作。
- `onMounted` 触发首次 fetch，再用 `watch` 处理 hydrate 完成后的二次触发。
- 模板直接消费响应式变量，没有手动 DOM 操作。
- 子组件用 `:prop="..."` 传数据、`@event="..."` 接事件、`<template #slot>` 投递模板。

### 10.2 表单：v-model

```vue
<form class="cy-form" @submit.prevent="submit">
  <input id="email" v-model="email" class="cy-input" type="email" required />
  <input id="pwd"   v-model="password" class="cy-input" type="password" required />
  <button type="submit" :disabled="busy">{{ busy ? "登录中…" : "登录" }}</button>
</form>
```

- `@submit.prevent="submit"` 是 `v-on:submit` + `.prevent` 修饰符，等价于 `submit` 调用前先 `e.preventDefault()`，省一行。Vue 还有 `.stop`、`.once`、`.capture` 等修饰符。
- `v-model="email"` 把输入框值与 `ref` 双向绑定，所有键入自动同步到 `email.value`。
- `:disabled="busy"` 是 `v-bind:disabled`，按响应式值变化自动切换。

### 10.3 自定义 v-model：`CapsuleCodeInput`

8 位胶囊码输入框是 v-model 的进阶用法：

```vue
<!-- 子 -->
const props = defineProps<{ modelValue: string }>();
const emit  = defineEmits<{ (e: "update:modelValue", v: string): void; ... }>();
emit("update:modelValue", next);

<!-- 父 -->
<CapsuleCodeInput v-model="code" @complete="(v) => onCode(v)" />
```

`v-model="x"` 是 `:model-value="x" @update:model-value="x = $event"` 的语法糖。任意组件只要接收 `modelValue` prop 并 emit `update:modelValue` 事件，就能作为 v-model 的目标。

### 10.4 组件分类

| 类型 | 举例 | 特征 |
|---|---|---|
| **布局** | `MainLayout`、`MeLayout` | 套在路由外层，含 Header/Footer/`<RouterView />` |
| **展示** | `CapsuleCard`、`Alert`、`Pagination` | 接 props + slot，几乎无内部 state |
| **交互** | `FavoriteButton`、`PlazaToolbar`、`AvatarPicker` | 有内部 state + 副作用 |

## 12. 工具与组合函数

`utils/format.ts` 是与 Vue 无关的纯函数：

```ts
countdownTo(iso, now)        // 返回 { days, hours, minutes, seconds, expired }
fmtDateTime(iso)             // 本地化日期时间字符串
localInputToIso(local)       // <input type="datetime-local"> 值 → ISO UTC
avatarUrl(avatarId)          // → "/static/avatars/<id>.svg"
```

`composables/*` 是依赖 Vue 响应式 API 的复用单元：

```ts
useCountdown(active)         // 每秒响应式刷新 now，组件卸载自动停
useDebouncedRef(source, ms)  // 把一个 ref 防抖成另一个 ref（PlazaToolbar 搜索框用）
useClickOutside(ref, ...)    // 点击外部触发回调（AppHeader 关闭下拉菜单用）
```

`PlazaToolbar` 把搜索框防抖写成了三行：

```ts
const draft = ref(q.value);
const debounced = useDebouncedRef(draft, 300);
watch(debounced, (v) => { if (v !== plaza.q) plaza.setQ(v); });
```

`draft` 是即时跟随键入的 ref，`debounced` 是 300ms 之后才更新的 ref，`watch` 把它推给 store。**关注点完全分离**——这是 composable 的价值。

## 13. 样式层：Tailwind + 设计令牌

```css
/* src/styles/index.css */
@import "tailwindcss";
@import "../../../../spec/styles/palette.css";    /* 色阶变量 --brand-500 等 */
@import "../../../../spec/styles/tokens.css";     /* 语义令牌 --color-text-primary 等 */
@import "../../../../spec/styles/cyber.css";      /* 共享类 cy-btn / cy-card / cy-capsule */
@import "./layout.css";
```

- `spec/styles/tokens.css` 是 **设计系统的单一来源**。所有前端实现共用同一份。修改 token 一次，所有前端生效。
- 主题切换靠 `data-theme="dark" | "light"`：tokens.css 里用 `[data-theme="dark"] { --color-text-primary: ... }` 重写变量。
- 组件用 **`cy-*` 共享类**（如 `cy-btn cy-btn--primary`），底层是 CSS 变量。**不允许直接写 `color: #ff00aa` 或用色阶变量 `--brand-500`**——保证多前端视觉一致和暗/亮主题正常切换。
- Tailwind v4 通过 `@tailwindcss/vite` 插件接入，主要用 utility 类做微调。
- 内联 `style="..."` 或 `:style="{...}"` 仅用于一次性、与 token 无关的微调。
- **`<style scoped>`**：`AppHeader.vue` 里的 `.cy-fade-enter-active` 这种过渡动画类放在 `<style scoped>` 里，编译后 Vue 自动给它加一个属性选择器（如 `[data-v-abc123]`），不会泄漏到其他组件。

### `<Transition>` 内置动画

```html
<Transition name="cy-fade">
  <div v-if="menuOpen" class="cy-user-dropdown" role="menu">...</div>
</Transition>
```

包一层 `<Transition name="cy-fade">`，Vue 会自动在 `v-if` 切换时给元素加 `cy-fade-enter-active`、`cy-fade-enter-from`、`cy-fade-leave-to` 等 class，配合 `<style>` 里的 CSS 过渡，下拉菜单淡入淡出。**无需手动管理动画时序**。

## 14. 测试：vitest

```bash
./test
```

跑的是 `*.test.ts` 文件。本项目目前有 `api/client.test.ts` 和 `utils/format.test.ts`。组件测试需要 `@vue/test-utils` + happy-dom，依赖里 happy-dom 已有（用于 vitest 的 jsdom 替代品）。

## 15. 常见改动指南

| 想做什么 | 改哪里 |
|---|---|
| 加一个新页面 | ① `src/pages/XxxPage.vue` 写组件；② `src/router/index.ts` 在 `routes` 加一项 |
| 加一个登录后才能访问的页面 | 同上，但加 `meta: { requiresAuth: true }`，`beforeEach` 自动拦截 |
| 加一个 API 端点 | ① `src/types/index.ts` 加请求/响应类型；② `src/api/client.ts` 在 `api` 对象里加方法 |
| 加一个状态域 | `src/stores/xxx.ts` 用 `defineStore("xxx", () => { ... })` 定义 |
| 加一个可复用 UI | `src/components/Xxx.vue` 写一个组件，用 `defineProps` / `defineEmits` |
| 加一个可复用逻辑 | `src/composables/useXxx.ts` 写一个普通函数，返回 ref / 函数 |
| 加一个表单字段 | 在页面里加 `const x = ref(""); ` + `<input v-model="x" />` |
| 改 API 代理目标 | `BACKEND_PROXY=http://localhost:29010 ./run` |
| 改主题色 / 间距 | 修改 `spec/styles/tokens.css`，所有前端同步生效 |
| 想在组件外读 store | `useAuthStore().xxx`（Pinia 装好之后任何地方都能调） |

## 16. 学到这里之后

读到这里，你已经掌握了 Vue 3 SPA 最常见的 80%：SFC、Composition API、`ref` + 响应式、模板指令（v-if/v-for/v-model/v-bind/v-on）、props/emits/slots、Pinia setup store、Vue Router 嵌套路由 + beforeEach 守卫、组合函数（composable）、TypeScript 类型注解、Vite 入口与代理、设计令牌主题。

下一步建议：

- 翻 `src/pages/CreatePage.vue`（最复杂的页面），跟读「填表单 → 调 AI 建议 → 提交 → 跳详情」整条路径。
- 把项目同时启起来：`hello start vue3-ts` 和 `hello start react-ts`，并排对比同一页面两套实现——React 走「函数+Hook+重渲染」，Vue 走「响应式变量+模板+精确更新」。
- 在 `usePlazaStore.fetch` 加 `console.log`，切换 sort/filter 观察「序列号丢弃旧请求」的行为。

之后可以再深入研究 Vue 的几个常见进阶主题：`watchEffect` 与 `watch` 的细分用法、`provide`/`inject` 依赖注入、自定义指令（`v-xxx`）、`<Suspense>` 异步组件、`Teleport` 把节点渲到任意 DOM 位置。本项目刻意保持极简，把这些留给后续。
