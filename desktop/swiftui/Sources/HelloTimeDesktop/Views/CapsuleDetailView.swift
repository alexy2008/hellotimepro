// 胶囊详情：徽章/码/标题；已开→正文，未开→翻页时钟倒计时 + 到期自动开启轮询；
// 复制 8 位码 / 分享 / 收藏。对齐 React CapsuleDetail。

import SwiftUI
import AppKit

struct CapsuleDetailView: View {
    @Environment(AppStore.self) private var store
    let code: String

    @State private var cap: CapsuleDetail?
    @State private var err: String?
    @State private var loading = true
    @State private var codeCopied = false
    @State private var linkCopied = false

    var body: some View {
        Container(maxWidth: Layout.containerNarrow) {
            VStack(alignment: .leading, spacing: Space.s5) {
                if store.canGoBack {
                    Button { store.goBack() } label: { Label("返回", systemImage: "chevron.left") }
                        .buttonStyle(.ht(.ghost, .sm))
                }
                if loading {
                    ProgressView().frame(maxWidth: .infinity, minHeight: 280)
                } else if let cap {
                    detail(cap)
                } else {
                    VStack(spacing: Space.s4) {
                        HTAlert(variant: .danger, text: err ?? "胶囊不存在")
                        Button("返回输入码") { store.navigate(to: .open) }.buttonStyle(.ht(.ghost, .md))
                    }
                    .frame(maxWidth: 480).frame(maxWidth: .infinity).padding(.top, Space.s12)
                }
            }
            .padding(.vertical, Space.s8)
        }
        .task(id: code) { await load() }
        .task(id: cap?.openAt) { await autoOpenLoop() }
    }

    // MARK: - 详情主体

    @ViewBuilder
    private func detail(_ c: CapsuleDetail) -> some View {
        let opened = c.isOpened
        VStack(alignment: .leading, spacing: Space.s5) {
            // 徽章行
            HStack(spacing: Space.s2) {
                badge(opened ? "已开启" : "未开启", color: opened ? Theme.capsuleOpenedAccent : Theme.capsuleSealedAccent)
                if c.inPlaza { badge("广场公开", color: Theme.brandPrimary) }
                Text(c.code).font(.system(size: FontSize.sm, weight: .semibold, design: .monospaced)).foregroundStyle(Theme.textLink)
                Text("· 创建于 \(DateUtil.fmtDateTime(c.createdAt))").font(.system(size: FontSize.sm)).foregroundStyle(Theme.textMuted)
            }

            Text(c.title).font(.display(FontSize.xxxxl)).foregroundStyle(Theme.textPrimary)

            if opened, let content = c.content {
                HStack(spacing: Space.s2) {
                    Image(systemName: "lock.open.fill").foregroundStyle(Theme.capsuleOpenedAccent)
                    Text("开启于 ").foregroundStyle(Theme.textMuted)
                    + Text(DateUtil.fmtDateTime(c.openAt)).foregroundStyle(Theme.capsuleOpenedAccent)
                }
                .font(.system(size: FontSize.sm))
                Text(content)
                    .font(.system(size: FontSize.base)).foregroundStyle(Theme.textSecondary)
                    .textSelection(.enabled).fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(Space.s5).background(Theme.surface1)
                    .clipShape(RoundedRectangle(cornerRadius: Radius.lg, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: Radius.lg, style: .continuous).stroke(Theme.borderSubtle, lineWidth: 1))
            } else {
                sealed(c)
            }

            footer(c)

            if !opened {
                HTAlert(variant: .info, text: "未开启的胶囊仅显示标题与倒计时，内容将在开启后公开。")
            } else if c.inPlaza {
                HTAlert(variant: .success, text: "这条胶囊已在广场公开，任何人都可以通过广场或 8 位码访问。")
            }
        }
    }

    private func sealed(_ c: CapsuleDetail) -> some View {
        VStack(spacing: Space.s4) {
            Text("🔒").font(.system(size: FontSize.xxxxl))
            Text("这封信还在上锁，将在以下时刻开启")
                .font(.system(size: FontSize.sm)).foregroundStyle(Theme.textSecondary).tracking(2)
            TimelineView(.periodic(from: .now, by: 1)) { ctx in
                let cd = DateUtil.countdown(toISO: c.openAt, now: ctx.date)
                HStack(alignment: .top, spacing: Space.s3) {
                    FlipUnit(value: cd.days, label: "天")
                    sep; FlipUnit(value: cd.hours, label: "时")
                    sep; FlipUnit(value: cd.minutes, label: "分")
                    sep; FlipUnit(value: cd.seconds, label: "秒")
                }
            }
            Text("开启于 ").foregroundStyle(Theme.textSecondary)
                + Text(DateUtil.fmtDateTime(c.openAt)).foregroundStyle(Theme.textPrimary).bold()
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Space.s8)
        .background(Theme.surface1)
        .clipShape(RoundedRectangle(cornerRadius: Radius.xl, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: Radius.xl, style: .continuous).stroke(Theme.capsuleSealedBorder.opacity(0.5), lineWidth: 1))
    }

    private var sep: some View {
        Text(":").font(.system(size: FontSize.xxxl, weight: .bold)).foregroundStyle(Theme.textMuted).padding(.top, Space.s2)
    }

    private func footer(_ c: CapsuleDetail) -> some View {
        HStack(spacing: Space.s3) {
            HStack(spacing: Space.s2) {
                Text("来自").font(.system(size: FontSize.sm)).foregroundStyle(Theme.textSecondary)
                AvatarView(avatarId: c.creator.avatarId, nickname: c.creator.nickname, size: 28)
                Text(c.creator.nickname).font(.system(size: FontSize.sm, weight: .semibold)).foregroundStyle(Theme.textPrimary)
            }
            Spacer()
            Button { copyCode(c.code) } label: { Label(codeCopied ? "已复制!" : "复制 8 位码", systemImage: codeCopied ? "checkmark" : "doc.on.doc") }
                .buttonStyle(.ht(.ghost, .sm))
            Button { copyLink(c.code) } label: { Label(linkCopied ? "已复制!" : "分享", systemImage: linkCopied ? "checkmark" : "square.and.arrow.up") }
                .buttonStyle(.ht(.ghost, .sm))
            FavoriteButton(id: c.id, favoritedByMe: c.favoritedByMe, favoriteCount: c.favoriteCount, size: .md) { fav, count in
                cap = CapsuleDetail(id: c.id, code: c.code, title: c.title, creator: c.creator, openAt: c.openAt,
                                    createdAt: c.createdAt, inPlaza: c.inPlaza, favoriteCount: count, isOpened: c.isOpened,
                                    favoritedByMe: fav, content: c.content)
            }
        }
        .padding(.top, Space.s2)
    }

    private func badge(_ text: String, color: Color) -> some View {
        Text(text).font(.system(size: FontSize.xs, weight: .semibold)).foregroundStyle(color)
            .padding(.vertical, Space.s1).padding(.horizontal, Space.s2)
            .background(color.opacity(0.12)).clipShape(Capsule())
    }

    // MARK: - 数据 / 动作

    private func load(showLoading: Bool = true) async {
        if showLoading { loading = true }
        defer { if showLoading { loading = false } }
        do { cap = try await store.api.capsule(byCode: code.uppercased()); err = nil }
        catch { err = (error as? LocalizedError)?.errorDescription ?? "胶囊不存在"; if showLoading { cap = nil } }
    }

    /// 到期后自动刷新开启状态（对齐 React onExpired 轮询）。
    private func autoOpenLoop() async {
        guard let c = cap, !c.isOpened, let openAt = DateUtil.parse(c.openAt) else { return }
        let wait = max(0, openAt.timeIntervalSinceNow + 0.25)
        try? await Task.sleep(nanoseconds: UInt64(wait * 1_000_000_000))
        while !Task.isCancelled {
            await load(showLoading: false)
            if cap?.isOpened == true { break }
            try? await Task.sleep(nanoseconds: 1_000_000_000)
        }
    }

    private func copyCode(_ s: String) {
        NSPasteboard.general.clearContents(); NSPasteboard.general.setString(s, forType: .string)
        codeCopied = true
        Task { try? await Task.sleep(nanoseconds: 2_000_000_000); codeCopied = false }
    }
    private func copyLink(_ s: String) {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString("用胶囊码 \(s) 在 HelloTime Pro 打开（开启 → 输入码）", forType: .string)
        linkCopied = true
        Task { try? await Task.sleep(nanoseconds: 2_000_000_000); linkCopied = false }
    }
}

/// 翻页时钟单元：用 numericText 内容过渡实现原生数字滚动。
private struct FlipUnit: View {
    let value: Int
    let label: String
    var body: some View {
        VStack(spacing: Space.s2) {
            Text(DateUtil.pad2(value))
                .font(.system(size: FontSize.xxxxl, weight: .bold, design: .monospaced))
                .foregroundStyle(Theme.capsuleSealedAccent)
                .contentTransition(.numericText(countsDown: true))
                .animation(.snappy, value: value)
                .frame(minWidth: 64)
                .padding(.vertical, Space.s3).padding(.horizontal, Space.s2)
                .background(Theme.surface2)
                .clipShape(RoundedRectangle(cornerRadius: Radius.md, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: Radius.md, style: .continuous).stroke(Theme.borderSubtle, lineWidth: 1))
                .overlay(Rectangle().fill(Theme.surface0.opacity(0.5)).frame(height: 1), alignment: .center)
            Text(label).font(.system(size: FontSize.xs)).foregroundStyle(Theme.textMuted)
        }
    }
}
