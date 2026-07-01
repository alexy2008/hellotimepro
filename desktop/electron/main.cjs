// ============================================================
// HelloTime Pro · Electron 主进程
//
// Electron 的壳哲学：**自带一份 Chromium** 渲染内嵌的 Web 前端，
// 壳层用 **Node.js** 编写，与渲染层通过 **IPC** 通信。
// 对照 desktop/tauri（系统 WebView + Rust 壳 + command）。
//
// 本壳 dev 模式加载 frontends/react-ts 的 Vite dev server（由 ./run 拉起，
// 端口 7190），前端自带的 /api → :9080 代理原样复用 —— 桌面壳不碰 API 契约。
//
// 原生桥示例「导出应用信息为 JSON」：native menu / IPC → Node fs → 保存对话框，
// 走公开的 /api/v1/health，不涉及鉴权（鉴权版见 README 的说明）。
// ============================================================
const { app, BrowserWindow, Menu, dialog, ipcMain } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");

// 渲染层 URL：内嵌 React 前端的 Vite dev server（./run 注入，默认 7190）。
const RENDERER_URL = process.env.RENDERER_URL || "http://localhost:7190";
// 后端：经 :9080 反代（hello switch 切换目标）。主进程是 Node，直连后端，
// 不经渲染层的 /api 代理。
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:9080";

let mainWindow = null;

// ---- 原生能力：收集应用信息（含后端健康） ----------------------
async function collectAppInfo() {
  const info = {
    app: "HelloTime Pro · Electron 桌面壳",
    shell: "Electron",
    rendering: "自带 Chromium",
    shellLanguage: "Node.js",
    embeddedFrontend: "frontends/react-ts",
    rendererUrl: RENDERER_URL,
    backendUrl: BACKEND_URL,
    versions: {
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
    },
    platform: `${process.platform} ${process.arch}`,
    exportedAt: new Date().toISOString(),
  };
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/health`, {
      signal: AbortSignal.timeout(5000),
    });
    info.backendHealth = res.ok ? await res.json() : { error: `HTTP ${res.status}` };
  } catch (e) {
    info.backendHealth = { error: String((e && e.message) || e) };
  }
  return info;
}

// ---- 原生桥：导出到本地文件（Node fs + 原生保存对话框） --------
async function exportAppInfo() {
  const info = await collectAppInfo();
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: "导出应用信息",
    defaultPath: "hellotime-electron-info.json",
    filters: [{ name: "JSON", extensions: ["json"] }],
  });
  if (canceled || !filePath) return { ok: false, canceled: true };
  await fs.writeFile(filePath, JSON.stringify(info, null, 2), "utf-8");
  return { ok: true, filePath };
}

// IPC：渲染层（desktop-aware 前端）也能触发，与原生菜单共用同一处理
ipcMain.handle("hello:app-info", () => collectAppInfo());
ipcMain.handle("hello:export-app-info", () => exportAppInfo());

// ---- 原生应用菜单（纯壳层能力，无需渲染层配合） ----------------
function buildMenu() {
  const isMac = process.platform === "darwin";
  const template = [
    ...(isMac ? [{ role: "appMenu" }] : []),
    {
      label: "胶囊",
      submenu: [
        {
          label: "导出应用信息为 JSON…",
          accelerator: "CmdOrCtrl+E",
          click: () =>
            exportAppInfo().catch((e) =>
              dialog.showErrorBox("导出失败", String((e && e.message) || e)),
            ),
        },
        { type: "separator" },
        { role: "reload", label: "重新加载" },
        { role: isMac ? "close" : "quit", label: "退出" },
      ],
    },
    { role: "viewMenu" },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 380, // 移动断点也能挤进来对照
    backgroundColor: "#06060c", // 对齐 --color-surface-0，规避加载白闪
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadURL(RENDERER_URL);
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  buildMenu();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// dev 工具语境：关窗即退出，让 ./run 前台进程结束、连带清理 Vite 子进程。
app.on("window-all-closed", () => {
  app.quit();
});
