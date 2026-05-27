# HelloTime Pro Gin 后端技术手册与代码导读

本文面向已经熟悉 Go 基本语法（包、结构体、接口、切片/映射、goroutine、`error` 返回值、`defer`），但还没系统接触过 Gin、GORM、JWT 这套 Web 技术栈的读者。读完后，你应该能回答三件事：

- 一个 HTTP 请求进入后端后，代码按什么顺序执行。
- Gin、GORM、golang-migrate、`golang-jwt`、`bcrypt` 分别负责什么。
- 想新增一个接口、字段或业务规则时，应该改哪些文件。

> 阅读建议：第 1 节介绍技术栈与设计特色；第 2～4 节建立整体地图与入口；第 5 节集中讲 Gin 的几个核心机制（路由分组、中间件链、context）；第 6～13 节按一次请求的生命周期分层细讲；第 14 节给出常见改动的步骤清单。

## 1. 技术选型与设计特色

HelloTime Pro 的 Gin 后端实现基于 **Go + Gin + GORM** 核心骨架，并选用 **golang-migrate** 管理数据库迁移、**golang-jwt** 结合 **bcrypt** 提供安全的 JWT 与密码处理，同时支持 **PostgreSQL** 和 **SQLite** 双数据库驱动切换。其具体选型考量与设计特色如下：

* **Go 与 Gin（天然的高并发与极速 HTTP 路由）**：利用 Go 语言轻量级协程（Goroutine）和原生高并发的优势，配合 Gin 轻量级的 HTTP 路由与中间件链，实现极低的请求延迟与优异的吞吐量。
* **GORM（简洁高效的 ORM 数据库访问）**：选用 Go 生态最主流 of GORM 库作为数据库访问层，通过简洁的结构体标签（Struct Tags）实现强大的表关系映射与自动数据映射，大幅简化了数据持久化代码。
* **双数据库自适应与二进制静态打包**：项目同时支持 SQLite 和 PostgreSQL。在 SQLite 模式下对路径与锁行为进行了精细设计，并在 Go 编译时利用 `//go:embed` 将 SQL 迁移脚本直接编译进二进制文件，使得程序可以在无任何外部依赖的情况下单文件部署运行。
* **清晰的四层架构设计**：项目在内部（`internal/`）划分了配置层（Config）、错误与安全工具（Core）、数据模型（Model/Db）、请求/响应数据载体（DTO）以及业务逻辑（Service），实现了严格的展示与业务分离，行文清晰易读。

## 2. 先建立整体地图

HelloTime Pro 是一个时间胶囊应用。Gin 后端的职责是：

- 提供 `/api/v1/*` HTTP API（与 `spec/api/openapi.yaml` 对齐）。
- 校验请求数据：邮箱格式、密码强度、胶囊开启时间等。
- 处理用户注册、登录、JWT access token、refresh token 轮转（含令牌族追踪）。
- 读写用户、胶囊、收藏、refresh token 等数据，并维护反规范化字段 `favorite_count`。
- 在 PostgreSQL 和 SQLite 之间无缝切换（通过环境变量），同一份业务代码两边都跑得动。
- 暴露 `spec/avatars/*`、`spec/icons/*` 作为静态资源，并提供 LLM 胶囊建议接口。

核心目录：

```text
backends/gin/
├── go.mod / go.sum                       # Go Modules，记录依赖与版本
├── run / build / test                    # 三个 Bash 脚本，封装 go 命令并注入数据库环境变量
├── cmd/
│   └── server/main.go                    # main 入口：装配数据库、路由、中间件，启动 HTTP server
├── static/                               # 启动时从 spec/{avatars,icons} 拷贝过来的 SVG
└── internal/                             # internal 目录禁止被外部 module 导入
    ├── config/                           # 环境变量 → Settings 单例（init() 函数）
    ├── core/                             # 错误码 (APIError) + 鉴权原语 (bcrypt / JWT / refresh token)
    ├── db/
    │   ├── database.go                   # gorm.Open + 执行 golang-migrate
    │   └── migrations/{postgres,sqlite}/ # SQL 迁移文件，//go:embed 进二进制
    ├── model/models.go                   # GORM 结构体（带 `gorm:"..."` tag），对应数据库表
    ├── dto/                              # 请求 / 响应数据载体（带 `json:"..."` 和 `binding:"..."` tag）
    ├── service/                          # 业务层：auth / capsule / favorite / plaza / user / avatar / llm
    ├── handler/                          # Gin 路由处理函数：解参数 → 调 service → 写响应
    └── middleware/auth.go                # Bearer token 解析 + 统一错误响应工具
```

一次典型请求的流向：

```text
浏览器 / 前端
  │ HTTP
  ▼
Go 标准库 net/http Server
  │ 每个连接一个 goroutine
  ▼
Gin Engine.ServeHTTP
  │ 按 URL/方法匹配路由
  ▼
中间件链：Logger → Recovery → CORS → (RequireAuth / OptionalAuth)
  │
  ▼
internal/handler/*.go
  │ ShouldBindJSON 反序列化 + 字段校验
  │ middleware.CurrentUser(c) 取出已鉴权用户
  ▼
internal/service/*.go
  │ 业务规则，调用 *gorm.DB
  ▼
GORM → database/sql → 驱动
  │
  ▼
PostgreSQL 或 SQLite
```

返回方向：service 把数据库行转成 `dto.*` 结构体，handler 用 `dto.OK(...)` 包一层「成功外壳」，`c.JSON(...)` 把对象用 `encoding/json` 写回响应。出错时一律走 `middleware.RespondErr(c, err)`，按 `APIError.StatusCode` 输出统一的「错误外壳」。

## 3. 如何运行和验证

开发运行：

```bash
cd backends/gin
DB_DRIVER=sqlite ./run      # 零依赖
./run                       # 默认 PostgreSQL（先 docker compose up -d postgres）
```

默认端口是 `29020`。启动后可访问：

- 健康检查：`http://127.0.0.1:29020/api/v1/health`
- 头像列表：`http://127.0.0.1:29020/api/v1/avatars`

测试（默认走 SQLite，无外部依赖）：

```bash
./test
```

构建静态二进制：

```bash
./build
# 产物在 bin/hellotime-gin
GIN_ROOT=$PWD ./bin/hellotime-gin    # 二进制需要知道 static/ 目录在哪
```

三个脚本做的事：

- `run`：根据 `DB_DRIVER` 设置 `DB_URL`，把 `postgres://` 标准化成 `postgresql://`，可选灌入演示数据，然后 `go run ./cmd/server/.`。
- `test`：用临时 SQLite 文件，`go test ./...`。
- `build`：`go mod tidy && go mod verify`，再 `CGO_ENABLED=1 go build`（CGO 是 `mattn/go-sqlite3` 的依赖要求）。

> 第一次运行会下载 Go 模块（约 30～60 秒），之后缓存到 `$GOPATH/pkg/mod`。

## 4. 入口：`cmd/server/main.go`

整个应用的启动顺序大概是这样：

```go
func main() {
    syncStaticAssets()                    // 从 spec/ 拷贝 SVG 到 static/
    gormDB, err := db.Open()              // 建连接 + 跑 migrate.Up
    if err != nil { log.Fatalf(...) }

    gin.SetMode(gin.ReleaseMode)
    r := gin.New()                        // 一个新的 Engine
    r.Use(gin.Logger(), gin.Recovery())   // 全局中间件
    r.Use(cors.New(cors.Config{...}))

    r.Static("/static", staticDir)        // 静态文件路由

    v1 := r.Group("/api/v1")
    v1.GET("/health", handler.GetHealth)
    auth    := v1.Group("/auth")     { ... }
    capsules := v1.Group("/capsules") { ... }
    plaza   := v1.Group("/plaza").Use(middleware.OptionalAuth(gormDB)) { ... }
    me      := v1.Group("/me").Use(middleware.RequireAuth(gormDB))     { ... }

    r.Run(addr)                           // 阻塞，监听 :29020
}
```

几个 Go/Gin 特有的细节：

- **`gin.Engine` 就是 `http.Handler`**：`r.Run(addr)` 等价于 `http.ListenAndServe(addr, r)`，Gin 没有自己的 server，只是个路由器 + 中间件框架。
- **`gin.SetMode(gin.ReleaseMode)`**：关闭调试日志和颜色输出。开发期可以去掉，看 banner。
- **`gin.Logger()` 与 `gin.Recovery()`**：Gin 自带的两个中间件。Recovery 把每个请求里的 panic 捕获成 500，避免一个请求挂掉整个 server。
- **静态资源同步**：每个后端实现需要展示同样的头像/图标，所以启动时把仓库的 `spec/{avatars,icons}/*.svg` 拷贝到 `static/`，再用 `r.Static` 暴露出去。

## 5. Gin 的几个关键思想

Gin 没有「魔法」，但有 **三件事** 对刚从 `net/http` 切过来的人最直观地体现框架价值。看懂它们，剩下都是 Go 标准写法。

### 4.1 路由分组（Group）

```go
v1 := r.Group("/api/v1")
me := v1.Group("/me")
me.Use(middleware.RequireAuth(gormDB))
{
    me.GET("",          handler.GetMe)
    me.PATCH("",        handler.PatchMe(gormDB))
    me.POST("/password", handler.PostPassword(gormDB))
    ...
}
```

- `Group` 返回的还是一个能挂中间件、能注册路由的对象，公共 URL 前缀和中间件一次配齐。
- 三个组的鉴权策略不同：`/auth` 公开，`/capsules` 用 `OptionalAuth`（登录可选），`/me` 用 `RequireAuth`（必须登录）。`/plaza` 同样可选，因为列表里要根据登录状态返回 `favoritedByMe`。
- 这里没有用大括号开作用域的语义——`{ ... }` 纯粹是 `gofmt` 接受的写法，视觉上提示这一组属于上面的 Group。

### 4.2 中间件链与 `*gin.Context`

Gin 的中间件就是一个函数：

```go
type HandlerFunc func(*gin.Context)
```

每个请求会按 `Use` 的顺序依次执行所有中间件 + 最终 handler。链条由 `c.Next()` / `c.Abort()` 控制：

```go
func RequireAuth(db *gorm.DB) gin.HandlerFunc {
    return func(c *gin.Context) {
        token := parseBearer(c)
        if token == "" {
            RespondErr(c, core.UnauthorizedErr("缺少 access token"))
            c.Abort()           // 立刻终止，后续 handler 不会执行
            return
        }
        ...
        c.Set(CtxUser, &user)   // 把用户写进当前请求的 KV 上下文
        c.Next()                // 继续往下走
    }
}
```

- `*gin.Context` 是 Gin 的灵魂：它把 `http.Request`、`http.ResponseWriter`、URL 参数、JSON 反序列化、key-value 上下文都包成了一个对象。
- `c.Set(key, value)` / `c.Get(key)` 让中间件与 handler 共享数据。本项目用 `CtxUser` 和 `CtxViewerID` 两个 key 传递鉴权结果。
- `c.Abort()` 与 `c.Next()`：决定责任链是否继续。如果一个中间件既不 `Abort` 也不 `Next`，链会自动继续；写 `Abort` 是为了让意图更清晰。

> **注意**：`RequireAuth(db)` 是一个**返回** `HandlerFunc` 的函数。这是 Go 闭包的常见做法——通过参数捕获 `db`，每个路由组共享同一个 `*gorm.DB`。`handler.PostRegister(gormDB)` 等也是同样的模式。

### 4.3 参数绑定：`ShouldBindJSON` + struct tag

```go
type RegisterRequest struct {
    Email    string `json:"email"    binding:"required,email,max=254"`
    Password string `json:"password" binding:"required,min=8,max=128"`
    Nickname string `json:"nickname" binding:"required,min=2,max=20"`
    AvatarID string `json:"avatarId" binding:"required,min=2,max=20"`
}

var req dto.RegisterRequest
if err := c.ShouldBindJSON(&req); err != nil {
    middleware.RespondErr(c, core.ValidationErr(err.Error(), "body"))
    return
}
```

`ShouldBindJSON` 做两件事：

1. 用 `encoding/json` 把请求体反序列化到 `req`（按 `json:"..."` tag 映射字段名）。
2. 用 `go-playground/validator/v10` 跑 `binding:"..."` tag 里的校验规则。

校验失败返回 `error`，handler 把它包成 `core.ValidationErr` 走统一错误响应。

> 没用 `MustBindWith / BindJSON` 的原因是这两个会自动写 400 响应，会和我们的统一错误包装冲突。一律用 `ShouldBindXxx`，自己控制响应。

## 6. 配置层：`config/config.go`

Gin 后端没有 yml/properties 文件，全部走环境变量。`config/config.go` 在包初始化时（`init()` 函数）一次性把环境变量读进全局 `App` 变量：

```go
var App Settings

func init() {
    root := repoRoot()
    driver := getEnv("DB_DRIVER", "postgres")
    defaultDBUrl := "postgresql://hellotime:hellotime@127.0.0.1:55432/hellotime_pro"
    if driver == "sqlite" {
        defaultDBUrl = "sqlite://" + filepath.Join(root, "data", "sqlite", "hellotime.db")
    }
    App = Settings{
        Port:                  getEnvInt("PORT", 29020),
        DBDriver:              driver,
        DBUrl:                 getEnv("DB_URL", defaultDBUrl),
        JWTSecret:             getEnv("JWT_SECRET", "dev-secret-change-me"),
        AccessTokenTTLSeconds: getEnvInt("ACCESS_TOKEN_TTL_SECONDS", 3600),
        ...
    }
}
```

几个值得注意的点：

- **`init()` 是 Go 内建机制**：包被首次 import 时自动调用，**不能传参、不能返回值**。本项目所有其他包都 `import "hellotime/gin/internal/config"`，所以 `App` 在 `main` 跑之前已经准备好。
- **`repoRoot()` 用 `runtime.Caller(0)`** 反向定位仓库根目录，向上走 4 层。这样无论从哪里启动二进制，都能找到 `spec/` 目录读 `catalog.json` 和提示词文件。
- **跨数据库切换**：`DB_DRIVER` 是开关；`DB_URL` 是连接字符串，分别对应 `postgresql://...` 或 `sqlite://...`。`run` 脚本在调用前先标准化这两个变量。

## 7. 数据库层：GORM + golang-migrate

### 6.1 连接：`db/database.go`

```go
//go:embed migrations/postgres/*.sql
var pgMigrationsFS embed.FS
//go:embed migrations/sqlite/*.sql
var sqliteMigrationsFS embed.FS
```

`//go:embed` 是 Go 1.16 引入的指令：编译时把指定文件读进二进制的 `embed.FS` 变量。**好处是 `./bin/hellotime-gin` 单文件就能跑迁移，不依赖外部目录**。

`Open()` 的核心步骤：

```go
db, err = gorm.Open(postgres.Open(dsn), cfg)         // 或 sqlite.Open(path+"?_foreign_keys=on&_journal_mode=WAL")
runMigrations(db, driver)                            // 执行 migrate.Up
return db, nil
```

`runMigrations` 把 `embed.FS` 包成 `iofs.New(...)`，再用 `migrate.NewWithInstance` 跑到最新版本。`migrate.ErrNoChange`（没有可应用的迁移）被显式忽略，否则要返回错。

### 6.2 一个隐蔽的坑：SQLite URL 解析

`sqliteFilePath()` 里有一长段注释，值得读一遍：

> `sqlite:////abs/path.db`（4 个 `/`）解析成 host=`""`, path=`//abs/path` 会让 SQLite 把 `/abs/path` 和 `//abs/path` 当成两个数据库做锁协调，结果 INSERT 落一个锁域、SELECT 落另一个。表现：注册成功，但所有需要登录的接口都说「用户不存在」。

教学价值高：解析 URL 时不能想当然依赖标准库，特别是涉及驱动底层行为时。

### 6.3 GORM 模型：`model/models.go`

```go
type User struct {
    ID           string    `gorm:"primaryKey;type:varchar(36);not null"`
    Email        string    `gorm:"uniqueIndex;type:varchar(254);not null"`
    PasswordHash string    `gorm:"type:varchar(100);not null"`
    Nickname     string    `gorm:"uniqueIndex;type:varchar(20);not null"`
    AvatarID     string    `gorm:"type:varchar(20);not null"`
    CreatedAt    time.Time `gorm:"not null;autoCreateTime"`
    UpdatedAt    time.Time `gorm:"not null;autoUpdateTime"`
}
```

- `gorm:"primaryKey"`、`uniqueIndex`、`type:`、`not null`、`autoCreateTime` 是 GORM 的字段标签。
- 字段名 `ID` 默认映射成列 `id`，`CreatedAt` 映射成 `created_at`（PascalCase → snake_case）。
- 表名默认是 **结构体名的复数形式**：`User` → `users`，`Capsule` → `capsules`，`Favorite` → `favorites`，`RefreshToken` → `refresh_tokens`。
- `Favorite` 用复合主键：两个字段都标 `primaryKey` 即可。

> 本项目用 golang-migrate 管 schema，**不依赖 GORM 的 AutoMigrate**。GORM tag 实际上只在「GORM 生成 INSERT/UPDATE SQL 时」起作用（比如 `autoCreateTime` 让 GORM 在 INSERT 时自动填 `created_at`）。这是教学项目里两套工具职责清晰的取舍。

### 6.4 常见 GORM 调用模式

来自本项目的真实例子：

```go
// 单行查询
var user model.User
db.First(&user, "id = ?", claims.Subject)

// 计数
var count int64
db.Model(&model.User{}).Where("email = ?", emailNorm).Count(&count)

// INSERT
db.Create(&rt)

// 原子 UPDATE（自增计数）
tx.Model(&model.Capsule{}).
   Where("id = ?", capsuleID).
   UpdateColumn("favorite_count", gorm.Expr("favorite_count + 1"))

// JOIN + 自定义投影
db.Table("capsules").
   Select("capsules.*, users.nickname as owner_nickname, users.avatar_id as owner_avatar_id").
   Joins("JOIN users ON users.id = capsules.owner_id").
   Where("capsules.code = ?", codeNorm).
   Scan(&r)

// 事务（核心 API）
db.Transaction(func(tx *gorm.DB) error {
    // 用 tx 而不是 db；返回非 nil error 自动回滚，否则提交
})

// 行锁（仅 Postgres）
q := tx.Where("token_hash = ?", tokenHash)
if config.App.DBDriver == "postgres" {
    q = q.Clauses(clause.Locking{Strength: "UPDATE"})    // SELECT ... FOR UPDATE
}

// ON CONFLICT DO NOTHING（用于幂等收藏）
tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&fav)
```

要点：

- **`db` vs `tx`**：进了 `Transaction` 闭包，**必须**用 `tx` 做后续操作，否则该操作不在事务里。
- **占位符**：用 `?` 而不是字符串拼接，防注入由驱动负责转义。
- **`UpdateColumn` vs `Update`**：`UpdateColumn` 不触发 GORM 钩子和 `updated_at` 自动更新，更接近裸 SQL；`Update` 会更新 `updated_at`。

## 8. 错误处理：`core/errors.go`

Go 没有异常，业务错误用「自定义 error 类型 + 显式返回」表达。本项目定义了一个统一的 `APIError`：

```go
type APIError struct {
    Code       ErrorCode      // VALIDATION_ERROR / UNAUTHORIZED / NOT_FOUND ...
    Message    string
    StatusCode int            // 由 codeToStatus[Code] 自动设定
    Details    []ErrDetail
}
func (e *APIError) Error() string { ... }

// 构造器
core.ValidationErr("openAt 必须晚于当前时间 60 秒以上", "openAt")
core.UnauthorizedErr("缺少 access token")
core.NotFoundErr("胶囊不存在")
core.ConflictErr("邮箱已被注册", "email")
core.ForbiddenErr("无权删除他人胶囊")
core.RateLimitedErr()
core.InternalErr("...")
```

业务层 `return nil, core.NotFoundErr(...)`，handler 拿到 `err` 后调用 `middleware.RespondErr(c, err)`，里面用 `errors.As(err, &apiErr)` 类型断言：是 `*APIError` 就用它的 Code/Status/Message/Details；不是就降级为 500 `INTERNAL_ERROR`。

返回响应都是统一的 JSON 结构（来自 `spec/api/openapi.yaml`）：

```json
{ "success": false, "data": null,
  "message": "胶囊不存在", "errorCode": "NOT_FOUND",
  "details": [{ "field": "id", "message": "..." }] }
```

> Go 风格上，错误是「返回值」不是「异常」。**永远不要忽略 `err`**——本项目里看到 `_ = c.ShouldBindJSON(&req)` 这种忽略是因为 logout 的请求体允许为空，是经过思考的取舍。

## 9. DTO 层：请求 / 响应数据载体

`internal/dto/` 下每个文件管一组结构体，全部是普通 Go struct + json/binding tag。

```go
type Envelope[T any] struct {
    Success   bool    `json:"success"`
    Data      T       `json:"data"`
    Message   *string `json:"message"`
    ErrorCode *string `json:"errorCode"`
}
func OK[T any](data T) Envelope[T] {
    return Envelope[T]{Success: true, Data: data}
}
```

- 用了 Go 1.18+ 的**泛型**：`Envelope[T any]`、`Paginated[T any]`。`OK(...)` 的类型由参数推断。
- **指针 vs 值**：可选字段用 `*string` / `*time.Time`。`nil` 序列化成 JSON `null`，零值（如空字符串、Time{}）会写出 `""` 或 `"0001-01-01T00:00:00Z"`——这是 Go JSON 的常见坑，必须用指针来区分「没传」和「显式空」。
- `time.Time` 的 JSON 编码默认是 RFC 3339（`2026-05-18T03:00:00Z`），符合 spec。
- DTO 不直接复用 `model.*`：领域模型字段名是 `OwnerID`（snake → `owner_id`），DTO 是 `CreatorId / creator`，加上 `IsOpened`、`ContentPreview` 等派生字段。

### 8.1 字段嵌入（embedded struct）

```go
type CapsuleBase struct { ID, Code, Title string; ... }
type CapsuleDetail struct {
    CapsuleBase                            // 字段嵌入：CapsuleDetail 自动拥有 CapsuleBase 的所有字段
    Content       *string `json:"content"`
    FavoritedByMe bool    `json:"favoritedByMe"`
}
```

Go 的嵌入既「共享字段」也「共享 JSON 序列化」——`CapsuleDetail` 的 JSON 会平铺出 ID/Code/Title…… 加上 content/favoritedByMe，不需要手写组合。

## 10. 服务层：业务逻辑都在这里

handler 只做「解参数 → 调 service → 写响应」，真正的业务在 `service/`。

### 9.1 `auth.go`：注册、登录、refresh token 轮转

`Register` 流程：

```go
func Register(db *gorm.DB, email, password, nickname, avatarID string) (*dto.AuthTokens, error) {
    if !IsValidAvatarID(avatarID) { return nil, core.ValidationErr(...) }
    validatePassword(password); validateNickname(nickname)
    emailNorm := strings.ToLower(strings.TrimSpace(email))
    // 预检 + DB 唯一索引兜底
    db.Model(&model.User{}).Where("email = ?", emailNorm).Count(&count)
    ...
    user := model.User{ID: uuid.NewString(), ...}
    db.Create(&user)
    return issueTokenPair(db, &user, "")
}
```

`Refresh` 是最复杂的一段，关键点：

```go
err := db.Transaction(func(tx *gorm.DB) error {
    q := tx.Where("token_hash = ?", tokenHash)
    if config.App.DBDriver == "postgres" {
        q = q.Clauses(clause.Locking{Strength: "UPDATE"})   // SELECT ... FOR UPDATE
    }
    var rt model.RefreshToken
    q.First(&rt)

    if rt.RevokedAt != nil {
        // 重放检测 → 整族作废
        tx.Model(...).Where("family_id = ? AND revoked_at IS NULL", rt.FamilyID).Update(...)
        replayErr = core.UnauthorizedErr("refresh token 已失效")
        return nil           // 不返回 error，让事务提交（保留 revoke）
    }
    // 原子 revoke 旧 token：Where 加 AND revoked_at IS NULL，看 RowsAffected
    res := tx.Model(...).Where("id = ? AND revoked_at IS NULL", rt.ID).Update("revoked_at", now)
    if res.RowsAffected != 1 {  // 并发：被别人抢先 revoke 了 → 整族作废
        ...
    }
    tokens, _ = issueTokenPair(tx, &user, rt.FamilyID)   // 用同一个 familyId 续发
    return nil
})
```

值得学习：

- **事务里的提交语义**：闭包返回 `nil` 提交，返回 `err` 回滚。重放分支故意返回 `nil`，把 family revoke 提交掉，然后在外层把 `replayErr` 当作返回错——这样 401 响应和「整族作废」同时生效。
- **乐观并发**：`UPDATE ... WHERE id = ? AND revoked_at IS NULL` 加 `RowsAffected != 1` 检查，比读-修改-写更可靠，PostgreSQL/SQLite 通用。
- **`uuid.NewString()`** 来自 `google/uuid`，UUID v4，对应 `varchar(36)`。

### 9.2 `capsule.go` / `favorite.go` / `plaza.go`

- `CreateCapsule`：校验 openAt → 重试 5 次生成 8 位随机码（避免冲突）→ `db.Create`。
- `AddFavorite`：先非事务幂等检查 → 进事务 `OnConflict{DoNothing: true}` + 原子 UPDATE 计数 → `RowsAffected` 判断是否真的插入了。
- `PlazaList`：用 `Table().Select().Joins().Where()` 链式构造，按 sort/filter/q 动态加条件，先 `Count`，再 `Offset/Limit/Scan`。批量取 viewer 的收藏集合（`isFavoritedByViewer`）避免 N+1 查询。

### 9.3 限流：`sync.Map` + `sync.Mutex`

```go
var loginFailures sync.Map // email → *rateBucket
type rateBucket struct {
    mu         sync.Mutex
    timestamps []time.Time
}
```

- `sync.Map` 比 `map+sync.RWMutex` 在「键多次读写少」场景下性能更好，签名也明确（`LoadOrStore`）。
- 桶内部用 `sync.Mutex` 保护时间戳切片，60 秒滑动窗口。
- 教学实现，**单实例内存**。生产应该用 Redis。

### 9.4 `avatar.go`：`sync.Once` 单次加载

```go
var (
    avatarOnce    sync.Once
    cachedAvatars []dto.Avatar
)

func loadAvatarsOnce() {
    avatarOnce.Do(func() {
        data, err := os.ReadFile(config.App.AvatarsCatalogPath)
        ...
    })
}
```

`sync.Once.Do(fn)` 保证 `fn` **全程只执行一次**，并发安全。比 `init()` 灵活——可以延迟到首次访问。

### 9.5 LLM 客户端：`llm.go` + `capsule_suggestion.go`

用 `net/http.Client` 调 OpenAI 兼容 API：先尝试 `/responses`（带 JSON Schema 强校验），失败按 HTTP 状态码判断是否回退到 `/chat/completions`；后者再分「带 `thinking` 参数」与「不带」两轮。两层降级都失败时 `capsuleFallback()` 用本地模板兜底。

值得注意：

- `errors.As(err, &llmE)` 是 Go 1.13+ 的标准做法，比 `if e, ok := err.(*Foo); ok` 更鲁棒（能穿透 `fmt.Errorf("%w", ...)` 包装）。
- `var llmHTTPClient = &http.Client{Timeout: 30 * time.Second}` 是包级单例，复用底层连接池。**生产中绝对不要在每次请求时 `http.Get` 或裸用 `http.DefaultClient`**：前者每次新建 client；后者没有超时，可能挂死。

## 11. 中间件层：`middleware/auth.go`

只有一个文件，但它干了 4 件事：

```go
const (
    CtxUser     = "currentUser"
    CtxViewerID = "viewerID"
)

func OptionalAuth(db *gorm.DB) gin.HandlerFunc { ... }   // 解析失败也放行，user=nil
func RequireAuth(db *gorm.DB) gin.HandlerFunc { ... }   // 解析失败 → 401
func CurrentUser(c *gin.Context) *model.User { ... }    // handler 中读取
func ViewerID(c *gin.Context) string         { ... }
func RespondErr(c *gin.Context, err error)   { ... }    // 统一错误响应
```

- **闭包注入 `db`**：因为 Gin 中间件签名固定是 `gin.HandlerFunc`，外层函数用闭包把 `*gorm.DB` 捕获进来。
- **`CtxUser` 用字符串而非 typed key**：教学项目简化。生产代码通常用 `type ctxKey struct{}; const userKey ctxKey = 1` 避免键冲突。
- **`RespondErr` 用 `gin.H`** 写响应：`gin.H` 是 `map[string]any` 的别名，临时 JSON 用它最方便；正式 DTO 用结构体。

## 12. 数据库迁移：golang-migrate

`internal/db/migrations/{postgres,sqlite}/` 各一份 `000001_init.up.sql`（也有对应的 `down.sql`）。

- 文件名规范：`<版本号>_<描述>.up.sql` / `.down.sql`，版本号严格递增。
- `Open()` 启动时自动 `migrate.Up()` 把数据库升到最新版本。
- 两套 SQL 差异是「方言降级」：Postgres 用 `TIMESTAMPTZ`、`pg_trgm`、`gen_random_uuid()`；SQLite 用 `DATETIME`（不是 TEXT！见 6.2 的坑）、`length()`、应用层生 UUID。

要新增表 / 字段：再放一对 `000002_xxx.up.sql / .down.sql`（两套都加），重启即可。**不要修改已经发布的迁移**——执行过的环境会因校验和不一致而启动失败。

## 13. 测试

Gin 后端的契约一致性由仓库统一的「外部 black-box 验证」覆盖：

```bash
../../verification/scripts/verify-contract.sh gin
```

它启动 Gin 后端，按 `spec/api/openapi.yaml` 跑一组 HTTP 请求验证响应格式、状态码、不变式。如果未来增加包内 Go 单测，应该用 `httptest.NewRecorder()` + `router.ServeHTTP()` 的写法：

```go
func TestHealth(t *testing.T) {
    r := gin.New()
    r.GET("/health", handler.GetHealth)
    w := httptest.NewRecorder()
    req := httptest.NewRequest("GET", "/health", nil)
    r.ServeHTTP(w, req)
    if w.Code != 200 { t.Fatalf("want 200, got %d", w.Code) }
}
```

> 这个 pattern 不启动 TCP socket，比 `net/http/httptest.NewServer` 更轻量。

## 14. 常见改动指南

| 想做什么 | 改哪里 |
|---|---|
| 加一个新 HTTP 接口 | ① `internal/handler/` 新增 / 编辑函数；② `cmd/server/main.go` 在对应 `Group` 里注册路由 |
| 加一个请求 / 响应字段 | `internal/dto/*.go` 修改对应 struct（注意 `json` / `binding` tag） |
| 加一个业务规则 | 在对应的 `service/*.go` 函数里加判断，必要时 `return nil, core.XxxErr(...)` |
| 加一张表 / 一列 | ① `internal/db/migrations/{postgres,sqlite}/000<n>_*.up.sql / .down.sql` 各一对；② `internal/model/models.go` 增加 / 修改 struct |
| 加一个查询条件 | 在 service 里用 `db.Where(...)` 链式追加；复杂查询用 `Table().Select().Joins().Where().Scan(&dst)` |
| 加一个配置项 | `internal/config/config.go` 在 `Settings` 加字段，在 `init()` 从环境变量读取 |
| 加一个跨切关注（日志、指标、限流） | 写一个 `gin.HandlerFunc` 中间件，在 `main.go` 用 `r.Use(...)` 或 `group.Use(...)` 挂上 |
| 改默认错误响应 | `internal/middleware/auth.go` 的 `RespondErr` 或 `internal/core/errors.go` 的构造器 |
| 临时调端口 / 数据库 | 设置环境变量即可：`PORT=29021 ./run`、`DB_DRIVER=sqlite ./run` |

## 15. 学到这里之后

读到这里，你已经掌握了 Gin 项目最常见的 80%：路由分组、中间件链、`*gin.Context`、`ShouldBindJSON`、GORM 单行/批量/事务/行锁、`embed.FS` + golang-migrate、统一的 `APIError` 错误模型、`sync.Once / sync.Map` 并发原语、闭包注入依赖。

下一步建议：

- 翻 `handler/` 里你最感兴趣的接口，对照 `service/` 读完一条完整的请求路径。
- 在 `service.Refresh` 加 `log.Printf` 观察一次「正常 → 用旧 token 第二次刷 → 整族 revoke」的行为；这是教学 refresh token 安全模型最直观的演示。
- 比较一下 `backends/fastapi` 或 `backends/spring-boot` 的同名实现，理解相同业务在 Python/Java 生态下怎么写——这是这个项目最大的价值。

之后可以再深入研究 Go 项目的几个常见进阶主题：context 取消传播（`context.Context` 在 HTTP 请求中传递截止时间）、`pgx` 直接代替 GORM（性能与可控性）、`golang.org/x/sync/errgroup` 做并发查询、`go test -race` 检测数据竞争。本项目刻意保持极简，把这些留给后续。
