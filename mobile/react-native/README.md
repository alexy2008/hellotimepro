# HelloTime Pro · React Native（Expo）移动端

把 HelloTime Pro 用 **React Native + Expo** 重建为移动端 App。M5 移动端类目的第一个实现，
与 `frontends/react-ts` 构成「**Web React vs Native React**」对照。

## 定位

- **纯 API 消费者**：不持有 `/api/v1`，复用已绿的 10 套后端与契约，**不新增任何后端/数据库代码**。
- **逻辑/令牌共享，视图分叉**：同一套 zustand store + api client + 类型契约从 Web React 前端
  近乎逐行移植；只有视图层用原生组件重建。

## 复用策略（分层共享）

| 层 | 来源（frontends/react-ts） | 移植方式 |
|---|---|---|
| 类型 | `src/types/index.ts` | 逐字复制（纯 TS） |
| API 客户端 | `src/api/client.ts` | 复制，仅 `BASE` 从 `""`（Vite 代理）→ `API_BASE`（RN 直连 :9080） |
| 状态 store | `src/stores/{auth,plaza,capsule,theme}.ts` | 复制；`auth`/`theme` 把 `localStorage`→`AsyncStorage`（异步 hydrate） |
| 纯工具 | `src/utils/{format,avatar}.ts` | 逐字复制（avatar 改绝对 URL） |
| 视图/导航/组件 | 各 page/component | **重建**：底部 Tab Bar + RN 原生组件 |
| 设计令牌 | `spec/tokens/tokens.json` | codegen → `src/theme/tokens.ts`（见下） |

> 教学点：Web 端把这套 store/api/types 渲染成 DOM，本端渲染成原生组件 —— 差异全落在视图层。

## 架构

- **Expo SDK 56 + React Native 0.85 + React 19 + TypeScript**。
- **Expo Router**（文件式路由，底层即 React Navigation）驱动 **底部 Tab Bar**：广场 / 开启 / 创建 / 我的。
- **Zustand** 状态管理（与 Web 同源）。
- **设计令牌 codegen**：`scripts/gen-tokens-rn` 读 `spec/tokens/tokens.json` 生成 `src/theme/tokens.ts`
  （rem→px、颜色/渐变保留），`src/theme/index.ts` 包成调色板/glow/字体/间距消费层。RN 吃不了 `tokens.css`，
  这是 roadmap M5.1 令牌 codegen 管线在 JS 目标上的落地。`run`/`build` 启动前自动重生成，保证不漂移。
- **字体**：Orbitron（display）+ Inter（body），根布局 `useFonts` 加载。
- **远端 SVG**：头像 / 技术栈图标用 `react-native-svg` 的 `SvgUri` 直接拉后端 `/static/...`
  （复用后端真实资源，不自造头像，与 `desktop/swiftui` 一致）。
- **直连不走代理**：RN 无 Vite，`fetch` 直打 `:9080`（`EXPO_PUBLIC_API_BASE` 可覆盖），原生请求无 CORS。

### 信息架构（对标 `ui-prototype/mobile.html`）

```
app/
  _layout.tsx          根 Stack（字体/hydrate/splash）
  (tabs)/_layout.tsx   底部 Tab Bar
    index.tsx          广场（排序/筛选/防抖搜索/分页/收藏）
    open.tsx           开启（8 位分体码 → 详情）
    create.tsx         创建（AI 推荐/生成 + 日期选择器 + 公开开关，门禁）
    me.tsx             我的（资料 + 我创建/我收藏 + 撤回 + 登出，门禁）
  c/[code].tsx         凭码详情（实时倒计时 + 到期自动开启 + 复制码/分享/收藏，匿名可访问）
  login.tsx/register.tsx  鉴权（模态，含头像选择）
  about.tsx            关于（RN 栈 + 后端栈 from /health + 连通点）
  settings.tsx         账号设置（改资料 / 改密，门禁）
```

匿名访问广场/开启/详情/关于；创建/我的/设置走 `AuthGate` 重定向登录（行为对齐 Web `AuthGate`）。

## 运行

```bash
# 1) 选后端并初始化数据
./scripts/hello switch fastapi
./scripts/db init

# 2) 启动 Metro（端口 7192）——「探端口即就绪」
./scripts/hello start react-native
# 或：cd mobile/react-native && ./run

# 3) 在 iOS 模拟器打开（需已装 iOS 模拟器运行时）
cd mobile/react-native && ./run ios        # 启动 Metro 并在模拟器打开
#   或在 Expo 交互界面按 i

./scripts/hello stop react-native
```

后端地址默认 `:9080`（`hello switch` 切换的反代）。直连某后端口 / 真机用局域网 IP：

```bash
EXPO_PUBLIC_API_BASE=http://192.168.1.10:9080 ./run ios
```

> iOS 模拟器可达宿主 `localhost`；`app.json` 已开 ATS cleartext，便于 dev 直连 http。

## 构建 / 校验

```bash
./build      # 令牌 codegen + tsc --noEmit + expo export（Metro 打包冒烟）
```

不产出 `.ipa/.apk`（需 EAS / Xcode 原生构建，超出 dev MVP）。

## 验证（对齐客户端版 DoD · 按 M5 验证分层）

- **契约**：继承后端已绿的 104，客户端不重复跑。
- **类型/打包**：`./build` 全绿（`tsc --noEmit` + `expo export --platform ios` Metro 打包成功）。
- **编排**：`hello start react-native` → Metro 在 :7192 `ready`（`packager-status:running`）→ `stop` 干净释放端口。
- **核心旅程 E2E**：Maestro flow 见 `.maestro/core-journey.yaml`（注册→建胶囊→看详情→收藏→我的列表），
  关键交互元素已加 `testID`。运行：

  ```bash
  # 前提：后端+反代在 :9080、db init、Metro 在 :7192、iOS 模拟器已启动并加载本工程
  maestro test mobile/react-native/.maestro/core-journey.yaml
  ```

  - 默认走 Expo Go（`appId=host.exp.Exponent` + `openLink exp://127.0.0.1:7192`）。
  - dev-client/standalone：`MAESTRO_APP_ID=pro.hellotime.rn maestro test ...`（需先 `expo run:ios`）。
- **连通性**：App 启动后广场/health 请求会落到当前后端日志（`data/logs/<backend>.log`），佐证 `:9080` 直连链路通。

> **环境前提**：iOS 模拟器运行时需先安装（`xcodebuild -downloadPlatform iOS`，约 7GB；
> 建议在交互式终端/Xcode 中执行）；Maestro CLI 见 https://maestro.mobile.dev 。
> 二者就绪后即可跑上面的核心旅程 + 截图留证。

## 目录

```
mobile/react-native/
  app.json / tsconfig.json
  run / build                  启动 Metro(7192) / codegen+tsc+export
  .maestro/core-journey.yaml   核心旅程 E2E
  src/
    api/{client,config}.ts     移植（直连 :9080）
    types/index.ts             移植
    stores/*.ts                移植（AsyncStorage 化）
    utils/*.ts                 移植
    theme/tokens.ts            codegen 产物（勿手改）
    theme/index.ts             调色板/glow/字体/间距消费层
    components/*.tsx           UI 基元 + 域组件（卡片/码输入/日期选择器/收藏…）
    app/                       Expo Router 路由（见上）
```
