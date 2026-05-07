package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"hellotime/gin/internal/core"
	"hellotime/gin/internal/dto"
	"hellotime/gin/internal/middleware"
	"hellotime/gin/internal/service"
)

// PostCapsuleSuggestion POST /api/v1/capsule-suggestion
func PostCapsuleSuggestion(c *gin.Context) {
	var req dto.CapsuleSuggestionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondErr(c, core.ValidationErr(err.Error(), "title"))
		return
	}
	c.JSON(http.StatusOK, dto.OK(service.SuggestCapsule(req)))
}
