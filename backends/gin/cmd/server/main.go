// Package main 是 HelloTime Pro Gin 后端的启动入口。
package main

import (
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"

	"hellotime/gin/internal/config"
	"hellotime/gin/internal/db"
	"hellotime/gin/internal/handler"
	"hellotime/gin/internal/middleware"
)

func main() {
	syncStaticAssets()

	gormDB, err := db.Open()
	if err != nil {
		log.Fatalf("无法连接数据库: %v", err)
	}

	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.Use(gin.Logger(), gin.Recovery())

	r.Use(cors.New(cors.Config{
		AllowAllOrigins:  true,
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: false,
	}))

	// 静态资源：GIN_ROOT 或当前工作目录下的 static/
	staticDir := filepath.Join(ginRoot(), "static")
	r.Static("/static", staticDir)

	// ---------- 路由 ----------
	v1 := r.Group("/api/v1")

	v1.GET("/health", handler.GetHealth)
	v1.GET("/avatars", handler.GetAvatars)
	v1.POST("/stack-narration", handler.PostStackNarration)
	v1.POST("/capsule-suggestion", handler.PostCapsuleSuggestion)

	auth := v1.Group("/auth")
	{
		auth.POST("/register", handler.PostRegister(gormDB))
		auth.POST("/login", handler.PostLogin(gormDB))
		auth.POST("/refresh", handler.PostRefresh(gormDB))
		auth.POST("/logout", handler.PostLogout(gormDB))
	}

	capsules := v1.Group("/capsules")
	{
		capsules.POST("", middleware.RequireAuth(gormDB), handler.PostCapsule(gormDB))
		capsules.GET("/:code", middleware.OptionalAuth(gormDB), handler.GetCapsuleByCode(gormDB))
	}

	plaza := v1.Group("/plaza")
	plaza.Use(middleware.OptionalAuth(gormDB))
	{
		plaza.GET("/capsules", handler.GetPlazaCapsules(gormDB))
		plaza.GET("/capsules/:id", handler.GetPlazaCapsuleDetail(gormDB))
	}

	me := v1.Group("/me")
	me.Use(middleware.RequireAuth(gormDB))
	{
		me.GET("", handler.GetMe)
		me.PATCH("", handler.PatchMe(gormDB))
		me.POST("/password", handler.PostPassword(gormDB))
		me.GET("/capsules", handler.GetMyCapsules(gormDB))
		me.DELETE("/capsules/:id", handler.DeleteMyCapsule(gormDB))
		me.GET("/favorites", handler.GetMyFavorites(gormDB))
		me.POST("/favorites", handler.PostFavorite(gormDB))
		me.DELETE("/favorites/:capsuleId", handler.DeleteFavorite(gormDB))
	}

	addr := fmt.Sprintf("%s:%d", config.App.Host, config.App.Port)
	log.Printf("HelloTime Pro · Gin 启动于 http://%s  (DB: %s)", addr, config.App.DBDriver)
	if err := r.Run(addr); err != nil && err != http.ErrServerClosed {
		log.Fatalf("服务启动失败: %v", err)
	}
}

// ginRoot 返回 backends/gin/ 目录路径。
// 优先使用 GIN_ROOT 环境变量（由 ./run 脚本注入），退化到当前工作目录。
func ginRoot() string {
	if root := os.Getenv("GIN_ROOT"); root != "" {
		return root
	}
	wd, err := os.Getwd()
	if err != nil {
		return "."
	}
	return wd
}

// syncStaticAssets 从 spec/ 拷贝头像和图标到 static/ 目录。
func syncStaticAssets() {
	root := ginRoot()
	staticDir := filepath.Join(root, "static")

	copyDir := func(srcDir, dstDir string) {
		entries, err := os.ReadDir(srcDir)
		if err != nil {
			return
		}
		if err := os.MkdirAll(dstDir, 0o755); err != nil {
			return
		}
		for _, e := range entries {
			if e.IsDir() || filepath.Ext(e.Name()) != ".svg" {
				continue
			}
			src := filepath.Join(srcDir, e.Name())
			dst := filepath.Join(dstDir, e.Name())
			srcInfo, err := os.Stat(src)
			if err != nil {
				continue
			}
			if dstInfo, err := os.Stat(dst); err == nil && !srcInfo.ModTime().After(dstInfo.ModTime()) {
				continue
			}
			copyFile(src, dst)
		}
	}

	copyDir(config.App.AvatarsSourceDir, filepath.Join(staticDir, "avatars"))
	copyDir(config.App.IconsSourceDir, filepath.Join(staticDir, "icons"))
}

func copyFile(src, dst string) {
	in, err := os.Open(src)
	if err != nil {
		return
	}
	defer in.Close()
	out, err := os.Create(dst)
	if err != nil {
		return
	}
	defer out.Close()
	_, _ = io.Copy(out, in)
}
