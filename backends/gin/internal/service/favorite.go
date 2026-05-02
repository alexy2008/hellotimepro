package service

import (
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"hellotime/gin/internal/core"
	"hellotime/gin/internal/dto"
	"hellotime/gin/internal/model"
)

// AddFavorite 收藏胶囊（幂等）。
func AddFavorite(db *gorm.DB, user *model.User, capsuleID string) (*dto.FavoriteResult, error) {
	var c model.Capsule
	if err := db.First(&c, "id = ? AND in_plaza = ?", capsuleID, true).Error; err != nil {
		return nil, core.NotFoundErr("胶囊不存在")
	}
	if c.OwnerID == user.ID {
		return nil, core.BadRequestErr("不能收藏自己创建的胶囊")
	}

	// 幂等：已收藏直接返回
	var existing model.Favorite
	if err := db.Where("user_id = ? AND capsule_id = ?", user.ID, capsuleID).First(&existing).Error; err == nil {
		return &dto.FavoriteResult{
			CapsuleID:     c.ID,
			FavoriteCount: c.FavoriteCount,
			FavoritedAt:   existing.CreatedAt,
		}, nil
	}

	now := time.Now().UTC()
	fav := model.Favorite{UserID: user.ID, CapsuleID: capsuleID, CreatedAt: now}
	inserted := false

	err := db.Transaction(func(tx *gorm.DB) error {
		res := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&fav)
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return nil
		}
		inserted = true
		return tx.Model(&model.Capsule{}).
			Where("id = ?", capsuleID).
			UpdateColumn("favorite_count", gorm.Expr("favorite_count + 1")).Error
	})
	if err != nil {
		return nil, core.InternalErr("收藏失败")
	}

	if !inserted {
		var existing model.Favorite
		if err := db.Where("user_id = ? AND capsule_id = ?", user.ID, capsuleID).First(&existing).Error; err != nil {
			return nil, core.InternalErr("读取收藏状态失败")
		}
		db.First(&c, "id = ?", capsuleID)
		return &dto.FavoriteResult{
			CapsuleID:     c.ID,
			FavoriteCount: c.FavoriteCount,
			FavoritedAt:   existing.CreatedAt,
		}, nil
	}

	// 刷新 favorite_count
	db.First(&c, "id = ?", capsuleID)
	return &dto.FavoriteResult{
		CapsuleID:     c.ID,
		FavoriteCount: c.FavoriteCount,
		FavoritedAt:   now,
	}, nil
}

// RemoveFavorite 取消收藏（幂等）。
func RemoveFavorite(db *gorm.DB, user *model.User, capsuleID string) error {
	var fav model.Favorite
	if err := db.Where("user_id = ? AND capsule_id = ?", user.ID, capsuleID).First(&fav).Error; err != nil {
		// 不存在 → 幂等，不报错
		return nil
	}
	return db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Delete(&fav).Error; err != nil {
			return err
		}
		return tx.Model(&model.Capsule{}).
			Where("id = ? AND favorite_count > 0", capsuleID).
			UpdateColumn("favorite_count", gorm.Expr("favorite_count - 1")).Error
	})
}
