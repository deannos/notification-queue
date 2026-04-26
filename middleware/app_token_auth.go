package middleware

import (
	"net/http"

	"github.com/deannos/notification-queue/auth"
	"github.com/deannos/notification-queue/storage"
	"github.com/gin-gonic/gin"
)

const CtxApp = "app"

// AppTokenAuth validates the app token from the X-App-Token header or ?token= query param.
func AppTokenAuth(apps storage.AppRepository) gin.HandlerFunc {
	return func(c *gin.Context) {
		token := c.GetHeader("X-App-Token")
		if token == "" {
			token = c.Query("token")
		}
		if token == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing app token"})
			return
		}

		app, err := apps.FindByToken(c.Request.Context(), auth.TokenPrefix(token), auth.HashToken(token))
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid app token"})
			return
		}

		c.Set(CtxApp, app)
		c.Next()
	}
}
