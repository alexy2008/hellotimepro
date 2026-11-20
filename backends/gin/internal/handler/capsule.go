package handler

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"hellotime/gin/internal/core"
	"hellotime/gin/internal/dto"
	"hellotime/gin/internal/middleware"
	"hellotime/gin/internal/service"
)

func parseCapsuleID(rawID, field string) (string, error) {
	if err := uuid.Validate(rawID); err != nil {
		return "", core.ValidationErr(field+" 必须是有效的 UUID", field)
	}
	return uuid.MustParse(rawID).String(), nil
}

// PostCapsule POST /api/v1/capsules
func PostCapsule(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		user := middleware.CurrentUser(c)
		var req dto.CreateCapsuleRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			middleware.RespondErr(c, core.ValidationErr(err.Error(), "body"))
			return
		}
		detail, err := service.CreateCapsule(db, user, req)
		if err != nil {
			middleware.RespondErr(c, err)
			return
		}
		c.JSON(http.StatusCreated, dto.OK(detail))
	}
}

// GetCapsuleByCode GET /api/v1/capsules/:code
func GetCapsuleByCode(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		code := strings.ToUpper(c.Param("code"))
		if len(code) != 8 {
			middleware.RespondErr(c, core.ValidationErr("code 必须是 8 位字符", "code"))
			return
		}
		viewerID := middleware.ViewerID(c)
		detail, err := service.GetByCode(db, code, viewerID)
		if err != nil {
			middleware.RespondErr(c, err)
			return
		}
		c.JSON(http.StatusOK, dto.OK(detail))
	}
}
