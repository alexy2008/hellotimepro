// 「我的」Tab（移动版）：个人头 + 链接（我创建的/我收藏的/账号设置/关于）+ 登出。
// 子屏经 NavigationStack 压栈。= desktop/swiftui MeView（侧栏 IA 改为移动列表导航）。
import SwiftUI

enum MeRoute: Hashable { case created, favorites, profile, about }

struct MeView: View {
    @Environment(AppStore.self) private var store

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Space.s4) {
                    header
                    linkRow("我创建的", icon: "square.and.pencil", route: .created)
                    linkRow("我收藏的", icon: "heart", route: .favorites)
                    linkRow("账号设置", icon: "gearshape", route: .profile)
                    linkRow("关于", icon: "info.circle", route: .about)
                    Button { Task { await store.logout() } } label: {
                        Label("登出", systemImage: "arrow.backward.square")
                            .font(.system(size: FontSize.base, weight: .medium)).foregroundStyle(Theme.dangerFg)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(Space.s4)
                            .background(Theme.surface1).clipShape(RoundedRectangle(cornerRadius: Radius.lg))
                    }
                    .buttonStyle(.plain)
                }
                .padding(Space.s4)
            }
            .background(Theme.surface0)
            .navigationTitle("我的").navigationBarTitleDisplayMode(.inline)
            .navigationDestination(for: MeRoute.self) { route in
                switch route {
                case .created:   MeCreatedContent()
                case .favorites: MeFavoritesContent()
                case .profile:   MeProfileContent()
                case .about:     AboutView()
                }
            }
            .navigationDestination(for: String.self) { code in CapsuleDetailView(code: code) }
        }
    }

    private var header: some View {
        HStack(spacing: Space.s3) {
            if let u = store.currentUser {
                AvatarView(avatarId: u.avatarId, nickname: u.nickname, size: 56)
                VStack(alignment: .leading, spacing: 2) {
                    Text(u.nickname).font(.system(size: FontSize.lg, weight: .semibold)).foregroundStyle(Theme.textPrimary)
                    Text(u.email).font(.system(size: FontSize.sm)).foregroundStyle(Theme.textMuted)
                }
            }
            Spacer()
        }
        .padding(Space.s4)
        .background(Theme.surface1).clipShape(RoundedRectangle(cornerRadius: Radius.lg))
    }

    private func linkRow(_ title: String, icon: String, route: MeRoute) -> some View {
        NavigationLink(value: route) {
            HStack(spacing: Space.s3) {
                Image(systemName: icon).foregroundStyle(Theme.signalPrimary).frame(width: 24)
                Text(title).font(.system(size: FontSize.base)).foregroundStyle(Theme.textPrimary)
                Spacer()
                Image(systemName: "chevron.right").font(.system(size: FontSize.sm)).foregroundStyle(Theme.textMuted)
            }
            .padding(Space.s4)
            .background(Theme.surface1).clipShape(RoundedRectangle(cornerRadius: Radius.lg))
        }
        .buttonStyle(.plain)
    }
}

// MARK: - 我创建的

private struct MeCreatedContent: View {
    @Environment(AppStore.self) private var store
    @State private var items: [CapsuleListItem] = []
    @State private var page = 1
    @State private var totalPages = 1
    @State private var total = 0
    @State private var loading = false
    @State private var pendingDelete: CapsuleListItem?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Space.s4) {
                HStack {
                    Text("共 \(total) 条").font(.system(size: FontSize.sm)).foregroundStyle(Theme.textMuted)
                    Spacer()
                    Button("+ 新建") { store.selectTab(.create) }.buttonStyle(.ht(.primary, .sm))
                }
                if loading && items.isEmpty {
                    ProgressView().frame(maxWidth: .infinity, minHeight: 200)
                } else if items.isEmpty {
                    empty("📭", "还没有创建任何胶囊", cta: "去创建一个") { store.selectTab(.create) }
                } else {
                    LazyVStack(spacing: Space.s4) {
                        ForEach(items) { c in
                            CapsuleCard(capsule: c, showCreator: false) {
                                if c.isOpened {
                                    Label("\(c.favoriteCount)", systemImage: "heart.fill").font(.system(size: FontSize.xs)).foregroundStyle(Theme.favoriteActive)
                                } else {
                                    Button("撤回") { pendingDelete = c }.buttonStyle(.ht(.danger, .sm))
                                }
                            }
                        }
                    }
                }
                PaginationBar(page: page, totalPages: totalPages, total: total) { p in page = p; Task { await reload() } }
            }
            .padding(Space.s4)
        }
        .background(Theme.surface0)
        .navigationTitle("我创建的").navigationBarTitleDisplayMode(.inline)
        .task { await reload() }
        .confirmationDialog("确认撤回？此操作不可恢复。", isPresented: Binding(get: { pendingDelete != nil }, set: { if !$0 { pendingDelete = nil } }), titleVisibility: .visible) {
            Button("撤回", role: .destructive) { if let c = pendingDelete { delete(c) }; pendingDelete = nil }
            Button("取消", role: .cancel) { pendingDelete = nil }
        }
    }

    private func reload() async {
        loading = true; defer { loading = false }
        do {
            let r = try await store.api.myCapsules(page: page)
            items = r.items; totalPages = max(r.pagination.totalPages, 1); total = r.pagination.total
        } catch { store.report(error) }
    }
    private func delete(_ c: CapsuleListItem) {
        Task { do { try await store.api.deleteCapsule(id: c.id); await reload() } catch { store.report(error) } }
    }
}

// MARK: - 我收藏的

private struct MeFavoritesContent: View {
    @Environment(AppStore.self) private var store
    @State private var items: [CapsuleListItem] = []
    @State private var page = 1
    @State private var totalPages = 1
    @State private var total = 0
    @State private var loading = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Space.s4) {
                Text("共 \(total) 条；取消收藏只会从此列表移除，不影响原胶囊。").font(.system(size: FontSize.sm)).foregroundStyle(Theme.textMuted)
                if loading && items.isEmpty {
                    ProgressView().frame(maxWidth: .infinity, minHeight: 200)
                } else if items.isEmpty {
                    empty("🗂", "还没有收藏任何胶囊 —— 去广场看看？", cta: "去广场") { store.selectTab(.plaza) }
                } else {
                    LazyVStack(spacing: Space.s4) { ForEach(items) { c in CapsuleCard(capsule: c) } }
                }
                PaginationBar(page: page, totalPages: totalPages, total: total) { p in page = p; Task { await reload() } }
            }
            .padding(Space.s4)
        }
        .background(Theme.surface0)
        .navigationTitle("我收藏的").navigationBarTitleDisplayMode(.inline)
        .task { await reload() }
    }

    private func reload() async {
        loading = true; defer { loading = false }
        do {
            let r = try await store.api.myFavorites(page: page)
            items = r.items; totalPages = max(r.pagination.totalPages, 1); total = r.pagination.total
        } catch { store.report(error) }
    }
}

// MARK: - 账号设置

private struct MeProfileContent: View {
    @Environment(AppStore.self) private var store
    @State private var avatars: [Avatar] = []
    @State private var nickname = ""
    @State private var avatarId: String?
    @State private var profileBusy = false
    @State private var profileMsg: (AlertVariant, String)?

    @State private var oldPwd = ""
    @State private var newPwd = ""
    @State private var confirmPwd = ""
    @State private var pwdBusy = false
    @State private var pwdMsg: (AlertVariant, String)?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Space.s5) {
                basicCard
                passwordCard
            }
            .padding(Space.s4)
        }
        .background(Theme.surface0)
        .navigationTitle("账号设置").navigationBarTitleDisplayMode(.inline)
        .task {
            if avatars.isEmpty { avatars = (try? await store.api.avatars()) ?? [] }
            if let u = store.currentUser { nickname = u.nickname; avatarId = u.avatarId }
        }
    }

    private var basicCard: some View {
        VStack(alignment: .leading, spacing: Space.s4) {
            Text("基本信息").font(.system(size: FontSize.lg, weight: .semibold)).foregroundStyle(Theme.textPrimary)
            VStack(alignment: .leading, spacing: Space.s2) {
                FieldLabel(text: "邮箱")
                Text(store.currentUser?.email ?? "").font(.system(size: FontSize.base)).foregroundStyle(Theme.textMuted)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.vertical, Space.s3).padding(.horizontal, Space.s4)
                    .background(Theme.surface2).clipShape(RoundedRectangle(cornerRadius: Radius.md, style: .continuous))
            }
            VStack(alignment: .leading, spacing: Space.s2) { FieldLabel(text: "昵称"); TextField("", text: $nickname).fieldStyle() }
            VStack(alignment: .leading, spacing: Space.s2) { FieldLabel(text: "头像"); AvatarPicker(avatars: avatars, selected: $avatarId) }
            if let m = profileMsg { HTAlert(variant: m.0, text: m.1) }
            HStack {
                Spacer()
                Button("重置") { if let u = store.currentUser { nickname = u.nickname; avatarId = u.avatarId } }.buttonStyle(.ht(.ghost, .md))
                Button { saveProfile() } label: { HStack { if profileBusy { ProgressView().controlSize(.small) }; Text(profileBusy ? "保存中…" : "保存") } }
                    .buttonStyle(.ht(.primary, .md)).disabled(profileBusy)
            }
        }
        .cardStyle()
    }

    private var passwordCard: some View {
        VStack(alignment: .leading, spacing: Space.s4) {
            Text("修改密码").font(.system(size: FontSize.lg, weight: .semibold)).foregroundStyle(Theme.textPrimary)
            secure("当前密码", text: $oldPwd)
            secure("新密码", text: $newPwd, hint: "至少 8 位且含字母和数字；保存后所有 refresh token 会被吊销。")
            secure("确认新密码", text: $confirmPwd)
            if let m = pwdMsg { HTAlert(variant: m.0, text: m.1) }
            HStack {
                Spacer()
                Button { changePassword() } label: { HStack { if pwdBusy { ProgressView().controlSize(.small) }; Text(pwdBusy ? "更新中…" : "更新密码") } }
                    .buttonStyle(.ht(.primary, .md)).disabled(pwdBusy || oldPwd.isEmpty || newPwd.count < 8)
            }
        }
        .cardStyle()
    }

    private func secure(_ l: String, text: Binding<String>, hint: String? = nil) -> some View {
        VStack(alignment: .leading, spacing: Space.s2) {
            FieldLabel(text: l)
            SecureField("", text: text).fieldStyle()
            if let hint { Text(hint).font(.system(size: FontSize.sm)).foregroundStyle(Theme.textMuted) }
        }
    }

    private func saveProfile() {
        guard let u = store.currentUser else { return }
        profileMsg = nil
        let newNick = nickname.trimmed != u.nickname ? nickname.trimmed : nil
        let newAvatar = (avatarId != nil && avatarId != u.avatarId) ? avatarId : nil
        if newNick == nil && newAvatar == nil { profileMsg = (.info, "没有改动"); return }
        profileBusy = true
        Task {
            defer { profileBusy = false }
            do {
                let updated = try await store.api.updateProfile(UpdateProfileRequest(nickname: newNick, avatarId: newAvatar))
                store.setCurrentUser(updated)
                profileMsg = (.success, "已保存")
            } catch { profileMsg = (.danger, (error as? LocalizedError)?.errorDescription ?? "保存失败") }
        }
    }

    private func changePassword() {
        pwdMsg = nil
        if newPwd != confirmPwd { pwdMsg = (.danger, "两次输入的新密码不一致"); return }
        pwdBusy = true
        Task {
            defer { pwdBusy = false }
            do {
                try await store.api.changePassword(ChangePasswordRequest(currentPassword: oldPwd, newPassword: newPwd))
                pwdMsg = (.success, "密码已更新，3 秒后将自动登出。")
                oldPwd = ""; newPwd = ""; confirmPwd = ""
                try? await Task.sleep(nanoseconds: 3_000_000_000)
                await store.logout()
            } catch { pwdMsg = (.danger, (error as? LocalizedError)?.errorDescription ?? "修改失败") }
        }
    }
}

@ViewBuilder
private func empty(_ emoji: String, _ text: String, cta: String, action: @escaping () -> Void) -> some View {
    VStack(spacing: Space.s3) {
        Text(emoji).font(.system(size: 40))
        Text(text).foregroundStyle(Theme.textMuted).multilineTextAlignment(.center)
        Button(cta, action: action).buttonStyle(.ht(.ghost, .sm))
    }
    .frame(maxWidth: .infinity, minHeight: 220)
}
