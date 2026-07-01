# HelloTime Pro Tauri 桌面端技术手册与代码导读

本文面向熟悉 Web 前端、但没系统接触过 **Tauri 桌面壳** 的读者。读完后你应能回答:

- Tauri 的「Rust 主机 + 系统 WebView + command」模型各是什么。
- 这个桌面端怎么**内嵌**现有的 Svelte 前端,而不重写 UI。
- 原生桥(`#[tauri::command]` + Rust + 能力声明)怎么工作。
- 它和 `desktop/electron` 的关键差异。

> 重要前提:**本桌面端不重写任何 UI**。它内嵌的就是 `frontends/svelte` 那套 Svelte 前端——所以**页面/状态/组件的代码导读请直接看 `frontends/svelte/TECHNICAL_GUIDE.md`**。本文只讲「壳」:Tauri 如何把那套 SPA 装进原生窗口,以及壳层独有的原生能力。

## 1. 技术选型与设计特色

本实现是 M5 **Web 背书型**桌面客户端之一,壳层用 **Tauri**(Rust 主机 + 系统 WebView)。设计特色:

* **借系统 WebView**:Tauri 不打包浏览器引擎,用操作系统自带的 WebView(macOS 的 WKWebView 等),所以包体极小(~3–10MB)。这是它与 `desktop/electron`(自带 Chromium,~100–200MB)的根本哲学差异——「借引擎 vs 自带引擎」。
* **内嵌 Svelte 前端**:dev 模式下 `./run` 拉起 `frontends/svelte` 的 Vite dev server(端口 7191),Tauri 窗口加载该 URL。前端自带的 `/api → :9080` 代理原样复用——**壳层不碰 API 契约**。
* **Rust 壳**:主机进程用 Rust 写(`src-tauri/src/lib.rs`),原生桥走 `#[tauri::command]` + Rust 标准库,能力(权限)在 `capabilities/default.json` 显式声明(默认最小权限)。
* **差异化(避免与 Electron 重复)**:Tauri 内嵌 Svelte、Electron 内嵌 React;同一功能「导出应用信息」Tauri 走 Rust `command`、Electron 走 Node `fs`+IPC——两种模型差异落到代码里。

## 2. Tauri 模型（最少必要）

* **Rust 主机(core)**:`src-tauri/`,编译成原生二进制,负责创建窗口、注册 command、能力裁剪。`main.rs` 是入口(`tauri::Builder`),`lib.rs` 放 command 实现。
* **前端(WebView 里)**:就是 Svelte 前端,跑在系统 WebView 中。
* **command**:Rust 函数标 `#[tauri::command]` 注册后,前端用 `@tauri-apps/api` 的 `invoke("cmd_name", args)` 调用。返回值/错误经序列化跨边界传回。
* **能力(capabilities)**:Tauri 默认拒绝一切;要用某插件/API(如 dialog)需在 `capabilities/default.json` 声明,最小权限原则。

```text
Svelte 页面（系统 WebView）
  │ invoke("export_info")            ← @tauri-apps/api
  ▼ Tauri IPC（序列化）
lib.rs：#[tauri::command] fn export_info() → reqwest 拉 :9080 + tauri-plugin-dialog 保存 + std::fs 写
  （前提：capabilities/default.json 已授 dialog:default 等能力）
```

## 3. 目录与运行

```text
desktop/tauri/
├── package.json            # @tauri-apps/cli 等
├── run / build             # 启动 / 构建校验
└── src-tauri/
    ├── Cargo.toml          # Rust 依赖
    ├── tauri.conf.json     # Tauri 配置（窗口、标识符、devUrl 等）
    ├── capabilities/default.json   # 能力（权限）声明
    └── src/
        ├── main.rs         # 入口：tauri::Builder
        └── lib.rs          # #[tauri::command] 实现
```

```bash
./scripts/hello start tauri        # 端口 7191（探端口判活）
cd desktop/tauri && ./run          # npm install + 拉 Vite(svelte)@7191 + tauri dev
./build                            # cargo check
```

`./run` 关键流程:① 没装就 `npm install`(含 `@tauri-apps/cli`)+ 装内嵌前端依赖;② 以 `VITE_DESKTOP_SHELL=tauri` 拉起 `frontends/svelte` 的 Vite dev server(`--port 7191 --strictPort`);③ **等待渲染层就绪**——每轮先 `kill -0 $VITE_PID` 确认 Vite 存活(端口被占时 `--strictPort` 会让 Vite 退出,光靠 curl 可能命中外部服务而误判),再 `curl`;④ `tauri dev`(首次会 `cargo build` 较慢),关窗后 `trap` 清理 Vite。

## 4. 壳层代码导读

- `src/main.rs`:`tauri::Builder::default().invoke_handler(tauri::generate_handler![export_info]).run(...)`——注册 command、装插件、启窗。
- `src/lib.rs`:`#[tauri::command] fn export_info()` 拉 `/api/v1/health`(公开接口)+ `tauri-plugin-dialog` 弹保存框 + `std::fs` 写文件。
- `capabilities/default.json`:授予 `dialog:default` 等能力,否则 command 里调插件会被拒。
- `tauri.conf.json`:`identifier` 由脚手架默认 `com.tauri.dev`(保留值,build 会拒)改为 `pro.hellotime.tauri`;`build.devUrl` 指向 :7191。

> **刻意不在壳层抓后端健康的对称性差异**:Electron 壳用 Node 自带 fetch 抓 `/health`,Tauri 这边若要 HTTP 需 reqwest 重编译——这种不对称本身就是教学点(README 有述)。

## 5. 与 Electron 的对照

| 维度 | Tauri（本实现） | Electron |
|---|---|---|
| 渲染引擎 | 系统 WebView（~3–10MB） | 自带 Chromium（~100–200MB） |
| 壳语言 | Rust | Node.js |
| 内嵌前端 | Svelte（`frontends/svelte`） | React（`frontends/react-ts`） |
| 原生桥 | `#[tauri::command]` + 能力声明 | Node `fs`+`dialog` + IPC |
| 端口 | 7191 | 7190 |

## 6. 常见改动指南

- **改 UI / 加页面**:不在这里——去 `frontends/svelte`(本端只是壳)。
- **加一个原生能力**:`lib.rs` 写 `#[tauri::command] fn x(...)` → `main.rs` 的 `generate_handler![]` 注册 → 如需插件能力,在 `capabilities/default.json` 声明 → 前端 `invoke("x")`。
- **改内嵌前端 / 端口**:`run` 里的 `FRONTEND_DIR` + `tauri.conf.json` 的 `devUrl`。

## 7. 验证

- `./build`:`cargo check` 通过。
- `hello start tauri`:内嵌 Svelte 在 :7191 服务(`<title>HelloTime Pro · Svelte 5</title>`),`tauri dev` 首次 build 后窗口出现;`hello stop` 干净停、端口释放。原生 E2E 走 tauri-driver(力争对齐 25 smoke,列为后续)。
