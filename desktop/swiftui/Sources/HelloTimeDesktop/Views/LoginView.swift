// 登录页（对齐 React LoginPage）。

import SwiftUI

struct LoginView: View {
    @Environment(AppStore.self) private var store
    @State private var email = ""
    @State private var password = ""
    @State private var busy = false
    @State private var err: String?

    var body: some View {
        Container(maxWidth: 480) {
            VStack(spacing: Space.s5) {
                VStack(alignment: .leading, spacing: Space.s5) {
                    VStack(alignment: .leading, spacing: Space.s2) {
                        Text("欢迎回来").font(.display(FontSize.xxxl)).foregroundStyle(Theme.textPrimary)
                        Text("你留给未来的信，还在等你开启。").font(.system(size: FontSize.base)).foregroundStyle(Theme.textSecondary)
                    }
                    field("邮箱", text: $email, prompt: "you@example.com")
                    secure("密码", text: $password, prompt: "至少 8 位，含字母与数字")
                    Button { submit() } label: {
                        HStack { if busy { ProgressView().controlSize(.small) }; Text(busy ? "登录中…" : "登录") }
                    }
                    .buttonStyle(.ht(.primary, .lg, fullWidth: true)).disabled(busy || email.isEmpty || password.isEmpty)
                    HStack(spacing: Space.s1) {
                        Text("还没有账号？").font(.system(size: FontSize.sm)).foregroundStyle(Theme.textMuted)
                        Button("立即注册") { store.navigate(to: .register) }.buttonStyle(.plain)
                            .font(.system(size: FontSize.sm)).foregroundStyle(Theme.textLink)
                    }
                    .frame(maxWidth: .infinity)
                }
                .cardStyle(padding: Space.s8)
                if let err { HTAlert(variant: .danger, text: err) }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, Space.s12)
        }
    }

    private func field(_ l: String, text: Binding<String>, prompt: String) -> some View {
        VStack(alignment: .leading, spacing: Space.s2) {
            FieldLabel(text: l)
            TextField("", text: text, prompt: Text(prompt).foregroundColor(Theme.textDisabled)).fieldStyle()
        }
    }
    private func secure(_ l: String, text: Binding<String>, prompt: String) -> some View {
        VStack(alignment: .leading, spacing: Space.s2) {
            FieldLabel(text: l)
            SecureField("", text: text, prompt: Text(prompt).foregroundColor(Theme.textDisabled)).fieldStyle()
        }
    }

    private func submit() {
        busy = true; err = nil
        Task {
            defer { busy = false }
            do { try await store.login(email: email.trimmed, password: password) }
            catch { err = (error as? LocalizedError)?.errorDescription ?? "登录失败" }
        }
    }
}
