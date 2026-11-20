package service

import (
	"time"

	"gorm.io/gorm"

	"hellotime/gin/internal/core"
	"hellotime/gin/internal/dto"
	"hellotime/gin/internal/model"
)

const openCounts = `COUNT(CASE WHEN capsules.open_at <= ? THEN 1 END) AS opened,
	COUNT(CASE WHEN capsules.open_at > ? THEN 1 END) AS unopened`

func PlazaStats(db *gorm.DB, search string) (*dto.PlazaStats, error) {
	now := time.Now().UTC()
	query, err := plazaQuery(db, search)
	if err != nil {
		return nil, err
	}

	var stats dto.PlazaStats
	if err := query.Select(`COUNT(*) AS "all", `+openCounts, now, now).Scan(&stats.Counts).Error; err != nil {
		return nil, core.InternalErr("查询广场统计失败")
	}
	stats.FarthestOpenAt, err = firstOpenAt(plazaCapsules(db).Order("open_at DESC"))
	if err != nil {
		return nil, err
	}
	stats.NextOpenAt, err = firstOpenAt(plazaCapsules(db).Where("open_at > ?", now).Order("open_at ASC"))
	if err != nil {
		return nil, err
	}
	return &stats, nil
}

func firstOpenAt(query *gorm.DB) (*time.Time, error) {
	var capsule model.Capsule
	result := query.Select("open_at").Limit(1).Find(&capsule)
	if result.Error != nil {
		return nil, core.InternalErr("查询广场开启时间失败")
	}
	if result.RowsAffected == 0 {
		return nil, nil
	}
	openAt := capsule.OpenAt.UTC()
	return &openAt, nil
}

func MyStats(db *gorm.DB, user *model.User) (*dto.MyStats, error) {
	now := time.Now().UTC()
	var stats dto.MyStats
	if err := db.Model(&model.Capsule{}).Where("owner_id = ?", user.ID).
		Select(`COUNT(*) AS created, `+openCounts+`,
			COUNT(CASE WHEN in_plaza THEN 1 END) AS in_plaza,
			COALESCE(SUM(favorite_count), 0) AS favorites_received`, now, now).
		Scan(&stats).Error; err != nil {
		return nil, core.InternalErr("查询个人统计失败")
	}
	if err := db.Model(&model.Favorite{}).Where("user_id = ?", user.ID).Count(&stats.FavoritesGiven).Error; err != nil {
		return nil, core.InternalErr("查询收藏统计失败")
	}
	return &stats, nil
}
