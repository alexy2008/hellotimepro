package service

import (
	"testing"
	"time"
)

func TestOpenAtCalendarBounds(test *testing.T) {
	zone := time.FixedZone("UTC+8", 8*60*60)
	now := time.Date(2028, time.March, 1, 1, 30, 45, 123, zone)
	limit := time.Date(2038, time.February, 28, 17, 30, 45, 123, time.UTC)
	if got := addCalendarYears(now, 10); got != limit {
		test.Fatalf("calendar limit = %s, want %s", got, limit)
	}
	for _, testCase := range []struct {
		name  string
		at    time.Time
		valid bool
	}{
		{"exactly 60 seconds", now.Add(time.Minute), false},
		{"after 60 seconds", now.Add(time.Minute + time.Nanosecond), true},
		{"exactly ten calendar years", limit, true},
		{"past the calendar limit", limit.Add(time.Nanosecond), false},
	} {
		test.Run(testCase.name, func(test *testing.T) {
			err := validateOpenAt(testCase.at, now)
			if (err == nil) != testCase.valid {
				test.Fatalf("validateOpenAt(%s) = %v, want valid=%t", testCase.at, err, testCase.valid)
			}
		})
	}
}
