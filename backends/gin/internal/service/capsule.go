package service

import (
	"crypto/rand"
	"errors"
	"math/big"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"hellotime/gin/internal/core"
	"hellotime/gin/internal/dto"
	"hellotime/gin/internal/model"
)

const codeAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"

func generateCode() (string, error) {
	b := make([]byte, 8)
	for i := range b {
		n, err := rand.Int(rand.Reader, big.NewInt(int64(len(codeAlphabet))))
		if err != nil {
			return "", err
		}
		b[i] = codeAlphabet[n.Int64()]
	}
	return string(b), nil
}

func isOpened(openAt time.Time) bool {
	return !openAt.After(time.Now().UTC())
}

func contentPreview(content string, opened bool) *string {
	if !opened || content == "" {
		return nil
	}
	runes := []rune(strings.TrimSpace(content))
	var preview string
	if len(runes) > 80 {
		preview = string(runes[:80]) + "…"
	} else {
		preview = string(runes)
	}
	return &preview
}

func canonicalCapsuleID(storedID string) string {
	if parsed, err := uuid.Parse(storedID); err == nil {
		return parsed.String()
	}
	return storedID
}

func byCapsuleID(query *gorm.DB, capsuleID string) *gorm.DB {
	if query.Dialector.Name() == "sqlite" {
		return query.Where("capsules.id IN ?", []string{capsuleID, strings.ReplaceAll(capsuleID, "-", "")})
	}
	return query.Where("capsules.id = ?", capsuleID)
}

func capsuleToDetail(c *model.Capsule, owner *model.User, viewerID string, favoritedByMe bool) dto.CapsuleDetail {
	opened := isOpened(c.OpenAt)
	var content *string
	if opened {
		content = &c.Content
	}
	return dto.CapsuleDetail{
		CapsuleBase: dto.CapsuleBase{
			ID:            canonicalCapsuleID(c.ID),
			Code:          c.Code,
			Title:         c.Title,
			Creator:       dto.UserBrief{Nickname: owner.Nickname, AvatarID: owner.AvatarID},
			OpenAt:        c.OpenAt,
			CreatedAt:     c.CreatedAt,
			InPlaza:       c.InPlaza,
			FavoriteCount: c.FavoriteCount,
			IsOpened:      opened,
		},
		Content:       content,
		FavoritedByMe: favoritedByMe,
	}
}

func capsuleToListItem(c *model.Capsule, owner *model.User, favoritedByMe bool, favoritedAt *time.Time) dto.CapsuleListItem {
	opened := isOpened(c.OpenAt)
	return dto.CapsuleListItem{
		CapsuleBase: dto.CapsuleBase{
			ID:            canonicalCapsuleID(c.ID),
			Code:          c.Code,
			Title:         c.Title,
			Creator:       dto.UserBrief{Nickname: owner.Nickname, AvatarID: owner.AvatarID},
			OpenAt:        c.OpenAt,
			CreatedAt:     c.CreatedAt,
			InPlaza:       c.InPlaza,
			FavoriteCount: c.FavoriteCount,
			IsOpened:      opened,
		},
		FavoritedByMe:  favoritedByMe,
		FavoritedAt:    favoritedAt,
		ContentPreview: contentPreview(c.Content, opened),
	}
}

// isFavoritedByViewer 查询 viewer 是否收藏了某批胶囊，返回 capsuleID set。
func isFavoritedByViewer(db *gorm.DB, viewerID string, capsuleIDs []string) map[string]bool {
	result := make(map[string]bool)
	if viewerID == "" || len(capsuleIDs) == 0 {
		return result
	}
	var favs []model.Favorite
	db.Where("user_id = ? AND capsule_id IN ?", viewerID, capsuleIDs).Find(&favs)
	for _, f := range favs {
		result[f.CapsuleID] = true
	}
	return result
}

func addCalendarYears(at time.Time, years int) time.Time {
	at = at.UTC()
	year, month, day := at.Date()
	year += years
	lastDay := time.Date(year, month+1, 0, 0, 0, 0, 0, time.UTC).Day()
	return time.Date(year, month, min(day, lastDay), at.Hour(), at.Minute(), at.Second(), at.Nanosecond(), time.UTC)
}

func validateOpenAt(openAt, now time.Time) error {
	if !openAt.After(now.Add(time.Minute)) {
		return core.ValidationErr("openAt 必须晚于当前时间 60 秒以上", "openAt")
	}
	if openAt.After(addCalendarYears(now, 10)) {
		return core.ValidationErr("openAt 不得超出当前时间 10 年", "openAt")
	}
	return nil
}

// CreateCapsule 创建胶囊，最多 5 次重试码冲突。
func CreateCapsule(db *gorm.DB, owner *model.User, req dto.CreateCapsuleRequest) (*dto.CapsuleDetail, error) {
	openAt := req.OpenAt.UTC()
	if err := validateOpenAt(openAt, time.Now()); err != nil {
		return nil, err
	}
	inPlaza := true
	if req.InPlaza != nil {
		inPlaza = *req.InPlaza
	}

	for i := 0; i < 5; i++ {
		code, err := generateCode()
		if err != nil {
			return nil, core.InternalErr("生成胶囊码失败")
		}
		c := model.Capsule{
			ID:      uuid.NewString(),
			OwnerID: owner.ID,
			Code:    code,
			Title:   req.Title,
			Content: req.Content,
			OpenAt:  openAt,
			InPlaza: inPlaza,
		}
		if err := db.Select("*").Create(&c).Error; err != nil {
			if strings.Contains(err.Error(), "code") ||
				strings.Contains(err.Error(), "UNIQUE") ||
				strings.Contains(err.Error(), "unique") {
				continue
			}
			return nil, core.InternalErr("创建胶囊失败")
		}
		detail := capsuleToDetail(&c, owner, owner.ID, false)
		return &detail, nil
	}
	return nil, core.InternalErr("生成唯一码失败")
}

// GetByCode 按胶囊码查询详情。
func GetByCode(db *gorm.DB, code, viewerID string) (*dto.CapsuleDetail, error) {
	codeNorm := strings.ToUpper(code)
	type row struct {
		model.Capsule
		OwnerNickname string
		OwnerAvatarID string
	}
	var r row
	if err := db.Table("capsules").
		Select("capsules.*, users.nickname as owner_nickname, users.avatar_id as owner_avatar_id").
		Joins("JOIN users ON users.id = capsules.owner_id").
		Where("capsules.code = ?", codeNorm).
		Scan(&r).Error; err != nil || r.ID == "" {
		return nil, core.NotFoundErr("胶囊不存在")
	}
	owner := model.User{Nickname: r.OwnerNickname, AvatarID: r.OwnerAvatarID}
	favoritedByMe := false
	if viewerID != "" {
		var count int64
		db.Model(&model.Favorite{}).Where("user_id = ? AND capsule_id = ?", viewerID, r.ID).Count(&count)
		favoritedByMe = count > 0
	}
	detail := capsuleToDetail(&r.Capsule, &owner, viewerID, favoritedByMe)
	return &detail, nil
}

// GetPlazaDetail 按 ID 查广场内胶囊详情。
func GetPlazaDetail(db *gorm.DB, capsuleID, viewerID string) (*dto.CapsuleDetail, error) {
	type row struct {
		model.Capsule
		OwnerNickname string
		OwnerAvatarID string
	}
	var r row
	if err := byCapsuleID(db.Table("capsules"), capsuleID).
		Select("capsules.*, users.nickname as owner_nickname, users.avatar_id as owner_avatar_id").
		Joins("JOIN users ON users.id = capsules.owner_id").
		Where("capsules.in_plaza = ?", true).
		Scan(&r).Error; err != nil || r.ID == "" {
		return nil, core.NotFoundErr("胶囊不存在")
	}
	owner := model.User{Nickname: r.OwnerNickname, AvatarID: r.OwnerAvatarID}
	favoritedByMe := false
	if viewerID != "" {
		var count int64
		db.Model(&model.Favorite{}).Where("user_id = ? AND capsule_id = ?", viewerID, r.ID).Count(&count)
		favoritedByMe = count > 0
	}
	detail := capsuleToDetail(&r.Capsule, &owner, viewerID, favoritedByMe)
	return &detail, nil
}

func lockCapsule(tx *gorm.DB, capsuleID string) (model.Capsule, error) {
	if tx.Dialector.Name() == "postgres" {
		tx = tx.Clauses(clause.Locking{Strength: "UPDATE"})
	}
	var capsule model.Capsule
	err := byCapsuleID(tx, capsuleID).Take(&capsule).Error
	return capsule, err
}

// DeleteOwnCapsule 删除自己创建的胶囊。
func DeleteOwnCapsule(db *gorm.DB, user *model.User, capsuleID string) error {
	return db.Transaction(func(tx *gorm.DB) error {
		capsule, err := lockCapsule(tx, capsuleID)
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return core.NotFoundErr("胶囊不存在")
		}
		if err != nil {
			return err
		}
		if capsule.OwnerID != user.ID {
			return core.ForbiddenErr("无权删除他人胶囊")
		}
		if err := tx.Where("capsule_id = ?", capsule.ID).Delete(&model.Favorite{}).Error; err != nil {
			return err
		}
		return tx.Delete(&capsule).Error
	})
}
