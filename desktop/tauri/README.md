# HelloTime Pro · Tauri 桌面壳

把既有 Svelte 前端（`frontends/svelte`）装进 **Tauri** 桌面壳。与 `desktop/electron` 构成「同一道桌面 Web 选择题的两种工程答案」。

## 壳哲学（对照 Electron）

| 维度 | **Tauri（本实现）** | Electron |
|---|---|---|
| 渲染引擎 | **系统 WebView**（macOS WKWebView / Win WebView2 / Linux WebKitGTK） | 自带 Chromium |
| 壳层语言 | **Rust** | Node.js |
| 包体积 | ~3–10 MB | ~100–200 MB |
| 渲染一致性 | 依系统 WebView 而异 | 强（引擎自带） |
| 原生通信 | **`#[tauri::command]`** + `invoke` | IPC + preload |
| 内嵌前端 | **Svelte** | React |

呼应 `backends/axum`（Rust）。

## 架构

- **纯 API 消费者**：桌面壳不持有 `/api/v1`，复用已绿的 10 套后端。
- **dev 模式嵌入**：`./run` 在端口 **7191** 拉起 Svelte 的 Vite dev server，`tauri dev` 加载它（`tauri.conf.json` 的 `devUrl`）；前端自带的 `/api → :9080` 代理原样复用。
- **壳层**：`src-tauri/src/lib.rs`（Rust）建窗、挂原生菜单、注册 command；权限在 `src-tauri/capabilities/default.json`（Tauri v2 的能力/权限系统）。

## 运行

```bash
./scripts/hello switch fastapi   # 先把 :9080 指向某后端
./scripts/hello start tauri      # 或：cd desktop/tauri && ./run
./scripts/hello stop tauri
```

> **首次运行会编译 Rust（拉 ~400 crate，数分钟）**；之后增量编译很快。`hello` 探的是内嵌前端端口 7191，Vite 一就绪即报 ready，此时 Rust 可能仍在编译、窗口稍后才出现。

## 原生桥示例：导出应用信息

原生菜单「胶囊 → 导出应用信息为 JSON…」（或 `Cmd/Ctrl+E`）演示完整链路：

```
原生菜单 / command(invoke export_app_info) → Rust
  → 原生保存对话框 tauri-plugin-dialog
  → Rust std::fs::write 写 JSON 文件
  → emit 事件回渲染层
```

这是 Electron 侧 `Node fs + IPC` 的对照样本。

### 与 Electron 的刻意不对称

Electron 主进程自带 `fetch`，导出时顺带抓了 `/api/v1/health`；Tauri 的 Rust 壳要抓 HTTP 得引入 `reqwest`（显著拉长编译），故本实现**不在壳层抓后端健康**，只导出壳/平台信息。这个不对称正是「同一功能、两套壳」的教学点。鉴权版「导出我的胶囊」同样应由 desktop-aware 前端经 `invoke` 把数据交给壳层（避免壳层 out-of-band 刷新 token 触发轮换误登出）。

## 构建 / 校验

```bash
./build      # cargo check（Rust 编译校验，不出安装包）
```

### 生产打包（超出 dev MVP）

`npx tauri build` 出 `.app`/`.dmg`/`.exe`，需内嵌前端先 `vite build` 出静态产物（`frontendDist` 已指向 `frontends/svelte/dist`），并处理生产环境 `/api` 的绝对地址（无 Vite 代理）。

## 验证

桌面壳是原生窗口，Playwright 够不着；按 M5 验证分层走「核心旅程截图留证」（Tauri E2E 可用 tauri-driver + WebdriverIO，列为后续）。
