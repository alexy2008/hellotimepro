// Package db 负责数据库连接初始化与 golang-migrate 迁移执行。
package db

import (
	"embed"
	"errors"
	"fmt"
	"net/url"
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

// sqliteFilePath 从 sqlite:///path 提取文件路径。
func sqliteFilePath(raw string) string {
	u, err := url.Parse(raw)
	if err != nil {
		return raw
	}
	if u.Scheme == "sqlite" {
		return u.Host + u.Path
	}
	return raw
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
