// ============================================================
// APIClient：纯 API 消费者，URLSession + async/await（对齐 React api/client.ts）。
//
// - access token 内存，refresh token 持久化（AppStore）；二者经回调注入，避免循环依赖
// - access token 缺失 / 401(UNAUTHORIZED) 时触发一次 refresh + 重放（单飞）
// - 原生直连 baseURL（默认 :9080 反代，hello switch 切后端有效），无需代理 / 无 CORS
// ============================================================

import Foundation

enum APIError: LocalizedError {
    case network(String)
    case decoding(String)
    case api(status: Int, message: String, code: String?)

    var errorDescription: String? {
        switch self {
        case .network(let m): return "网络错误：\(m)"
        case .decoding(let m): return "数据解析失败：\(m)"
        case .api(_, let m, _): return m
        }
    }
    var isUnauthorized: Bool {
        if case .api(let s, _, _) = self { return s == 401 }
        return false
    }
}

final class APIClient {
    let baseURL: URL

    // 由 AppStore 注入（configure）
    var getAccessToken: () -> String? = { nil }
    var getRefreshToken: () -> String? = { nil }
    var onTokensRefreshed: (String, String) -> Void = { _, _ in }
    var onAuthLost: () -> Void = {}

    private var refreshing: Task<String?, Never>?

    static func resolveBaseURL() -> URL {
        // iOS 模拟器不继承宿主环境变量；后端地址从 Info.plist 的 APIBase 读
        // （由 project.yml 的 HT_API_BASE 构建设置注入，run 脚本可覆盖），默认本地反代。
        if let s = Bundle.main.object(forInfoDictionaryKey: "APIBase") as? String,
           !s.isEmpty, !s.hasPrefix("$("), let u = URL(string: s) {
            return u
        }
        return URL(string: "http://127.0.0.1:9080")!
    }

    init(baseURL: URL = APIClient.resolveBaseURL()) { self.baseURL = baseURL }

    // MARK: - 资源 URL

    func avatarURL(id: String) -> URL { baseURL.appendingPathComponent("/static/avatars/\(id).svg") }
    /// 把后端相对图标路径（/static/icons/xxx.svg）解析为绝对 URL。
    func resolveAsset(_ path: String) -> URL? {
        if path.hasPrefix("http") { return URL(string: path) }
        return baseURL.appendingPathComponent(path)
    }

    // MARK: - refresh（单飞）

    private func tryRefresh() async -> String? {
        if let r = refreshing { return await r.value }
        guard let rt = getRefreshToken() else { return nil }
        let task = Task<String?, Never> { [weak self] in
            guard let self else { return nil }
            defer { self.refreshing = nil }
            do {
                let tokens: RefreshedTokens = try await self.rawRequest(
                    "/api/v1/auth/refresh", method: "POST",
                    body: RefreshRequest(refreshToken: rt), token: nil, as: RefreshedTokens.self)
                self.onTokensRefreshed(tokens.accessToken, tokens.refreshToken)
                return tokens.accessToken
            } catch {
                self.onAuthLost()
                return nil
            }
        }
        refreshing = task
        return await task.value
    }

    // MARK: - 核心请求

    /// 带鉴权 + 401 自动 refresh 重放。
    private func request<T: Decodable>(
        _ path: String, method: String = "GET", query: [URLQueryItem] = [],
        body: (any Encodable)? = nil, auth: Bool = true, retry: Bool = false, as type: T.Type
    ) async throws -> T {
        var token: String? = nil
        if auth {
            if let t = getAccessToken() { token = t } else { token = await tryRefresh() }
        }
        do {
            return try await rawRequest(path, method: method, query: query, body: body, token: token, as: type)
        } catch let e as APIError {
            if case .api(401, _, let code) = e, code == "UNAUTHORIZED", auth, !retry, getRefreshToken() != nil {
                if await tryRefresh() != nil {
                    return try await request(path, method: method, query: query, body: body, auth: auth, retry: true, as: type)
                }
            }
            throw e
        }
    }

    private func requestVoid(
        _ path: String, method: String, body: (any Encodable)? = nil, auth: Bool = true, retry: Bool = false
    ) async throws {
        var token: String? = nil
        if auth {
            if let t = getAccessToken() { token = t } else { token = await tryRefresh() }
        }
        do {
            try await rawRequestVoid(path, method: method, body: body, token: token)
        } catch let e as APIError {
            if case .api(401, _, let code) = e, code == "UNAUTHORIZED", auth, !retry, getRefreshToken() != nil {
                if await tryRefresh() != nil {
                    return try await requestVoid(path, method: method, body: body, auth: auth, retry: true)
                }
            }
            throw e
        }
    }

    private func rawRequest<T: Decodable>(
        _ path: String, method: String, query: [URLQueryItem] = [],
        body: (any Encodable)? = nil, token: String?, as _: T.Type
    ) async throws -> T {
        let data = try await send(path, method: method, query: query, body: body, token: token)
        do {
            let env = try JSONDecoder().decode(Envelope<T>.self, from: data)
            guard let value = env.data else { throw APIError.decoding("响应缺少 data 字段") }
            return value
        } catch let e as APIError { throw e }
        catch { throw APIError.decoding(String(describing: error)) }
    }

    private func rawRequestVoid(_ path: String, method: String, body: (any Encodable)?, token: String?) async throws {
        _ = try await send(path, method: method, query: [], body: body, token: token)
    }

    private func send(
        _ path: String, method: String, query: [URLQueryItem], body: (any Encodable)?, token: String?
    ) async throws -> Data {
        var comps = URLComponents(url: baseURL.appendingPathComponent(path), resolvingAgainstBaseURL: false)!
        if !query.isEmpty { comps.queryItems = query }
        guard let url = comps.url else { throw APIError.network("非法 URL: \(path)") }

        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        if let token { req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        if let body {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try JSONEncoder().encode(AnyEncodable(body))
        }

        let data: Data, resp: URLResponse
        do { (data, resp) = try await URLSession.shared.data(for: req) }
        catch { throw APIError.network(error.localizedDescription) }
        guard let http = resp as? HTTPURLResponse else { throw APIError.network("无 HTTP 响应") }
        if http.statusCode == 204 { return Data() }
        guard (200..<300).contains(http.statusCode) else {
            let env = try? JSONDecoder().decode(Envelope<EmptyData>.self, from: data)
            throw APIError.api(status: http.statusCode,
                               message: env?.message ?? "请求失败（HTTP \(http.statusCode)）",
                               code: env?.errorCode)
        }
        return data
    }

    // MARK: - 端点

    func health() async throws -> HealthData { try await request("/api/v1/health", auth: false, as: HealthData.self) }

    func suggestCapsule(title: String?) async throws -> CapsuleSuggestion {
        try await request("/api/v1/capsule-suggestion", method: "POST",
                          body: CapsuleSuggestionRequest(title: title, locale: nil), auth: false, as: CapsuleSuggestion.self)
    }
    func capsuleRecommendations(count: Int = 4) async throws -> CapsuleRecommendationList {
        try await request("/api/v1/capsule-recommendations",
                          query: [URLQueryItem(name: "count", value: String(count))],
                          auth: false, as: CapsuleRecommendationList.self)
    }
    func avatars() async throws -> [Avatar] { try await request("/api/v1/avatars", auth: false, as: [Avatar].self) }

    func register(_ r: RegisterRequest) async throws -> AuthTokens {
        try await request("/api/v1/auth/register", method: "POST", body: r, auth: false, as: AuthTokens.self)
    }
    func login(_ r: LoginRequest) async throws -> AuthTokens {
        try await request("/api/v1/auth/login", method: "POST", body: r, auth: false, as: AuthTokens.self)
    }
    func logout(refreshToken: String?) async throws {
        let body: any Encodable = refreshToken.map { LogoutRequest(refreshToken: $0) } ?? EmptyBody()
        try await requestVoid("/api/v1/auth/logout", method: "POST", body: body, auth: false)
    }

    func me() async throws -> User { try await request("/api/v1/me", as: User.self) }
    func updateProfile(_ r: UpdateProfileRequest) async throws -> User {
        try await request("/api/v1/me", method: "PATCH", body: r, as: User.self)
    }
    func changePassword(_ r: ChangePasswordRequest) async throws {
        try await requestVoid("/api/v1/me/password", method: "POST", body: r)
    }

    func createCapsule(_ r: CreateCapsuleRequest) async throws -> CapsuleDetail {
        try await request("/api/v1/capsules", method: "POST", body: r, as: CapsuleDetail.self)
    }
    func capsule(byCode code: String) async throws -> CapsuleDetail {
        try await request("/api/v1/capsules/\(code)", as: CapsuleDetail.self)
    }

    func plaza(sort: String, filter: String, q: String, page: Int, pageSize: Int = 15) async throws -> Page<CapsuleListItem> {
        var query = [
            URLQueryItem(name: "sort", value: sort),
            URLQueryItem(name: "filter", value: filter),
            URLQueryItem(name: "page", value: String(page)),
            URLQueryItem(name: "pageSize", value: String(pageSize)),
        ]
        let t = q.trimmingCharacters(in: .whitespaces)
        if !t.isEmpty { query.append(URLQueryItem(name: "q", value: t)) }
        return try await request("/api/v1/plaza/capsules", query: query, as: Page<CapsuleListItem>.self)
    }

    func myCapsules(page: Int, pageSize: Int = 15) async throws -> Page<CapsuleListItem> {
        try await request("/api/v1/me/capsules",
                          query: [URLQueryItem(name: "page", value: String(page)), URLQueryItem(name: "pageSize", value: String(pageSize))],
                          as: Page<CapsuleListItem>.self)
    }
    func deleteCapsule(id: String) async throws { try await requestVoid("/api/v1/me/capsules/\(id)", method: "DELETE") }

    func myFavorites(page: Int, pageSize: Int = 15) async throws -> Page<CapsuleListItem> {
        try await request("/api/v1/me/favorites",
                          query: [URLQueryItem(name: "page", value: String(page)), URLQueryItem(name: "pageSize", value: String(pageSize))],
                          as: Page<CapsuleListItem>.self)
    }
    func favorite(capsuleId: String) async throws -> FavoriteResult {
        try await request("/api/v1/me/favorites", method: "POST", body: FavoriteRequest(capsuleId: capsuleId), as: FavoriteResult.self)
    }
    func unfavorite(capsuleId: String) async throws {
        try await requestVoid("/api/v1/me/favorites/\(capsuleId)", method: "DELETE")
    }
}

private struct EmptyData: Decodable {}
private struct EmptyBody: Encodable {}
private struct AnyEncodable: Encodable {
    private let encodeFn: (Encoder) throws -> Void
    init(_ wrapped: any Encodable) { encodeFn = wrapped.encode }
    func encode(to encoder: Encoder) throws { try encodeFn(encoder) }
}
