// Package core 提供鉴权原语：bcrypt 密码哈希 + JWT HS256 + 不透明 refresh token。
package core

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"

	"hellotime/gin/internal/config"
)

// ---------- 密码 ----------

func HashPassword(plain string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(plain), config.App.BcryptRounds)
	if err != nil {
		return "", err
	}
	return string(hash), nil
}

func VerifyPassword(plain, hashed string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hashed), []byte(plain))
	return err == nil
}

// ---------- Access Token (JWT HS256) ----------

type AccessClaims struct {
	Nickname string `json:"nickname"`
	AvatarID string `json:"avatarId"`
	jwt.RegisteredClaims
}

// CreateAccessToken 返回 (tokenString, expiresInSeconds)。
func CreateAccessToken(userID, nickname, avatarID string) (string, int, error) {
	ttl := config.App.AccessTokenTTLSeconds
	now := time.Now().UTC()
	claims := AccessClaims{
		Nickname: nickname,
		AvatarID: avatarID,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(time.Duration(ttl) * time.Second)),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(config.App.JWTSecret))
	if err != nil {
		return "", 0, err
	}
	return signed, ttl, nil
}


func DecodeAccessToken(tokenStr string) (*AccessClaims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &AccessClaims{}, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return []byte(config.App.JWTSecret), nil
	})
	if err != nil {
		if errors.Is(err, jwt.ErrTokenExpired) {
			return nil, &TokenParseError{Reason: "access_token_expired"}
		}
		return nil, &TokenParseError{Reason: "invalid_token"}
	}
	claims, ok := token.Claims.(*AccessClaims)
	if !ok || !token.Valid {
		return nil, &TokenParseError{Reason: "invalid_token"}
	}
	return claims, nil
}

// ---------- Refresh Token ----------
// 不透明：256-bit 随机 + base64url；DB 存 sha256 hex，比对时 hash 输入。

func GenerateRefreshToken() (string, error) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(raw), nil
}

func HashRefreshToken(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}
