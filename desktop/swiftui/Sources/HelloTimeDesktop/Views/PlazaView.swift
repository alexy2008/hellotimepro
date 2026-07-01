// 广场：Hero + 工具栏（排序/过滤/搜索）+ 卡片网格 + 分页。匿名可浏览。

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

    private let columns = [GridItem(.adaptive(minimum: 290, maximum: 360), spacing: Space.s5)]

    var body: some View {
        VStack(spacing: 0) {
            hero
            Container {
                VStack(spacing: Space.s5) {
                    toolbar
                    grid
                    PaginationBar(page: page, totalPages: totalPages, total: total) { p in page = p; Task { await reload() } }
                }
                .padding(.vertical, Space.s6)
            }
        }
        .task { if !loaded { loaded = true; await reload() } }
        // 搜索防抖：query 变化后等 300ms 再请求
        .task(id: query) {
            guard loaded else { return }
            try? await Task.sleep(nanoseconds: 300_000_000)
            if Task.isCancelled { return }
            page = 1
            await reload()
        }
    }

    // MARK: - Hero

    private var hero: some View {
        Container {
            VStack(spacing: Space.s4) {
                (Text("封存此刻 ").foregroundStyle(Theme.textPrimary)
                    + Text("开启未来").foregroundStyle(Theme.brandGradient))
                    .font(.display(FontSize.display))
                    .multilineTextAlignment(.center)
                Text("写下此刻最真实的想法，设定一个解封时刻——明年生日、十年后的清晨，或任何值得等待的瞬间。时间到了，它才会被打开。")
                    .font(.system(size: FontSize.base))
                    .foregroundStyle(Theme.textSecondary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 640)
                HStack(spacing: Space.s3) {
                    Button {
                        store.navigate(to: store.isAuthenticated ? .create : .register)
                    } label: { Label("创建我的胶囊", systemImage: "sparkles") }
                        .buttonStyle(.ht(.heroPrimary, .lg))
                    Button { store.navigate(to: .open) } label: { Label("用胶囊码开启", systemImage: "lock.open") }
                        .buttonStyle(.ht(.heroSuccess, .lg))
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, Space.s12)
        }
        .background(heroBackground)
    }

    // 双层背景：底淡三色渐变 + 居中模糊紫光（对齐 cy-hero-block + ::before）
    private var heroBackground: some View {
        ZStack {
            Theme.gradientBrandSubtle
            RadialGradient(colors: [Theme.heroGlow, .clear], center: .center, startRadius: 0, endRadius: 320)
                .blur(radius: 40)
                .padding(.bottom, 80)
        }
        .clipped()
        .allowsHitTesting(false)
    }

    // MARK: - 工具栏

    private var toolbar: some View {
        HStack(spacing: Space.s4) {
            Segmented(selection: $sort, options: [("new", "✨ 最新"), ("hot", "🔥 热门")]) { page = 1; Task { await reload() } }
            Segmented(selection: $filter, options: [("all", "全部"), ("opened", "已开启"), ("unopened", "未开启")]) { page = 1; Task { await reload() } }
            Spacer()
            HStack(spacing: Space.s2) {
                Image(systemName: "magnifyingglass").foregroundStyle(Theme.textMuted)
                TextField("", text: $query, prompt: Text("搜索标题或昵称…").foregroundColor(Theme.textDisabled))
                    .textFieldStyle(.plain).foregroundStyle(Theme.textPrimary)
            }
            .padding(.vertical, Space.s2).padding(.horizontal, Space.s3)
            .background(Theme.surface3).clipShape(RoundedRectangle(cornerRadius: Radius.md, style: .continuous))
            .frame(maxWidth: 280)
            if loading { ProgressView().controlSize(.small) }
        }
        .padding(.bottom, Space.s2)
        .overlay(alignment: .bottom) { Divider().overlay(Theme.borderSubtle) }
    }

    @ViewBuilder
    private var grid: some View {
        if items.isEmpty && !loading {
            VStack(spacing: Space.s3) {
                Text("🌌").font(.system(size: 44))
                Text("广场暂无胶囊 —— 来当第一个写信给未来的人？").foregroundStyle(Theme.textMuted)
                Button(store.isAuthenticated ? "创建胶囊" : "注册并创建") {
                    store.navigate(to: store.isAuthenticated ? .create : .register)
                }.buttonStyle(.ht(.primary, .sm))
            }
            .frame(maxWidth: .infinity, minHeight: 280)
        } else {
            LazyVGrid(columns: columns, spacing: Space.s5) {
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

/// 分段控件（排序 / 过滤）。
struct Segmented: View {
    @Binding var selection: String
    let options: [(String, String)]
    let onChange: () -> Void

    var body: some View {
        HStack(spacing: 2) {
            ForEach(options, id: \.0) { (key, label) in
                let active = selection == key
                Button {
                    if selection != key { selection = key; onChange() }
                } label: {
                    Text(label).font(.system(size: FontSize.sm, weight: .medium))
                        .foregroundStyle(active ? Theme.signalOn : Theme.textSecondary)
                        .padding(.vertical, 6).padding(.horizontal, Space.s4)
                        .background(active ? Theme.signalPrimary : Color.clear)
                        .clipShape(Capsule())
                        .shadow(color: active ? Theme.signalGlow : .clear, radius: active ? 10 : 0)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(3)
        .background(Theme.surface2)
        .clipShape(Capsule())
        .overlay(Capsule().stroke(Theme.borderSubtle, lineWidth: 1))
    }
}
