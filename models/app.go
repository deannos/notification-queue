package models

import "time"

type App struct {
	ID          string    `json:"id"                   gorm:"primaryKey"`
	UserID      string    `json:"user_id"              gorm:"index;not null"`
	Name        string    `json:"name"                 gorm:"not null"`
	Description string    `json:"description"`
	WebhookURL  string    `json:"webhook_url,omitempty"`
	TokenPrefix string    `json:"-"                    gorm:"column:token_prefix;index;size:8;default:''"`
	TokenHash   string    `json:"-"                    gorm:"column:token;uniqueIndex;not null;default:''"`
	Token       string    `json:"token,omitempty"      gorm:"-"` // plaintext — returned once, never stored
	CreatedAt   time.Time `json:"created_at"`
}
