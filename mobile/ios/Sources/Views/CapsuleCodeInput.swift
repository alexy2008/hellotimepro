// 8 位胶囊码输入（移动版）：一个隐藏 TextField 承接键盘输入（大写过滤、整串粘贴、
// 软键盘退格天然可用），上层 8 个格子按 code[i] 显示。点任意处聚焦。
// = desktop/swiftui CapsuleCodeInput（桌面用逐格 + onKeyPress，移动改隐藏字段更稳）。
import SwiftUI

struct CapsuleCodeInput: View {
    @Binding var code: String
    var onComplete: (String) -> Void

    @FocusState private var focused: Bool

    var body: some View {
        ZStack {
            // 隐藏输入框：承接真实键盘事件
            TextField("", text: Binding(
                get: { code },
                set: { handle($0) }
            ))
            .focused($focused)
            .keyboardType(.asciiCapable)
            .textInputAutocapitalization(.characters)
            .autocorrectionDisabled()
            .frame(width: 1, height: 1)
            .opacity(0.01)

            // 可见的 8 个格子
            HStack(spacing: Space.s2) {
                ForEach(0..<8, id: \.self) { i in
                    let ch = i < code.count ? String(Array(code)[i]) : ""
                    Text(ch)
                        .font(.system(size: FontSize.xl, weight: .semibold, design: .monospaced))
                        .foregroundStyle(Theme.textPrimary)
                        .frame(width: 38, height: 52)
                        .background(Theme.surface3)
                        .clipShape(RoundedRectangle(cornerRadius: Radius.md, style: .continuous))
                        .overlay(RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                            .stroke(focused && i == min(code.count, 7) ? Theme.borderFocus : Theme.borderDefault,
                                    lineWidth: focused && i == min(code.count, 7) ? 2 : 1))
                }
            }
            .contentShape(Rectangle())
            .onTapGesture { focused = true }
        }
        .onAppear { focused = true }
    }

    private func handle(_ raw: String) {
        let s = String(raw.uppercased().filter { $0.isLetter || $0.isNumber }.prefix(8))
        code = s
        if s.count == 8 { onComplete(s) }
    }
}
