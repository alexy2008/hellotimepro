// ============================================================
// HelloTime Pro · Tauri 壳层（Rust）
//
// Tauri 的壳哲学：**借系统 WebView** 渲染内嵌 Web 前端，
// 壳层用 **Rust** 编写，与渲染层通过 **command（#[tauri::command]）** 通信。
// 对照 desktop/electron（自带 Chromium + Node 壳 + IPC）。
//
// dev 模式加载 frontends/svelte 的 Vite dev server（由 ./run 拉起，端口 7191），
// 前端自带的 /api → :9080 代理原样复用 —— 桌面壳不碰 API 契约。
//
// 原生桥示例「导出应用信息」：原生菜单 / command → 原生保存对话框 → Rust std::fs 写文件。
// 这是 Electron 侧 Node fs + IPC 的对照样本。
// ============================================================
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::menu::{Menu, MenuItem, Submenu};
use tauri::Emitter;
use tauri_plugin_dialog::DialogExt;

/// 收集壳层 / 平台信息。
///
/// 注：刻意不抓后端健康。Node 主进程自带 fetch（Electron 侧免费），
/// 而 Rust 要抓 HTTP 得引入 reqwest（显著拉长编译）——这个不对称本身就是
/// 「同一功能、两套壳」的教学点。一个 desktop-aware 前端可经 invoke 把
/// 已加载的数据交给壳层导出。
fn build_app_info() -> serde_json::Value {
    let now_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    serde_json::json!({
        "app": "HelloTime Pro · Tauri 桌面壳",
        "shell": "Tauri",
        "rendering": "系统 WebView",
        "shellLanguage": "Rust",
        "embeddedFrontend": "frontends/svelte",
        "rendererUrl": "http://localhost:7191",
        "backendUrl": "http://localhost:9080",
        "platform": format!("{} {}", std::env::consts::OS, std::env::consts::ARCH),
        "tauri": env!("CARGO_PKG_VERSION"),
        "backendHealthNote": "后端健康未由壳层抓取：Rust 需 reqwest（重编译）；Node 主进程自带 fetch。",
        "exportedAtUnixMs": now_ms,
    })
}

/// 原生桥核心：弹原生保存对话框，拿到路径后用 Rust std::fs 写 JSON。
fn export_app_info_flow(app: &tauri::AppHandle) {
    let json = serde_json::to_string_pretty(&build_app_info()).unwrap_or_default();
    let app2 = app.clone();
    app.dialog()
        .file()
        .set_file_name("hellotime-tauri-info.json")
        .add_filter("JSON", &["json"])
        .save_file(move |maybe_path| {
            let Some(path) = maybe_path else { return };
            let Some(p) = path.as_path() else { return };
            match std::fs::write(p, json.as_bytes()) {
                Ok(_) => {
                    let _ = app2.emit("hello://exported", p.display().to_string());
                }
                Err(e) => {
                    let _ = app2.emit("hello://export-error", e.to_string());
                }
            }
        });
}

/// 渲染层可调用的 command（与原生菜单共用同一流程）。
#[tauri::command]
fn export_app_info(app: tauri::AppHandle) {
    export_app_info_flow(&app);
}

/// 渲染层可调用的 command：返回壳信息。
#[tauri::command]
fn app_info() -> serde_json::Value {
    build_app_info()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![export_app_info, app_info])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            // 原生应用菜单：胶囊 → 导出应用信息为 JSON…
            let export = MenuItem::with_id(
                app,
                "export_app_info",
                "导出应用信息为 JSON…",
                true,
                Some("CmdOrCtrl+E"),
            )?;
            let submenu = Submenu::with_items(app, "胶囊", true, &[&export])?;
            let menu = Menu::with_items(app, &[&submenu])?;
            app.set_menu(menu)?;
            Ok(())
        })
        .on_menu_event(|app, event| {
            if event.id().as_ref() == "export_app_info" {
                export_app_info_flow(app);
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
