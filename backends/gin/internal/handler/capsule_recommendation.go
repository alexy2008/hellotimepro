package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"hellotime/gin/internal/core"
	"hellotime/gin/internal/dto"
	"hellotime/gin/internal/middleware"
	"hellotime/gin/internal/service"
)

// GetCapsuleRecommendations GET /api/v1/capsule-recommendations
func GetCapsuleRecommendations(c *gin.Context) {
	count := 4
	if raw := c.Query("count"); raw != "" {
		n, err := strconv.Atoi(raw)
		if err != nil || n < 3 || n > 8 {
			middleware.RespondErr(c, core.ValidationErr("count must be an integer in [3, 8]", "count"))
			return
		}
		count = n
	}
	locale := c.DefaultQuery("locale", "zh-CN")
	c.JSON(http.StatusOK, dto.OK(service.GetCapsuleRecommendations(count, locale)))
}
