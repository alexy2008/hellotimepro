// 胶囊卡片：广场 / 我创建 / 我收藏 共用。
// 显示 8 位码、实时倒计时（每秒刷新）、整卡点开详情；右下角收藏或自定义槽位。

import SwiftUI

struct CapsuleCard<RightSlot: View>: View {
    @Environment(AppStore.self) private var store
    let capsule: CapsuleListItem
    var showCreator: Bool = true
    @ViewBuilder var rightSlot: () -> RightSlot

    @State private var hovering = false
    @State private var breathe = false

    private var opened: Bool { capsule.isOpened }
    private var accent: Color { opened ? Theme.capsuleOpenedAccent : Theme.capsuleSealedAccent }
    private var borderGradient: LinearGradient { opened ? Theme.gradientMintFlow : Theme.gradientCyberFlow }
    private var glow: Color { opened ? Theme.capsuleOpenedGlow : Theme.capsuleSealedGlow }

    var body: some View {
        VStack(alignment: .leading, spacing: Space.s3) {
            header
            Button { store.push(.capsule(capsule.code)) } label: {
                Text(capsule.title)
                    .font(.system(size: FontSize.lg, weight: .semibold))
                    .foregroundStyle(Theme.textPrimary)
                    .multilineTextAlignment(.leading)
                    .lineLimit(2)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .buttonStyle(.plain)

            body2
            Spacer(minLength: 0)
            footer
        }
        .padding(Space.s5)
        .frame(maxWidth: .infinity, minHeight: 190, alignment: .topLeading)
        .background(Theme.surface1)
        .clipShape(RoundedRectangle(cornerRadius: Radius.lg, style: .continuous))
        // 流光渐变描边 + 状态色外发光（对齐 cyber.css 的 border-box 渐变 + glow）
        .overlay(RoundedRectangle(cornerRadius: Radius.lg, style: .continuous)
            .strokeBorder(borderGradient, lineWidth: 1.5))
        .shadow(color: glow.opacity(hovering ? 1 : 0.7), radius: hovering ? 22 : 10)
        // hover：上浮 + 呼吸（轻微缩放，repeatForever，仅悬停时）
        .scaleEffect(breathe ? 1.015 : 1.0)
        .offset(y: hovering ? -2 : 0)
        .animation(.easeInOut(duration: 0.25), value: hovering)
        .onHover { h in
            hovering = h
            if h {
                withAnimation(.easeInOut(duration: 1.6).repeatForever(autoreverses: true)) { breathe = true }
            } else {
                withAnimation(.easeInOut(duration: 0.25)) { breathe = false }
            }
        }
    }

    private var header: some View {
        HStack {
            Text(opened ? "已开启" : "未开启")
                .font(.system(size: FontSize.xs, weight: .semibold)).foregroundStyle(accent)
                .padding(.vertical, Space.s1).padding(.horizontal, Space.s2)
                .background(accent.opacity(0.12)).clipShape(Capsule())
            Spacer()
            Button { store.push(.capsule(capsule.code)) } label: {
                Text(capsule.code)
                    .font(.system(size: FontSize.sm, weight: .semibold, design: .monospaced))
                    .foregroundStyle(Theme.textLink)
            }
            .buttonStyle(.plain)
            .help("打开胶囊 \(capsule.code)")
        }
    }

    @ViewBuilder
    private var body2: some View {
        if !opened {
            TimelineView(.periodic(from: .now, by: 1)) { ctx in
                let cd = DateUtil.countdown(toISO: capsule.openAt, now: ctx.date)
                Text("⏳ 还剩 \(cd.days) 天 · \(DateUtil.pad2(cd.hours)):\(DateUtil.pad2(cd.minutes)):\(DateUtil.pad2(cd.seconds))")
                    .font(.system(size: FontSize.sm, weight: .medium, design: .monospaced))
                    .foregroundStyle(Theme.capsuleSealedAccent)
            }
        } else if let p = capsule.contentPreview, !p.isEmpty {
            Text(p).font(.system(size: FontSize.sm)).foregroundStyle(Theme.textMuted).lineLimit(3)
        }
    }

    private var footer: some View {
        HStack(spacing: Space.s2) {
            if showCreator {
                AvatarView(avatarId: capsule.creator.avatarId, nickname: capsule.creator.nickname, size: 22)
                Text(capsule.creator.nickname).font(.system(size: FontSize.xs)).foregroundStyle(Theme.textMuted)
            } else {
                Text("创建于 \(DateUtil.fmtDate(capsule.createdAt))").font(.system(size: FontSize.xs)).foregroundStyle(Theme.textMuted)
            }
            Spacer()
            rightSlot()
        }
    }
}

// 便捷构造：右下角默认放收藏按钮（广场 / 我收藏的）。
extension CapsuleCard where RightSlot == FavoriteButton {
    init(capsule: CapsuleListItem, showCreator: Bool = true) {
        self.init(capsule: capsule, showCreator: showCreator,
                  rightSlot: { FavoriteButton(id: capsule.id, favoritedByMe: capsule.favoritedByMe, favoriteCount: capsule.favoriteCount) })
    }
}
