// Package db 负责数据库连接初始化与 golang-migrate 迁移执行。
package db

import (
	"embed"
	"errors"
	"fmt"
	"strings"

	"github.com/golang-migrate/migrate/v4"
	migratePostgres "github.com/golang-migrate/migrate/v4/database/postgres"
	migrateSQLite "github.com/golang-migrate/migrate/v4/database/sqlite3"
	"github.com/golang-migrate/migrate/v4/source/iofs"
	"gorm.io/driver/postgres"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"hellotime/gin/internal/config"
)

//go:embed migrations/postgres/*.sql
var pgMigrationsFS embed.FS

//go:embed migrations/sqlite/*.sql
var sqliteMigrationsFS embed.FS

// Open 根据配置打开数据库连接并运行迁移。
func Open() (*gorm.DB, error) {
	cfg := &gorm.Config{
		Logger:                 logger.Default.LogMode(logger.Silent),
		PrepareStmt:            false,
		SkipDefaultTransaction: false,
	}

	driver := config.App.DBDriver
	rawURL := config.App.DBUrl

	var db *gorm.DB
	var err error

	switch driver {
	case "postgres":
		dsn := normalizePgURL(rawURL)
		db, err = gorm.Open(postgres.Open(dsn), cfg)
	case "sqlite":
		path := sqliteFilePath(rawURL)
		db, err = gorm.Open(sqlite.Open(path+"?_foreign_keys=on&_journal_mode=WAL"), cfg)
	default:
		return nil, fmt.Errorf("unknown db driver: %s", driver)
	}
	if err != nil {
		return nil, fmt.Errorf("open db: %w", err)
	}

	if err := runMigrations(db, driver); err != nil {
		return nil, fmt.Errorf("run migrations: %w", err)
	}

	return db, nil
}

// normalizePgURL 统一 PostgreSQL 连接字符串。
func normalizePgURL(raw string) string {
	// FastAPI 用 postgresql+psycopg://，这里去掉 python 专属前缀
	if strings.HasPrefix(raw, "postgresql+psycopg://") {
		raw = "postgresql://" + strings.TrimPrefix(raw, "postgresql+psycopg://")
	}
	return raw
}

// sqliteFilePath 把 SQLAlchemy 风格的 sqlite URL 转成本地路径。
//
//	sqlite:///rel/path.db    → rel/path.db     (3 个 /，相对路径)
//	sqlite:////abs/path.db   → /abs/path.db    (4 个 /，绝对路径)
//	sqlite://file.db         → file.db
//	/abs/path.db             → /abs/path.db    (已是路径，原样返回)
//
// 老实现 url.Parse + u.Host + u.Path 在 4-斜杠绝对路径下会得到 "//abs/path"
// 双前导斜杠，macOS 上 SQLite VFS 会把它和 "/abs/path" 当作两个不同的数据库做
// 锁协调——结果是 INSERT 落在一个 lock 域，SELECT 在另一个，读不到自己刚写的
// 行。表现为 register 成功但所有 RequireAuth 端点 "用户不存在"。
func sqliteFilePath(raw string) string {
	const scheme = "sqlite://"
	if !strings.HasPrefix(raw, scheme) {
		return raw
	}
	rest := raw[len(scheme):] // 至少以 "/" 开头（3 斜杠相对）或 "//" 开头（4 斜杠绝对）
	if strings.HasPrefix(rest, "/") {
		return rest[1:] // 吃掉一个斜杠
	}
	return rest
}

func runMigrations(db *gorm.DB, driver string) error {
	sqlDB, err := db.DB()
	if err != nil {
		return err
	}

	var m *migrate.Migrate

	switch driver {
	case "postgres":
		src, err := iofs.New(pgMigrationsFS, "migrations/postgres")
		if err != nil {
			return err
		}
		dbDrv, err := migratePostgres.WithInstance(sqlDB, &migratePostgres.Config{})
		if err != nil {
			return err
		}
		m, err = migrate.NewWithInstance("iofs", src, "postgres", dbDrv)
		if err != nil {
			return err
		}
	case "sqlite":
		src, err := iofs.New(sqliteMigrationsFS, "migrations/sqlite")
		if err != nil {
			return err
		}
		dbDrv, err := migrateSQLite.WithInstance(sqlDB, &migrateSQLite.Config{})
		if err != nil {
			return err
		}
		m, err = migrate.NewWithInstance("iofs", src, "sqlite3", dbDrv)
		if err != nil {
			return err
		}
	default:
		return fmt.Errorf("unknown driver for migrations: %s", driver)
	}

	if err := m.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		return err
	}
	return nil
}
