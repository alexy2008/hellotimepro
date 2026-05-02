// Package config 读取环境变量配置，提供统一的 Settings 单例。
package config

import (
	"os"
	"path/filepath"
	"runtime"
	"strconv"
)

// Settings 保存应用全局配置。
type Settings struct {
	// 服务
	ServiceName    string
	ServiceVersion string
	Host           string
	Port           int

	// 数据库
	DBDriver string // "postgres" | "sqlite"
	DBUrl    string

	// JWT / 密码
	JWTSecret              string
	JWTAlgorithm           string
	AccessTokenTTLSeconds  int
	RefreshTokenTTLSeconds int
	BcryptRounds           int

	// 静态资源（相对 repo 根）
	AvatarsCatalogPath string
	AvatarsSourceDir   string
	IconsSourceDir     string

	// 限流
	LoginRateLimitPerMinute int

	// LLM（可选）
	LLMEnabled  bool
	LLMProvider string
	LLMBaseURL  string
	LLMAPIKey   string
	LLMModel    string

	// 仓库根目录（供 spec/ 路径拼接使用）
	RepoRoot string
}

var App Settings

// repoRoot 从本文件位置向上找 repo 根（包含 spec/ 目录）。
func repoRoot() string {
	_, file, _, ok := runtime.Caller(0)
	if !ok {
		return "."
	}
	// file = .../backends/gin/internal/config/config.go
	// 上走 5 层：config → internal → gin → backends → repo-root
	dir := filepath.Dir(file)
	for i := 0; i < 4; i++ {
		dir = filepath.Dir(dir)
	}
	return dir
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return fallback
}

func getEnvBool(key string, fallback bool) bool {
	if v := os.Getenv(key); v != "" {
		b, err := strconv.ParseBool(v)
		if err == nil {
			return b
		}
	}
	return fallback
}

func init() {
	root := repoRoot()
	driver := getEnv("DB_DRIVER", "postgres")

	defaultDBUrl := "postgresql://hellotime:hellotime@127.0.0.1:55432/hellotime_pro"
	if driver == "sqlite" {
		defaultDBUrl = "sqlite://" + filepath.Join(root, "data", "sqlite", "hellotime.db")
	}

	App = Settings{
		ServiceName:    getEnv("SERVICE_NAME", "hellotime-pro"),
		ServiceVersion: getEnv("SERVICE_VERSION", "0.1.0"),
		Host:           getEnv("HOST", "0.0.0.0"),
		Port:           getEnvInt("PORT", 29020),

		DBDriver: driver,
		DBUrl:    getEnv("DB_URL", defaultDBUrl),

		JWTSecret:              getEnv("JWT_SECRET", "dev-secret-change-me"),
		JWTAlgorithm:           "HS256",
		AccessTokenTTLSeconds:  getEnvInt("ACCESS_TOKEN_TTL_SECONDS", 3600),
		RefreshTokenTTLSeconds: getEnvInt("REFRESH_TOKEN_TTL_SECONDS", 7*24*3600),
		BcryptRounds:           getEnvInt("BCRYPT_ROUNDS", 10),

		AvatarsCatalogPath: filepath.Join(root, "spec", "avatars", "catalog.json"),
		AvatarsSourceDir:   filepath.Join(root, "spec", "avatars"),
		IconsSourceDir:     filepath.Join(root, "spec", "icons"),

		LoginRateLimitPerMinute: getEnvInt("LOGIN_RATE_LIMIT_PER_MINUTE", 10),

		LLMEnabled:  getEnvBool("LLM_ENABLED", false),
		LLMProvider: getEnv("LLM_PROVIDER", "openai"),
		LLMBaseURL:  getEnv("LLM_BASE_URL", "https://api.openai.com/v1"),
		LLMAPIKey:   getEnv("LLM_API_KEY", ""),
		LLMModel:    getEnv("LLM_MODEL", "gpt-4.1-mini"),

		RepoRoot: root,
	}
}
