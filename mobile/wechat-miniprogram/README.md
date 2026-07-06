# HelloTime Pro · 微信小程序端（原生框架）

移动端 5 个实现里的第 5 个，也是全项目最后一个客户端。用**微信小程序原生框架**
（`App` / `Page` / `Component` + WXML / WXSS + `wx.request` + `setData`）实现整套时光胶囊
产品——不借助 Taro / uni-app 等任何第三方框架，直接吃小程序平台原语。

它与 `frontends/react-ts` 是一组**「同逻辑、异视图」**的对照：业务逻辑层（JWT 刷新单飞、
收藏计数、胶囊开启判定、类型契约）从 Web React 前端近逐字移植，只是承载它的不再是
React + zustand，而是一个 40 行的手搓可观察 store；视图层则按小程序 IA（底部 `tabBar` +
页面栈）完全重建。

> 术语对照：`frontends/react-ts` 把同一套 store/api 渲染成 **DOM**；`mobile/react-native`
> 渲染成 **RN 原生组件**；本端渲染成 **小程序原生组件**——三者共享逻辑与设计令牌，视图层分叉。

## 快速开始

```bash
# 后端（任选其一）＋反代 :9080
./scripts/hello start fastapi
./scripts/hello switch fastapi

# 校验（离线可跑，无需开发者工具）：令牌 codegen + 结构/JSON/JS 语法冒烟
cd mobile/wechat-miniprogram && ./build

# 运行（需微信开发者工具）：用 DevTools CLI 打开工程 → 模拟器起 → wx.request 直连 :9080
./scripts/hello start wechat
# 或手动：在微信开发者工具里「导入项目」，目录选 mobile/wechat-miniprogram
```

`hello status` 里 `wechat` 显示为 `native`（`port: None`）：无 dev server 端口，以 `run`
进程存活判活（同 `ios` / `android` / `desktop/swiftui`）。

## 运行前置（微信开发者工具）

原生小程序不能像其它端那样纯命令行编译运行——它由**微信开发者工具**（DevTools）内置的
模拟器 / 微信运行时解释执行。因此：

1. 安装[微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)（macOS）。
2. 打开工具 → **设置 → 安全 → 开启「服务端口」**（供 `cli` 调用），首次需扫码登录。
3. `./run`（或 `hello start wechat`）会调 `cli open --project .` 打开本工程；也可在工具里
   直接「导入项目」。
4. **appid**：`project.config.json` 默认 `touristappid`。游客模式下 `wx.request` 受限，
   要联网请在工具里改用你自己的 **AppID** 或**测试号**（工具会写入被 gitignore 的
   `project.private.config.json`，不污染仓库）。

### 本地 HTTP 放行

小程序默认只允许 https 且校验合法域名。本项目开发直连宿主 `http://127.0.0.1:9080`，
已在 `project.config.json` 里 `setting.urlCheck: false`（不校验合法域名）。工具右上角
「详情 → 本地设置」也可勾选「不校验合法域名、web-view、TLS、HTTPS 证书」。

> ⚠️ 上线版必须走 https，并在小程序管理后台把 `request` 合法域名配置好——`urlCheck: false`
> 仅用于本地开发。

### 后端地址为什么是 127.0.0.1（不是 10.0.2.2）

小程序模拟器跑在**宿主 macOS 进程**内，与后端同机，故直连 `127.0.0.1:9080`；这与
Android 模拟器（独立 VM，宿主别名 `10.0.2.2`）不同。真机预览需改 `config.js` 的
`API_BASE` 为局域网 IP。

## 功能对齐（与 react-ts 参考前端一致）

| 能力 | 页面 |
|---|---|
| 广场：排序（新/热）/ 筛选 / 搜索 / 分页 | `pages/plaza` |
| 用码开启（8 位码）→ 详情 | `pages/open` → `pages/capsule` |
| 胶囊详情：实时倒计时 + 到期自动开启轮询 + 复制码 / 分享 / 收藏 | `pages/capsule` |
| 创建：AI 生成 / 灵感推荐 + 日期时间选择 + 快捷预设 + 广场公开开关（门禁） | `pages/create` |
| 我的：资料卡 + 我创建的 / 我收藏的 + 撤回 + 分页（门禁） | `pages/me` |
| 账号设置：改昵称 / 头像 + 改密码（改后自动登出，门禁） | `pages/settings` |
| 登录 / 注册（头像必选） | `pages/login` / `pages/register` |
| 关于：产品简介 + 端 / 后端技术栈（from `/health`） | `pages/about` |
| 明暗主题（持久化）| 每页右上角切换 |

## 目录结构

```
app.js / app.json / app.wxss   小程序入口：启动 hydrate 主题+鉴权；tabBar；全局共享类
config.js                       API_BASE（127.0.0.1:9080）
project.config.json             DevTools 工程配置（urlCheck 关、appid 占位）
utils/
  store.js       40 行可观察 store（getState/setState/subscribe，zustand vanilla 同形）
  page.js        createPage 工厂：给每页自动接主题（根节点 theme-{{mode}} 类）
  api.js         API 客户端（wx.request 版；refresh 单飞 + 401 重放 + Envelope 解包）
  format.js      倒计时 / 时间 / 数字格式化
  avatar.js      头像 URL（SVG，见下方限制）
stores/          auth / plaza / capsule / theme —— 从 react-ts 移植的业务逻辑
tokens/          palette.js + tokens.wxss（codegen 产物，勿手改）
assets/avatars/  10 个头像 PNG（codegen 产物，勿手改，见下方「头像渲染」）
components/
  avatar-badge   头像组件（本地 PNG，加载失败回退色底 + 首字）
  capsule-card   广场 / 我的 列表卡片
pages/           plaza / open / create / me / login / register / capsule / settings / about
run / build      hello 集成脚本
```

## 头像渲染：预烘焙 PNG，而非色块降级

小程序原生 `<image>` 不支持渲染 SVG，无法像其它原生端（iOS SVGView / Flutter flutter_svg /
RN react-native-svg）那样直接显示 `spec/avatars/*.svg`。这里没有停在「色块+首字」的降级，
而是用 [scripts/gen-avatars-miniprogram](../../scripts/gen-avatars-miniprogram)（`rsvg-convert`，
`brew install librsvg`）在 codegen 阶段把 `spec/avatars` 的 10 个头像预渲染成 256×256 PNG，
存进 `assets/avatars/`，`avatar-badge` 组件 `<image>` 直接加载本地文件——视觉上与其它端一致。

`./run` / `./build` 都会先跑一遍这个 codegen（同源保证：重新生成后 `git diff` 应为空）。
`rsvg-convert` 未安装时脚本打印警告并跳过（不阻塞 build），组件在 `<image>` `binderror`
时自动回退到「品牌色底 + 首字」的确定性徽章——这是兜底，不是常态。`about` 页的技术栈图标
（无固定小集合、非本项目资产）仍用文本名+版本呈现。

## 已知平台限制

- **验证方式**：小程序窗口在 Playwright 与常规 CLI 之外，以「后端日志出现
  `GET /api/v1/plaza/capsules`、`/avatars`、`/health` 200」佐证连通（同 ios/android 原生端）。

设计令牌 codegen 与逻辑移植细节见 [TECHNICAL_GUIDE.md](TECHNICAL_GUIDE.md)。
