# HelloTime Pro Vue 3 + TypeScript 前端技术手册与代码导读

本文面向已经熟悉 HTML / CSS / JavaScript 基本语法，但还没系统接触过 Vue 3、TypeScript、Vite、单页应用（SPA）这套现代前端栈的读者。读完后，你应该能回答三件事：

- 用户在浏览器输入 URL 后，代码按什么顺序执行。
- Vue、TypeScript、Vite、Vue Router、Pinia 与 spec/styles 分别在做什么。
- 想新增一个页面、状态或接口调用时，应该改哪些文件。

> 阅读建议：第 1 节介绍技术栈与设计特色；第 2～4 节建立整体地图与入口链路；第 5 节集中讲 Vue 的核心概念（响应式、单文件组件、组合式 API、组件通信）；第 6 节快速过 TypeScript 在 Vue 里的写法；第 7～13 节按一次「打开页面」的生命周期分层细讲；第 14～16 节是样式、测试与常见改动。
> 同一个应用的 React 版本在 `frontends/react-ts`，两份对照着读，最能看出两个框架各自的味道。

## 1. 技术选型与设计特色

本前端基于 **Vue 3 + TypeScript + Vite**，路由用 **Vue Router 4**，状态用 **Pinia**，样式原样引入 `spec/styles` 的两套皮肤（2.0）。

* **Vue 3 与组合式 API（响应式驱动的声明式 UI）**：模板描述「状态对应的界面」，响应式系统自动追踪模板用到了哪些数据、只在它们变化时更新。组合式 API（`<script setup>` + `ref` / `computed` / `watch`）让一个功能的状态、计算与副作用写在一起，并能抽成可复用的「组合式函数」。
* **单文件组件（SFC）**：一个 `.vue` 文件里放 `<script setup>`、`<template>`、`<style>`。模板就是增强过的 HTML，`v-if` / `v-for` / `v-model` 这些指令让结构一眼可读——这对「照原型写出相同 DOM 与类名」的 2.0 尤其友好。
* **TypeScript（强类型约束与契约对齐）**：`types/` 与 `spec/api/openapi.yaml` 对齐；`defineProps<…>()`、泛型组件、`RouteMeta` 扩展让组件之间、路由之间的约定也有类型检查。`./build` 第一步就是 `vue-tsc`，类型不过不出包。
* **Vite（极速开发与构建）**：基于原生 ES 模块的开发服务器与热更新；`@vitejs/plugin-vue` 把 `.vue` 编译成 JS。
* **Pinia（Vue 官方状态管理）**：setup 风格的 store 就是「一个返回 ref 与函数的组合式函数」，和组件里的写法完全一样；可以在组件外（API 客户端、路由守卫）直接调用。
* **双皮肤与设计令牌（2.0）**：「时笺」「琥珀」两套皮肤 × 明暗，全部样式来自 `spec/styles`（每条规则按 `:root[data-skin]` 限定，两套同时加载）。本前端不写组件样式，只按 2.0 原型写出相同的 DOM 结构与类名；切换皮肤 / 明暗只改 `<html>` 上的两个属性。
* **逻辑一份、视图按皮肤分**：业务逻辑写成组合式函数（`src/composables/`）与 store（`src/stores/`），两套皮肤的页面（`src/skins/paper`、`src/skins/amber`）调用同一批函数，只负责把数据画成各自的样子。

## 2. 先建立整体地图

HelloTime Pro 是一个时间胶囊应用。这个前端的职责是：

- 渲染所有页面（首页广场 / 开启 / 详情 / 创建 / 我的 / 登录 / 注册 / 关于 / 404），每个页面都有「时笺」「琥珀」两套视图。
- 调用后端 `/api/v1/*`（经 `:9080` 反代），把 JSON 画成卡片、表单、详情；2.0 新增 `/plaza/stats`、`/me/stats`。
- 维护客户端状态：登录态、皮肤与明暗、广场查询条件、创建页草稿、账号表单。
- 守卫需要登录的路由（`/create`、`/me/*`），未登录跳 `/login?redirect=…`；access token 过期自动刷新并重放。

```
src/
├── main.ts / App.vue    入口：装 Pinia、恢复登录态、装路由；总布局
├── router/              路由表、导航守卫、skinned()（§7）
├── stores/              Pinia：auth · ui · plaza · feedback · draft · forms（§10）
├── composables/         组合式函数：两套皮肤共用的业务逻辑（§11）
├── api/ · types/        接口客户端与类型（§9）
├── lib/                 纯工具：时间说法、开启时间规则、图标、头像、专属色、关于页文字、回跳（§13）
├── components/          结构两套相同、只靠样式换肤的部件（§12）
└── skins/paper|amber/   两套视图（§12）
```

一次「打开首页」的数据流：路由 `/` 渲染 `skinned("PlazaPage", …)` → 它读 `ui.skin` 渲染 `skins/amber/AmberHomePage.vue` → 视图调用 `usePlazaHome()` → 组合式函数里的 `watch(…, { immediate: true })` 调 `plaza.refreshAll()` → `api/client` 发请求 → store 的 `ref` 被赋新值 → 模板自动重渲染。换成时笺时，只有视图换成 `PaperHomePage.vue`，其余链路一模一样。

## 3. 如何运行和验证

```bash
cd frontends/vue3-ts
./run                          # 开发模式，端口 7173
./build                        # vue-tsc 类型检查 + vite build 到 dist/
./test                         # vitest 单测
```

`./run` 检查 `node_modules`，没有就 `npm install`，然后 `vite --host 0.0.0.0 --port 7173`。API 代理在 `vite.config.ts`：`/api/*` 与 `/static/*` 转发到 `BACKEND_PROXY`（默认 `http://localhost:9080`）。也可以在仓库根目录用 `./scripts/hello start vue`。

```bash
./verification/scripts/verify-ui-smoke.sh vue3-ts        # UI 冒烟：44 条 × 两套皮肤
./verification/scripts/verify-design-tokens.sh vue3-ts   # 自己的样式只用语义令牌
```

## 4. 入口链路：`index.html` → `main.ts` → `App.vue`

### 4.1 `index.html`：SPA 的唯一 HTML

整个应用只有一个 `<div id="app"></div>`，所有页面都在它里面渲染。`<head>` 里有一段同步执行的内联脚本：在 Vue 启动之前从 `localStorage` 读出 `hellotime.skin` / `hellotime.theme`，写到 `<html data-skin data-theme>` 上，并设置地址栏颜色——这样首帧就是正确的皮肤和明暗，不会先闪出另一套。

### 4.2 `main.ts`：组装 Vue 应用

```ts
const app = createApp(App);
app.use(createPinia());

// 登录态在装路由之前从 localStorage 恢复：首次导航的守卫第一帧就能拿到正确的 user
useAuthStore().hydrate();
// 把 auth store 注入到 api client（refresh 单飞、401 重放）
wireAuthApi();

app.use(router);
app.mount("#app");
```

- `createApp(App)`：以 `App.vue` 为根组件创建应用实例。
- `app.use(plugin)`：安装插件。Pinia 装上之后，`useAuthStore()` 就能在组件外调用。
- **顺序有讲究**：`app.use(router)` 会立刻开始第一次导航并执行守卫，所以 `hydrate()` 必须在它之前——否则刷新 `/register` 时守卫以为没登录，不会把已登录用户跳走。
- `import "./styles/index.css"`：CSS 也走 Vite 的依赖图。

### 4.3 `App.vue`：总布局

```vue
<script setup lang="ts">
const SHELL = {
  paper: { Header: PaperHeader, Footer: PaperFooter, TabBar: PaperTabBar },
  amber: { Header: AmberHeader, Footer: AmberFooter, TabBar: AmberTabBar },
};
const ui = useUiStore();
const shell = computed(() => SHELL[ui.skin]);
</script>

<template>
  <PaperFilters />
  <AmberBackdrop />
  <a class="skip" href="#view">跳到正文</a>
  <component :is="shell.Header" />
  <main id="view" tabindex="-1">
    <RouterView />
  </main>
  <component :is="shell.Footer" />
  <component :is="shell.TabBar" />
  <ToastHost />
  <DialogHost />
</template>

<style>
#app { display: contents; }
</style>
```

- `<component :is="…">`：**动态组件**，`is` 给什么组件就渲染什么。换皮肤时 `shell` 变了，页头 / 页脚 / 底栏整个换成另一套。
- `<RouterView />`：当前路由对应的页面渲染在这里。
- `header.hdr / main#view / footer.ftr / nav.tabbar` 是 `spec/styles` 依赖的 DOM 约定，照原型写。`#app { display: contents }` 让挂载点不参与布局（皮肤样式里 `body` 是纵向 flex）。
- `App.vue` 里还有两个 `watch`：有 refresh token 时拉一次 `/me` 校验登录态；登录态在受保护页面上丢了（refresh 失败）时跳登录页。

## 5. Vue 的核心概念

### 5.1 响应式：`ref`、`reactive`、`computed`、`watch`

```ts
const count = ref(0);            // 一个响应式的「盒子」，脚本里用 count.value 读写
const form = reactive({ email: "", password: "" });   // 响应式对象，直接 form.email
const double = computed(() => count.value * 2);       // 由别的状态算出来，自动缓存
watch(count, (n, old) => console.log(n, old));        // 状态变了执行副作用
```

- **模板里不用写 `.value`**：`<script setup>` 顶层的 ref 在模板里自动解包，`{{ count }}` 就是数字。
- **`computed` 也可以写**：给它 `get` 和 `set`，就能直接 `v-model`。创建页用这个把草稿字段暴露给视图，写入时顺手清掉该字段的错误：

  ```ts
  const title = computed({
    get: () => draft.title,
    set: (v: string) => {
      clearErr("title");
      draft.title = v;
    },
  });
  ```

- **`watch` 的三个常用选项**：`immediate: true`（先跑一次，首页「进来就拉数据」靠它）；`flush: "post"`（等 DOM 更新完再跑，量元素尺寸时需要，见 `useSlider`）；回调第三个参数 `onCleanup`（下次触发或销毁前清理，`DialogHost` 用它解绑键盘监听）。
- **`reactive(useXxx())`**：组合式函数通常返回一个装着 ref 的普通对象；在模板里 `f.title` 这种「对象里的 ref」不会自动解包。用 `reactive()` 包一层就能直接点属性，写入也会落到 ref（或可写 computed）上——创建页、资料页都是 `const f = reactive(useCreateCapsule())`。

> 心智模型：你只管改数据，Vue 记得「哪个模板片段读过哪个数据」，数据变了就只更新那一小块。没有「什么时候重渲染」的心智负担，也没有依赖数组。

### 5.2 单文件组件与模板指令

| 写法 | 含义 | 本项目的例子 |
|---|---|---|
| `{{ expr }}` | 文本插值（自动转义） | `{{ c.title }}` |
| `:attr="expr"` | 绑定属性（`v-bind` 简写） | `:data-code="c.code"` |
| `@event="fn"` | 监听事件（`v-on` 简写） | `@click="copyCode"` |
| `v-if / v-else-if / v-else` | 条件渲染 | 详情页三种形态 |
| `v-for="(c, i) in items" :key="c.id"` | 列表渲染 | 卡片网格 |
| `v-model="x"` | 双向绑定 | 所有输入框 |
| `@submit.prevent` | 事件修饰符 | 表单不刷新页面 |
| `@keydown.right.prevent` | 按键修饰符 | 头像选择器方向键 |
| `:class="['a', { 'is-on': on }]"` | 类名数组 / 对象 | 几乎每个组件 |
| `:style="{ '--i': i }"` | 内联样式（含 CSS 变量） | 卡片入场错位 |

`<template v-for>` / `<template v-if>` 可以包住多个兄弟节点而不多出一层 DOM——照原型写结构时经常用到。

### 5.3 `<script setup>` 与组合式函数

`<script setup>` 里顶层声明的变量、函数、导入的组件，模板里都能直接用，不需要 `return`。一段可复用的逻辑抽成 `useXxx()` 函数，就是「组合式函数」（composable）：

```ts
export function useCodeOpen() {
  const router = useRouter();
  const state = ref<CodeState>("");
  const error = ref("");
  const shake = ref(0);
  async function go(code: string) { /* 查询、命中后跳详情、没命中就地提示 */ }
  return { state, error, shake, go, reset };
}
```

组合式函数里可以用一切 Vue API——`ref`、`watch`、生命周期（`onMounted` / `onBeforeUnmount`）、`onScopeDispose`（所在组件销毁时清理）、路由守卫 `onBeforeRouteLeave`、模板引用 `useTemplateRef`。它们会自动挂到调用它的那个组件上。

### 5.4 组件通信：props、emits、v-model、插槽、expose

```vue
<!-- FavButton.vue -->
<script setup lang="ts">
const props = withDefaults(defineProps<{ capsule: {...}; size?: "sm" | "md" }>(), { size: "sm" });
const emit = defineEmits<{ change: [favorited: boolean, count: number] }>();
</script>

<!-- 父组件 -->
<FavButton :capsule="c" @change="(f, n) => onFavChange(c.id, f)" />
```

- **props 向下、事件向上**：子组件不改 props，有变化就 `emit` 给父组件。
- **`defineModel()`**：组件上的 `v-model` 一行搞定。`FormField` 的输入值、`AvatarPicker` 的选中项、`SegControl` 的选中值都是它：

  ```ts
  const model = defineModel<string>({ default: "" });   // FormField.vue
  ```
  ```vue
  <FormField id="email" v-model="form.email" label="邮箱" test-id="login-email" />
  ```

- **插槽**：组件留一个「坑」给父组件填。`FormField` 的输入框右侧小部件（眼睛、昵称状态、锁）走具名插槽 `#trail`：

  ```vue
  <FormField id="nickname" v-model="form.nickname" label="昵称" test-id="register-nickname">
    <template #trail><NickState :state="nick.state" /></template>
  </FormField>
  ```

- **`defineExpose`**：让父组件通过模板引用调用子组件的方法。时笺输码框暴露 `set()` 给「粘贴识别」，长按封缄按钮暴露 `reset()` 给「再写一枚」。
- **属性透传**：没声明成 props 的属性（`class`、`data-testid`…）自动落到组件根元素上。`<PaperSeal ch="封" class="hero__dot" />` 的 `hero__dot` 就这样并到了 `.seal` 上。

## 6. TypeScript 在 Vue 里

`.ts` 与 `.vue` 里的 `<script setup lang="ts">` 都是带类型的 JavaScript；`vue-tsc` 连模板一起检查。本项目常见的写法：

```ts
defineProps<{ c: CapsuleListItem; now: number; rank?: number }>();   // 基于类型声明 props
defineEmits<{ favChange: [favorited: boolean, count: number] }>();   // 事件名与参数
ref<CapsuleDetail | null>(null);                                      // 泛型参数
useTemplateRef<InstanceType<typeof PaperCodeInput>>("codeInput");     // 子组件实例的类型
```

**泛型组件**：`SegControl` 的 `v-model` 类型由选项决定（排序是 `PlazaSort`，筛选是 `PlazaFilter`）：

```vue
<script setup lang="ts" generic="T extends string">
const model = defineModel<T>({ required: true });
defineProps<{ label: string; options: SegOption<T>[]; testid: string }>();
</script>
```

**扩展路由元信息的类型**（`router/index.ts`）：

```ts
declare module "vue-router" {
  interface RouteMeta { title?: string; requiresAuth?: boolean; guestOnly?: boolean }
}
```

之后 `to.meta.requiresAuth` 有类型提示，拼错会报错。

## 7. 路由层：`router/`

### 7.1 路由表

```ts
export const router = createRouter({
  history: createWebHistory(),
  stringifyQuery,
  routes: [
    { path: "/", component: skinned("PlazaPage", { paper: PaperHomePage, amber: AmberHomePage }), meta: { title: "把此刻寄给未来" } },
    { path: "/login", component: skinned("LoginPage", {...}), meta: { title: "登录", guestOnly: true } },
    { path: "/create", component: skinned("CreatePage", {...}, { needsUser: true }), meta: { title: "写给未来", requiresAuth: true } },
    { path: "/capsules/:code", component: skinned("CapsulePage", {...}) },
    { path: "/me", redirect: "/me/created" },
    { path: "/me/:tab(created|favorites|profile)", component: skinned("MePage", {...}, { needsUser: true }), meta: { title: "我的", requiresAuth: true } },
    { path: "/me/:rest(.*)", redirect: "/me/created" },
    { path: "/:pathMatch(.*)*", component: skinned("NotFoundPage", {...}), meta: { title: "查无此页" } },
  ],
  scrollBehavior: (to, from) => (to.path !== from.path ? { top: 0 } : false),
});
```

- **路径参数**：`:code` 在组件里用 `useRoute().params.code` 取。
- **正则参数**：`:tab(created|favorites|profile)` 只匹配三个页签；三个页签是**同一条路由**，切页签只是参数变化，组件实例复用，页头与统计不重新挂载。别的 `/me/*` 由下一条重定向回「我创建的」。
- **404 兜底**：`/:pathMatch(.*)*` 匹配任何没被前面接住的路径，放在最后。
- **`scrollBehavior`**：换页回到顶部。

### 7.2 `skinned()`：同一条路由，两份视图

```ts
export function skinned(name: string, views: Record<Skin, Component>, opts: { needsUser?: boolean } = {}) {
  return defineComponent({
    name,
    setup() {
      const ui = useUiStore();
      const auth = useAuthStore();
      return () => (opts.needsUser && !auth.user ? null : h(views[ui.skin]));
    },
  });
}
```

`setup()` 返回一个**渲染函数**：`h(组件)` 等价于模板里写 `<组件 />`。它读了 `ui.skin`，皮肤一变就重新渲染成另一份视图。`needsUser`：创建页、我的页要用当前用户的头像与昵称，登出那一瞬 `user` 先变空、跳转还在路上，这时先什么都不画。

### 7.3 导航守卫

```ts
router.beforeEach(async (to) => {
  const auth = useAuthStore();
  if (to.meta.guestOnly && auth.user) {
    const r = to.query.redirect;
    return safeRedirect(typeof r === "string" ? r : null, "/");
  }
  if (to.meta.requiresAuth) {
    if (!auth.user && auth.refreshToken) await auth.refreshMe();
    if (!auth.user) return loginPath(to.fullPath);
  }
  return true;
});
```

- 守卫返回 `true` 放行，返回一个地址就重定向。
- **守卫可以是 async**：只有 refresh token（user 还没拿到）时，先 `await auth.refreshMe()`——接口客户端会自动用 refresh token 续期，拿到 user 再判断。
- **`guestOnly`**：已登录时访问登录 / 注册页，直接去 `?redirect=` 或首页。只在「进入」这一页时判断，所以页面里刚登录成功、由表单自己跳转时不会被抢先。
- **`stringifyQuery`**：守卫返回的地址会被路由器解析再重新拼接，默认编码保留 `/`，`/login?redirect=%2Fcreate` 会变成 `?redirect=/create`。这里换成 `encodeURIComponent` 编码，地址栏与 `loginPath()` 一致（`spec/ui/testids.md` X7 要求 redirect 原样保留）。
- **`afterEach`**：写 `document.title` 与 `body[data-route]`（个别皮肤样式按页面微调）。

页面之间跳转：模板里用 `<RouterLink to="/open">`（渲染成 `<a>`，点击走前端路由），脚本里用 `useRouter().push(...)`。

## 8. 外壳：页头、匿名拦截、浮层

- **当前导航项**：`useNavKey()` 把路径归到「广场 / 开启 / 创建 / 关于 / 我的」（详情页算「开启」，登录注册算「我的」），`navAttrs()` 生成高亮类名与 `aria-current`，`v-bind="navAttrs('plaza', cur)"` 一次绑上。
- **匿名点「创建」先确认**：普通 `<RouterLink>` 上加 `@click`，透传的监听器会排在它自己的 `navigate` 之后，来不及拦。`CreateLink.vue` 用 `RouterLink` 的 `custom` 插槽自己渲染 `<a>`：

  ```vue
  <RouterLink v-slot="{ href, navigate }" to="/create" custom>
    <a v-bind="$attrs" :href="href" @click="onClick($event, navigate)"><slot /></a>
  </RouterLink>
  ```

  已登录就 `navigate(e)`；匿名就 `preventDefault()`，弹确认框，确认后 `router.push(loginPath("/create"))`。首页、导航、底栏、空状态、详情页里的「创建」入口都用它。
- **浮层**：时笺的封缄仪式要盖在整页之上，用 `<Teleport to="body">` 把它渲染到 `<body>` 下，组件逻辑仍在创建页里。
- **琥珀星空**：`AmberBackdrop.vue` 用 `watchEffect((onCleanup) => …)` 在皮肤 / 明暗变化时重启画布动画，上一轮的停止函数交给 `onCleanup`。

## 9. 数据层：`api/client.ts`

与 React 参考实现是同一份（框架无关）：

- `request<T>(path, opts)`：自动设置 `Content-Type` / `Accept`、序列化 `body`、带上 `Authorization`；解开后端统一外壳 `{ success, data, message, errorCode }`，调用者只看到 `data`；失败抛 `ApiError`（带 HTTP 状态、errorCode、字段级 details）。
- **自动 refresh 单飞**：模块级变量 `refreshing` 保存进行中的 refresh Promise，一波 401 同时发生时只发一次 `/auth/refresh`，其余请求 `await` 同一个 Promise；拿到新 token 后重放原请求，`_retry` 防止无限循环。
- **与 store 解耦**：`api/client.ts` 不 import store（store 反过来 import 了 api，会循环）。`stores/auth.ts` 导出 `wireAuthApi()`，在 `main.ts` 里调用一次，把 store 的 getter / setter 注册进客户端。

## 10. 状态层：Pinia

### 10.1 setup 风格的 store

```ts
export const useUiStore = defineStore("ui", () => {
  const skin = ref<Skin>(root().dataset.skin === "paper" ? "paper" : "amber");
  const theme = ref<Theme>(root().dataset.theme === "light" ? "light" : "dark");
  function setSkin(next: Skin) { /* View Transition 里改 <html> 属性、存 localStorage */ }
  function toggleTheme(origin?: { x: number; y: number }) { /* 从点击处圆形晕开 */ }
  return { skin, theme, setSkin, toggleTheme };
});
```

`defineStore` 的第二个参数就是一个组合式函数：`ref` 是 state，`computed` 是 getter，函数是 action。组件里 `const ui = useUiStore()`，模板里直接 `ui.skin`（store 本身是响应式对象，自动解包）。要把 state 解构出来又保持响应式，用 `storeToRefs(store)`（`DialogHost.vue`）。

### 10.2 本项目的六个 store

| Store | 关心什么 | 持久化 |
|---|---|---|
| `auth` | user / accessToken / refreshToken / hydrated | refreshToken + user → localStorage（`main.ts` 在装路由前恢复） |
| `ui` | skin · theme 及带转场的切换 | localStorage `hellotime.skin` / `hellotime.theme` |
| `plaza` | sort / filter / q / qInput / page + 列表、筛选数量、年鉴、精选 | 否；两套皮肤共用，切皮肤后条件还在 |
| `feedback` | Toast 队列与当前确认框 | 否；任何地方直接 `toast()`、`await confirmDialog()` |
| `draft` | 创建页草稿：标题、正文、开启时刻、预设、是否公开 | 否（只在内存）；封存成功、登出、换账号时清空 |
| `forms` | 登录 / 注册 / 资料 / 改密码的表单值 | 否；提交成功、登出、离开该页面时清空 |

### 10.3 store 里也能 `watch`：草稿属于写它的人

```ts
// stores/draft.ts（forms 同理）
const auth = useAuthStore();
watch(
  () => auth.user?.id,
  (id, prev) => {
    if (prev && id !== prev) reset();
  },
);
```

setup store 里的 `watch` 跟着 store 活，不跟任何组件。登出、换了另一个账号，草稿与表单立刻清空——同一标签页里下一位用户读不到（也没法以自己的身份封存）上一位的草稿。`stores/stores.test.ts` 用 `setActivePinia(createPinia())` 单测了这条规则。

### 10.4 并发请求的「序列号」模式

```ts
let listSeq = 0;
async function fetchList() {
  const my = ++listSeq;
  const data = await api.plaza({ ... });
  if (my !== listSeq) return;        // 已经被更新的请求淘汰了
  items.value = data.items;
}
```

用户快速切排序 / 筛选会连发好几个请求，响应顺序不一定和发起顺序一致；序列号保证只有最后发起的那个能写状态。同样的模式用在筛选数量、AI 推荐、「我的」列表、详情页取数上。

### 10.5 搜索防抖放在 store 里

```ts
function typeQ(v: string) {          // 搜索框每敲一个字
  qInput.value = v;
  clearTimeout(debounce);
  if (v === q.value) return;
  debounce = window.setTimeout(() => setQ(v), SEARCH_DEBOUNCE_MS);   // 300ms 后真正查询
}
```

计时器若放在视图里，输入后 300ms 内切皮肤（视图整个换掉）会丢字；放在 store 里就不会。视图里 `v-model="qInput"`，`qInput` 是 `usePlazaHome()` 给的可写 computed，写入走 `typeQ`。

### 10.6 跨 store 联动

`FavButton` 收藏成功后调 `plaza.patchFavorited(id, favorited, count)`，广场列表与精选里的这一枚同步更新；「我收藏的」里取消收藏则通过 `change` 事件把它从列表移出，并刷新 `/me/stats`。

## 11. 组合式函数层：`composables/`

| 函数 | 做什么 | 值得看的写法 |
|---|---|---|
| `useNow` | 全局整秒节拍，所有倒计时一起跳 | 模块级 `ref` + 使用计数；`onScopeDispose` 里最后一个使用者走了就停表 |
| `usePlazaHome` | 首页：进入 / 换账号时刷新、`/` 聚焦搜索、到点刷新、v-model 用的 `sort / filter / qInput` | `useTemplateRef("plazaSearch")` 在组合式函数里拿视图的输入框；`watch(due, …)` 到点刷新 |
| `useCountUp` | 年鉴数字进入视口时数上来 | `IntersectionObserver` + rAF；减少动效时直接显示终值 |
| `useCodeOpen` | 凭码开启：校验、查询、命中后跳详情 | 首页就地输码与开启页共用 |
| `useCapsuleByCode` | 详情：取数、逐秒倒数、`expired`、`awaitOpened()` | 归零后以服务端 `isOpened` 为准，1s、2s…≤5s 退避重试；换码或离开页面作废等待 |
| `useCreateCapsule` | 创建：草稿字段、校验、AI 推荐与代笔、封存 | 可写 computed 给 v-model；AI 请求成功前不动正文，失败原文保留 |
| `useAccount` | 登录、注册、我的统计与列表、资料与密码 | `onBeforeRouteLeave` / `onBeforeRouteUpdate` 判断「真的离开」再清表单 |
| `useShell` | 导航项、滚动态、明暗切换、`/health` | `/health` 只请求一次，页脚与关于页共用 |
| `useMotion` | `useShake`、`useSlider` | `watch(deps, place, { flush: "post" })` 在 DOM 更新后量位置 |

### 11.1 详情页：倒数归零 → 等服务端确认

```ts
async function awaitOpened(): Promise<CapsuleDetail | null> {
  const my = gen;                                    // 换了码或离开页面 gen 会变
  for (let i = 0; my === gen; i++) {
    const d = await api.capsuleByCode(toValue(code));
    if (d.isOpened) { capsule.value = d; return d; }
    await sleep(Math.min(1000 * (i + 1), 5000));     // 本机时钟可能快几秒：隔一会儿再问
  }
  return null;
}
```

两套皮肤在 `watch(expired, …)` 里先播开启动画，再 `await awaitOpened()`；服务端没确认前停在动画末帧，不提前报「已开启」。

### 11.2 离开页面才清表单

```ts
function useClearOnLeave(keys: FormKey[], stays: (to: RouteLocationNormalized) => boolean) {
  const forms = useFormsStore();
  onBeforeRouteLeave(() => forms.clear(...keys));
  onBeforeRouteUpdate((to) => {
    if (!stays(to)) forms.clear(...keys);
  });
}
```

切换皮肤会卸载视图组件，但不经过路由守卫，所以表单不会被误清（X5）；真的换页才清。资料页在 `/me/:tab` 下，切到别的页签是「同一路由参数变化」，要靠 `onBeforeRouteUpdate`。

## 12. 视图层：皮肤与组件

### 12.1 一个页面的三层

```
router/index.ts           /create → skinned("CreatePage", { paper, amber }, { needsUser: true })
composables/              useCreateCapsule()：草稿、校验、AI、封存
skins/paper/PaperCreatePage.vue   信笺 + 对数时间标尺 + 日历 + 长按火漆 + 封缄仪式
skins/amber/AmberCreatePage.vue   表单卡 + 实时预览 + 按钮 + 码牌回执
```

两套创建页长得完全不同，却调用同一个 `useCreateCapsule()`。读代码时先看组合式函数，再对照两份视图，就能看清「逻辑」与「表现」的分界。时笺把大块拆成了子组件：`PaperTimeRuler`（拖动 / 点按 / 方向键调整，外部改了时刻时平滑滑过去）、`PaperCalendar` + `PaperTimeInput`、`PaperHoldSeal`（按住 1.15 秒才提交，完成由定时器驱动，空格键同样可用）、`PaperCeremony`（`<Teleport>`）。

### 12.2 结构两套相同的部件（`components/`）

| 组件 | 说明 |
|---|---|
| `FormField` / `PasswordField` | `defineModel` + `#trail` 插槽；按皮肤出下划线信笺栏或带图标的输入框；出错时带 `field-error` 钩子并抖一下 |
| `SegControl` | 泛型分段控件，滑块由 `useSlider` 对齐 |
| `FavButton` | 乐观更新、失败回滚；`:key="pop"` 让按钮重新挂载以重播 `is-pop` 动画 |
| `AvatarPicker` / `NickState` / `PwdRules` / `FormMsg` | 注册与资料页的小件 |
| `CreateLink` | 见 §8 |
| `ToastHost` / `DialogHost` | Toast 与确认框；确认框的正文与插画是**函数式组件** |
| `UserMenu` / `SkinSwitch` / `ListMore` / `AppIcon` / `AppAvatar` / `TechIcon` | 外壳与通用小件 |

### 12.3 确认框的正文：函数式组件

```ts
// composables/useAccount.ts：删除确认
await confirmDialog({
  title: "删除这枚胶囊？",
  body: () => [
    h("p", [`《${c.title}》会被永久删除。持有胶囊码 `, h("b", { class: "mono" }, c.code), " 的人将无法再打开它……"]),
    h("p", { class: "dlg__warn" }, "此操作不可恢复。"),
  ],
  tone: "danger",
  mark, // 各皮肤的小插画：时笺一枚「删」字印，琥珀这枚胶囊的插画
});
```

一个返回 VNode 的函数本身就是合法的组件，`DialogHost` 用 `<component :is="dialog.body" />` 渲染。正文里有用户写的标题，这样写文字会被正常转义，不需要 `v-html`。

### 12.4 测试钩子

每个关键元素都带 `spec/ui/testids.md` 规定的 `data-testid` 与状态属性（`data-state`、`data-code`、`data-selected`、`aria-pressed`…）。Vue 3 把布尔值渲染成字符串（`data-selected="false"`），`undefined` / `null` 则不渲染属性——所以「条件出现」的钩子写成 `:data-testid="error ? 'open-error' : undefined"`。UI 冒烟只靠这些钩子定位，两套皮肤跑同一套用例。

## 13. 工具层：`lib/`

| 文件 | 内容 |
|---|---|
| `fmt.ts` | 时间说法（`span`：「2 年 8 个月」）、倒计时拆分、等待进度、农历、`reducedMotion()`、`focusIfIdle()`、`addCalendarYears()` |
| `schedule.ts` | 开启时间上下限（≥ 此刻 + 61 秒，≤ 10 个日历年，两头留余量）、预设、校验文案 |
| `icons.ts` | 24 网格线性图标的路径（`AppIcon.vue` 负责渲染） |
| `avatars.ts` | 构建期内联 `spec/avatars/v2` 的单线徽记（`import.meta.glob(..., { query: "?raw" })`） |
| `palette.ts` | 琥珀的胶囊专属色：FNV-1a + OKLCH（`docs/02-design.md §9.6`） |
| `about.ts` | 关于页文字、本前端的技术栈 |
| `redirect.ts` | 登录回跳：只接受站内路径 |

## 14. 样式层：spec/styles

`src/styles/index.css` 只做两件事：引入 `@fontsource` 自托管字体；按「base → 时笺 → 琥珀 → shell」的顺序引入 `spec/styles`。本前端不写组件样式、不用 Tailwind。

SFC 的 `<style>` 块只用在两处胶水上：`App.vue`（全局，`#app { display: contents }`）与 `ListMore.vue`（`scoped`，只作用于本组件，用 `var(--space-8)`）。令牌检查会扫描 `.vue` 的 `<style>` 块：只能引用 `base.css` 刻度与语义令牌，不能写色值。

想改长相：改 `spec/styles/<skin>/*.css`（所有实现一起受益），并在原型里两套皮肤、明暗都看一遍。

## 15. 测试

- 单元测试（vitest + happy-dom，`./test`）：
  - `lib/lib.test.ts`：时间说法、日历年上限（含 2 月 29 日）、专属色确定性、登录回跳
  - `api/client.test.ts`：refresh 单飞与重放
  - `stores/stores.test.ts`：草稿与表单随登出 / 换账号清空，同一个人刷新资料不清
- UI 冒烟（Playwright，`verification/ui`）：44 条用例 × 两套皮肤，靠测试钩子定位；`SKINS=paper` 可只跑一套。

## 16. 常见改动指南

- **新增一个页面**：在 `composables/` 写逻辑 → 在 `skins/paper` 与 `skins/amber` 各写一份视图（照原型的结构与类名）→ 在 `router/index.ts` 用 `skinned()` 登记，需要登录就加 `meta.requiresAuth` → 按 `spec/ui/testids.md` 加测试钩子。
- **新增一个接口**：先改 `spec/api/openapi.yaml` → 在 `types/` 加类型 → 在 `api/client.ts` 加方法 → 在组合式函数或 store 里调用。
- **新增一份要跨皮肤保留的状态**：放进 store（或 store 里的一个 `reactive` 对象），不要放在视图组件自己的 `ref` 里。
- **调整视觉**：改 `spec/styles`，不要在组件里写样式。

## 17. 学到这里之后

读到这里，你已经掌握了现代 Vue SPA 最常见的 80%：响应式（`ref` / `computed` / `watch`）、单文件组件与模板指令、`<script setup>` 与组合式函数、props / emits / `defineModel` / 插槽、Vue Router 守卫、Pinia、TypeScript 泛型组件、Vite 入口与代理、fetch 封装 + 自动 refresh。

下一步建议：

- 从 `skins/paper/PaperCreatePage.vue` 跟读「填表 → 调 AI 代笔 → 长按封缄 → 封缄仪式」整条路径，再对照 `skins/amber/AmberCreatePage.vue`。
- 打开 Vue Devtools，看 Pinia 面板里 `plaza` store 在切排序、搜索时怎么变；在 `fetchList` 里加 `console.log` 观察「序列号丢弃旧请求」。
- 对照 `frontends/react-ts` 的同名文件：Hook 与组合式函数、Zustand 与 Pinia、`<AuthGate>` 与导航守卫、受控组件与 `v-model`——相同的 UI 在两种思路下怎么写，是这个项目最大的价值。

之后可以再深入：`<KeepAlive>` 与 `<Suspense>`、`provide / inject`、自定义指令、`shallowRef` 与性能、Nuxt（`fullstacks/nuxt` 是同一个应用的 Nuxt 版）。本项目刻意保持极简，把这些留给后续。
