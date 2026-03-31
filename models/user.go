package models

import "time"

type User struct {
	ID        string    `json:"id"         gorm:"primaryKey"`
	Username  string    `json:"username"   gorm:"uniqueIndex;not null"`
	Password  string    `json:"-"          gorm:"not null"`
	IsAdmin   bool      `json:"is_admin"   gorm:"default:false"`
	CreatedAt time.Time `json:"created_at"`
}
