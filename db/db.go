package db

import (
	"fmt"
	"log"

	"github.com/deannos/notification-queue/models"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func Open(path string) (*gorm.DB, error) {
	database, err := gorm.Open(sqlite.Open(path), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn),
	})
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}

	// Enable WAL mode for better concurrent read performance
	sqlDB, err := database.DB()
	if err != nil {
		return nil, err
	}
	if _, err := sqlDB.Exec("PRAGMA journal_mode=WAL;"); err != nil {
		log.Printf("warn: failed to set WAL mode: %v", err)
	}
	if _, err := sqlDB.Exec("PRAGMA foreign_keys=ON;"); err != nil {
		log.Printf("warn: failed to enable foreign keys: %v", err)
	}

	return database, nil
}

func Migrate(database *gorm.DB) error {
	return database.AutoMigrate(
		&models.User{},
		&models.App{},
		&models.Notification{},
	)
}
