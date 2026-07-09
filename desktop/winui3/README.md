# HelloTime Pro · WinUI 3 桌面端

M5 桌面端第 6 个实现，也是唯一的 **Windows 原生** 客户端：**WinUI 3 / Windows App SDK + C# (.NET 8)**。纯 API 消费者，复用后端契约（不持有 `/api/v1`），经反向代理直连后端 `:9080`。

## 与其它桌面端的对照点

| 维度 | 说明 |
|---|---|
| 范式 | 纯原生（同 swiftui/flutter/qt-pyside），**非** electron/tauri 的 Web 壳 |
| UI 框架 | WinUI 3（Fluent 设计），XAML + C# code-behind |
| 状态 | `AppStore`（`INotifyPropertyChanged`）整合会话/导航/主题，对齐 `desktop/swiftui` 的 AppStore |
| 网络 | `HttpClient` + `System.Text.Json`，信封解包 / 单飞 refresh / 401 重放，逐字对齐 react `api/client.ts` |
| 头像 | `SvgImageSource` **原生渲染 SVG**（不同于 iOS/RN 需降级为色块/PNG） |
| 令牌 | codegen `scripts/gen-tokens-winui` → `Themes/Tokens.xaml`（`ThemeDictionaries` 承载 dark/light 语义色 + 间距/圆角/字体静态资源） |

## 最大的不同：远程构建

WinUI 3 = Windows App SDK，**编译与运行都只能在 Windows 上发生**（无 macOS 交叉编译，也不像 Flutter/RN 那样产物可跨平台）。本仓库在 macOS 上开发，故本实现采用「**远程构建**」形态：

```
Mac（仓库 + 编辑）          远端 Windows（编译 + 运行）
  ./build ── tar over ssh ──▶ dotnet build（自带运行时的 exe）
  ./run  ── 反向 SSH 隧道 ──▶ schtasks 交互桌面拉起 exe
        （远端 127.0.0.1:9080 ⇄ Mac :9080 反代）
  后端日志出现 app 请求 ◀────── app 经隧道访问 Mac 后端
```

- `desktop/winui3` 在 `hello` 里注册为 `{"port": None, "runtime": "dotnet"}`（原生，进程存活判活）。
- 判活对象是 `./run` 里那条 hold 住反向隧道的 ssh；`hello stop` 对它发 SIGTERM，`trap` 清理远端 app + 计划任务。

## 运行

前置：一台可 SSH 免密登录的 Windows 11 主机，装好 **.NET SDK 8** + **VS 2022（含 WinUI/桌面开发负载）**。

```bash
cd desktop/winui3
cp remote.env.example remote.env     # 填入你的 Windows 主机 SSH 信息（见文件内注释）
./build                              # 同步源码 + 远端编译
./run                                # 编译 + 反向隧道 + 交互桌面拉起窗口（前台 hold）
# 或经 dev-manager：
../../scripts/hello start winui3
../../scripts/hello stop  winui3
```

`remote.env` 已 gitignore（个人主机信息）。UI 目视请自行 RDP 到该 Windows 主机查看窗口。

## 功能

登录/注册（含头像选择）、广场（热门/最新排序 + 全部/已开启/未开启筛选 + 搜索防抖 + 分页 + 收藏乐观更新）、按 8 位码开启、胶囊详情（倒计时/到期自动开启/复制码/收藏）、创建（AI 生成正文 + 推荐灵感 + 日期时间选择 + 快速预设 + 广场可见性）、我的（我创建的+撤回 / 我收藏的 / 账号设置改昵称头像密码）、暗/亮主题切换。

技术细节与踩坑见 [TECHNICAL_GUIDE.md](TECHNICAL_GUIDE.md)。
