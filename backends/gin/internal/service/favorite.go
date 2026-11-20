package service

import (
	"errors"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"hellotime/gin/internal/core"
	"hellotime/gin/internal/dto"
	"hellotime/gin/internal/model"
)

// AddFavorite 收藏胶囊（幂等）。
func AddFavorite(db *gorm.DB, user *model.User, capsuleID string) (*dto.FavoriteResult, error) {
	var result dto.FavoriteResult
	err := db.Transaction(func(tx *gorm.DB) error {
		capsule, err := lockCapsule(tx, capsuleID)
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return core.NotFoundErr("胶囊不存在")
		}
		if err != nil {
			return err
		}
		favorite := model.Favorite{UserID: user.ID, CapsuleID: capsule.ID, CreatedAt: time.Now().UTC().Truncate(time.Microsecond)}
		insert := tx.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "user_id"}, {Name: "capsule_id"}},
			DoNothing: true,
		}).Create(&favorite)
		if insert.Error != nil {
			return insert.Error
		}
		if insert.RowsAffected == 0 {
			if err := tx.Select("created_at").Take(&favorite).Error; err != nil {
				return err
			}
		} else {
			if err := tx.Model(&capsule).UpdateColumn("favorite_count", gorm.Expr("favorite_count + 1")).Error; err != nil {
				return err
			}
			capsule.FavoriteCount++
		}
		result = dto.FavoriteResult{
			CapsuleID:     canonicalCapsuleID(capsule.ID),
			FavoriteCount: capsule.FavoriteCount,
			FavoritedAt:   favorite.CreatedAt,
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &result, nil
}

// RemoveFavorite 取消收藏（幂等）。
func RemoveFavorite(db *gorm.DB, user *model.User, capsuleID string) error {
	return db.Transaction(func(tx *gorm.DB) error {
		capsule, err := lockCapsule(tx, capsuleID)
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil
		}
		if err != nil {
			return err
		}
		deleted := tx.Where("user_id = ? AND capsule_id = ?", user.ID, capsule.ID).
			Delete(&model.Favorite{})
		if deleted.Error != nil {
			return deleted.Error
		}
		if deleted.RowsAffected == 0 {
			return nil
		}
		return tx.Model(&capsule).
			Where("favorite_count > 0").
			UpdateColumn("favorite_count", gorm.Expr("favorite_count - 1")).Error
	})
}
