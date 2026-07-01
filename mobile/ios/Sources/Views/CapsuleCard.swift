// 胶囊卡片（移动版）：广场 / 我创建 / 我收藏 共用。
// 显示 8 位码、实时倒计时、点开详情（NavigationLink，按 code 压栈）；右下角收藏或自定义槽。
// = desktop/swiftui CapsuleCard（去 hover/help，push 改 NavigationLink）。
import SwiftUI

struct CapsuleCard<RightSlot: View>: View {
    let capsule: CapsuleListItem
    var showCreator: Bool = true
    @ViewBuilder var rightSlot: () -> RightSlot

    private var opened: Bool { capsule.isOpened }
    private var accent: Color { opened ? Theme.capsuleOpenedAccent : Theme.capsuleSealedAccent }
    private var borderGradient: LinearGradient { opened ? Theme.gradientMintFlow : Theme.gradientCyberFlow }
    private var glow: Color { opened ? Theme.capsuleOpenedGlow : Theme.capsuleSealedGlow }

    var body: some View {
        VStack(alignment: .leading, spacing: Space.s3) {
            header
            NavigationLink(value: capsule.code) {
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
        .frame(maxWidth: .infinity, minHeight: 170, alignment: .topLeading)
        .background(Theme.surface1)
        .clipShape(RoundedRectangle(cornerRadius: Radius.lg, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: Radius.lg, style: .continuous)
            .strokeBorder(borderGradient, lineWidth: 1.5))
        .shadow(color: glow.opacity(0.6), radius: 10)
    }

    private var header: some View {
        HStack {
            Text(opened ? "已开启" : "未开启")
                .font(.system(size: FontSize.xs, weight: .semibold)).foregroundStyle(accent)
                .padding(.vertical, Space.s1).padding(.horizontal, Space.s2)
                .background(accent.opacity(0.12)).clipShape(Capsule())
            Spacer()
            NavigationLink(value: capsule.code) {
                Text(capsule.code)
                    .font(.system(size: FontSize.sm, weight: .semibold, design: .monospaced))
                    .foregroundStyle(Theme.textLink)
            }
            .buttonStyle(.plain)
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

extension CapsuleCard where RightSlot == FavoriteButton {
    init(capsule: CapsuleListItem, showCreator: Bool = true) {
        self.init(capsule: capsule, showCreator: showCreator,
                  rightSlot: { FavoriteButton(id: capsule.id, favoritedByMe: capsule.favoritedByMe, favoriteCount: capsule.favoriteCount) })
    }
}
