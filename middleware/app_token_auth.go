package middleware

import (
	"net/http"

	"github.com/deannos/notification-queue/auth"
	"github.com/deannos/notification-queue/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const CtxApp = "app"

// AppTokenAuth validates the app token from the X-App-Token header or ?token= query param.
// Tokens are stored as SHA-256 hashes; lookup is accelerated by an 8-char prefix index.
func AppTokenAuth(database *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		token := c.GetHeader("X-App-Token")
		if token == "" {
			token = c.Query("token")
		}
		if token == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing app token"})
			return
		}

		prefix := auth.TokenPrefix(token)
		hash := auth.HashToken(token)

		var app models.App
		if err := database.Where("token_prefix = ? AND token = ?", prefix, hash).First(&app).Error; err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid app token"})
			return
		}

		c.Set(CtxApp, &app)
		c.Next()
	}
}
