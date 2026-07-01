// 凭 8 位码开启：码输入 + 开启 / 粘贴识别。成功跳详情。

import SwiftUI
import AppKit

struct OpenView: View {
    @Environment(AppStore.self) private var store
    @State private var code = ""
    @State private var busy = false
    @State private var err: String?

    var body: some View {
        Container(maxWidth: Layout.containerNarrow) {
            VStack(spacing: Space.s6) {
                VStack(spacing: Space.s2) {
                    Text("用 8 位密钥开启胶囊")
                        .font(.display(FontSize.xxxl)).foregroundStyle(Theme.textPrimary)
                    Text("输入朋友分享给你的 8 位大写字母和数字，可直接查看胶囊。")
                        .font(.system(size: FontSize.base)).foregroundStyle(Theme.textSecondary)
                        .multilineTextAlignment(.center)
                }

                CapsuleCodeInput(code: $code, onComplete: { open($0) })

                HStack(spacing: Space.s3) {
                    Button { open(code) } label: {
                        HStack { if busy { ProgressView().controlSize(.small) }; Text(busy ? "查询中…" : "开启 →") }
                    }
                    .buttonStyle(.ht(.primary, .lg)).disabled(busy || code.count != 8)
                    Button("粘贴识别") { pasteRecognize() }.buttonStyle(.ht(.ghost, .lg))
                }

                HStack(spacing: Space.s4) {
                    Label("可用 /c/<code> 直链访问", systemImage: "link")
                    Label("未到时间的胶囊也会显示倒计时", systemImage: "lock")
                }
                .font(.system(size: FontSize.sm)).foregroundStyle(Theme.textMuted)

                if let err { HTAlert(variant: .danger, text: err).frame(maxWidth: 480) }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, Space.s12)
        }
    }

    private func open(_ c: String) {
        guard c.count == 8 else { return }
        busy = true; err = nil
        Task {
            defer { busy = false }
            do {
                let cap = try await store.api.capsule(byCode: c)
                store.push(.capsule(cap.code))
            } catch { err = (error as? LocalizedError)?.errorDescription ?? "找不到这条胶囊" }
        }
    }

    private func pasteRecognize() {
        let text = NSPasteboard.general.string(forType: .string) ?? ""
        let filtered = String(text.uppercased().filter { $0.isLetter || $0.isNumber }.prefix(8))
        code = filtered
        if filtered.count == 8 { open(filtered) }
    }
}
