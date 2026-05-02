package service

import (
	"strings"
	"time"

	"gorm.io/gorm"

	"hellotime/gin/internal/core"
	"hellotime/gin/internal/dto"
	"hellotime/gin/internal/model"
)

// PlazaRow 是 JOIN 查询返回的单行（capsule + owner 信息）。
type PlazaRow struct {
	model.Capsule
	OwnerNickname string
	OwnerAvatarID string
}

func buildPlazaQuery(db *gorm.DB) *gorm.DB {
	return db.Table("capsules").
		Select("capsules.*, users.nickname as owner_nickname, users.avatar_id as owner_avatar_id").
		Joins("JOIN users ON users.id = capsules.owner_id").
		Where("capsules.in_plaza = ?", true)
}

func applyFilter(q *gorm.DB, filter string) (*gorm.DB, error) {
	now := time.Now().UTC()
	switch filter {
	case "opened":
		return q.Where("capsules.open_at <= ?", now), nil
	case "unopened":
		return q.Where("capsules.open_at > ?", now), nil
	case "all", "":
		return q, nil
	default:
		return nil, core.ValidationErr("filter 仅支持 all/opened/unopened", "filter")
	}
}

func applySearch(q *gorm.DB, search string) (*gorm.DB, error) {
	s := strings.TrimSpace(search)
	if s == "" {
		return q, nil
	}
	if len([]rune(s)) > 50 {
		return nil, core.ValidationErr("q 长度不得超过 50", "q")
	}
	pattern := "%" + strings.ToLower(s) + "%"
	return q.Where("LOWER(capsules.title) LIKE ? OR LOWER(users.nickname) LIKE ?", pattern, pattern), nil
}

// PlazaList 广场列表（分页 + 排序 + 筛选 + 搜索）。
func PlazaList(db *gorm.DB, sort, filter, q string, page, pageSize int, viewerID string) (*dto.Paginated[dto.CapsuleListItem], error) {
	if sort != "hot" && sort != "new" {
		return nil, core.ValidationErr("sort 仅支持 hot/new", "sort")
	}
	if page < 1 {
		return nil, core.ValidationErr("page 必须 >= 1", "page")
	}
	if pageSize < 1 || pageSize > 50 {
		return nil, core.ValidationErr("pageSize 范围 1-50", "pageSize")
	}

	base := buildPlazaQuery(db)
	var err error
	if base, err = applyFilter(base, filter); err != nil {
		return nil, err
	}
	if base, err = applySearch(base, q); err != nil {
		return nil, err
	}

	var total int64
	if err := base.Count(&total).Error; err != nil {
		return nil, core.InternalErr("查询失败")
	}

	if sort == "hot" {
		base = base.Order("capsules.favorite_count DESC, capsules.created_at DESC")
	} else {
		base = base.Order("capsules.created_at DESC")
	}

	var rows []PlazaRow
	if err := base.Offset((page - 1) * pageSize).Limit(pageSize).Scan(&rows).Error; err != nil {
		return nil, core.InternalErr("查询失败")
	}

	capsuleIDs := make([]string, len(rows))
	for i, r := range rows {
		capsuleIDs[i] = r.ID
	}
	favMap := isFavoritedByViewer(db, viewerID, capsuleIDs)

	items := make([]dto.CapsuleListItem, len(rows))
	for i, r := range rows {
		owner := model.User{Nickname: r.OwnerNickname, AvatarID: r.OwnerAvatarID}
		items[i] = capsuleToListItem(&r.Capsule, &owner, favMap[r.ID], nil)
	}

	return &dto.Paginated[dto.CapsuleListItem]{
		Items: items,
		Pagination: dto.Pagination{
			Page:       page,
			PageSize:   pageSize,
			Total:      int(total),
			TotalPages: dto.CalcTotalPages(int(total), pageSize),
		},
	}, nil
}

// MyCapsules 返回当前用户创建的胶囊列表（分页）。
func MyCapsules(db *gorm.DB, user *model.User, page, pageSize int) (*dto.Paginated[dto.CapsuleListItem], error) {
	if page < 1 {
		return nil, core.ValidationErr("page 必须 >= 1", "page")
	}
	if pageSize < 1 || pageSize > 50 {
		return nil, core.ValidationErr("pageSize 范围 1-50", "pageSize")
	}

	var total int64
	db.Model(&model.Capsule{}).Where("owner_id = ?", user.ID).Count(&total)

	var rows []PlazaRow
	db.Table("capsules").
		Select("capsules.*, users.nickname as owner_nickname, users.avatar_id as owner_avatar_id").
		Joins("JOIN users ON users.id = capsules.owner_id").
		Where("capsules.owner_id = ?", user.ID).
		Order("capsules.created_at DESC").
		Offset((page - 1) * pageSize).Limit(pageSize).
		Scan(&rows)

	items := make([]dto.CapsuleListItem, len(rows))
	for i, r := range rows {
		owner := model.User{Nickname: r.OwnerNickname, AvatarID: r.OwnerAvatarID}
		items[i] = capsuleToListItem(&r.Capsule, &owner, false, nil)
	}

	return &dto.Paginated[dto.CapsuleListItem]{
		Items: items,
		Pagination: dto.Pagination{
			Page:       page,
			PageSize:   pageSize,
			Total:      int(total),
			TotalPages: dto.CalcTotalPages(int(total), pageSize),
		},
	}, nil
}

// FavoriteRow 是收藏 JOIN 查询行。
type FavoriteRow struct {
	model.Capsule
	OwnerNickname string
	OwnerAvatarID string
	FavCreatedAt  time.Time
}

// MyFavorites 返回当前用户收藏的胶囊列表（分页）。
func MyFavorites(db *gorm.DB, user *model.User, page, pageSize int) (*dto.Paginated[dto.CapsuleListItem], error) {
	if page < 1 {
		return nil, core.ValidationErr("page 必须 >= 1", "page")
	}
	if pageSize < 1 || pageSize > 50 {
		return nil, core.ValidationErr("pageSize 范围 1-50", "pageSize")
	}

	var total int64
	db.Model(&model.Favorite{}).Where("user_id = ?", user.ID).Count(&total)

	var rows []FavoriteRow
	db.Table("favorites").
		Select("capsules.*, users.nickname as owner_nickname, users.avatar_id as owner_avatar_id, favorites.created_at as fav_created_at").
		Joins("JOIN capsules ON capsules.id = favorites.capsule_id").
		Joins("JOIN users ON users.id = capsules.owner_id").
		Where("favorites.user_id = ?", user.ID).
		Order("favorites.created_at DESC").
		Offset((page - 1) * pageSize).Limit(pageSize).
		Scan(&rows)

	items := make([]dto.CapsuleListItem, len(rows))
	for i, r := range rows {
		owner := model.User{Nickname: r.OwnerNickname, AvatarID: r.OwnerAvatarID}
		favAt := r.FavCreatedAt
		items[i] = capsuleToListItem(&r.Capsule, &owner, true, &favAt)
	}

	return &dto.Paginated[dto.CapsuleListItem]{
		Items: items,
		Pagination: dto.Pagination{
			Page:       page,
			PageSize:   pageSize,
			Total:      int(total),
			TotalPages: dto.CalcTotalPages(int(total), pageSize),
		},
	}, nil
}
