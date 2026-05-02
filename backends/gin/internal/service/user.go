package service

import (
	"strings"

	"gorm.io/gorm"

	"hellotime/gin/internal/core"
	"hellotime/gin/internal/dto"
	"hellotime/gin/internal/model"
)

// GetMe 返回当前用户资料。
func GetMe(user *model.User) dto.UserOut {
	return userToOut(user)
}

// UpdateProfile 修改昵称或头像。
func UpdateProfile(db *gorm.DB, user *model.User, req dto.UpdateProfileRequest) (*dto.UserOut, error) {
	if req.Nickname != nil && *req.Nickname != user.Nickname {
		nick := strings.TrimSpace(*req.Nickname)
		if err := validateNickname(nick); err != nil {
			return nil, err
		}
		var count int64
		db.Model(&model.User{}).Where("nickname = ? AND id != ?", nick, user.ID).Count(&count)
		if count > 0 {
			return nil, core.ConflictErr("昵称已被使用", "nickname")
		}
		user.Nickname = nick
	}

	if req.AvatarID != nil {
		if !IsValidAvatarID(*req.AvatarID) {
			return nil, core.ValidationErr("头像 ID 不存在", "avatarId")
		}
		user.AvatarID = *req.AvatarID
	}

	if err := db.Save(user).Error; err != nil {
		return nil, core.InternalErr("保存资料失败")
	}

	out := userToOut(user)
	return &out, nil
}
