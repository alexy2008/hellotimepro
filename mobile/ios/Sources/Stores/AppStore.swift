// ============================================================
// AppStore：全局会话 + 主题 + Tab 选择（鉴权/主题/持久化逻辑搬自 desktop/swiftui，
// 导航改为移动 IA：底部 Tab Bar + 受保护 Tab 拦截弹登录 sheet；详情用各 Tab 的
// NavigationStack 压栈，故不在 store 里维护单一导航栈）。
// ============================================================

import Foundation
import Observation

enum Tab: Hashable { case plaza, open, create, me }
enum AppTheme: String { case dark, light }

@MainActor
@Observable
final class AppStore {
    let api = APIClient()

    // 会话
    private(set) var accessToken: String?
    private(set) var refreshToken: String?
    private(set) var currentUser: User?

    // 主题 + 导航
    var theme: AppTheme = .dark
    var selectedTab: Tab = .plaza
    var showAuthSheet = false           // 受保护 Tab / 匿名动作触发登录
    private var pendingTab: Tab?
    var banner: String?

    var isAuthenticated: Bool { accessToken != nil && currentUser != nil }
    /// 守卫放行：有 user，或仅有 refreshToken（启动未拉到 access），接口会自动 refresh。
    var canAccessProtected: Bool { currentUser != nil || refreshToken != nil }
    var apiBaseDescription: String { api.baseURL.absoluteString }

    private let authKey = "hellotime.auth"
    private let themeKey = "hellotime.theme"

    init() {
        api.getAccessToken = { [weak self] in self?.accessToken }
        api.getRefreshToken = { [weak self] in self?.refreshToken }
        api.onTokensRefreshed = { [weak self] a, r in self?.patchTokens(a, r) }
        api.onAuthLost = { [weak self] in self?.clearSession() }
    }

    // MARK: - 启动
    func bootstrap() {
        hydrateTheme()
        hydrateAuth()
        if refreshToken != nil { Task { await refreshMe() } }
    }

    // MARK: - 导航
    /// Tab 切换拦截：受保护 Tab（创建/我的）未登录 → 记下目标 + 弹登录。
    func selectTab(_ t: Tab) {
        if (t == .create || t == .me) && !canAccessProtected {
            pendingTab = t
            showAuthSheet = true
            return
        }
        selectedTab = t
    }
    /// 匿名触发需登录的动作（收藏）时弹登录。
    func requireLogin() { pendingTab = nil; showAuthSheet = true }

    // MARK: - 鉴权
    func login(email: String, password: String) async throws {
        apply(try await api.login(LoginRequest(email: email, password: password)), defaultTab: .me)
    }
    func register(email: String, password: String, nickname: String, avatarId: String) async throws {
        apply(try await api.register(RegisterRequest(email: email, password: password, nickname: nickname, avatarId: avatarId)),
              defaultTab: .create)
    }
    func logout() async {
        let rt = refreshToken
        clearSession()
        if let rt { try? await api.logout(refreshToken: rt) }
        selectedTab = .plaza
    }
    func refreshMe() async {
        do { currentUser = try await api.me(); persistAuth() }
        catch { /* 401 走 onAuthLost */ }
    }

    private func apply(_ tokens: AuthTokens, defaultTab: Tab) {
        accessToken = tokens.accessToken
        refreshToken = tokens.refreshToken
        currentUser = tokens.user
        persistAuth()
        showAuthSheet = false
        selectedTab = pendingTab ?? defaultTab
        pendingTab = nil
    }
    private func patchTokens(_ a: String, _ r: String) {
        accessToken = a; refreshToken = r; persistAuth()
    }
    private func clearSession() {
        accessToken = nil; refreshToken = nil; currentUser = nil
        UserDefaults.standard.removeObject(forKey: authKey)
    }
    func setCurrentUser(_ u: User) { currentUser = u; persistAuth() }

    func report(_ error: Error) {
        if let e = error as? APIError, e.isUnauthorized {
            clearSession(); banner = "登录已过期，请重新登录"
        } else {
            banner = (error as? LocalizedError)?.errorDescription ?? "发生未知错误"
        }
    }

    // MARK: - 持久化
    private func persistAuth() {
        guard let rt = refreshToken, let u = currentUser,
              let data = try? JSONEncoder().encode(PersistedAuth(refreshToken: rt, user: u)) else { return }
        UserDefaults.standard.set(data, forKey: authKey)
    }
    private func hydrateAuth() {
        guard let data = UserDefaults.standard.data(forKey: authKey),
              let p = try? JSONDecoder().decode(PersistedAuth.self, from: data) else { return }
        refreshToken = p.refreshToken
        currentUser = p.user
    }
    func toggleTheme() {
        theme = theme == .dark ? .light : .dark
        UserDefaults.standard.set(theme.rawValue, forKey: themeKey)
    }
    private func hydrateTheme() {
        if let raw = UserDefaults.standard.string(forKey: themeKey), let t = AppTheme(rawValue: raw) { theme = t }
    }
}

private struct PersistedAuth: Codable {
    let refreshToken: String
    let user: User
}

extension User: Encodable {
    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(id, forKey: .id); try c.encode(email, forKey: .email)
        try c.encode(nickname, forKey: .nickname); try c.encode(avatarId, forKey: .avatarId)
        try c.encode(createdAt, forKey: .createdAt)
    }
    enum CodingKeys: String, CodingKey { case id, email, nickname, avatarId, createdAt }
}
