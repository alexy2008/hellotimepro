# HelloTime Pro · Electron 桌面壳

把既有 React 前端（`frontends/react-ts`）装进 **Electron** 桌面壳。与 `desktop/tauri` 构成「同一道桌面 Web 选择题的两种工程答案」。

## 壳哲学（对照 Tauri）

| 维度 | **Electron（本实现）** | Tauri |
|---|---|---|
| 渲染引擎 | **自带一份 Chromium** | 系统 WebView |
| 壳层语言 | **Node.js** | Rust |
| 包体积 | ~100–200 MB | ~3–10 MB |
| 渲染一致性 | 强（引擎自带） | 依系统 WebView 而异 |
| 原生通信 | **IPC**（`ipcMain` / `ipcRenderer` + preload `contextBridge`） | `#[tauri::command]` |
| 内嵌前端 | **React** | Svelte |

Electron 是业界事实标准（VS Code / Slack / Discord）。

## 架构

- **纯 API 消费者**：桌面壳不持有 `/api/v1`，复用已绿的 10 套后端。
- **dev 模式嵌入**：`./run` 在端口 **7190** 拉起 React 的 Vite dev server，Electron 窗口加载它；前端自带的 `/api → :9080` 代理原样复用（`hello switch <backend>` 切换后端）。
- **进程模型**：main（Node，`main.cjs`）创建 `BrowserWindow` 加载渲染层；`preload.cjs` 在隔离上下文经 `contextBridge` 暴露最小桥面 `window.helloDesktop`。

## 运行

```bash
./scripts/hello switch fastapi     # 先把 :9080 指向某后端
./scripts/hello start electron     # 或：cd desktop/electron && ./run
./scripts/hello stop electron
```

首次运行会 `npm install`（含下载 Electron 二进制）并安装内嵌前端依赖。

## 原生桥示例：导出应用信息

原生菜单「胶囊 → 导出应用信息为 JSON…」（或 `Cmd/Ctrl+E`）演示完整链路：

```
原生菜单 / IPC(window.helloDesktop.exportAppInfo) → 主进程
  → fetch :9080/api/v1/health（公开端点，无鉴权）
  → 原生保存对话框 dialog.showSaveDialog
  → Node fs 写入 JSON 文件
```

这是 Tauri 侧 `#[tauri::command] + Rust fs` 的对照样本。

### 为什么不是「导出我的胶囊」

`/api/v1/me/capsules` 需要鉴权，而 React 前端把 **access token 只放在内存**（zustand），仅 refresh token 落 `localStorage`。壳层若 out-of-band 调 `/auth/refresh` 取 token，会**轮换并吊销** refresh token 族，下次前端刷新触发重用检测 → 误登出（next/nuxt 曾踩此坑）。正确做法是让一个 **desktop-aware 前端**通过 `window.helloDesktop` 主动把已加载的胶囊数据交给壳层导出——挂载点已就绪（`preload.cjs`），作为后续增强。

## 构建 / 校验

```bash
./build      # npm install + 语法检查（node --check）
```

### 生产打包（超出 dev MVP）

出 `.app` / `.dmg` / `.exe` 需引入 `electron-builder`，并把内嵌前端 `vite build` 的静态产物随包分发、再处理 `/api` 的绝对地址（生产无 Vite 代理）。dev MVP 不含此步。

## 验证

桌面壳是原生窗口，Playwright 够不着；按 M5 验证分层走「核心旅程截图留证」（Electron 也可用 Playwright 的 Electron 驱动做 E2E，列为后续）。
