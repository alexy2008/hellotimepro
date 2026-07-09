# HelloTime Pro WinUI 3 桌面端技术手册与代码导读

本文面向熟悉一门现代语言、想了解 **Windows 原生开发 / WinUI 3 / XAML**，以及「代码在 Mac、
编译运行在远端 Windows」这种**远程构建形态**如何工程化的读者。读完后你应能回答：

- 一个 WinUI 3 app 从 `App.xaml.cs` 到看到广场页，代码按什么顺序跑。
- 为什么本端必须远程构建，`./build`/`./run` 怎么经 SSH 驱动远端 Windows 编译、拉起窗口、回程访问 Mac 上的后端。
- XAML + `x:Bind` + `INotifyPropertyChanged` 这套 UI 体系与 SwiftUI/Compose 的声明式有何不同。
- 想加一个视图 / 接口 / 状态，改哪些文件。

> 核心叙事一：本端是**唯一的 Windows 原生客户端**，逻辑层（Models / ApiClient / AppStore）
> 对齐 `desktop/swiftui`——同一套「Route 记录 + requiresAuth 守卫 + pendingRoute 回跳」的
> 导航模型，只是宿主从 Swift Observation 换成 .NET 的 `INotifyPropertyChanged`。
> 核心叙事二：**远程构建**——WinUI 3 是 Windows-only 工具链，本仓库在 macOS 开发，
> 故代码留在 Mac 仓库、编译/运行经 SSH 发生在远端 Windows 主机（§4–§7）。

## 1. 技术选型与设计特色

* **WinUI 3 / Windows App SDK + C# / .NET 8**：微软当代 Windows 原生 UI 栈（Win32 之上的
  XAML 体系），系统级 Fluent 控件、`ThemeDictionaries` 明暗主题、`x:Bind` 编译期绑定。
* **纯原生、零 webview**：与 electron/tauri（Web 壳）相对，视图全部 XAML + C#；
  `SvgImageSource` 原生渲染后端 SVG 头像。
* **远程构建形态**（全项目唯一）：`./build` = tar-over-ssh 同步源码 + 远端 `dotnet build`；
  `./run` = SSH 反向隧道（远端 `127.0.0.1:9080` ⇄ Mac `:9080` 反代）+ `schtasks` 在交互桌面
  拉起 exe。Mac 侧脚本即 `hello` 的判活对象。
* **令牌 codegen**：`scripts/gen-tokens-winui` 从 `spec/tokens/tokens.json` 生成
  `Themes/Tokens.xaml`（`ResourceDictionary.ThemeDictionaries`，Dark/Light 两套
  `Color`+`SolidColorBrush`），XAML 里 `{ThemeResource Surface0Brush}` 取用、随主题自动切换。

## 2. 先建立整体地图

```text
desktop/winui3/
├── run / build              # SSH 驱动远端构建/运行（见 §5–§7）
├── remote.env               # 远端主机配置（gitignored；模板 remote.env.example）
├── HelloTimePro.csproj      # net8.0-windows + WindowsAppSDK（版本 pin 见 §6）
├── App.xaml(.cs)            # Application：合并 Tokens.xaml 资源 + 创建 MainWindow
├── MainWindow.xaml(.cs)     # 外壳：AppHeader + 内容宿主 + AppFooter；订阅 store 切页/切主题
├── Themes/Tokens.xaml       # ← codegen 产物（勿手改）：ThemeDictionaries Dark/Light
├── Models/Models.cs         # 契约模型（System.Text.Json，camelCase）
├── Api/ApiClient.cs         # HttpClient + Envelope 解包 + refresh 单飞 + 401 重放
├── Stores/
│   ├── AppStore.cs          # INotifyPropertyChanged：会话/导航/主题/banner
│   └── LocalStore.cs        # 持久化：%LOCALAPPDATA%\HelloTimePro\*.json（见 §8）
├── Helpers/                 # CardFmt/Format/Avatars/Converters（供 x:Bind 函数绑定）
└── Views/                   # PlazaView / OpenView / CreateView / MeView / CapsuleDetailView
                             # / LoginView / RegisterView / AboutView / AppHeader / AppFooter
```

一次「打开广场」的流向（注意后端在 Mac 上，请求经 SSH 隧道回程）：

```text
（Mac）./run：./build 同步+编译 → ssh -R 9080:127.0.0.1:9080 建反向隧道 → schtasks 拉起 exe
  │
  ▼
（Windows）App.xaml.cs OnLaunched → new MainWindow()：装配 AppStore + ApiClient，Bootstrap()
  │ （LocalStore 恢复 refresh token + user，有则后台拉 /me 校准）
  ▼
MainWindow：Store.PropertyChanged 订阅 → ApplyRoute()/ApplyTheme()
  │ ContentHost.Content = Store.Current.Kind switch { Plaza => new PlazaView(), … }
  ▼
PlazaView 构造 → 拉 Store.Api.PlazaAsync(...)
  │ HttpClient 打 http://127.0.0.1:9080 —— 这是远端的 127.0.0.1，被 ssh -R 隧穿回 Mac 的反代
  ▼
Envelope 解包 → ObservableCollection 更新 → x:Bind 刷新卡片；头像 SvgImageSource 经同一隧道加载
```

## 3. 如何运行和验证

前置：一台可 SSH 免密登录的 Windows 10/11 主机（装 .NET 8 SDK），配置写入
`remote.env`（参照 `remote.env.example`：host/port/user + `WINUI_REMOTE_DIR`）。

```bash
cd desktop/winui3 && ./build      # tar-over-ssh 同步源码 + 远端 dotnet build
./scripts/hello start winui3      # build + 反向隧道 + 远端拉起窗口（hello status 显示 native）
./scripts/hello stop winui3       # SIGTERM → trap 清理远端 app + 计划任务 + 隧道
```

验证（无 computer-use，同其它原生端）：`hello start winui3` 后看 Mac 侧
`data/logs/fastapi.log`（日志偏移法：记基线行数 → 拉起 → 只看新增），出现
`GET /api/v1/plaza/capsules ... 200` + 多个 `GET /static/avatars/*.svg 200` 即证明
「远端 app → 隧道 → Mac 反代 → 后端」全链路（请求源 IP 都是隧道的 127.0.0.1）。
UI 目视由开发者 RDP 自行确认。

## 4. 为什么远程构建

WinUI 3 = Windows App SDK + XAML 编译器 + Windows SDK，三者全是 Windows-only；不存在
「Mac 编译、拷到 Windows 跑」的路线（与 Flutter/RN 的跨平台产物根本不同）。编译与运行都
必须在 Windows 上。本仓库在 macOS 开发，故：**代码留在 Mac 仓库，编译/运行发生在远端
Windows 主机，经 SSH 驱动。**

> 坑：`remote.env` 里 `WINUI_REMOTE_DIR="D:\hello-winui3"` 必须加双引号——否则 bash
> `source` 把 `\h` 当转义吃掉反斜杠，变成 `D:hello-winui3`。

## 5. `./build`：tar-over-ssh + 远端 dotnet build

```bash
COPYFILE_DISABLE=1 tar czf - --exclude=./bin --exclude=./obj --exclude='._*' ... \
  | ssh HOST "cmd /c \"cd /d DIR && tar xzf -\""
ssh HOST "cmd /c \"cd /d DIR && dotnet build -c Debug -p:Platform=x64 -p:RuntimeIdentifier=win-x64\""
```

- Windows 10+ 自带 bsdtar（`tar.exe`），tar 流经 stdin 解包。
- 成败判定直接用 **ssh 透传的远端退出码**（`cmd /c "cd /d DIR && dotnet build"` 返回 dotnet
  的退出码）。**不要**用 `cmd /c "... & echo %ERRORLEVEL%"`——`%ERRORLEVEL%` 在解析时就
  展开，永远是旧值。
- **AppleDouble 坑**：macOS `tar` 会把 `._xxx`（扩展属性文件）打进包，传到 Windows 后
  `._Tokens.xaml` 被 WinUI 的 `**/*.xaml` glob 当 XAML 编译 → `WMC9999 0x00 无效字符`。
  故 tar 加 `COPYFILE_DISABLE=1` + `--exclude='._*'`。

## 6. 打包形态：unpackaged + RID + self-contained

像其它原生桌面端「直接跑 exe」，用 **非打包（unpackaged）**：

```xml
<WindowsPackageType>None</WindowsPackageType>
<WindowsAppSDKSelfContained>true</WindowsAppSDKSelfContained>
<WindowsSdkPackageVersion>10.0.26100.38</WindowsSdkPackageVersion>
```

三个缺一不可的点（都由启动失败逼出来的）：

1. **必须带 RID**（构建 `-p:RuntimeIdentifier=win-x64`）：否则产物落在 TFM 目录下、无
   `win-x64\` 子目录、缺 `Microsoft.WindowsAppRuntime.Bootstrap.dll`，进程一起来就退。
2. **必须 self-contained**（`WindowsAppSDKSelfContained=true`）：否则即便机器装了
   `Microsoft.WindowsAppRuntime.2` 框架包，bootstrapper 仍弹「Required components of the
   Windows App Runtime are missing」（它要完整运行时集）。self-contained 把运行时
   （`Microsoft.WindowsAppRuntime.dll` 等 ~84 dll）打进输出目录，exe 自足、对教学仓库也更友好。
3. **版本 pin**：模板默认 `Version="*"` 会浮动到最新 WindowsAppSDK（本项目锁 `2.2.0` +
   `SDK.BuildTools 10.0.28000.2270`）。WindowsAppSDK 2.2.0 要求
   `Microsoft.Windows.SDK.NET.Ref ≥ 10.0.26100.38`，而 .NET 8.0.400 默认给 `.34` →
   必须 `<WindowsSdkPackageVersion>10.0.26100.38</WindowsSdkPackageVersion>`。

产物：`bin\x64\Debug\net8.0-windows10.0.26100.0\win-x64\HelloTimePro.exe`。

## 7. `./run`：反向隧道 + 交互桌面拉起 + trap 清理

```text
./build → ssh -o ExitOnForwardFailure=yes -R 9080:127.0.0.1:9080 HOST <EncodedCommand>
```

- **反向隧道**：Mac 无公网/局域网可达地址，故用 `ssh -R` 把远端的 `127.0.0.1:9080` 隧穿回
  Mac 的 `:9080` 反代。隧道在 ssh 连接建立时即生效（先于远端命令），app 首个请求就能回程。
  127.0.0.1:9080 对 Windows 机器所有会话可见（TCP loopback 非会话隔离），故 schtasks 起的
  app（另一会话）也能用同一隧道。
- **交互桌面拉起**：SSH 会话是非交互会话，直接启 GUI 窗口不显示。用
  `schtasks /create ... /it /rl LIMITED` + `schtasks /run` 以当前登录用户在 RDP 桌面拉起窗口。
- **hold + 判活**：远端载荷末尾 `while(1){Start-Sleep}` 把 ssh 会话（连同隧道）hold 住；
  这条 ssh 即 `hello` 的判活对象（`port: None` → status 显示 `native`）。
- **清理**：`hello stop` 发 SIGTERM（等 5s 才 SIGKILL），`./run` 的
  `trap cleanup EXIT INT TERM` 来得及 ssh 远端 `taskkill /f /im HelloTimePro.exe` +
  `schtasks /delete`。
- **引号**：ssh→cmd→powershell 多层转义极易断，启动/清理载荷统一用
  `powershell -EncodedCommand <base64(UTF-16LE)>`（Mac 侧 `iconv -t UTF-16LE | base64`）。

## 8. 应用架构

- **`Api/ApiClient.cs`**（数据层）：`HttpClient` + `System.Text.Json`（camelCase 策略）。
  信封 `Envelope<T>` 解包、**单飞 refresh**（`lock` + 共享 `Task<string?>`——.NET 真多线程，
  与 android 的 Mutex 同理）、401(UNAUTHORIZED) 自动 refresh + 重放。对齐 swiftui
  `APIClient.swift` 与 react `api/client.ts` 的同一套语义。
- **`Stores/AppStore.cs`**（状态层）：`INotifyPropertyChanged`——.NET 最经典的可观察模型，
  属性 setter 里 `OnPropertyChanged()`，UI 侧（`x:Bind Mode=OneWay` 或代码订阅）自动刷新。
  整合会话（access token 内存 / refresh token + user 持久化）、**导航栈**（`Route` record +
  `RequiresAuth` 守卫 + pendingRoute 回跳，模型 = desktop/swiftui）、主题、全局 banner。
  回调注入 ApiClient 避免循环依赖。
- **`Stores/LocalStore.cs`**（持久化）：非打包 WinUI3 **不能用** `ApplicationData.Current`
  （会抛异常），故落地为 `%LOCALAPPDATA%\HelloTimePro\*.json` 文件。
- **导航外壳**（`MainWindow.xaml.cs`）：订阅 `Store.PropertyChanged`，
  `ContentHost.Content = Store.Current.Kind switch { Plaza => new PlazaView(), … }`——
  按路由 new 视图（对齐 swiftui `RootView` 的 switch），**非** Frame 导航。根
  `Grid.RequestedTheme` 随 `Store.Theme` 切换，驱动 `ThemeDictionaries` 整表换色。
- **视图**（`Views/*.xaml`）：各 UserControl；卡片显示辅助 `Helpers/CardFmt.cs` 供 XAML
  `x:Bind` **函数绑定**（绑定到静态方法，避免模板里堆转换器）。倒计时用 `DispatcherTimer`
  每秒 Tick；8 位码是单 `TextBox` + 输入过滤（大写字母数字、截断 8 位）。
- **主题**（`Themes/Tokens.xaml`）：codegen 产物，`ResourceDictionary.ThemeDictionaries`
  的 Dark/Light 两套 `Color`/`SolidColorBrush`；视图统一 `{ThemeResource XxxBrush}` 引用。

## 9. XAML 编译踩坑

- 每个 `.xaml` 若写 `mc:Ignorable="d"` 必须声明
  `xmlns:d="http://schemas.microsoft.com/expression/blend/2008"`，否则报 `'d' prefix is not defined`。
- 命名空间：`FontWeights` 在 `Microsoft.UI.Text`（非 `Microsoft.UI.Xaml.Text`）；`Colors` 在
  `Microsoft.UI`（非 `Windows.UI`）；`Color` 结构体在 `Windows.UI`。
- `ThemeDictionaries` 里的资源**不能**用 `Application.Current.Resources["XxxBrush"]` 索引取
  （会抛）——要么用 `{ThemeResource}` 标记，要么代码里用固定色兜底。
- **调试要诀**：C# 编译错误会连锁伪装成一堆 XAML 错误（`WMC1509 No LocalAssembly` +
  `WMC0001 Unknown type` / `WMC0909 Cannot resolve DataType` / `WMC9999 空引用`）——根因常是
  某个 `.cs` 编译不过导致程序集没生成、XAML pass2 拿不到项目类型。**先找并修 `CSxxxx` 错误，
  XAML 报错多半连锁消失。**
- WinUI 增量构建偶发 XAML pass 用陈旧状态报假错误，干净重编即过。

## 10. 常见改动指南

- **加一个视图**：`Views/` 新建 UserControl（xaml + xaml.cs）→ `Stores/AppStore.cs` 的
  `RouteKind` 加枚举值 + `Route` 加静态工厂 → `MainWindow.xaml.cs` 的 `ApplyRoute()`
  switch 加映射 → 需要入口的话在 `AppHeader` 加导航按钮。
- **加一个接口**：`Api/ApiClient.cs` 加 async 方法（模型进 `Models/Models.cs`）——多数可
  对照 `desktop/swiftui` 的 `APIClient.swift` 直接翻译。
- **加一个状态**：`AppStore.cs` 加属性 + setter 里 `OnPropertyChanged()`；视图 `x:Bind`
  或订阅 `PropertyChanged`。
- **改设计令牌**：改 `spec/styles/tokens.css`（源）→ 派生 `tokens.json` →
  `node scripts/gen-tokens-winui`；不要手改 `Themes/Tokens.xaml`。改完需 `./build` 重同步远端。
- **换远端主机**：改 `remote.env`（不入库）；首次需手动 ssh 确认指纹 + 免密。

## 11. 验证（无 computer-use，编译 + 后端日志）

- `./build`：远端 `dotnet build` 通过（退出码经 ssh 透传）。
- 端到端：`hello start winui3` → Mac 侧 fastapi 日志（偏移法）出现
  `GET /api/v1/plaza/capsules ... 200` + `GET /static/avatars/*.svg 200`
  （`SvgImageSource` 经隧道加载头像），佐证「远端 app → ssh -R 隧道 → Mac 反代」全链路；
  `hello stop` 干净清理远端 app + 计划任务。UI 目视由开发者 RDP 确认。
- 核心旅程 E2E（WinAppDriver / FlaUI）：后续。
