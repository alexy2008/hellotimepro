// 创建页「AI 推荐主题」：灵感标签 + 换一批（对齐 React RecommendationStrip）。

import SwiftUI

struct RecommendationStrip: View {
    let recos: [CapsuleRecommendation]
    let busy: Bool
    var disabled: Bool = false
    let onPick: (CapsuleRecommendation) -> Void
    let onRefresh: () -> Void

    private let palette: [Color] = [Theme.brandPrimary, Theme.accentPrimary, Theme.signalPrimary]

    var body: some View {
        VStack(alignment: .leading, spacing: Space.s3) {
            HStack {
                FieldLabel(text: "✨ 没有头绪？试试这些灵感")
                Spacer()
                Button(busy ? "换一批中…" : "换一批") { onRefresh() }
                    .buttonStyle(.ht(.ghost, .sm)).disabled(busy || disabled)
            }
            FlowChips(recos: recos, palette: palette, busy: busy, disabled: disabled, onPick: onPick)
        }
    }
}

/// 自动换行的标签流。
private struct FlowChips: View {
    let recos: [CapsuleRecommendation]
    let palette: [Color]
    let busy: Bool
    let disabled: Bool
    let onPick: (CapsuleRecommendation) -> Void

    var body: some View {
        let cols = [GridItem(.adaptive(minimum: 110, maximum: 220), spacing: Space.s2, alignment: .leading)]
        LazyVGrid(columns: cols, alignment: .leading, spacing: Space.s2) {
            ForEach(Array(recos.enumerated()), id: \.element.id) { (i, reco) in
                Button { onPick(reco) } label: {
                    Text(reco.title).font(.system(size: FontSize.sm)).foregroundStyle(Theme.textSecondary)
                        .lineLimit(1)
                        .padding(.vertical, Space.s2).padding(.horizontal, Space.s3)
                        .overlay(Capsule().stroke(palette[i % palette.count], lineWidth: 1))
                }
                .buttonStyle(.plain)
                .help(reco.hint)
                .disabled(busy || disabled)
            }
        }
    }
}
