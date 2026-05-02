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

// GetMyFavorites GET /api/v1/me/favorites
func GetMyFavorites(db *gorm.DB) gin.HandlerFunc {
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
		data, err := service.MyFavorites(db, user, page, pageSize)
		if err != nil {
			middleware.RespondErr(c, err)
			return
		}
		c.JSON(http.StatusOK, dto.OK(data))
	}
}

// PostFavorite POST /api/v1/me/favorites
func PostFavorite(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		user := middleware.CurrentUser(c)
		var req dto.FavoriteRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			middleware.RespondErr(c, core.ValidationErr(err.Error(), "capsuleId"))
			return
		}
		result, err := service.AddFavorite(db, user, req.CapsuleID)
		if err != nil {
			middleware.RespondErr(c, err)
			return
		}
		c.JSON(http.StatusOK, dto.OK(result))
	}
}

// DeleteFavorite DELETE /api/v1/me/favorites/:capsuleId
func DeleteFavorite(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		user := middleware.CurrentUser(c)
		capsuleID := c.Param("capsuleId")
		if capsuleID == "" {
			middleware.RespondErr(c, core.ValidationErr("缺少 capsuleId", "capsuleId"))
			return
		}
		if err := service.RemoveFavorite(db, user, capsuleID); err != nil {
			middleware.RespondErr(c, err)
			return
		}
		c.Status(http.StatusNoContent)
	}
}
