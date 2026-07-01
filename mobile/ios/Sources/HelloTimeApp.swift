// HelloTime Pro · iOS 原生入口。底部 Tab Bar（广场/开启/创建/我的）+ splash + 登录 sheet。
// 对标 ui-prototype/mobile.html 的移动 IA；逻辑层复用自 desktop/swiftui。
import SwiftUI

@main
struct HelloTimeApp: App {
    @State private var store = AppStore()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(store)
                .preferredColorScheme(store.theme == .dark ? .dark : .light)
                .tint(Theme.signalPrimary)
                .task { store.bootstrap() }
        }
    }
}

/// 根：splash 短暂展示后进入 TabView；受保护 Tab 未登录弹登录 sheet。
struct RootView: View {
    @Environment(AppStore.self) private var store
    @State private var showSplash = true

    var body: some View {
        @Bindable var store = store
        ZStack {
            Theme.surface0.ignoresSafeArea()

            TabView(selection: Binding(
                get: { store.selectedTab },
                set: { store.selectTab($0) }
            )) {
                // 各 Tab 自带 NavigationStack（独立导航 + 可程序化压栈详情）。
                PlazaView()
                    .tabItem { Label("广场", systemImage: "square.grid.2x2") }.tag(Tab.plaza)
                OpenView()
                    .tabItem { Label("开启", systemImage: "lock.open") }.tag(Tab.open)
                CreateView()
                    .tabItem { Label("创建", systemImage: "plus.circle") }.tag(Tab.create)
                MeView()
                    .tabItem { Label("我的", systemImage: "person.crop.circle") }.tag(Tab.me)
            }

            if showSplash { SplashView().transition(.opacity) }
        }
        .sheet(isPresented: $store.showAuthSheet) { AuthSheet() }
        .overlay(alignment: .top) {
            if let banner = store.banner { BannerView(text: banner) { store.banner = nil } }
        }
        .task {
            try? await Task.sleep(nanoseconds: 900_000_000)
            withAnimation(.easeOut(duration: 0.35)) { showSplash = false }
        }
    }
}

/// 启动页（霓虹标题 + 加载点）。
struct SplashView: View {
    var body: some View {
        ZStack {
            Theme.surface0.ignoresSafeArea()
            VStack(spacing: Space.s4) {
                Text("⏳").font(.system(size: 56))
                (Text("HelloTime ").foregroundStyle(Theme.textPrimary)
                    + Text("Pro").foregroundStyle(Theme.brandGradient))
                    .font(.system(size: FontSize.xxxl, weight: .bold, design: .rounded))
                Text("封存此刻 · 开启未来").foregroundStyle(Theme.textMuted).font(.system(size: FontSize.sm))
            }
        }
    }
}

struct BannerView: View {
    let text: String
    let onClose: () -> Void
    var body: some View {
        HStack(spacing: Space.s3) {
            Image(systemName: "exclamationmark.triangle.fill").foregroundStyle(Theme.warningFg)
            Text(text).font(.system(size: FontSize.sm, weight: .medium)).foregroundStyle(Theme.textPrimary)
            Spacer(minLength: Space.s4)
            Button(action: onClose) { Image(systemName: "xmark").foregroundStyle(Theme.textMuted) }
        }
        .padding(Space.s3)
        .background(.regularMaterial, in: Capsule())
        .padding(.horizontal, Space.s4)
        .shadow(color: .black.opacity(0.3), radius: 12, y: 4)
    }
}
