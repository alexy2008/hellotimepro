import Vapor
import Foundation

/// 手工依赖装配（Vapor 无 DI 容器，构造函数注入即可）。
struct AppComponents: Sendable {
    let config: AppConfig
    let db: AppDatabase
    let startTime: Date

    let security: SecurityService
    let mapper: MapperService
    let avatars: AvatarService
    let authContext: AuthContext
    let authService: AuthService
    let userService: UserService
    let capsuleService: CapsuleService
    let plazaService: PlazaService
    let favoriteService: FavoriteService
    let suggestionService: SuggestionService
    let recommendationService: RecommendationService

    init(app: Application, config: AppConfig, db: AppDatabase) throws {
        self.config = config
        self.db = db
        self.startTime = Date()

        let users = UserRepository(dbx: db)
        let capsules = CapsuleRepository(dbx: db)
        let favorites = FavoriteRepository(dbx: db)
        let refreshTokens = RefreshTokenRepository(dbx: db)

        let security = SecurityService(config: config)
        let mapper = MapperService()
        let avatars = try AvatarService(config: config)
        let llm = LlmClient(config: config.llm, client: app.client,
                            logger: Logger(label: "app.llm"))

        self.security = security
        self.mapper = mapper
        self.avatars = avatars
        self.authContext = AuthContext(security: security, db: db, users: users)
        self.authService = AuthService(
            config: config, db: db, users: users, refreshTokens: refreshTokens,
            security: security, mapper: mapper, avatars: avatars,
            rateLimiter: LoginRateLimiter(limit: config.loginRateLimitPerMinute)
        )
        self.userService = UserService(db: db, users: users, mapper: mapper, avatars: avatars)
        self.capsuleService = CapsuleService(db: db, capsules: capsules, favorites: favorites, mapper: mapper)
        self.plazaService = PlazaService(db: db, capsules: capsules, mapper: mapper)
        self.favoriteService = FavoriteService(db: db, capsules: capsules, favorites: favorites)
        self.suggestionService = SuggestionService(config: config, llm: llm,
                                                   logger: Logger(label: "app.suggestion"))
        self.recommendationService = RecommendationService(config: config, llm: llm,
                                                           logger: Logger(label: "app.recommendation"))
    }
}
