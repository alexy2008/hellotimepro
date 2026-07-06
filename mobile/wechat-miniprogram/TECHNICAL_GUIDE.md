# HelloTime Pro 微信小程序（原生框架）技术手册与代码导读

本文面向熟悉 Web 前端（最好读过 `frontends/react-ts`）、想了解**微信小程序原生开发**的读者。读完后你应能回答：

- 一个小程序从 `App()` 到看到广场页，代码按什么顺序跑。
- 它与 `frontends/react-ts` 是什么对应关系——哪些**近逐字移植**、哪些是小程序的平台替换。
- 小程序特有的几个坑（`<image>` 不认 SVG、合法域名校验、游客 appid 联网受限、CLI 打开不自动编译）怎么解决。
- 想加一页 / 接口 / 状态，改哪些文件。

> 核心叙事：本端是「**同逻辑异视图**」的对照实验——不借助 Taro / uni-app，直接吃小程序
> 原生原语（`App`/`Page`/`Component` + WXML/WXSS + `wx.request` + `setData`）。业务逻辑
> （store / api client / format）从 react-ts 近逐字移植，承载它的不再是 React + zustand，
> 而是一个 40 行的手搓可观察 store；视图层按小程序 IA（底部 `tabBar` + 页面栈）全量重建。
> 与 `mobile/react-native`（同一套逻辑渲染成 RN 原生组件）恰成三方对照。

## 1. 技术选型与设计特色

* **原生框架、零编译层**：不经 Taro/uni-app 转译，直接写 WXML/WXSS/JS——作为独立平台范式，与已有 5 个 Web 前端和 RN 都不重复，教学价值最高。代价是没有 TS/组件树/CSS 级联，全部用平台原语补齐。
* **40 行手搓 store**：`utils/store.js` 提供 `getState/setState/subscribe`，与 **zustand vanilla API 同形**——从 react-ts 移植来的 store 工厂 `create((set, get) => ({...}))` **一字不改**。页面在 `onLoad` 订阅、`setData` 推数、`onUnload` 退订。
* **纯 API 消费者**：`wx.request` 直连 `:9080` 反代（模拟器跑在宿主 macOS 进程内，走 `127.0.0.1`，**不同于** Android 模拟器的 `10.0.2.2`），复用 `/api/v1` 契约，不新增后端代码。
* **双通道令牌 codegen**：`scripts/gen-tokens-miniprogram` 产出 `tokens/tokens.wxss`（CSS 变量，样式主通道）+ `tokens/palette.js`（JS 侧取色）；另有 `scripts/gen-avatars-miniprogram` 把 SVG 头像预烘焙成 PNG（小程序 `<image>` 不认 SVG）。

## 2. 先建立整体地图

```text
mobile/wechat-miniprogram/
├── run / build                # DevTools CLI 打开工程+keepalive / 离线静态校验
├── app.js                     # App()：onLaunch 同步 hydrate 主题+鉴权
├── app.json                   # 页面注册 + tabBar（广场/开启/创建/我的）
├── app.wxss                   # @import tokens.wxss + 全局共享类（.card/.btn/.chip…）
├── config.js                  # API_BASE（http://127.0.0.1:9080）
├── project.config.json        # DevTools 工程配置（urlCheck 关、appid）
├── utils/
│   ├── store.js               # 40 行可观察 store（zustand vanilla 同形）
│   ├── page.js                # createPage 工厂：注入 themeMode + themeColors
│   ├── api.js                 # wx.request 版 API 客户端（refresh 单飞 + 401 重放）
│   ├── format.js / avatar.js  # 倒计时/时间/数字格式化；头像 URL
├── stores/                    # auth / plaza / capsule / theme ← 从 react-ts 移植
├── tokens/                    # tokens.wxss + palette.js（codegen 产物，勿手改）
├── assets/avatars/            # 10 个头像 PNG（codegen 产物，勿手改）
├── components/
│   ├── avatar-badge/          # 头像（本地 PNG，binderror 回退色底+首字）
│   └── capsule-card/          # 列表卡片（事件上抛父页）
└── pages/                     # plaza / open / create / me / login / register
                               # / capsule / settings / about（每页 js+json+wxml+wxss 四件套）
```

一次「打开广场」的流向（对照 React Web 版，差异已标注）：

```text
微信开发者工具「编译」→ 加载小程序包
  │
  ▼
app.js App().onLaunch：hydrate 主题+鉴权（wx.storageSync，同步 ← Web localStorage 也同步，
  │                     反而是 RN 的 AsyncStorage 要 await）
  ▼
app.json tabBar 默认页 = pages/plaza/index
  │
  ▼
createPage.onLoad：注入 themeMode/themeColors + 订阅 store（← Web 是 useStore hook 订阅）
  │ 根节点 <view class="app-root theme-{{themeMode}}"> 挂上主题类
  ▼
onShow → usePlaza.getState().fetch()（← 与 Web 同一个 store 逻辑，近逐字）
  │
  ▼
api.plaza(...) → wx.request(`${API_BASE}/api/v1/plaza/capsules?...`)（← 直连 :9080，无代理）
  │
  ▼
后端 JSON → store setState → 订阅回调 setData → WXML 重渲染 <capsule-card>（← Web 是 VDOM diff）
```

## 3. 如何运行和验证

```bash
cd mobile/wechat-miniprogram && ./build   # 离线静态校验（无需开发者工具）
./scripts/hello start wechat              # DevTools CLI 打开工程 + keepalive
```

- **`./build`**（离线可跑）：令牌 + 头像 codegen → 配置 JSON 合法性 → 页面四件套齐备 → 全部 `.js` 过 `node --check`。原生小程序没有独立编译工具链（由微信运行时解释执行），静态校验是离线能做的极限；纯 JS 逻辑另可在 Node 里 stub `wx` 跑冒烟。
- **`./run`**（需微信开发者工具）：先装 [DevTools](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)，在 设置→安全 开启「服务端口」；`./run` 调 `cli open --project` 打开工程后前台 keepalive（`hello` 据 run 进程判活，`port: None` → status 显示 `native`）。
- **⚠️ `cli open` 只加载编辑器，不会自动编译运行**——需在工具里手动点「编译」，模拟器才真正跑起来、发出 `wx.request`。
- **验证**（无 computer-use，同 ios/android 原生端）：编译后 fastapi 日志出现 `GET /api/v1/avatars 200`、`GET /api/v1/plaza/capsules?...&pageSize=15 200`、`GET /api/v1/health 200`、`GET /api/v1/capsules/{code} 200`，佐证 wx.request → `:9080` 全链路 + 广场→详情导航。2026-07-06 已用真实 AppID 完整验证（含头像 PNG 渲染目验）。

## 4. 分层：逻辑复用，视图重建

同 `mobile/react-native` 的哲学——把 `frontends/react-ts` 拆成「逻辑层 / 视图层」，
逻辑层近逐字搬运，视图层按平台 IA 重写。

| 层 | react-ts（Web） | 本端（小程序） | 改动 |
|---|---|---|---|
| 类型契约 | `types/index.ts`（TS interface） | 无独立文件（JS 无类型），语义随 api/store 内联 | 删类型声明 |
| API 客户端 | `fetch` + Envelope 解包 + refresh 单飞 | `wx.request` 版，逻辑逐字保留 | fetch→wx.request |
| 状态管理 | zustand `create` | `utils/store.js` 手搓同形 `create` | 40 行等价实现 |
| 业务 store | auth/plaza/capsule/theme | 同名 4 个，逻辑零改 | localStorage→wx.storage |
| 视图 | React 组件 + DOM | Page/Component + WXML | 全量重建 |

### 手搓 store（zustand vanilla 同形）

`utils/store.js` 暴露 `getState / setState / subscribe`，与 zustand 的 vanilla API 一致，
所以移植来的 store 工厂 `create((set, get) => ({...}))` **一字不用改**。页面侧不是 React，
没有 `useStore()` hook 订阅——改为在 `onLoad` 里 `subscribe` 把 state `setData` 进页面，
`onUnload` 取消订阅。`plaza`/`capsule` 里靠闭包序列号（`fetchSeq`）丢弃乱序响应的手法
原样保留。

## 5. 平台差异抹平

### fetch → wx.request

`wx.request` 是回调式、不返回 Promise，且字段名与 `fetch` 不同。用一个 `wxRequest()`
包一层 Promise，并映射：

| fetch | wx.request |
|---|---|
| `res.status` | `res.statusCode` |
| `await res.json()` | `res.data`（工具按 header 自动解 JSON） |
| `fetch(url, {headers, body})` | `wx.request({url, header, data})` |
| `URLSearchParams` | 手搓 `qs()`（小程序无内置） |

其余（401→refresh 单飞→重放、`Envelope<T>` 解包、`ApiError`）与 Web/RN 完全同构。

### localStorage/AsyncStorage → wx.storage（同步！）

RN 用异步 `AsyncStorage`，hydrate 得 `await`；小程序的 `wx.getStorageSync/setStorageSync`
是**同步**的，反而更接近 Web 的 `localStorage`——`auth`/`theme` 的 `hydrate()` 改回同步，
`app.js` 的 `onLaunch` 里先 hydrate 再进首页，无闪登出。

### 主题：无 `<html data-theme>`，改「根节点换类」

Web 版给 `<html>` 挂 `data-theme` 切 CSS 变量表。小程序没有可挂类的全局根节点，于是：

1. `gen-tokens-miniprogram` 把两套语义色各生成一个类：`.theme-dark{--surface-0:…}` /
   `.theme-light{…}`（尺寸令牌两套相同）。
2. `utils/page.js` 的 `createPage` 工厂给每页注入 `themeMode` 并订阅 theme store。
3. 每页根节点写 `<view class="app-root theme-{{themeMode}}">`——切主题即换类，`var(--…)` 重解析。

`createPage` 还注入 **`themeColors`**（palette.js 里当前主题的语义色）：小程序部分组件属性
（`<switch color>`、`wx.showModal confirmColor`）**吃不了 CSS 变量**，只能喂色值字符串——
统一从工厂注入（随主题切换自动更新），业务文件不硬编码色值，避免与 spec token 漂移。
工厂另挂公共 `toggleTheme()`，各页右上角一个字符即可切换。

### 无 React 组件树 → Page/Component + 事件上抛

列表卡片 `capsule-card` 是小程序 `Component`，交互经 `triggerEvent` 上抛父页
（`bind:opencard` / `bind:favtoggle` / `bind:deletecard`），父页调 store——对齐 RN 里
`FavoriteButton` 的 `onPress` 回调模式，把副作用集中在 store，组件保持纯展示。收藏按钮用
`catchtap` 阻止冒泡，避免与「点卡片打开详情」的 `bindtap` 打架。

## 6. 设计令牌与头像资产 codegen（M5.1 管线的小程序目标）

`scripts/gen-tokens-miniprogram` 读事实源 `spec/tokens/tokens.json`，一次产两物：

- `tokens/tokens.wxss`：CSS 变量（WXSS 支持 `var()`），按主题分 `.theme-dark`/`.theme-light`
  两块；尺寸令牌（字号/间距/圆角）带 px 单位输出。**样式主通道**。
- `tokens/palette.js`：嵌套 JS 对象（同 RN `tokens.ts` 形状），供 JS 侧少数取色场景
  （组件属性色、辉光、渐变解析）。

转换规则与 `gen-tokens-rn` 对齐：`rem→px`（1rem=16px），颜色/渐变原样。产物头标注
「勿手改」，重生成 `git diff` 应为空（同源保证）。`run`/`build` 都会先跑一遍防漂移。

### 头像资产 codegen：SVG→PNG 预烘焙（而非停在色块降级）

小程序 `<image>` 不支持 SVG，其它原生端（iOS/Flutter/RN）都靠各自的 SVG 渲染库直接显示
`spec/avatars/*.svg`。这里没有止步于「品牌色底+首字」的文字降级，而是加了一步
`scripts/gen-avatars-miniprogram`：用 `rsvg-convert`（`librsvg`，`brew install librsvg`）
在 codegen 阶段把 `spec/avatars` 的 10 个头像离线栅格化成 256×256 PNG（128 viewBox 的
2x，覆盖列表~32px 到设置页~56px 的清晰度需求），存进 `assets/avatars/`，`<image>` 直接引用
本地文件——视觉上与其它端保持一致，而不是唯独小程序端显示纯色块。

`avatar-badge` 组件用 `wx:if="{{imgOk && imgSrc}}"` 切 `<image>`/兜底 `<view>`：`imgSrc`
由 `avatarId` 拼出 `/assets/avatars/${avatarId}.png`；`binderror` 触发时把 `imgOk` 置 false
回退到色块+首字——覆盖 `rsvg-convert` 未安装（codegen 跳过生成，打印警告不阻塞 build）或
`avatarId` 不在内置 10 个之列的情况，功能不受影响，只是视觉降级。

选择「预烘焙 PNG」而非运行时用 `<canvas>` 解析绘制 SVG：源文件都是简单的渐变+几何图形
（圆/多边形/直线，1KB 左右），一次性栅格化远比维护一个小程序端 SVG-path-to-canvas 解析器
划算，且和其它端的 tokens/头像 codegen 一样遵循「事实源→codegen→提交产物」的管线约定。

## 7. hello 集成（port=None 原生模型）

小程序无 dev server 端口，`hello` 里登记 `port: None`（`status` 显示 `native`），走「进程
存活判活」路径（同 ios/android/swiftui）：

- `./run` = DevTools `cli open --project .` 打开工程（编辑器加载；模拟器需手动点「编译」）→
  前台 `while sleep` keepalive。`hello` 据本 run 进程存活判 ready。
- `hello stop` 用 `killpg` 结束 run 进程组，只关 keepalive，DevTools 窗口不受影响（需手动关）。
- `cli` 路径经 `DEVTOOLS_CLI` 可覆盖；缺失时 `run` 打印安装指引并非零退出（同 android 检查 adb）。

## 8. 小程序平台坑（都已解决）

- **游客 appid 联网受限**：`touristappid` 下 `wx.request` 被限。要联网必须换自己的 AppID
  或测试号——写进被 gitignore 的 `project.private.config.json`，不污染仓库的
  `project.config.json`。
- **本地 http 被拦**：小程序默认只放 https + 合法域名。`setting.urlCheck: false` 放行本地
  `127.0.0.1:9080`；仅限开发，上线必须 https + 后台配置合法域名。
- **`cli open` 不自动编译**：只把工程加载进 IDE 编辑器，需手动点「编译」模拟器才真正运行
  （首次验证曾因此误判为无响应）。
- **`<image>` 不认 SVG**：头像走 `gen-avatars-miniprogram` 预烘焙 PNG（见 §6），
  `about` 页技术栈图标（无固定小集合、非本项目资产）改文本呈现。
- **`<button open-type="share">` 默认样式**：小程序原生 `button` 自带边框/外边距，用
  `button.btn::after{border:none}` + `margin:0` 抹掉，套回 `.btn` 语义。
- **组件属性吃不了 CSS 变量**：`<switch color>`、`showModal confirmColor` 等只能喂色值
  字符串 → `createPage` 统一注入 `themeColors`（源自 palette.js），业务文件不硬编码。
- **无 CLI 编译**：原生小程序没有独立编译工具链，`./build` 只能做静态校验（结构 / JSON /
  页面四件套 / `node --check` 语法）；真正运行靠 DevTools。纯 JS 逻辑另在 Node 里 stub `wx`
  跑过冒烟（store/format/api/stores 均可执行）。

## 9. 常见改动指南

- **加一页**：`pages/<name>/` 建四件套（js/json/wxml/wxss）→ `app.json` 的 `pages` 注册
  （要进底部导航再加 `tabBar.list`）。页面 js 用 `createPage({...})` 包裹自动接主题；根节点
  写 `<view class="app-root theme-{{themeMode}}">`。
- **加接口 / 状态**：与 Web 完全一样——`utils/api.js` 加端点方法 → 对应 store 加 action →
  页面 `onLoad` 里 `subscribe` + `setData`。多数情况可直接对照 react-ts 改。
- **改令牌**：改 `spec/styles/tokens.css`（源）→ 派生 `tokens.json` →
  `node scripts/gen-tokens-miniprogram`（`run`/`build` 自动跑）；不要手改 `tokens/` 产物。
- **加头像**：`spec/avatars/` 加 SVG + `catalog.json` 登记 → `node scripts/gen-avatars-miniprogram`
  重烘焙 PNG。
- **组件属性需要色值**：不要写死 hex——`utils/page.js` 的 `themeData()` 里加一个语义色字段，
  WXML 用 `{{themeColors.xxx}}`、JS 用 `palette().xxx` 取。
- **换后端地址**（真机预览）：改 `config.js` 的 `API_BASE` 为局域网 IP。
