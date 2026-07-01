// 广场（移动版）：紧凑 Hero + 工具栏（排序/过滤/搜索）+ 单列卡片 + 分页。匿名可浏览。
// 卡片点开经 navigationDestination(code) 压栈详情。= desktop/swiftui PlazaView 适配移动 IA。
import SwiftUI

struct PlazaView: View {
    @Environment(AppStore.self) private var store

    @State private var items: [CapsuleListItem] = []
    @State private var sort = "new"
    @State private var filter = "all"
    @State private var query = ""
    @State private var page = 1
    @State private var totalPages = 1
    @State private var total = 0
    @State private var loading = false
    @State private var loaded = false
    @State private var showAbout = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: Space.s5) {
                    hero
                    toolbar
                    grid
                    PaginationBar(page: page, totalPages: totalPages, total: total) { p in page = p; Task { await reload() } }
                }
                .padding(.horizontal, Space.s4)
                .padding(.bottom, Space.s8)
            }
            .background(Theme.surface0)
            .navigationTitle("广场")
            .navigationBarTitleDisplayMode(.inline)
            // 移动版无全局 header：主题切换 + 关于放广场工具栏（匿名可访问，对齐 mobile.html 原型）。
            .toolbar {
                ToolbarItemGroup(placement: .topBarTrailing) {
                    Button { withAnimation(.easeInOut) { store.toggleTheme() } } label: {
                        Image(systemName: store.theme == .dark ? "moon.stars.fill" : "sun.max.fill")
                    }
                    .accessibilityLabel("切换主题")
                    Button { showAbout = true } label: { Image(systemName: "info.circle") }
                        .accessibilityLabel("关于")
                }
            }
            .navigationDestination(for: String.self) { code in CapsuleDetailView(code: code) }
        }
        .sheet(isPresented: $showAbout) {
            NavigationStack {
                AboutView()
                    .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("完成") { showAbout = false } } }
            }
        }
        .task { if !loaded { loaded = true; await reload() } }
        .task(id: query) {
            guard loaded else { return }
            try? await Task.sleep(nanoseconds: 300_000_000)
            if Task.isCancelled { return }
            page = 1
            await reload()
        }
    }

    private var hero: some View {
        VStack(spacing: Space.s3) {
            (Text("封存此刻 ").foregroundStyle(Theme.textPrimary)
                + Text("开启未来").foregroundStyle(Theme.brandGradient))
                .font(.system(size: FontSize.xxxl, weight: .bold, design: .rounded))
                .multilineTextAlignment(.center)
            Text("写下此刻最真实的想法，设定一个解封时刻——时间到了，它才会被打开。")
                .font(.system(size: FontSize.sm)).foregroundStyle(Theme.textSecondary)
                .multilineTextAlignment(.center)
            // 等宽 flex（fullWidth）+ 纯文字（对齐 RN，去图标以免小屏折行）。
            HStack(spacing: Space.s3) {
                Button("创建胶囊") { store.selectTab(.create) }
                    .buttonStyle(.ht(.heroPrimary, .md, fullWidth: true))
                Button("用码开启") { store.selectTab(.open) }
                    .buttonStyle(.ht(.heroSuccess, .md, fullWidth: true))
            }
            .lineLimit(1)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Space.s6)
        .background(
            ZStack {
                Theme.gradientBrandSubtle
                RadialGradient(colors: [Theme.heroGlow, .clear], center: .center, startRadius: 0, endRadius: 220).blur(radius: 36)
            }.clipped().allowsHitTesting(false)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radius.xl, style: .continuous))
    }

    private var toolbar: some View {
        // 排序 / 筛选 / 搜索：三行竖排，前两行等分全宽（对齐 RN，布局整齐）。
        VStack(spacing: Space.s3) {
            Segmented(selection: $sort, options: [("new", "✨ 最新"), ("hot", "🔥 热门")]) { page = 1; Task { await reload() } }
            Segmented(selection: $filter, options: [("all", "全部"), ("opened", "已开启"), ("unopened", "未开启")]) { page = 1; Task { await reload() } }
            HStack(spacing: Space.s2) {
                Image(systemName: "magnifyingglass").foregroundStyle(Theme.textMuted)
                TextField("", text: $query, prompt: Text("搜索标题或昵称…").foregroundColor(Theme.textDisabled))
                    .textFieldStyle(.plain).foregroundStyle(Theme.textPrimary)
                    .textInputAutocapitalization(.never)
            }
            .padding(.vertical, Space.s2).padding(.horizontal, Space.s3)
            .background(Theme.surface3).clipShape(RoundedRectangle(cornerRadius: Radius.md, style: .continuous))
        }
    }

    @ViewBuilder
    private var grid: some View {
        if loading && items.isEmpty {
            ProgressView().frame(maxWidth: .infinity, minHeight: 240)
        } else if items.isEmpty {
            VStack(spacing: Space.s3) {
                Text("🌌").font(.system(size: 44))
                Text("广场暂无胶囊 —— 来当第一个写信给未来的人？")
                    .foregroundStyle(Theme.textMuted).multilineTextAlignment(.center)
                Button(store.isAuthenticated ? "创建胶囊" : "注册并创建") { store.selectTab(.create) }
                    .buttonStyle(.ht(.primary, .sm))
            }
            .frame(maxWidth: .infinity, minHeight: 240)
        } else {
            LazyVStack(spacing: Space.s4) {
                ForEach(items) { item in CapsuleCard(capsule: item) }
            }
        }
    }

    private func reload() async {
        loading = true
        defer { loading = false }
        do {
            let r = try await store.api.plaza(sort: sort, filter: filter, q: query, page: page)
            items = r.items; totalPages = max(r.pagination.totalPages, 1); total = r.pagination.total
        } catch { store.report(error) }
    }
}

/// 分段控件（排序 / 过滤）。= desktop Segmented（跨平台）。
struct Segmented: View {
    @Binding var selection: String
    let options: [(String, String)]
    let onChange: () -> Void
    var body: some View {
        HStack(spacing: 3) {
            ForEach(options, id: \.0) { (key, label) in
                let active = selection == key
                Button {
                    if selection != key { selection = key; onChange() }
                } label: {
                    Text(label).font(.system(size: FontSize.sm, weight: active ? .semibold : .medium))
                        .foregroundStyle(active ? Theme.signalOn : Theme.textSecondary)
                        .lineLimit(1)
                        .frame(maxWidth: .infinity)          // 等分全宽（对齐 RN 的 flex:1）
                        .padding(.vertical, 6)
                        .background(active ? Theme.signalPrimary : Color.clear)
                        .clipShape(Capsule())
                        .shadow(color: active ? Theme.signalGlow : .clear, radius: active ? 10 : 0)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(3)
        .frame(maxWidth: .infinity)
        .background(Theme.surface2)
        .clipShape(Capsule())
        .overlay(Capsule().stroke(Theme.borderSubtle, lineWidth: 1))
    }
}
