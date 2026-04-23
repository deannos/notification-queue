package db

import (
	"context"
	"time"

	"github.com/deannos/notification-queue/logger"
	"github.com/deannos/notification-queue/models"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// StartRetentionWorker deletes notifications older than retentionDays every 24 hours.
// It stops when ctx is cancelled (on graceful shutdown).
// If retentionDays <= 0, it does nothing.
func StartRetentionWorker(ctx context.Context, database *gorm.DB, retentionDays int) {
	if retentionDays <= 0 {
		return
	}
	go func() {
		purge := func() {
			cutoff := time.Now().AddDate(0, 0, -retentionDays)
			result := database.Unscoped().Where("created_at < ?", cutoff).Delete(&models.Notification{})
			if result.Error != nil {
				logger.L.Error("retention cleanup error", zap.Error(result.Error))
			} else if result.RowsAffected > 0 {
				logger.L.Info("retention purged notifications",
					zap.Int64("deleted", result.RowsAffected),
					zap.Int("older_than_days", retentionDays),
				)
			}
		}

		purge() // run immediately on startup
		ticker := time.NewTicker(24 * time.Hour)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				purge()
			case <-ctx.Done():
				return
			}
		}
	}()
}
