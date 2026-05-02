package service

import (
	"strings"
	"sync"
	"time"
	"unicode"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"hellotime/gin/internal/config"
	"hellotime/gin/internal/core"
	"hellotime/gin/internal/dto"
	"hellotime/gin/internal/model"
)

// ---------- 密码 / 昵称 策略 ----------

func validatePassword(p string) error {
	hasLetter, hasDigit := false, false
	for _, c := range p {
		if unicode.IsLetter(c) {
			hasLetter = true
		}
		if unicode.IsDigit(c) {
			hasDigit = true
		}
	}
	if !hasLetter || !hasDigit {
		return core.ValidationErr("密码至少 8 位且需包含字母和数字", "password")
	}
	return nil
}

func validateNickname(n string) error {
	if len([]rune(n)) < 2 || len([]rune(n)) > 20 {
		return core.ValidationErr("昵称长度 2-20", "nickname")
	}
	for _, c := range n {
		if !unicode.IsLetter(c) && !unicode.IsDigit(c) && c != '_' && c != '-' {
			return core.ValidationErr("昵称仅允许中英文、数字、下划线、连字符", "nickname")
		}
	}
	return nil
}

// ---------- 简单内存限流 ----------

type rateBucket struct {
	mu         sync.Mutex
	timestamps []time.Time
}

var loginFailures sync.Map // email → *rateBucket

func checkRateLimit(email string) error {
	b, _ := loginFailures.LoadOrStore(email, &rateBucket{})
	bucket := b.(*rateBucket)
	bucket.mu.Lock()
	defer bucket.mu.Unlock()

	now := time.Now()
	cutoff := now.Add(-60 * time.Second)
	// 清除 60s 外记录
	fresh := bucket.timestamps[:0]
	for _, t := range bucket.timestamps {
		if t.After(cutoff) {
			fresh = append(fresh, t)
		}
	}
	bucket.timestamps = fresh

	if len(bucket.timestamps) >= config.App.LoginRateLimitPerMinute {
		return core.RateLimitedErr()
	}
	return nil
}

func recordFailure(email string) {
	b, _ := loginFailures.LoadOrStore(email, &rateBucket{})
	bucket := b.(*rateBucket)
	bucket.mu.Lock()
	defer bucket.mu.Unlock()
	bucket.timestamps = append(bucket.timestamps, time.Now())
}

// ---------- 辅助 ----------

func userToOut(u *model.User) dto.UserOut {
	return dto.UserOut{
		ID:        u.ID,
		Email:     u.Email,
		Nickname:  u.Nickname,
		AvatarID:  u.AvatarID,
		CreatedAt: u.CreatedAt,
	}
}

func issueTokenPair(db *gorm.DB, u *model.User, familyID string) (*dto.AuthTokens, error) {
	if familyID == "" {
		familyID = uuid.NewString()
	}
	accessToken, accessTTL, err := core.CreateAccessToken(u.ID, u.Nickname, u.AvatarID)
	if err != nil {
		return nil, core.InternalErr("创建 access token 失败")
	}
	rawRefresh, err := core.GenerateRefreshToken()
	if err != nil {
		return nil, core.InternalErr("生成 refresh token 失败")
	}
	tokenHash := core.HashRefreshToken(rawRefresh)
	expiresAt := time.Now().UTC().Add(time.Duration(config.App.RefreshTokenTTLSeconds) * time.Second)

	rt := model.RefreshToken{
		ID:        uuid.NewString(),
		UserID:    u.ID,
		TokenHash: tokenHash,
		FamilyID:  familyID,
		ExpiresAt: expiresAt,
	}
	if err := db.Create(&rt).Error; err != nil {
		return nil, core.InternalErr("保存 refresh token 失败")
	}

	return &dto.AuthTokens{
		AccessToken:           accessToken,
		RefreshToken:          rawRefresh,
		AccessTokenExpiresIn:  accessTTL,
		RefreshTokenExpiresIn: config.App.RefreshTokenTTLSeconds,
		User:                  userToOut(u),
	}, nil
}

// ---------- 公开函数 ----------

func Register(db *gorm.DB, email, password, nickname, avatarID string) (*dto.AuthTokens, error) {
	if !IsValidAvatarID(avatarID) {
		return nil, core.ValidationErr("头像 ID 不存在", "avatarId")
	}
	if err := validatePassword(password); err != nil {
		return nil, err
	}
	if err := validateNickname(nickname); err != nil {
		return nil, err
	}

	emailNorm := strings.ToLower(strings.TrimSpace(email))

	// 预检（并发下由 DB unique 兜底）
	var count int64
	db.Model(&model.User{}).Where("email = ?", emailNorm).Count(&count)
	if count > 0 {
		return nil, core.ConflictErr("邮箱已被注册", "email")
	}
	db.Model(&model.User{}).Where("nickname = ?", nickname).Count(&count)
	if count > 0 {
		return nil, core.ConflictErr("昵称已被使用", "nickname")
	}

	hash, err := core.HashPassword(password)
	if err != nil {
		return nil, core.InternalErr("密码加密失败")
	}

	user := model.User{
		ID:           uuid.NewString(),
		Email:        emailNorm,
		PasswordHash: hash,
		Nickname:     nickname,
		AvatarID:     avatarID,
	}

	if err := db.Create(&user).Error; err != nil {
		errMsg := err.Error()
		if strings.Contains(errMsg, "email") {
			return nil, core.ConflictErr("邮箱已被注册", "email")
		}
		if strings.Contains(errMsg, "nickname") {
			return nil, core.ConflictErr("昵称已被使用", "nickname")
		}
		return nil, core.ConflictErr("注册冲突")
	}

	return issueTokenPair(db, &user, "")
}

func Login(db *gorm.DB, email, password string) (*dto.AuthTokens, error) {
	emailNorm := strings.ToLower(strings.TrimSpace(email))
	if err := checkRateLimit(emailNorm); err != nil {
		return nil, err
	}

	var user model.User
	if err := db.Where("email = ?", emailNorm).First(&user).Error; err != nil {
		recordFailure(emailNorm)
		return nil, core.UnauthorizedErr("邮箱或密码错误")
	}
	if !core.VerifyPassword(password, user.PasswordHash) {
		recordFailure(emailNorm)
		return nil, core.UnauthorizedErr("邮箱或密码错误")
	}

	return issueTokenPair(db, &user, "")
}

func Refresh(db *gorm.DB, rawRefresh string) (*dto.AuthTokens, error) {
	tokenHash := core.HashRefreshToken(rawRefresh)

	var tokens *dto.AuthTokens
	var replayErr error
	err := db.Transaction(func(tx *gorm.DB) error {
		q := tx.Where("token_hash = ?", tokenHash)
		if config.App.DBDriver == "postgres" {
			q = q.Clauses(clause.Locking{Strength: "UPDATE"})
		}

		var rt model.RefreshToken
		if err := q.First(&rt).Error; err != nil {
			return core.UnauthorizedErr("refresh token 无效")
		}

		now := time.Now().UTC()
		if rt.ExpiresAt.Before(now) {
			return core.UnauthorizedErr("refresh token 已过期")
		}

		if rt.RevokedAt != nil {
			// 重放 → 整族作废
			if err := tx.Model(&model.RefreshToken{}).
				Where("family_id = ? AND revoked_at IS NULL", rt.FamilyID).
				Update("revoked_at", now).Error; err != nil {
				return err
			}
			replayErr = core.UnauthorizedErr("refresh token 已失效")
			return nil
		}

		var user model.User
		if err := tx.First(&user, "id = ?", rt.UserID).Error; err != nil {
			return core.UnauthorizedErr("用户不存在")
		}

		res := tx.Model(&model.RefreshToken{}).
			Where("id = ? AND revoked_at IS NULL", rt.ID).
			Update("revoked_at", now)
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected != 1 {
			if err := tx.Model(&model.RefreshToken{}).
				Where("family_id = ? AND revoked_at IS NULL", rt.FamilyID).
				Update("revoked_at", now).Error; err != nil {
				return err
			}
			replayErr = core.UnauthorizedErr("refresh token 已失效")
			return nil
		}

		issued, err := issueTokenPair(tx, &user, rt.FamilyID)
		if err != nil {
			return err
		}
		tokens = issued
		return nil
	})
	if err != nil {
		return nil, err
	}
	if replayErr != nil {
		return nil, replayErr
	}
	return tokens, nil
}

func Logout(db *gorm.DB, rawRefresh string) {
	if rawRefresh == "" {
		return
	}
	tokenHash := core.HashRefreshToken(rawRefresh)
	now := time.Now().UTC()
	db.Model(&model.RefreshToken{}).
		Where("token_hash = ? AND revoked_at IS NULL", tokenHash).
		Update("revoked_at", now)
}

func ChangePassword(db *gorm.DB, user *model.User, currentPwd, newPwd string) error {
	if !core.VerifyPassword(currentPwd, user.PasswordHash) {
		return core.UnauthorizedErr("当前密码错误")
	}
	if err := validatePassword(newPwd); err != nil {
		return err
	}
	hash, err := core.HashPassword(newPwd)
	if err != nil {
		return core.InternalErr("密码加密失败")
	}
	user.PasswordHash = hash
	if err := db.Save(user).Error; err != nil {
		return core.InternalErr("保存密码失败")
	}
	// 吊销所有 refresh token
	now := time.Now().UTC()
	db.Model(&model.RefreshToken{}).
		Where("user_id = ? AND revoked_at IS NULL", user.ID).
		Update("revoked_at", now)
	return nil
}
