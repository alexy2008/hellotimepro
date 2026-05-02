// Package service 包含所有业务逻辑。
package service

import (
	"encoding/json"
	"os"
	"sync"

	"hellotime/gin/internal/config"
	"hellotime/gin/internal/dto"
)

var (
	avatarOnce    sync.Once
	cachedAvatars []dto.Avatar
	avatarIDSet   map[string]struct{}
)

type avatarCatalog struct {
	Avatars []struct {
		ID           string `json:"id"`
		Name         string `json:"name"`
		PrimaryColor string `json:"primaryColor"`
	} `json:"avatars"`
}

func loadAvatarsOnce() {
	avatarOnce.Do(func() {
		data, err := os.ReadFile(config.App.AvatarsCatalogPath)
		if err != nil {
			// spec 目录可能还未准备好；退化为空列表
			cachedAvatars = []dto.Avatar{}
			avatarIDSet = map[string]struct{}{}
			return
		}
		var cat avatarCatalog
		if err := json.Unmarshal(data, &cat); err != nil {
			cachedAvatars = []dto.Avatar{}
			avatarIDSet = map[string]struct{}{}
			return
		}
		avatarIDSet = make(map[string]struct{}, len(cat.Avatars))
		cachedAvatars = make([]dto.Avatar, 0, len(cat.Avatars))
		for _, a := range cat.Avatars {
			cachedAvatars = append(cachedAvatars, dto.Avatar{
				ID:           a.ID,
				Name:         a.Name,
				PrimaryColor: a.PrimaryColor,
				SvgURL:       "/static/avatars/" + a.ID + ".svg",
			})
			avatarIDSet[a.ID] = struct{}{}
		}
	})
}

// Avatars 返回所有可用头像列表。
func Avatars() []dto.Avatar {
	loadAvatarsOnce()
	return cachedAvatars
}

// IsValidAvatarID 判断给定 ID 是否在已知头像列表中。
func IsValidAvatarID(id string) bool {
	loadAvatarsOnce()
	_, ok := avatarIDSet[id]
	return ok
}
