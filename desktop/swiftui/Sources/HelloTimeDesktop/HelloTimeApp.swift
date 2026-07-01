// ============================================================
// @main 入口。
//
// SwiftPM 可执行包（非 .app bundle）直接 swift run 启动；裸可执行默认不是常规 GUI app，
// 故在 AppDelegate 显式 setActivationPolicy(.regular) + activate，表现为正常前台 macOS app。
//
// 原生菜单：通过 .commands 注入「前往 / 视图」菜单，把导航与主题切换接到系统菜单栏 ——
// 这正是「macOS 风格菜单」的原生表达，纯 Web 壳做不到。
// ============================================================

import SwiftUI
import AppKit

final class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        NSApp.activate(ignoringOtherApps: true)
    }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
}

@main
struct HelloTimeApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @State private var store = AppStore()

    var body: some Scene {
        WindowGroup("HelloTime Pro") {
            RootView()
                .environment(store)
                .frame(minWidth: 980, minHeight: 680)
                .preferredColorScheme(store.theme == .dark ? .dark : .light)
                .onAppear { store.bootstrap() }
        }
        .windowStyle(.titleBar)
        .defaultSize(width: 1180, height: 820)
        .commands {
            CommandGroup(after: .sidebar) {
                Button("切换深色 / 浅色") { store.toggleTheme() }
                    .keyboardShortcut("d", modifiers: [.command, .shift])
            }
            CommandMenu("前往") {
                Button("广场") { store.navigate(to: .plaza) }.keyboardShortcut("1", modifiers: .command)
                Button("开启胶囊") { store.navigate(to: .open) }.keyboardShortcut("2", modifiers: .command)
                Button("创建胶囊") { store.navigate(to: .create) }.keyboardShortcut("n", modifiers: .command)
                Button("关于") { store.navigate(to: .about) }
                Divider()
                Button("我创建的") { store.navigate(to: .meCreated) }
                Button("我收藏的") { store.navigate(to: .meFavorites) }
                Button("账号设置") { store.navigate(to: .meProfile) }
                Divider()
                Button("返回") { store.goBack() }.keyboardShortcut("[", modifiers: .command).disabled(!store.canGoBack)
            }
        }
    }
}
