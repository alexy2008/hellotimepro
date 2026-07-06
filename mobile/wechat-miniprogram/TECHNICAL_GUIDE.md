# 技术指南 · 微信小程序端

面向想读懂「原生小程序如何承接一套 Web React 逻辑」的读者。重点讲**移植策略**、
**平台差异抹平**与**踩过的坑**，不重复 README 的使用说明。

## 1. 分层：逻辑复用，视图重建

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

## 2. 平台差异抹平

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

`createPage` 还顺手挂了公共 `toggleTheme()`，各页右上角一个字符即可切换。

### 无 React 组件树 → Page/Component + 事件上抛

列表卡片 `capsule-card` 是小程序 `Component`，交互经 `triggerEvent` 上抛父页
（`bind:opencard` / `bind:favtoggle` / `bind:deletecard`），父页调 store——对齐 RN 里
`FavoriteButton` 的 `onPress` 回调模式，把副作用集中在 store，组件保持纯展示。收藏按钮用
`catchtap` 阻止冒泡，避免与「点卡片打开详情」的 `bindtap` 打架。

## 3. 设计令牌 codegen（M5.1 管线的小程序目标）

`scripts/gen-tokens-miniprogram` 读事实源 `spec/tokens/tokens.json`，一次产两物：

- `tokens/tokens.wxss`：CSS 变量（WXSS 支持 `var()`），按主题分 `.theme-dark`/`.theme-light`
  两块；尺寸令牌（字号/间距/圆角）带 px 单位输出。**样式主通道**。
- `tokens/palette.js`：嵌套 JS 对象（同 RN `tokens.ts` 形状），供 JS 侧少数取色场景
  （tabBar 选中色、辉光、渐变解析）。

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

## 4. hello 集成（port=None 原生模型）

小程序无 dev server 端口，`hello` 里登记 `port: None`（`status` 显示 `native`），走「进程
存活判活」路径（同 ios/android/swiftui）：

- `./run` = DevTools `cli open --project .` 打开工程（模拟器起、`wx.request` 发出）→ 前台
  `while sleep` keepalive。`hello` 据本 run 进程存活判 ready。
- `hello stop` 用 `killpg` 结束 run 进程组，只关 keepalive，DevTools 窗口不受影响（需手动关）。
- `cli` 路径经 `DEVTOOLS_CLI` 可覆盖；缺失时 `run` 打印安装指引并非零退出（同 android 检查 adb）。

## 5. 踩坑记录

- **游客 appid 联网受限**：`touristappid` 下 `wx.request` 被限。要联网必须换自己的 AppID
  或测试号——写进被 gitignore 的 `project.private.config.json`，不污染仓库的
  `project.config.json`。
- **本地 http 被拦**：小程序默认只放 https + 合法域名。`setting.urlCheck: false` 放行本地
  `127.0.0.1:9080`；仅限开发。
- **`<image>` 不认 SVG**：头像走 `gen-avatars-miniprogram` 预烘焙 PNG（见上节），
  `about` 页技术栈图标（无固定小集合、非本项目资产）改文本呈现。
- **`<button open-type="share">` 默认样式**：小程序原生 `button` 自带边框/外边距，用
  `button.btn::after{border:none}` + `margin:0` 抹掉，套回 `.btn` 语义。
- **无 CLI 编译**：原生小程序没有独立编译工具链，`./build` 只能做静态校验（结构 / JSON /
  页面四件套 / `node --check` 语法）；真正运行靠 DevTools。纯 JS 逻辑另在 Node 里 stub `wx`
  跑过冒烟（store/format/api/stores 均可执行）。
