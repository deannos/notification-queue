package db

import (
	"fmt"

	"github.com/deannos/notification-queue/logger"
	"github.com/deannos/notification-queue/models"
	"go.uber.org/zap"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"
)

func Open(path string) (*gorm.DB, error) {
	database, err := gorm.Open(sqlite.Open(path), &gorm.Config{
		Logger: gormlogger.Default.LogMode(gormlogger.Warn),
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
		logger.L.Warn("failed to set WAL mode", zap.Error(err))
	}
	if _, err := sqlDB.Exec("PRAGMA foreign_keys=ON;"); err != nil {
		logger.L.Warn("failed to enable foreign keys", zap.Error(err))
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
