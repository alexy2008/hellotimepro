// ============================================================
// AppStore：全局会话 + 导航 + 主题（对齐 React 的 auth / theme store + router）。
//
// 鉴权（对齐 React，做完整功能）：access token 内存；refresh token + user
// 持久化到 UserDefaults（macOS 上 localStorage 的等价物，对应 docs/02-design §7.2
// 的"更简单方案"）；启动 hydrate，有 refresh token 则拉 /me 校验；401 自动 refresh。
// 原生是唯一客户端，无 electron/tauri 那种壳层与内嵌前端共享 token 的轮换误登出问题。
// ============================================================

import Foundation
import Observation

// MARK: - 路由

enum Route: Hashable {
    case plaza, open, about, create, login, register
    case meCreated, meFavorites, meProfile
    case capsule(String) // code

    var requiresAuth: Bool {
        switch self {
        case .create, .meCreated, .meFavorites, .meProfile: return true
        default: return false
        }
    }
    /// 顶部导航点击的是「根」路由（替换栈），胶囊详情是「压栈」。
    var isRoot: Bool { if case .capsule = self { return false }; return true }
}

enum AppTheme: String { case dark, light }

@MainActor
@Observable
final class AppStore {
    let api = APIClient()

    // 会话
    private(set) var accessToken: String?
    private(set) var refreshToken: String?
    private(set) var currentUser: User?

    // 主题
    var theme: AppTheme = .dark

    // 导航栈
    private(set) var path: [Route] = [.plaza]
    private var pendingRoute: Route?

    // 全局提示
    var banner: String?

    var current: Route { path.last ?? .plaza }
    var canGoBack: Bool { path.count > 1 }
    var isAuthenticated: Bool { accessToken != nil && currentUser != nil }
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
        if refreshToken != nil {
            Task { await refreshMe() }
        }
    }

    // MARK: - 导航

    func navigate(to route: Route) {
        if route.requiresAuth && !isAuthenticated {
            pendingRoute = route
            path = [.login]
            return
        }
        if route.isRoot { path = [route] } else { path.append(route) }
    }

    func push(_ route: Route) { path.append(route) }
    func goBack() { if path.count > 1 { path.removeLast() } }

    /// 匿名触发需登录的动作（收藏）时跳登录。
    func requireLogin() { pendingRoute = nil; path = [.login] }

    // MARK: - 鉴权

    func login(email: String, password: String) async throws {
        apply(try await api.login(LoginRequest(email: email, password: password)), defaultRoute: .meCreated)
    }
    func register(email: String, password: String, nickname: String, avatarId: String) async throws {
        apply(try await api.register(RegisterRequest(email: email, password: password, nickname: nickname, avatarId: avatarId)),
              defaultRoute: .create)
    }
    func logout() async {
        let rt = refreshToken
        clearSession()
        if let rt { try? await api.logout(refreshToken: rt) }
        path = [.plaza]
    }

    func refreshMe() async {
        do {
            let me = try await api.me()
            currentUser = me
            persistAuth()
        } catch { /* 401 走 onAuthLost */ }
    }

    private func apply(_ tokens: AuthTokens, defaultRoute: Route) {
        accessToken = tokens.accessToken
        refreshToken = tokens.refreshToken
        currentUser = tokens.user
        persistAuth()
        let target = pendingRoute ?? defaultRoute
        pendingRoute = nil
        path = [target]
    }

    private func patchTokens(_ a: String, _ r: String) {
        accessToken = a
        refreshToken = r
        persistAuth()
    }

    private func clearSession() {
        accessToken = nil
        refreshToken = nil
        currentUser = nil
        UserDefaults.standard.removeObject(forKey: authKey)
    }

    /// 把当前用户合并更新（资料修改后）。
    func setCurrentUser(_ u: User) { currentUser = u; persistAuth() }

    func report(_ error: Error) {
        if let e = error as? APIError, e.isUnauthorized {
            clearSession()
            banner = "登录已过期，请重新登录"
        } else {
            banner = (error as? LocalizedError)?.errorDescription ?? "发生未知错误"
        }
    }

    func requireToken() throws -> String {
        guard let t = accessToken else { throw APIError.api(status: 401, message: "未登录", code: "UNAUTHORIZED") }
        return t
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
