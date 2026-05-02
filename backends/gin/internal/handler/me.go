package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"hellotime/gin/internal/core"
	"hellotime/gin/internal/dto"
	"hellotime/gin/internal/middleware"
	"hellotime/gin/internal/service"
)

// GetMe GET /api/v1/me
func GetMe(c *gin.Context) {
	user := middleware.CurrentUser(c)
	c.JSON(http.StatusOK, dto.OK(service.GetMe(user)))
}

// PatchMe PATCH /api/v1/me
func PatchMe(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		user := middleware.CurrentUser(c)
		var req dto.UpdateProfileRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			middleware.RespondErr(c, core.ValidationErr(err.Error(), "body"))
			return
		}
		if req.Nickname == nil && req.AvatarID == nil {
			middleware.RespondErr(c, core.ValidationErr("nickname / avatarId 至少提供一个", "body"))
			return
		}
		out, err := service.UpdateProfile(db, user, req)
		if err != nil {
			middleware.RespondErr(c, err)
			return
		}
		c.JSON(http.StatusOK, dto.OK(out))
	}
}

// PostPassword POST /api/v1/me/password
func PostPassword(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		user := middleware.CurrentUser(c)
		var req dto.ChangePasswordRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			middleware.RespondErr(c, core.ValidationErr(err.Error(), "body"))
			return
		}
		if err := service.ChangePassword(db, user, req.CurrentPassword, req.NewPassword); err != nil {
			middleware.RespondErr(c, err)
			return
		}
		c.Status(http.StatusNoContent)
	}
}

// GetMyCapsules GET /api/v1/me/capsules
func GetMyCapsules(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		user := middleware.CurrentUser(c)
		page, err := queryInt(c, "page", 1)
		if err != nil {
			middleware.RespondErr(c, err)
			return
		}
		pageSize, err := queryInt(c, "pageSize", 20)
		if err != nil {
			middleware.RespondErr(c, err)
			return
		}
		data, err := service.MyCapsules(db, user, page, pageSize)
		if err != nil {
			middleware.RespondErr(c, err)
			return
		}
		c.JSON(http.StatusOK, dto.OK(data))
	}
}

// DeleteMyCapsule DELETE /api/v1/me/capsules/:id
func DeleteMyCapsule(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		user := middleware.CurrentUser(c)
		capsuleID := c.Param("id")
		if err := service.DeleteOwnCapsule(db, user, capsuleID); err != nil {
			middleware.RespondErr(c, err)
			return
		}
		c.Status(http.StatusNoContent)
	}
}
