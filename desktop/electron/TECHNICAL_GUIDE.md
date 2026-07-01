# HelloTime Pro Electron 桌面端技术手册与代码导读

本文面向熟悉 Web 前端、但没系统接触过 **Electron 桌面壳** 的读者。读完后你应能回答:

- Electron 的「主进程 / 渲染进程 / preload」三件套各是什么。
- 这个桌面端怎么**内嵌**现有的 React 前端,而不重写 UI。
- 原生桥(IPC + Node fs/dialog)怎么工作。
- 它和 `desktop/tauri` 的关键差异。

> 重要前提:**本桌面端不重写任何 UI**。它内嵌的就是 `frontends/react-ts` 那套 React 前端——所以**页面/状态/组件的代码导读请直接看 `frontends/react-ts/TECHNICAL_GUIDE.md`**。本文只讲「壳」:Electron 如何把那套 SPA 装进一个原生窗口,以及壳层独有的原生能力。

## 1. 技术选型与设计特色

本实现是 M5 **Web 背书型**桌面客户端之一,壳层用 **Electron**(自带 Chromium 渲染引擎 + Node.js 主进程)。设计特色:

* **自带引擎**:Electron 把一整份 Chromium 打包进 app(包体 ~100–200MB),所以渲染行为在所有平台一致、不依赖系统浏览器。这是它与 `desktop/tauri`(借系统 WebView,~3–10MB)的根本哲学差异。
* **内嵌 React 前端**:dev 模式下 `./run` 拉起 `frontends/react-ts` 的 Vite dev server(端口 7190),Electron 窗口加载该 URL。前端自带的 `/api → :9080` 代理原样复用——**壳层不碰 API 契约**。
* **JS 壳**:主进程用 Node.js 写(`main.cjs`),原生桥走 Node 的 `fs`/`dialog` + IPC。
* **差异化(避免与 Tauri 重复)**:Electron 内嵌 React,Tauri 内嵌 Svelte;同一功能「导出应用信息」Electron 走 Node `fs`+IPC、Tauri 走 Rust `command`——让两种 IPC 模型的差异落到代码里,对比成为承重墙。

## 2. Electron 三件套（最少必要）

* **主进程(main process)**:`main.cjs`,Node.js 环境,负责创建窗口(`BrowserWindow`)、原生菜单、文件对话框、生命周期。一个 app 一个主进程。
* **渲染进程(renderer)**:就是窗口里那个 Chromium 页面,跑的是 React 前端。默认**沙箱化、无 Node 权限**(安全)。
* **preload 脚本**:`preload.cjs`,在渲染进程加载前注入,是主进程与渲染进程之间唯一的安全桥。用 `contextBridge.exposeInMainWorld(...)` 把白名单 API 暴露给页面,页面经 `window.xxx` 调用,内部走 `ipcRenderer.invoke` → 主进程 `ipcMain.handle`。`contextIsolation: true` 保证页面拿不到 Node 全局。

```text
React 页面（渲染进程，无 Node）
  │ window.helloDesktop.exportInfo()   ← preload 暴露的白名单 API
  ▼ contextBridge
preload.cjs：ipcRenderer.invoke("export-info")
  ▼ IPC
main.cjs：ipcMain.handle("export-info", …) → fetch(:9080/api/v1/health) + dialog 保存 + fs 写文件
```

## 3. 目录与运行

```text
desktop/electron/
├── package.json     # electron 依赖 + 脚本
├── run / build      # 启动 / 构建校验
├── main.cjs         # 主进程：BrowserWindow + 原生菜单 + IPC handler
└── preload.cjs      # contextBridge 暴露白名单 API（contextIsolation）
```

```bash
./scripts/hello start electron     # 端口 7190（探端口判活）
cd desktop/electron && ./run       # npm install + 拉 Vite(react-ts)@7190 + npx electron .
./build                            # 语法检查
```

`./run` 关键流程:① 没装就 `npm install`(含下载 Electron)+ 装内嵌前端依赖;② 以 `VITE_DESKTOP_SHELL=electron` 拉起 `frontends/react-ts` 的 Vite dev server(`--port 7190 --strictPort`,这个环境变量让前端在关于页/页脚显示「桌面端技术栈」);③ **等待渲染层就绪**——每轮先 `kill -0 $VITE_PID` 确认 Vite 存活(端口被占时 `--strictPort` 会让 Vite 退出,光靠 curl 可能命中外部服务而误判),再 `curl` 探测;④ 前台 `npx electron .`,关窗后 `trap` 清理 Vite。

## 4. 壳层代码导读

- `main.cjs`:`app.whenReady()` 后创建 `BrowserWindow`(`webPreferences: { preload, contextIsolation: true, nodeIntegration: false }`),`loadURL(RENDERER_URL)` 加载 React 前端。注册原生菜单「胶囊 → 导出应用信息为 JSON…」,点它触发 IPC → 拉 `/api/v1/health`(公开接口)+ `dialog.showSaveDialog` + `fs.writeFile`。
- `preload.cjs`:`contextBridge.exposeInMainWorld("helloDesktop", { exportInfo: () => ipcRenderer.invoke("export-info") })`——只暴露白名单,页面无法直接碰 Node。

> **鉴权版「导出我的胶囊」未做**:React 把 access token 只放内存,壳层 out-of-band 调 `/auth/refresh` 会轮换吊销→误登出。正解是 desktop-aware 前端经桥主动交数据;挂载点已就绪,列为后续。

## 5. 与 Tauri 的对照

| 维度 | Electron（本实现） | Tauri |
|---|---|---|
| 渲染引擎 | 自带 Chromium（~100–200MB） | 系统 WebView（~3–10MB） |
| 壳语言 | Node.js | Rust |
| 内嵌前端 | React（`frontends/react-ts`） | Svelte（`frontends/svelte`） |
| 原生桥 | Node `fs`+`dialog` + IPC | `#[tauri::command]` + Rust + 能力声明 |
| 端口 | 7190 | 7191 |

## 6. 常见改动指南

- **改 UI / 加页面**:不在这里——去 `frontends/react-ts`(本端只是壳)。
- **加一个原生能力**:`main.cjs` 加 `ipcMain.handle("x", …)` → `preload.cjs` 在 `exposeInMainWorld` 白名单加 `x` → 前端 `window.helloDesktop.x()` 调用。
- **改内嵌的前端**:`run` 里的 `FRONTEND_DIR` / 端口。

## 7. 验证

- `./build`:壳脚本语法检查通过。
- `hello start electron`:内嵌 React 在 :7190 服务(`<title>HelloTime Pro · React</title>`),Electron 壳进程起、窗口出现;`hello stop` 干净停、端口释放。Playwright 原生支持 Electron 的 E2E(力争对齐 25 smoke,列为后续)。
