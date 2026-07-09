# HelloTime Pro · 五个移动端实现全面对比

> 对比对象：`mobile/` 下的 5 个移动端客户端，**5/5 已全部落地并验证**（移动端收官 2026-07-06）：
> **iOS**（SwiftUI 原生）· **Android**（Jetpack Compose 原生）· **Flutter**（与桌面同源工程，一码多端）·
> **React Native**（Expo）· **微信小程序**（原生框架）。
> 姊妹篇：桌面端对比见 [`docs/desktop-comparison.md`](desktop-comparison.md)；
> Web 前端对比见 [`docs/frontend-comparison.md`](frontend-comparison.md)；
> 各端深度导读见其 `README.md` / `TECHNICAL_GUIDE.md`。

---

## 0. 这篇文章怎么读

五个客户端实现**同一个 App**：同样的四个底部 Tab（广场 / 开启 / 创建 / 我的）、同样的页面、
同样的交互（浏览胶囊、写信封存、凭 8 位码开启、倒计时解封、收藏、明暗主题）、同一组后端接口。
所以本文不按「框架特性清单」组织，而是**按界面和流程切片**：每一节取一个具体的 UI 场景，
把五端的声明方式和状态控制并排放在一起——

- §2 应用外壳：底部 Tab 导航怎么声明
- §3 受保护入口：点「创建」但没登录，会发生什么
- §4 状态如何驱动界面：以主题切换为例
- §5 一个会动的界面：倒计时每秒刷新
- §6 输入的手感：8 位胶囊码与日期选择
- §7 列表与卡片
- §8 登录态的生命周期
- §9 主题令牌与视觉
- §10 每端撞过的墙
- §11 代码量与「该读哪一个」

读本文**不需要**读过本项目的 Web 前端代码；涉及 Web 的对照只在 React Native 相关段落顺带给出。

---

## 1. 五端一览

| | ios | android | flutter | react-native | wechat |
|---|---|---|---|---|---|
| 语言 | Swift 6 | Kotlin 2.4 | Dart | TypeScript | JavaScript |
| UI 体系 | SwiftUI（系统原生控件） | Jetpack Compose + Material 3 | Flutter Widget（Impeller 自绘） | RN 原生组件桥接 | WXML/WXSS（微信渲染层） |
| 状态原语 | `@Observable` + `@State` | `StateFlow` + Compose state | Riverpod provider | Zustand store + hooks | 手搓 store + `setData` |
| 导航 | `TabView` + `NavigationStack` | `NavHost` + `NavigationBar` | go_router + 响应式外壳 | Expo Router（文件式） | `app.json` tabBar + 页面栈 |
| 网络 | URLSession async/await | OkHttp + 协程 | Dart http | fetch | wx.request |
| 一句话定位 | 平台贴合度最高 | 一切手写、最「工程」 | 一份代码桌面+移动双投影 | Web React 技能直接平移 | 免安装、即点即用 |

五端都是**纯 API 消费者**：直连同一组后端（`:9080` 反代），不含任何服务端代码。

---

## 2. 应用外壳：底部 Tab 导航怎么声明

同一个移动 IA——底部四 Tab、启动 splash、全局登录弹层——五端的声明方式：

**iOS（SwiftUI）**：`TabView` 是系统控件，`selection` 绑定到 store，每个 Tab 自带独立的
`NavigationStack`（各 Tab 的浏览历史互不干扰，这是 iOS 的平台惯例）：

```swift
TabView(selection: Binding(
    get: { store.selectedTab },
    set: { store.selectTab($0) }        // 经 store 走，才能拦截受保护 Tab（见 §3）
)) {
    PlazaView().tabItem { Label("广场", systemImage: "square.grid.2x2") }.tag(Tab.plaza)
    OpenView().tabItem  { Label("开启", systemImage: "lock.open") }.tag(Tab.open)
    CreateView().tabItem { Label("创建", systemImage: "plus.circle") }.tag(Tab.create)
    MeView().tabItem    { Label("我的", systemImage: "person.crop.circle") }.tag(Tab.me)
}
.sheet(isPresented: $store.showAuthSheet) { AuthSheet() }   // 全局登录弹层
```

**Android（Compose）**：没有一体化的 TabView，用 `Scaffold` 组合 `NavigationBar`（M3 底栏）
与 `NavHost`（路由容器），当前 Tab 从导航栈反推：

```kotlin
Scaffold(bottomBar = { BottomBar(nav, currentRoute) }) { pad ->
    NavHost(nav, startDestination = "plaza", modifier = Modifier.padding(pad)) {
        composable("plaza") { PlazaScreen(nav) }
        composable("open") { OpenScreen(nav) }
        composable("create") { CreateScreen(nav) }
        composable("me") { MeScreen(nav) }
        composable("capsule/{code}") { entry ->     // 详情页与 Tab 同一棵栈
            CapsuleDetailScreen(nav, entry.arguments?.getString("code") ?: "")
        }
    }
}
if (showAuth) AuthSheet(nav)                        // ModalBottomSheet 登录
```

**Flutter**：本端的特殊性在于**同一份工程还要跑桌面**。外壳按窗口宽度分叉——
宽屏走桌面外壳（顶部导航 + 页脚），窄屏走 `MobileShell`；页面本体和路由树两套外壳共用：

```dart
const double kWideBreakpoint = 740;   // >= 桌面外壳，否则移动外壳

// MobileShell：Scaffold + 精简 AppBar + 底部 NavigationBar
bottomNavigationBar: NavigationBar(
  selectedIndex: _currentIndex(loc),
  onDestinationSelected: (i) => context.go(_tabs[i].$1),   // go_router 切路由
  destinations: [ for (final t in _tabs) NavigationDestination(icon: ..., label: t.$3) ],
)
```

**React Native（Expo Router）**：路由由**文件系统**声明——`app/(tabs)/` 目录下每个文件是
一个 Tab 页，`(tabs)/_layout.tsx` 定义 Tab Bar 本体。对写过 Web React 的人，这就是
JSX + props，只是组件从 `<div>` 换成了 `<Tabs>`：

```tsx
<Tabs screenOptions={{ tabBarActiveTintColor: pal.signal.primary, ... }}>
  <Tabs.Screen name="index" options={{ title: "广场", tabBarIcon: ... }} />
  <Tabs.Screen name="open"  options={{ title: "开启", ... }} />
  <Tabs.Screen name="create" options={{ title: "创建", ... }} />
  <Tabs.Screen name="me"    options={{ title: "我的", ... }} />
</Tabs>
```

**微信小程序**：Tab Bar 不是代码，是**配置**——`app.json` 里声明，渲染和切换由微信平台接管：

```json
"tabBar": {
  "list": [
    { "pagePath": "pages/plaza/index",  "text": "广场" },
    { "pagePath": "pages/open/index",   "text": "开启" },
    { "pagePath": "pages/create/index", "text": "创建" },
    { "pagePath": "pages/me/index",     "text": "我的" }
  ]
}
```

> **观察**：从 iOS（一个控件全包）到 Android/Flutter/RN（组合出来）再到小程序（纯配置、
> 应用代码无法介入），Tab 壳的「可编程程度」逐级下降——这直接决定了 §3 里登录拦截
> 能做在哪一层。

---

## 3. 受保护入口：点「创建」但没登录，会发生什么

「创建」「我的」两个 Tab 需要登录。用户未登录点下去，五端的交互和实现分成三派：

| 派系 | 端 | 用户看到什么 | 实现在哪一层 |
|---|---|---|---|
| **拦截 + 弹层回跳** | ios、android | Tab 不切换，底部弹出登录 sheet；登录成功自动进入刚才想去的 Tab | Tab 切换入口统一收口到一个函数 |
| **路由守卫重定向** | flutter、react-native | 页面跳转被重定向到登录页 | 路由层 |
| **页面内门禁** | wechat | Tab **会**切过去，页面渲染一张「请先登录」卡片 | 页面模板 |

**ios / android 的「拦截 + 回跳」**是移动端最顺手的一派——关键是把「想去哪」记下来：

```kotlin
// android：所有 Tab 点击都走这个函数（iOS 的 store.selectTab 同思路）
fun goTab(nav: NavHostController, route: String) {
    if (protected && !session.canAccessProtected) {
        session.requireLogin(pending = route)   // 记下目标，弹登录 sheet
        return                                  // Tab 不切换
    }
    nav.navigate(route) { ... }
}
// 登录成功 → 读出 pending → 自动导航过去
```

**flutter 的路由守卫**最省事：go_router 的 `redirect` 是给桌面版写的，移动外壳换了、
守卫一行没改——路由层守卫天然与 UI 外壳解耦。

**wechat 的页面内门禁**是被平台逼的：原生 `tabBar` 由微信渲染，应用代码**拿不到
「Tab 即将切换」事件**，无法拦截，只能让页面切过去之后自己挡：

```xml
<view wx:if="{{!hasUser}}" class="card">
  <text>登录后才能封存写给未来的信。</text>
  <view class="btn btn-primary" bindtap="goLogin">登录</view>
</view>
<view wx:else><!-- 真正的创建表单 --></view>
```

> 同一个需求，实现位置从「导航层」滑落到「页面层」，不是设计品味差异，
> 而是平台开放度差异——这是五端对照里最能看清「框架给了你多少控制权」的一处。

---

## 4. 状态如何驱动界面：以主题切换为例

每端右上角都有一个明暗切换按钮，点一下全 App 换肤。这个「一个状态，全局生效」的场景
把五端的响应式模型照得很清楚：

| 端 | 状态存在哪 | 界面怎么知道要重画 |
|---|---|---|
| ios | `@Observable` 的 `AppStore.theme` | SwiftUI 自动追踪读取，改值即重算依赖它的视图；`preferredColorScheme` 一并切系统明暗 |
| android | `ThemeStore` 的 `StateFlow` | `collectAsState()` 把流变成 Compose state，`CompositionLocal`（`HT.colors`）向整棵树下发当前配色 |
| flutter | Riverpod `themeProvider` | `ref.watch(themeProvider)` 的 Widget 自动重建；页面经 `context.colors` 取当前语义色 |
| react-native | Zustand `useTheme` store | 订阅该 store 的组件重渲染；`usePalette()` 返回当前主题调色板 |
| wechat | 手搓 store（40 行，`getState/setState/subscribe`） | 页面工厂 `createPage` 统一订阅，`setData({ themeMode })` 触发重渲染 |

前四端本质相同：**声明式 UI + 可观察状态，改状态、框架负责重画**，差别只是「可观察」
的拼法（宏 / 流 / provider / hook）。

**wechat 是唯一的例外**，值得单独看。小程序没有「组件读状态自动订阅」机制，数据必须
显式 `setData` 推给渲染层；而且没有全局根节点可挂主题类。解法是一个页面工厂：

```js
// utils/page.js —— 每个页面都用 createPage 包裹
function createPage(options) {
  return Page(Object.assign({}, options, {
    onLoad(query) {
      this.setData(themeData());                                  // 注入 themeMode + themeColors
      this.__themeUnsub = useTheme.subscribe(() => this.setData(themeData()));
      if (options.onLoad) options.onLoad.call(this, query);
    },
    onUnload() { this.__themeUnsub?.(); ... },
  }));
}
```

每页根节点写 `<view class="app-root theme-{{themeMode}}">`——切主题即换 CSS 类，
WXSS 里的 `var(--surface-0)` 等变量整表切换。这等价于 Web 的 `<html data-theme>` 手法，
只是「挂在每一页」而非全局。

> 顺带的收获：`themeColors` 也从这里注入——小程序部分组件属性（`<switch color>`、
> `wx.showModal` 的 `confirmColor`）吃不了 CSS 变量，只能喂色值字符串，统一由工厂
> 从令牌调色板取值，业务代码不写死颜色。

---

## 5. 一个会动的界面：倒计时每秒刷新

未解封的胶囊详情页有一块「天 / 时 / 分 / 秒」倒计时，每秒跳动，到点自动向后端确认解封、
刷出正文。「每秒重画一小块 UI + 到期触发副作用」五端写法：

**iOS**：SwiftUI 有专门为此设计的 `TimelineView`——声明「这块视图每秒重算」，
不需要自己管理定时器和状态：

```swift
TimelineView(.periodic(from: .now, by: 1)) { ctx in
    let cd = DateUtil.countdown(toISO: c.openAt, now: ctx.date)
    HStack { FlipUnit(value: cd.days, label: "天"); ... }
}
// 到期自动开启：.task(id: cap?.openAt) { await autoOpenLoop() }
```

**Android**：Compose 没有 TimelineView 等价物，惯用法是 `LaunchedEffect` 里开协程循环，
改一个 `mutableStateOf` 驱动重组：

```kotlin
var now by remember { mutableStateOf(Instant.now()) }
LaunchedEffect(cap?.id, cap?.isOpened) {
    if (cap?.isOpened != false) return@LaunchedEffect
    while (true) {
        delay(1000)
        now = Instant.now()                                    // 改 state → 依赖它的 UI 重组
        if (DateUtil.countdown(cap.openAt, now) == null) { reload(); break }   // 到点重拉
    }
}
```

**Flutter**：经典的 `Timer.periodic` + `setState`（StatefulWidget），到期另挂一个一次性
`Timer` 去轮询解封：

```dart
_ticker = Timer.periodic(const Duration(seconds: 1), (_) {
  if (mounted) setState(() {});          // 空 setState：触发 build 重算倒计时
});
_autoOpen = Timer(wait, _pollOpen);
```

**React Native**：和 Web React 一模一样的写法——`useState` 存当前时刻，
`useEffect` 里 `setInterval`，清理函数退订：

```tsx
const [now, setNow] = useState(() => Date.now());
useEffect(() => {
  if (!cap || opened) return;
  const t = setInterval(() => setNow(Date.now()), 1000);
  return () => clearInterval(t);
}, [cap, opened]);
```

**微信小程序**：`setInterval` 里显式 `setData` 推格式化好的四个数字；页面 `onUnload`
必须手动清定时器（没有 hook 的自动清理）：

```js
this._tick = setInterval(() => this._renderCountdown(), 1000);   // 内部 setData({units})
this._poll = setTimeout(() => this._pollOpen(), delay);          // 到期轮询解封
// onUnload() { clearInterval(this._tick); clearTimeout(this._poll); }
```

> **梯度很清晰**：iOS 把「随时间重画」做成了声明式原语（连状态都不用你存）；
> Android/Flutter/RN 是「定时器改状态、框架重画」的半自动；小程序是全手动——
> 连「格式化成什么字符串」都要在 JS 侧算好推过去，渲染层只认 `{{units}}`。
> 清理责任也随之从「框架管」（`.task`/`LaunchedEffect`/`useEffect` 自动取消）
> 滑向「自己管」（`dispose`/`onUnload` 手动清）。

---

## 6. 输入的手感：8 位胶囊码与日期选择

### 8 位分格码输入

「开启」页要输入 8 位大写码，UI 是 8 个分离的格子。难点在移动端：软键盘的退格、
整串粘贴、自动前进都要顺。三种实现思路：

| 思路 | 端 | 说明 |
|---|---|---|
| **隐藏输入框 + 8 个显示格** | ios、android | 一个透明 `TextField`/`BasicTextField` 承接全部键盘事件，上层 8 个格子按 `code[i]` 纯展示。退格/粘贴/输入法天然正确，格子只管好看 |
| **8 个真输入框 + 焦点接力** | react-native、flutter | 每格一个输入框，输入自动跳下一格、捕获 Backspace 回跳前格 |
| **单输入框 + 字距拉开** | wechat | 一个 `<input>`，`letter-spacing` 做出分格视觉；输入过滤大写化。省去焦点管理，代价是分格只是「视觉上的」 |

iOS 版的核心（android 的 `decorationBox` 同思路）：

```swift
ZStack {
    TextField("", text: Binding(get: { code }, set: { handle($0) }))
        .opacity(0.01).frame(width: 1, height: 1)        // 隐藏，只接键盘
    HStack { ForEach(0..<8) { i in /* 第 i 格显示 code[i]，当前位高亮描边 */ } }
        .onTapGesture { focused = true }                  // 点格子聚焦隐藏框
}
```

> 「隐藏输入框」是移动端最稳的一派：状态只有一个字符串，永远不会出现「格子间焦点
> 不同步」的边角案例。「焦点接力」写起来直观，但退格跨格、粘贴分发都要自己处理。

### 日期时间选择

创建页要选「开启时间」。这是五端 UI 差异最大的一处——一半用平台控件，一半自定义：

- **ios**：`DatePicker(.compact)`——iOS 系统日历弹层，平台白送。
- **android**：M3 `DatePickerDialog` + `TimePicker` 两段式对话框，平台白送。
- **wechat**：`<picker mode="date|time">` 唤起微信内置滚轮，平台白送。
- **flutter**：自定义 `HtDateTimePicker`（桌面移动共用的键盘输入型控件）——一码多端
  意味着不能依赖单一平台的日期控件。
- **react-native**：自定义底部弹层（年/月/日/时/分五个步进字段，可手输可 ± 微调）——
  RN 核心库不带日期控件，与其引原生依赖不如按产品需求自建。

五端都配了同一组「快捷预设」按钮（1 分钟后（测试）/ 1 小时后 / 明天 9:00 / 1 年后 /
2030-01-01）——**控件形态各异，产品语义统一**。

---

## 7. 列表与卡片

广场是一条卡片流（头像 + 标题 + 内容预览 + 倒计时徽标 + 收藏数），
下拉分页。五端的列表容器与卡片组合：

| 端 | 列表容器 | 卡片是什么 | 事件怎么回来 |
|---|---|---|---|
| ios | `LazyVStack`（懒加载） | `CapsuleCard` View，`NavigationLink(value: code)` 压栈详情 | 闭包 / Binding |
| android | `LazyColumn` | `CapsuleCard` Composable | 回调参数（`onClick: () -> Unit`） |
| flutter | `CapsuleGrid`（`LayoutBuilder` 响应式：宽 3 列 / 窄单列——桌面移动同一个组件） | `CapsuleCard` Widget | 回调参数 |
| react-native | `<FlatList>`（虚拟化滚动） | `CapsuleCard` 组件 | props 回调（同 Web React） |
| wechat | `<block wx:for="{{items}}">` | `capsule-card` 自定义组件 | **事件上抛**：`triggerEvent('favtoggle')`，父页 `bind:favtoggle` 接 |

值得一提的两处：

- **flutter 的卡片列表是桌面/移动共用的**：`LayoutBuilder` 按可用宽度决定列数，
  手机上自动退化为单列——「一码多端」不只是外壳，页面内容也在自适应。
- **wechat 的「事件上抛」**是小程序组件模型的强约定：子组件不能直接调父页方法或改
  全局状态，交互必须 `triggerEvent` 冒泡、由页面统一处理——数据流向比其余四端更严格
  地单向。

---

## 8. 登录态的生命周期

会话行为五端**完全一致**（这是按同一份 API 契约实现的直接结果）：

1. access token 只放内存；refresh token + 用户信息持久化本地；
2. 冷启动恢复持久化的会话，后台静默拉 `/me` 校准；
3. 任何请求遇 401 → 自动用 refresh token 换新 → 重放原请求（对用户不可见）；
4. 并发请求同时撞 401 时，**只允许一个去刷新**，其余等结果（refresh token 用一次即作废，
   并发各刷各的必坏）。

差异在实现材料：

| 端 | 持久化 | 「只刷新一次」的并发原语 |
|---|---|---|
| ios | UserDefaults | 共享 `Task<String?, Never>`：已有刷新任务就 `await` 它 |
| android | DataStore | `Mutex` + **进锁后复查**（JVM 真并发，拿到锁先看别人是否已换新） |
| flutter | shared_preferences | 共享 `Future`（Dart 事件循环，赋值即互斥） |
| react-native | AsyncStorage（异步，启动需 `await` 恢复） | 共享 Promise |
| wechat | `wx.storageSync`（**同步**，启动恢复无闪烁） | 共享 Promise |

> android 是唯一需要「进锁复查」的：协程可能真并行，其余四端的单线程事件循环
> 把互斥白送了。另一个细节：小程序的同步存储让「启动即有登录态」最干脆，
> RN 的异步 AsyncStorage 反而要处理「恢复完成前不渲染门禁」的一拍延迟。

---

## 9. 主题令牌与视觉

全项目的颜色 / 间距 / 圆角定义在一份令牌源（`spec/tokens/tokens.json`，明暗两套语义色）。
它进入各端的通道：

| 端 | 进入方式 | 产物形态 |
|---|---|---|
| android | codegen 脚本 | `Tokens.kt`：`Color` / 渐变 `Brush` / 辉光色，经 `CompositionLocal` 下发 |
| flutter | codegen 脚本 | `tokens.dart`（桌面移动共享） |
| react-native | codegen 脚本 | `tokens.ts`：rem 折算 px 数字 |
| wechat | codegen 脚本 | **双通道**：`tokens.wxss`（CSS 变量，样式主用）+ `palette.js`（组件属性用） |
| ios | **手抄** `Tokens.swift` | 全场唯一未上 codegen，改令牌需人工同步 |

视觉上最考验各端的是设计稿里的**霓虹辉光**（多层彩色光晕）：

- **wechat** 最轻松：WXSS 就是 CSS，`box-shadow` 原样可用。
- **flutter**：`BoxShadow` 支持颜色模糊，自绘引擎三端渲染一致。
- **ios**：SwiftUI `shadow(color:radius:)` 原生支持彩色阴影。
- **android**：Material 阴影只有海拔模型，彩色辉光靠 `Modifier.blur` 画光斑补偿
  （API 28+ 才有 `ambientColor/spotColor`）。
- **react-native**：iOS 走 `shadowColor/shadowRadius`；Android 侧只有 `elevation`，
  辉光退化为普通投影——**跨平台桥接层的最典型妥协**。

头像是另一类共享资产（10 个 SVG）。四端引库直渲远端 SVG（SVGView / Coil+SvgDecoder /
flutter_svg / react-native-svg）；**小程序的 `<image>` 不认 SVG 且无库可引**，
解法是把渲染提前到构建期——codegen 脚本用 rsvg-convert 把 SVG 预烘焙成 PNG 打进包里，
运行时直接 `<image src="/assets/avatars/{{id}}.png">`，视觉与其余四端一致。

---

## 10. 每端撞过的墙

各端落地时真实踩过、已解决的平台坑（细节见各端 TECHNICAL_GUIDE）：

- **ios**：ATS 默认拦明文 HTTP，请求**静默失败、后端零日志**（最难定位的一类）——
  Info.plist 开本地例外；iOS app 不能纯 SwiftPM 跑模拟器，需 XcodeGen 生成 Xcode 工程；
  `UIImage` 不认 SVG。
- **android**：模拟器里 `127.0.0.1` 是模拟器自身，宿主后端必须走 `10.0.2.2` 别名 +
  `network_security_config` 放行明文；手写 gradle 的版本矩阵全靠查证（Compose BOM
  传递依赖强制 Kotlin ≥2.4）；`hello stop` 的进程组信号会误杀模拟器（独立会话规避）。
- **flutter**：全局 `~/.gradle/init.gradle` 镜像注入与 Gradle 9 严格仓库模式冲突
  （构建期临时挪开、退出还原、残留备份则中止）；`flutter_svg` 不支持 `<filter>`（良性警告）。
- **react-native**：Expo 模板的 Gradle wrapper 与 RN 0.85 工具链版本冲突（降 8.14.3）；
  Metro 广播主机名会选到 VPN 虚拟网卡（钉死 127.0.0.1）；`EXPO_PUBLIC_*` 环境变量被
  Metro 进程**烘焙**，改了必须重启；Android 侧同样要走 10.0.2.2。
- **wechat**：开发者工具 `cli open` 只加载编辑器、**不自动编译运行**（需手动点「编译」）；
  游客 appid 联网受限（真实 AppID 写 gitignored 私有配置）；本地 http 要关合法域名校验
  （仅开发，上线须 https）；组件属性吃不了 CSS 变量。

跨三个平台看，「明文 HTTP 默认被拦」出现了三次（iOS ATS / Android
network_security_config / 小程序 urlCheck），症状都是**请求静默消失**——所以本项目的
连通性验证统一采用「后端日志出现 200」佐证，不信 UI 表象。

---

## 11. 代码量与「该读哪一个」

统一排除 codegen 产物，复现命令见文末：

| 端 | 行数 | 说明 |
|---|---|---|
| flutter | **5,138**（Dart） | ⚠️ 桌面 + 移动**同一份**；单独归给移动端的增量不足 300 行（MobileShell 127 行 + 页面宽窄分支） |
| react-native | 3,898（TS/TSX） | |
| android | 3,005（Kotlin） | |
| wechat | 2,861（JS 1,881 + WXML 569 + WXSS 411） | 逻辑/模板/样式三种文件分离 |
| ios | 2,564（Swift，含手抄令牌 174） | 系统控件白送得最多，代码最少 |

| 你想学什么 | 读哪端 |
|---|---|
| 移动端声明式 UI 的「平台原生」形态（TabView / TimelineView / NavigationStack 这些白送的东西） | **ios** |
| 一个不依赖向导、全手写的现代 Android 工程（Compose + 协程 + StateFlow） | **android** |
| 同一批页面如何同时服务桌面和手机（响应式外壳、路由守卫与 IA 解耦） | **flutter** |
| Web React 技能怎么平移到移动端（会 React 就会 80%，剩下 20% 在 §5/§9 的差异里） | **react-native** |
| 受限平台下的工程化补偿（无状态订阅→页面工厂；无 SVG→预烘焙；属性无变量→调色板注入） | **wechat** |

一句话总结：**五端渲染体系各不相同，但「同一个界面长什么样、状态怎么流动、会话怎么
自愈」在五端完全一致**——差异全在表达材料，不在产品语义。这正是对着同一份契约和
设计令牌开发的效果。

### 附：复现本文数据

```bash
# 代码量（§11，排除 codegen 产物）
find mobile/react-native/src \( -name "*.ts" -o -name "*.tsx" \) ! -name tokens.ts | xargs wc -l | tail -1
find mobile/ios/Sources -name "*.swift" | xargs wc -l | tail -1
find mobile/android/app/src/main/kotlin -name "*.kt" ! -name Tokens.kt | xargs wc -l | tail -1
find desktop/flutter/lib -name "*.dart" ! -name tokens.dart | xargs wc -l | tail -1   # 桌面+移动同源
for ext in js wxml wxss; do find mobile/wechat-miniprogram -name "*.$ext" -not -path "*/tokens/*" | xargs wc -l | tail -1; done

# 连通性验证（§10，任一端）
./scripts/hello start <ios|android|flutter-mobile|react-native|wechat>
tail -f data/logs/fastapi.log   # 等待 GET /api/v1/plaza/capsules ... 200
```
