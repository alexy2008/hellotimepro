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

// PostRegister POST /api/v1/auth/register
func PostRegister(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req dto.RegisterRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			middleware.RespondErr(c, core.ValidationErr(err.Error(), "body"))
			return
		}
		tokens, err := service.Register(db, req.Email, req.Password, req.Nickname, req.AvatarID)
		if err != nil {
			middleware.RespondErr(c, err)
			return
		}
		c.JSON(http.StatusCreated, dto.OK(tokens))
	}
}

// PostLogin POST /api/v1/auth/login
func PostLogin(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req dto.LoginRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			middleware.RespondErr(c, core.ValidationErr(err.Error(), "body"))
			return
		}
		tokens, err := service.Login(db, req.Email, req.Password)
		if err != nil {
			middleware.RespondErr(c, err)
			return
		}
		c.JSON(http.StatusOK, dto.OK(tokens))
	}
}

// PostRefresh POST /api/v1/auth/refresh
func PostRefresh(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req dto.RefreshRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			middleware.RespondErr(c, core.ValidationErr(err.Error(), "refreshToken"))
			return
		}
		tokens, err := service.Refresh(db, req.RefreshToken)
		if err != nil {
			middleware.RespondErr(c, err)
			return
		}
		c.JSON(http.StatusOK, dto.OK(tokens))
	}
}

// PostLogout POST /api/v1/auth/logout
func PostLogout(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req dto.LogoutRequest
		// body 可为空，忽略绑定错误
		_ = c.ShouldBindJSON(&req)
		service.Logout(db, req.RefreshToken)
		c.Status(http.StatusNoContent)
	}
}
