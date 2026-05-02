package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"hellotime/gin/internal/core"
	"hellotime/gin/internal/dto"
	"hellotime/gin/internal/middleware"
	"hellotime/gin/internal/service"
)

func queryInt(c *gin.Context, key string, def int) (int, error) {
	raw := c.Query(key)
	if raw == "" {
		return def, nil
	}
	n, err := strconv.Atoi(raw)
	if err != nil {
		return 0, core.ValidationErr(key+" 必须是整数", key)
	}
	return n, nil
}

// GetPlazaCapsules GET /api/v1/plaza/capsules
func GetPlazaCapsules(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		sort := c.DefaultQuery("sort", "new")
		filter := c.DefaultQuery("filter", "all")
		q := c.Query("q")

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

		viewerID := middleware.ViewerID(c)
		data, err := service.PlazaList(db, sort, filter, q, page, pageSize, viewerID)
		if err != nil {
			middleware.RespondErr(c, err)
			return
		}
		c.JSON(http.StatusOK, dto.OK(data))
	}
}

// GetPlazaCapsuleDetail GET /api/v1/plaza/capsules/:id
func GetPlazaCapsuleDetail(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		capsuleID := c.Param("id")
		if capsuleID == "" {
			middleware.RespondErr(c, core.ValidationErr("缺少 capsuleId", "id"))
			return
		}
		viewerID := middleware.ViewerID(c)
		detail, err := service.GetPlazaDetail(db, capsuleID, viewerID)
		if err != nil {
			middleware.RespondErr(c, err)
			return
		}
		c.JSON(http.StatusOK, dto.OK(detail))
	}
}
