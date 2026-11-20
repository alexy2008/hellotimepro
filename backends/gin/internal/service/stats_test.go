package service

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"hellotime/gin/internal/config"
	"hellotime/gin/internal/core"
	"hellotime/gin/internal/dto"
	"hellotime/gin/internal/model"
)

func openTestDB(test *testing.T) *gorm.DB {
	test.Helper()
	database, err := gorm.Open(sqlite.Open(filepath.Join(test.TempDir(), "contract.db")), &gorm.Config{})
	requireNoError(test, err)
	sqlDB, err := database.DB()
	requireNoError(test, err)
	test.Cleanup(func() { _ = sqlDB.Close() })
	sqlDB.SetMaxOpenConns(1)
	schema, err := os.ReadFile(filepath.Join(config.App.RepoRoot, "spec", "db", "schema.sqlite.sql"))
	requireNoError(test, err)
	requireNoError(test, database.Exec(string(schema)).Error)
	return database
}

func requireNoError(test *testing.T, err error) {
	test.Helper()
	if err != nil {
		test.Fatal(err)
	}
}

func insertUser(test *testing.T, database *gorm.DB, nickname string) *model.User {
	test.Helper()
	user := &model.User{ID: uuid.NewString(), Email: strings.ToLower(nickname) + "@example.test", Nickname: nickname, AvatarID: "neo", PasswordHash: "test"}
	requireNoError(test, database.Create(user).Error)
	return user
}

func insertCapsule(test *testing.T, database *gorm.DB, owner *model.User, storedID, title string, openAt time.Time, inPlaza bool) {
	test.Helper()
	code, err := generateCode()
	requireNoError(test, err)
	requireNoError(test, database.Create(&model.Capsule{
		ID: storedID, OwnerID: owner.ID, Code: code, Title: title, Content: "test",
		OpenAt: openAt, CreatedAt: openAt.Add(-time.Hour), InPlaza: inPlaza,
	}).Error)
}

func TestPlazaStatsAndListShareLiteralSearch(test *testing.T) {
	database := openTestDB(test)
	empty, err := PlazaStats(database, "")
	requireNoError(test, err)
	if *empty != (dto.PlazaStats{}) {
		test.Fatalf("empty stats = %+v", *empty)
	}

	matchedOwner := insertUser(test, database, "Writer_One")
	otherOwner := insertUser(test, database, "WriterXOne")
	now := time.Now().UTC().Truncate(time.Second)
	next, farthest := now.Add(time.Hour), now.Add(2*time.Hour)
	insertCapsule(test, database, matchedOwner, uuid.NewString(), `Report%_\`, now.Add(-time.Hour), true)
	insertCapsule(test, database, otherOwner, uuid.NewString(), "Plain", next, true)
	insertCapsule(test, database, otherOwner, uuid.NewString(), "ReportXYZ", farthest, true)
	insertCapsule(test, database, matchedOwner, uuid.NewString(), `Report%_\`, now.Add(3*time.Hour), false)

	for _, search := range []string{`  REPORT%_\  `, `\`, "%", "_", "WRITER_ONE"} {
		test.Run(search, func(test *testing.T) {
			stats, err := PlazaStats(database, search)
			requireNoError(test, err)
			if stats.Counts != (dto.PlazaCounts{All: 1, Opened: 1}) ||
				stats.NextOpenAt == nil || !stats.NextOpenAt.Equal(next) ||
				stats.FarthestOpenAt == nil || !stats.FarthestOpenAt.Equal(farthest) {
				test.Fatalf("unexpected stats: %+v", *stats)
			}
			for filter, want := range map[string]int{"all": 1, "opened": 1, "unopened": 0} {
				page, err := PlazaList(database, "new", filter, search, 1, 20, "")
				requireNoError(test, err)
				if page.Pagination.Total != want || len(page.Items) != want {
					test.Fatalf("filter=%s: got total=%d, %d items; want %d", filter, page.Pagination.Total, len(page.Items), want)
				}
			}
		})
	}
	_, err = PlazaStats(database, strings.Repeat("字", 51))
	var apiErr *core.APIError
	if !errors.As(err, &apiErr) || apiErr.Code != core.ErrValidation {
		test.Fatalf("overlong search: got %v, want validation error", err)
	}
}

func TestFavoritePrivateCapsuleAndDeleteWithoutCascade(test *testing.T) {
	database := openTestDB(test)
	requireNoError(test, database.Exec("PRAGMA foreign_keys = OFF").Error)
	owner := insertUser(test, database, "Owner")
	fan := insertUser(test, database, "Fan")
	capsuleID := uuid.NewString()
	insertCapsule(test, database, owner, strings.ReplaceAll(capsuleID, "-", ""), "Private", time.Now().UTC().Add(time.Hour), false)

	first, err := AddFavorite(database, owner, capsuleID)
	requireNoError(test, err)
	again, err := AddFavorite(database, owner, capsuleID)
	requireNoError(test, err)
	if first.CapsuleID != capsuleID || first.FavoriteCount != 1 || *first != *again {
		test.Fatalf("favorite should be idempotent: first=%+v again=%+v", first, again)
	}
	_, err = AddFavorite(database, fan, capsuleID)
	requireNoError(test, err)

	mine, err := MyCapsules(database, owner, 1, 20)
	requireNoError(test, err)
	if len(mine.Items) != 1 || !mine.Items[0].FavoritedByMe || mine.Items[0].FavoritedAt != nil {
		test.Fatalf("unexpected own list: %+v", mine.Items)
	}
	favorites, err := MyFavorites(database, fan, 1, 20)
	requireNoError(test, err)
	if len(favorites.Items) != 1 || favorites.Items[0].InPlaza || favorites.Items[0].FavoritedAt == nil {
		test.Fatalf("unexpected favorites: %+v", favorites.Items)
	}
	stats, err := MyStats(database, owner)
	requireNoError(test, err)
	if *stats != (dto.MyStats{Created: 1, Unopened: 1, FavoritesReceived: 2, FavoritesGiven: 1}) {
		test.Fatalf("unexpected owner stats: %+v", *stats)
	}

	requireNoError(test, RemoveFavorite(database, fan, capsuleID))
	requireNoError(test, RemoveFavorite(database, fan, capsuleID))
	refavorited, err := AddFavorite(database, fan, capsuleID)
	requireNoError(test, err)
	if refavorited.FavoriteCount != 2 {
		test.Fatalf("favorite count after re-adding = %d, want 2", refavorited.FavoriteCount)
	}
	requireNoError(test, DeleteOwnCapsule(database, owner, capsuleID))
	for _, user := range []*model.User{owner, fan} {
		stats, err := MyStats(database, user)
		requireNoError(test, err)
		if *stats != (dto.MyStats{}) {
			test.Fatalf("%s after deletion: %+v", user.Nickname, *stats)
		}
	}
}
