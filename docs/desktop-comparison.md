# HelloTime Pro · 六个桌面端实现全面对比

> 对比对象：`desktop/` 下的 6 个桌面客户端，**6/6 已全部落地并验证**：
> **Electron**（Web 壳 · 内嵌 React）· **Tauri**（Web 壳 · 内嵌 Svelte）· **SwiftUI**（macOS 原生）·
> **Flutter**（自绘引擎，与移动端同源工程）· **Qt Quick/QML + PySide6**（跨平台，首个 Linux 原生）·
> **WinUI 3**（Windows 原生，远程构建）。
> 姊妹篇：移动端对比见 [`docs/mobile-comparison.md`](mobile-comparison.md)；
> Web 前端对比见 [`docs/frontend-comparison.md`](frontend-comparison.md)；
> 各端深度导读见其 `README.md` / `TECHNICAL_GUIDE.md`。

---

## 0. 这篇文章怎么读

六个客户端实现**同一个桌面 App**：同样的顶部导航 + 多列宽屏布局、同样的页面（广场 / 开启 /
创建 / 我的 / 关于）、同样的交互（浏览、封存、凭码开启、倒计时、收藏、明暗主题）、同一组
后端接口。

第一道分岔在 §2：**把现成的 Web 前端装进一个原生窗口（Electron / Tauri），还是用原生 UI
体系重写整个界面（SwiftUI / Flutter / Qt / WinUI 3）？** 两派要对比的东西完全不同——
壳派比的是进程模型、包体与原生桥；原生派比的是同一个界面怎么声明、状态怎么流动。
所以 §2 讲两个壳，§3 起按界面和流程切片对比四个原生端：

- §3 应用外壳：窗口、顶部导航与路由
- §4 状态如何驱动界面：以主题切换为例
- §5 一个会动的界面：倒计时每秒刷新
- §6 键盘与指针：桌面特有的交互
- §7 登录态的生命周期
- §8 主题令牌与视觉
- §9 每端撞过的墙
- §10 代码量与「该读哪一个」

读本文不需要读过本项目的 Web 前端代码。

---

## 1. 六端一览

| | electron | tauri | swiftui | flutter | qt-pyside | winui3 |
|---|---|---|---|---|---|---|
| 范式 | **Web 壳** | **Web 壳** | 原生 | 原生（自绘） | 原生（自绘） | 原生 |
| 语言 | Node.js（壳） | Rust（壳） | Swift 6 | Dart | Python + QML | C# / .NET 8 |
| UI 体系 | 内嵌 React 前端 | 内嵌 Svelte 前端 | SwiftUI | Flutter Widget | Qt Quick/QML | WinUI 3 XAML |
| 状态原语 | （前端自带） | （前端自带） | `@Observable` | Riverpod | QObject Property/Signal | `INotifyPropertyChanged` |
| 平台 | 跨平台 | 跨平台 | 仅 macOS | mac/Win/Linux | mac/Win/Linux | 仅 Windows |
| 运行形态 | Vite:7190 + 壳窗口 | Vite:7191 + 壳窗口 | 原生进程 | 原生进程 | 原生进程 | **远程**：SSH 驱动远端 Windows |
| 一句话定位 | 自带浏览器引擎的 Web 壳 | 借系统 WebView 的轻量壳 | 苹果平台贴合度最高 | 一份代码桌面+移动 | 首个 Linux 原生 | 唯一 Windows 原生 |

六端都是**纯 API 消费者**：直连同一组后端（`:9080` 反代），不含服务端代码。

---

## 2. 第一道分岔：装进窗口，还是重写 UI

### Web 壳派：Electron vs Tauri

两个壳**一行 UI 都没写**——窗口里加载的就是本项目现成的 Web 前端（Electron 嵌 React、
Tauri 嵌 Svelte，刻意错开以免重复）。壳层只做三件事：开窗口、装菜单、提供网页做不到的
原生能力（本项目的示例是「导出应用信息到本地文件」）。于是两壳的对比全在「壳」本身：

| 维度 | Electron | Tauri |
|---|---|---|
| 渲染引擎 | **自带一整份 Chromium**（包体 ~100–200MB） | **借系统 WebView**（macOS 的 WKWebView 等，~3–10MB） |
| 一致性 vs 体积 | 所有平台渲染行为一致 | 体积极小，但渲染行为随系统 WebView 版本浮动 |
| 壳语言 | Node.js（`main.cjs`） | Rust（`src-tauri/src/lib.rs`） |
| 原生桥 | preload 脚本 `contextBridge` 暴露白名单 API → IPC → 主进程 Node `fs`/`dialog` | `#[tauri::command]` Rust 函数，前端 `invoke("cmd")` 调用；能力需在 `capabilities/default.json` 显式声明（默认拒绝一切） |
| 壳层代码量 | **150 行**（main.cjs 127 + preload.cjs 23） | **118 行**（lib.rs 112 + main.rs 6） |

同一个「导出应用信息」功能，两种桥的形状：

```text
Electron：React 页面 → window.helloDesktop.exportInfo()   ← preload 白名单
            → ipcRenderer.invoke → 主进程 ipcMain.handle → Node fetch + dialog + fs

Tauri：  Svelte 页面 → invoke("export_info")               ← @tauri-apps/api
            → Tauri IPC（序列化）→ Rust fn export_info() → reqwest + dialog 插件 + std::fs
            （前提：capabilities 已授 dialog 能力）
```

> **取舍一句话**：Electron 用 ~150MB 换「渲染永远一致 + 壳里就是全套 Node」；Tauri 用
> Rust 学习成本换「10MB 包体 + 默认最小权限」。而共同的天花板是：**UI 能力 = Web 能力**，
> 桌面感（原生菜单、系统对话框）只能靠壳一点点补。

后文 §3–§8 聚焦四个原生端——壳派的界面就是 Web 前端，那部分对比见
[`frontend-comparison.md`](frontend-comparison.md)。

---

## 3. 应用外壳：窗口、顶部导航与路由

桌面 IA 是「顶部导航 + 内容区 + 页脚」，点导航切页、点卡片进详情、未登录访问受保护页
跳登录并在成功后回跳。四端的路由模型：

**SwiftUI**：没有用系统导航容器，自建了一个极简路由——`AppStore` 里存 `Route` 枚举栈，
`RootView` 按当前路由 `switch` 出对应视图：

```swift
// AppStore：路由值 + 守卫
if route.requiresAuth && !isAuthenticated { pendingRoute = route; navigate(to: .login); return }

// RootView：switch 渲染
switch store.current {
case .plaza: PlazaView()
case .capsule(let code): CapsuleDetailView(code: code)
...
}
```

**WinUI 3**：与 SwiftUI **同一个模型**换了材料——`Route` 是 C# record（带 `RequiresAuth`
计算属性），`MainWindow` 订阅 store 变化后按路由 new 视图塞进内容宿主：

```csharp
ContentHost.Content = Store.Current.Kind switch {
    RouteKind.Plaza => new PlazaView(),
    RouteKind.Capsule => new CapsuleDetailView(Store.Current.Code ?? ""),
    ...
};
```

**Qt/QML**：用 Qt 自带的页面容器 `StackView`（push / replace / pop），守卫写在导航函数里。
QML 有个特有陷阱：**id 作用域只在单个 .qml 文件内**，独立页面文件看不到主窗口的 `stack`——
解法是经根窗口的附加属性导航，任意后代都能 `ApplicationWindow.window.go("plaza")`。

**Flutter**：唯一用现成路由库的——go_router 声明路由表，守卫是路由层的 `redirect` 回调
（`refreshListenable` 让登录态变化触发重算）。这套守卫与 UI 完全解耦，后来移动端复用同一棵
路由树、只换外壳，桌面零回归——收益在「一码多端」时兑现。

> **观察**：三家自建路由（swiftui / winui3 / qt）收敛到了同一个形状——「路由值 + 守卫
> 判断 + pendingRoute 回跳」，语言各异、模型同构；flutter 押注路由库，代价是学 API，
> 收益是守卫、重定向、深链这些细节不用自己踩。

---

## 4. 状态如何驱动界面：以主题切换为例

顶部导航有个明暗切换按钮，点一下全窗口换肤。四端的「可观察状态」拼法：

| 端 | 状态存在哪 | 界面怎么知道要重画 |
|---|---|---|
| swiftui | `@Observable` 的 `AppStore.theme` | SwiftUI 自动追踪读取，改值即重算依赖视图 |
| flutter | Riverpod `themeProvider` | `ref.watch` 的 Widget 自动重建，`context.colors` 取当前语义色 |
| qt-pyside | Python `QObject` 的 `colors` Property（dict） | 改内部值后 `self.changed.emit()`，QML 里所有 `color: Theme.colors.surface0` **绑定**自动重算 |
| winui3 | `AppStore.Theme` + `INotifyPropertyChanged` | 订阅方把根元素 `RequestedTheme` 换掉 → XAML `{ThemeResource}` 引用的 `ThemeDictionaries` **整表切换** |

四端是同一个思想的四种拼法：**状态可观察，UI 是状态的投影**。有两个值得停下看的细节：

- **QML 的属性绑定是语言级的**：`color: Theme.colors.surface0` 不是赋值，是建立绑定——
  这让 Python 侧只需要「换掉 dict + 发一个信号」，QML 侧零代码全量刷新。四端里
  「切主题」写起来最省的是它。
- **WinUI 3 的 ThemeDictionaries 是资源系统级的**：Dark/Light 两套画刷字典，切
  `RequestedTheme` 时框架把所有 `{ThemeResource XxxBrush}` 引用换到另一套——应用代码
  不碰任何一个控件的颜色。代价是资源只能用标记引用（用代码索引 `Resources["XxxBrush"]`
  会直接抛异常，见 §9）。

Web 壳派的主题在内嵌前端里（CSS 变量 + `<html data-theme>`），壳完全不参与。

---

## 5. 一个会动的界面：倒计时每秒刷新

未解封的胶囊详情页有一块「天 / 时 / 分 / 秒」翻页时钟，每秒跳动，到期自动向后端确认解封。
「每秒重画一小块 UI」四端写法：

**SwiftUI**：`TimelineView` 是为此而生的声明式原语——声明「这块视图每秒重算」，
定时器、状态、清理全不用管：

```swift
TimelineView(.periodic(from: .now, by: 1)) { ctx in
    let cd = DateUtil.countdown(toISO: c.openAt, now: ctx.date)
    HStack { FlipUnit(value: cd.days, label: "天"); ... }
}
```

**Qt/QML**：`Timer` 在 QML 里是一个**声明式元素**，连「要不要跑」都是绑定——胶囊已解封时
`running` 自动变 false，定时器自己停：

```qml
Timer {
    interval: 1000; repeat: true
    running: page.cap && !page.cap.isOpened     // ← 绑定：条件变化自动启停
    onTriggered: page.nowMs = Date.now()         // 改属性 → 依赖它的文本绑定重算
}
```

**Flutter**：命令式 `Timer.periodic` + `setState`，`dispose` 里手动 `cancel`：

```dart
_ticker = Timer.periodic(const Duration(seconds: 1), (_) {
  if (mounted) setState(() {});     // 空 setState：触发 build 重算倒计时
});
```

**WinUI 3**：`DispatcherTimer`（UI 线程定时器）每秒 `Tick`，回调里更新绑定属性：

```csharp
private readonly DispatcherTimer _timer = new() { Interval = TimeSpan.FromSeconds(1) };
_timer.Tick += (_, _) => Tick();    // Tick() 里算倒计时、OnPropertyChanged
```

> **梯度**：SwiftUI 和 QML 把「随时间/条件重画」做进了声明式语言本身（一个连状态都不用存，
> 一个连启停都是绑定）；Flutter 和 WinUI 3 是经典的「定时器改状态、框架重画」，
> 清理责任在自己（`dispose` / 页面卸载）。

---

## 6. 键盘与指针：桌面特有的交互

桌面端有移动端没有的两样东西：**物理键盘**和**悬停的鼠标**。这在三处界面上留下了痕迹：

### 8 位胶囊码输入

| 端 | 实现 | 键盘细节 |
|---|---|---|
| swiftui | 8 个逐格输入框 + `@FocusState` 焦点接力 | `onKeyPress(.delete)` 捕获物理退格跨格回跳——桌面有实体键盘，这么写很自然（同一组件的 iOS 版反而改成了隐藏输入框，软键盘更稳） |
| qt-pyside | `CapsuleCodeInput.qml` 8 格 | 同思路：焦点接力 + 键盘事件 |
| flutter | 逐格 + 焦点接力（桌面移动共用一个组件） | |
| winui3 | **单 `TextBox`** + 输入过滤（仅大写字母数字、截断 8 位） | 最朴素的一派：让平台文本框自己管焦点和退格 |

### 悬停（hover）

鼠标悬停是桌面独有的反馈通道。最好的例子是 Qt 的卡片辉光——**悬停时辉光变亮**，
一行绑定完成：

```qml
layer.effect: MultiEffect {
    shadowColor: root.glow
    shadowBlur: hoverArea.containsMouse ? 1.0 : 0.6   // ← 悬停增强辉光
}
```

swiftui 用 `.help()` 挂悬停提示（tooltip）；Web 壳派的 hover 是 CSS `:hover` 白送。
这些在移动端全部不存在（无指针），对照移动版对比文档 §6 可见同一组件两套交互假设。

### 日期时间选择

- **swiftui / flutter / qt** 都是**自定义控件**：键盘直接输入 + 月历 + 快捷预设——桌面用户
  习惯敲键盘，纯弹层选择器反而慢。
- **winui3** 是四端里唯一用**平台控件**的（`DatePicker` + `TimePicker`）——WinUI 的系统
  日期控件本身就是为键鼠设计的，够用即不自建。

---

## 7. 登录态的生命周期

会话行为六端**完全一致**（同一份 API 契约的直接结果）：access token 只放内存；
refresh token + 用户信息持久化；冷启动恢复会话后台校准；401 自动刷新重放；并发请求
只允许一个去刷新。

Web 壳派整套逻辑在内嵌前端里（localStorage），壳不碰会话——甚至刻意不做「壳层代拉
需要鉴权的接口」：access token 在前端内存里，壳 out-of-band 刷新会触发轮换吊销、
把用户登出（Electron 指南 §4 记载了这个取舍）。

原生四端的材料：

| 端 | 持久化 | 「只刷新一次」的并发原语 |
|---|---|---|
| swiftui | UserDefaults | 共享 `Task<String?, Never>`（Swift Concurrency） |
| flutter | shared_preferences | 共享 `Future`（Dart 事件循环，赋值即互斥） |
| qt-pyside | QSettings | `threading.Lock` + **进锁后复查**（真多线程） |
| winui3 | `%LOCALAPPDATA%\HelloTimePro\*.json` 文件 | `lock` + 共享 `Task<string?>`（.NET 真多线程） |

两个细节：

- **qt 的异步模型在四端里独一份**：网络层是**同步** `urllib`，靠 `QThreadPool` 丢工作线程 +
  Qt 信号回主线程更新状态（跨线程信号默认排队投递，天然线程安全）。其余三端都是语言级
  async/await。这也是为什么它和 winui3 一样需要「真多线程」级别的刷新互斥。
- **winui3 的持久化路径是被平台逼的**：非打包（unpackaged）WinUI 3 应用调
  `ApplicationData.Current` 会直接抛异常，只能自己写 JSON 文件到 `%LOCALAPPDATA%`。

---

## 8. 主题令牌与视觉

全项目的颜色 / 间距 / 圆角定义在一份令牌源（`spec/tokens/tokens.json`，明暗两套语义色）。
六端的进入通道：

| 端 | 进入方式 | 产物形态 |
|---|---|---|
| flutter | codegen | `tokens.dart`（桌面移动共享） |
| qt-pyside | codegen | `palette.py`：DARK/LIGHT dict，经 `Theme.colors` Property 暴露给 QML |
| winui3 | codegen | `Tokens.xaml`：`ThemeDictionaries` Dark/Light 两套 `Color`+`SolidColorBrush` |
| swiftui | **手抄** `Tokens.swift` | 原生四端里唯一未上 codegen，改令牌需人工同步 |
| electron / tauri | 无需转换 | 内嵌前端直接用 `tokens.css` 的 CSS 变量——Web 壳的「免费午餐」 |

产物形态恰好展示了三种「主题切换」的宿主机制：dict 换引用（qt）、资源字典整表切换
（winui3）、编译期常量 + 运行时按 mode 取（flutter/swiftui）。

视觉上的霓虹辉光：swiftui 用 `shadow(color:radius:)`（系统支持彩色阴影）；flutter 用
`BoxShadow`（自绘，三平台一致）；qt 用 `MultiEffect.shadowColor/shadowBlur`（还接了
hover 增强，见 §6）；Web 壳派就是 CSS `box-shadow` 多层辉光原样。

---

## 9. 每端撞过的墙

各端落地时真实踩过、已解决的坑（细节见各端 TECHNICAL_GUIDE）：

- **electron / tauri（壳的探活坑）**：`./run` 要等内嵌前端的 Vite 就绪才开窗——但光 `curl`
  探端口会误判（端口被外部服务占用时 `--strictPort` 已让 Vite 退出）：每轮先 `kill -0`
  确认 Vite 进程活着再探。tauri 另有 `identifier` 保留值坑（脚手架默认 `com.tauri.dev`，
  build 直接拒）。
- **swiftui**：裸二进制没有 bundle id，`run` 自动组装 `.app` bundle；系统菜单中文化要
  `CFBundleLocalizations` + `zh-Hans.lproj`。值得注意的**反例**：macOS 桌面可以纯 SwiftPM
  （`swift build` 即可，无 `.xcodeproj`）——同一套代码到 iOS 就必须 XcodeGen 生成工程。
- **flutter**：macOS 沙箱默认拦出站网络，需 `network.client` entitlement（不开则后端
  零日志静默失败）；工具链硬把产物写进项目内 `build/` 目录，与 `./build` 脚本同名冲突，
  被迫改名 `build.sh`——全项目唯一的脚本命名例外。
- **qt-pyside**：必须 `QQuickStyle.setStyle("Basic")`，否则 macOS 原生样式禁止自定义按钮
  背景、满屏报错；QML 跨文件 id 作用域隔离（§3 的导航方案由此而来）；`RowLayout` 内用
  `anchors` 是未定义行为；退出期 context property 先于 QML 销毁会打一批无害的 teardown
  噪声。
- **winui3（远程构建全家桶）**：macOS tar 的 AppleDouble 文件（`._*`）传到 Windows 被当
  XAML 编译报 0x00 无效字符（`COPYFILE_DISABLE=1` + exclude）；`%ERRORLEVEL%` 在 cmd 解析
  时就展开永远是旧值（用 ssh 透传退出码）；必须 RID + self-contained + pin
  `WindowsSdkPackageVersion`，三者缺一启动即退；**C# 编译错误会连锁伪装成一堆 XAML 错误**
  ——先修 `CSxxxx`，XAML 报错多半自动消失。

---

## 10. 代码量与「该读哪一个」

统一排除 codegen 产物（`tokens.dart` / `palette.py` / `Tokens.xaml`），复现命令见文末：

| 端 | 行数 | 说明 |
|---|---|---|
| flutter | **5,138**（Dart） | ⚠️ 桌面 + 移动**同一份**工程 |
| swiftui | 3,239（Swift，含手抄令牌） | |
| qt-pyside | 3,150（Python + QML + js） | 逻辑（py）与视图（qml）物理分文件 |
| winui3 | 2,869（C# + XAML） | 同样逻辑/视图分文件（xaml.cs / xaml） |
| electron | **150**（壳） | UI = 内嵌 React 前端（不计入） |
| tauri | **118**（壳） | UI = 内嵌 Svelte 前端（不计入） |

壳派的数字才是它们的全部意义：**一百多行就能把一个 Web 应用变成桌面程序**——代价与
边界见 §2。原生四端量级相当（2.9k–3.2k），flutter 的 5.1k 要除以「桌面+移动两套 IA」。

| 你想学什么 | 读哪端 |
|---|---|
| 最快把现有 Web 应用做成桌面版（以及两种壳的取舍） | **electron / tauri**（各 ~150 行壳，一下午能读完） |
| 苹果平台声明式 UI 的桌面形态（TimelineView、SwiftPM 免工程文件） | **swiftui** |
| 同一份代码同时服务桌面与移动（路由守卫与外壳解耦） | **flutter** |
| 声明式标记 + 脚本语言逻辑的经典分层（QML 绑定、信号槽、线程池异步） | **qt-pyside** |
| Windows 原生 XAML 体系 + 一套完整的远程构建工程化方案 | **winui3** |
| 三家自建路由如何收敛到同一模型 | swiftui + winui3 + qt 对照读（§3） |

一句话总结：**壳派证明了「Web 前端 + 一百行壳 = 桌面应用」的下限有多低；原生四端证明了
同一个产品语义在四套 UI 体系里的形状可以多么一致**——路由都是「值 + 守卫 + 回跳」，
状态都是「可观察 + 投影」，差异全在语言给了你多少声明式表达力（TimelineView 和 QML Timer
在一端，DispatcherTimer 在另一端）。

### 附：复现本文数据

```bash
# 代码量（§10，排除 codegen 产物）
find desktop/swiftui/Sources -name "*.swift" | xargs wc -l | tail -1
find desktop/flutter/lib -name "*.dart" ! -name tokens.dart | xargs wc -l | tail -1   # 桌面+移动同源
find desktop/qt-pyside/app \( -name "*.py" -o -name "*.qml" -o -name "*.js" \) ! -name palette.py | xargs wc -l | tail -1
find desktop/winui3 \( -name "*.cs" -o -name "*.xaml" \) ! -name Tokens.xaml | xargs wc -l | tail -1
wc -l desktop/electron/main.cjs desktop/electron/preload.cjs
wc -l desktop/tauri/src-tauri/src/*.rs

# 连通性验证（任一端；winui3 需先配置 remote.env）
./scripts/hello start <electron|tauri|swiftui|flutter|qt-pyside|winui3>
tail -f data/logs/fastapi.log   # 等待 GET /api/v1/plaza/capsules ... 200
```
