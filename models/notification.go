package models

import (
	"time"

	"gorm.io/gorm"
)

type Notification struct {
	ID        string         `json:"id"         gorm:"primaryKey"`
	AppID     string         `json:"app_id"     gorm:"index;not null"`
	Title     string         `json:"title"      gorm:"not null"`
	Message   string         `json:"message"    gorm:"not null"`
	Priority  int            `json:"priority"   gorm:"default:5;index"`
	Read      bool           `json:"read"       gorm:"default:false;index"`
	CreatedAt time.Time      `json:"created_at" gorm:"index:idx_notif_app,sort:desc"`
	DeletedAt gorm.DeletedAt `json:"-"          gorm:"index"`
	App       *App           `json:"app,omitempty" gorm:"foreignKey:AppID;references:ID"`
}
