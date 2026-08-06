package db

import (
	"testing"
	"time"

	"github.com/mattn/go-sqlite3"
)

func TestSqliteTimestampFormatMatchesSeedAndSortsChronologically(t *testing.T) {
	previous := sqlite3.SQLiteTimestampFormats[0]
	t.Cleanup(func() { sqlite3.SQLiteTimestampFormats[0] = previous })
	sqlite3.SQLiteTimestampFormats[0] = "2006-01-02T15:04:05.999999999-07:00"

	seed := "2026-07-13T01:00:00+00:00"
	appLater := time.Date(2026, 7, 13, 23, 0, 0, 0, time.UTC).
		Format(sqlite3.SQLiteTimestampFormats[0])
	if appLater != "2026-07-13T23:00:00+00:00" {
		t.Fatalf("unexpected SQLite timestamp: %s", appLater)
	}
	if seed >= appLater {
		t.Fatalf("timestamp text order is not chronological: %s >= %s", seed, appLater)
	}
}
