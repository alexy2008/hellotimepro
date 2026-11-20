package dto

import "time"

type PlazaCounts struct {
	All      int64 `json:"all"`
	Opened   int64 `json:"opened"`
	Unopened int64 `json:"unopened"`
}

type PlazaStats struct {
	Counts         PlazaCounts `json:"counts"`
	FarthestOpenAt *time.Time  `json:"farthestOpenAt"`
	NextOpenAt     *time.Time  `json:"nextOpenAt"`
}

type MyStats struct {
	Created           int64 `json:"created"`
	Opened            int64 `json:"opened"`
	Unopened          int64 `json:"unopened"`
	InPlaza           int64 `json:"inPlaza"`
	FavoritesReceived int64 `json:"favoritesReceived"`
	FavoritesGiven    int64 `json:"favoritesGiven"`
}
