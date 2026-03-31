package models

import "time"

type App struct {
	ID          string    `json:"id"          gorm:"primaryKey"`
	UserID      string    `json:"user_id"     gorm:"index;not null"`
	Name        string    `json:"name"        gorm:"not null"`
	Description string    `json:"description"`
	Token       string    `json:"token,omitempty" gorm:"uniqueIndex;not null"`
	CreatedAt   time.Time `json:"created_at"`
}
