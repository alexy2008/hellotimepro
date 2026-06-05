package com.hellotimepro.ktor

import com.hellotimepro.ktor.config.AppConfig
import com.hellotimepro.ktor.repository.CapsuleRepository
import com.hellotimepro.ktor.repository.FavoriteRepository
import com.hellotimepro.ktor.repository.RefreshTokenRepository
import com.hellotimepro.ktor.repository.UserRepository
import com.hellotimepro.ktor.service.AuthService
import com.hellotimepro.ktor.service.AvatarService
import com.hellotimepro.ktor.service.CapsuleRecommendationService
import com.hellotimepro.ktor.service.CapsuleService
import com.hellotimepro.ktor.service.CapsuleSuggestionService
import com.hellotimepro.ktor.service.FavoriteService
import com.hellotimepro.ktor.service.LlmClient
import com.hellotimepro.ktor.service.MapperService
import com.hellotimepro.ktor.service.PlazaService
import com.hellotimepro.ktor.service.SecurityService
import com.hellotimepro.ktor.service.UserService
import com.hellotimepro.ktor.web.AuthContext

/** 手动依赖装配（Ktor 惯用的简单做法，避免引入 DI 容器）。单例、无状态共享。 */
class AppComponents(val config: AppConfig) {
    val startTime: Long = System.currentTimeMillis()

    // infrastructure / repositories
    private val userRepository = UserRepository()
    private val capsuleRepository = CapsuleRepository()
    private val favoriteRepository = FavoriteRepository()
    private val refreshTokenRepository = RefreshTokenRepository()

    // domain services
    val avatarService = AvatarService(config)
    private val securityService = SecurityService(config)
    private val mapperService = MapperService()
    private val llmClient = LlmClient(config)

    val authService = AuthService(
        config, userRepository, refreshTokenRepository, securityService, mapperService, avatarService,
    )
    val userService = UserService(userRepository, avatarService, mapperService)
    val capsuleService = CapsuleService(capsuleRepository, userRepository, favoriteRepository, mapperService)
    val plazaService = PlazaService(capsuleRepository, userRepository, favoriteRepository, mapperService)
    val favoriteService = FavoriteService(capsuleRepository, favoriteRepository)
    val suggestionService = CapsuleSuggestionService(config, llmClient)
    val recommendationService = CapsuleRecommendationService(config, llmClient)

    val authContext = AuthContext(securityService, userRepository)
}
