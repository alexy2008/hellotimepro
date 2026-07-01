// 「我的」区：左侧栏（我创建的 / 我收藏的 / 账号设置 / 登出）+ 右侧内容。
// 对齐 React MeLayout + MeCreated/MeFavorites/MeProfile。

import SwiftUI

struct MeView: View {
    @Environment(AppStore.self) private var store

    var body: some View {
        Container {
            HStack(alignment: .top, spacing: Space.s6) {
                sidebar.frame(width: 200)
                VStack(alignment: .leading, spacing: Space.s5) {
                    switch store.current {
                    case .meFavorites: MeFavoritesContent()
                    case .meProfile:   MeProfileContent()
                    default:           MeCreatedContent()
                    }
                }
                .frame(maxWidth: .infinity, alignment: .topLeading)
            }
            .padding(.vertical, Space.s8)
        }
    }

    private var sidebar: some View {
        VStack(alignment: .leading, spacing: Space.s1) {
            item("我创建的", icon: "square.and.pencil", route: .meCreated)
            item("我收藏的", icon: "heart", route: .meFavorites)
            item("账号设置", icon: "gearshape", route: .meProfile)
            Divider().overlay(Theme.borderSubtle).padding(.vertical, Space.s2)
            Button { Task { await store.logout() } } label: {
                Label("登出", systemImage: "arrow.backward.square")
                    .font(.system(size: FontSize.sm, weight: .medium)).foregroundStyle(Theme.dangerFg)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.vertical, Space.s2).padding(.horizontal, Space.s3)
            }
            .buttonStyle(.plain)
        }
        .padding(Space.s3)
        .background(Theme.surface1)
        .clipShape(RoundedRectangle(cornerRadius: Radius.lg, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: Radius.lg, style: .continuous).stroke(Theme.borderSubtle, lineWidth: 1))
    }

    private func item(_ title: String, icon: String, route: Route) -> some View {
        let active = store.current == route
        // 对齐 .cy-me__nav .is-active：signal-subtle 底 + signal 青字（非紫填充）。
        return Button { store.navigate(to: route) } label: {
            Label(title, systemImage: icon)
                .font(.system(size: FontSize.sm, weight: active ? .semibold : .medium))
                .foregroundStyle(active ? Theme.signalPrimary : Theme.textSecondary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.vertical, Space.s2).padding(.horizontal, Space.s3)
                .background(active ? Theme.signalSubtle : Color.clear)
                .clipShape(RoundedRectangle(cornerRadius: Radius.md, style: .continuous))
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

    private let columns = [GridItem(.adaptive(minimum: 280, maximum: 360), spacing: Space.s5)]

    var body: some View {
        VStack(alignment: .leading, spacing: Space.s5) {
            HStack {
                Text("我创建的胶囊").font(.display(FontSize.xxl)).foregroundStyle(Theme.textPrimary)
                Spacer()
                Button("+ 新建胶囊") { store.navigate(to: .create) }.buttonStyle(.ht(.primary, .sm))
            }
            Text("按创建时间倒序 · 共 \(total) 条").font(.system(size: FontSize.sm)).foregroundStyle(Theme.textMuted)

            if loading && items.isEmpty {
                ProgressView().frame(maxWidth: .infinity, minHeight: 200)
            } else if items.isEmpty {
                empty("📭", "还没有创建任何胶囊", cta: "去创建一个") { store.navigate(to: .create) }
            } else {
                LazyVGrid(columns: columns, spacing: Space.s5) {
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
        .task { await reload() }
        .confirmationDialog("确认撤回？此操作不可恢复。", isPresented: Binding(get: { pendingDelete != nil }, set: { if !$0 { pendingDelete = nil } }), titleVisibility: .visible) {
            Button("撤回", role: .destructive) { if let c = pendingDelete { delete(c) }; pendingDelete = nil }
            Button("取消", role: .cancel) { pendingDelete = nil }
        }
    }

    private func reload() async {
        loading = true; defer { loading = false }
        do {
            let token = try store.requireToken(); _ = token
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

    private let columns = [GridItem(.adaptive(minimum: 280, maximum: 360), spacing: Space.s5)]

    var body: some View {
        VStack(alignment: .leading, spacing: Space.s5) {
            Text("我收藏的胶囊").font(.display(FontSize.xxl)).foregroundStyle(Theme.textPrimary)
            Text("共 \(total) 条；取消收藏只会从此列表移除，不会影响原胶囊。").font(.system(size: FontSize.sm)).foregroundStyle(Theme.textMuted)
            if loading && items.isEmpty {
                ProgressView().frame(maxWidth: .infinity, minHeight: 200)
            } else if items.isEmpty {
                empty("🗂", "还没有收藏任何胶囊 —— 去广场看看？", cta: "去广场") { store.navigate(to: .plaza) }
            } else {
                LazyVGrid(columns: columns, spacing: Space.s5) {
                    ForEach(items) { c in CapsuleCard(capsule: c) }
                }
            }
            PaginationBar(page: page, totalPages: totalPages, total: total) { p in page = p; Task { await reload() } }
        }
        .task { await reload() }
    }

    private func reload() async {
        loading = true; defer { loading = false }
        do {
            let token = try store.requireToken(); _ = token
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
        VStack(alignment: .leading, spacing: Space.s6) {
            Text("账号设置").font(.display(FontSize.xxl)).foregroundStyle(Theme.textPrimary)
            basicCard
            passwordCard
        }
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
                Text("邮箱作为登录账号不可修改。").font(.system(size: FontSize.sm)).foregroundStyle(Theme.textMuted)
            }
            VStack(alignment: .leading, spacing: Space.s2) {
                FieldLabel(text: "昵称")
                TextField("", text: $nickname).fieldStyle()
            }
            VStack(alignment: .leading, spacing: Space.s2) {
                FieldLabel(text: "头像")
                AvatarPicker(avatars: avatars, selected: $avatarId)
            }
            if let m = profileMsg { HTAlert(variant: m.0, text: m.1) }
            HStack {
                Spacer()
                Button("重置") { if let u = store.currentUser { nickname = u.nickname; avatarId = u.avatarId } }.buttonStyle(.ht(.ghost, .md))
                Button { saveProfile() } label: { HStack { if profileBusy { ProgressView().controlSize(.small) }; Text(profileBusy ? "保存中…" : "保存更改") } }
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

// MARK: - 空状态

@ViewBuilder
private func empty(_ emoji: String, _ text: String, cta: String, action: @escaping () -> Void) -> some View {
    VStack(spacing: Space.s3) {
        Text(emoji).font(.system(size: 40))
        Text(text).foregroundStyle(Theme.textMuted)
        Button(cta, action: action).buttonStyle(.ht(.ghost, .sm))
    }
    .frame(maxWidth: .infinity, minHeight: 220)
}
