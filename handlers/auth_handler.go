package handlers

import (
	"net/http"
	"time"

	"github.com/deannos/notification-queue/auth"
	"github.com/deannos/notification-queue/config"
	"github.com/deannos/notification-queue/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type loginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type registerRequest struct {
	Username string `json:"username" binding:"required,min=3,max=50"`
	Password string `json:"password" binding:"required,min=6"`
}

func Login(database *gorm.DB, cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req loginRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		var user models.User
		if err := database.Where("username = ?", req.Username).First(&user).Error; err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid username or password"})
			return
		}

		if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid username or password"})
			return
		}

		token, err := auth.GenerateToken(user.ID, user.IsAdmin, cfg.JWTSecret, cfg.JWTExpiryHours)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"token":      token,
			"user":       user,
			"expires_in": cfg.JWTExpiryHours * 3600,
		})
	}
}

func Register(database *gorm.DB, cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !cfg.AllowRegistration {
			// Still allow if no users exist (bootstrap).
			var count int64
			database.Model(&models.User{}).Count(&count)
			if count > 0 {
				c.JSON(http.StatusForbidden, gin.H{"error": "registration is disabled"})
				return
			}
		}

		var req registerRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to hash password"})
			return
		}

		var isAdmin bool
		// Wrap in a transaction so two simultaneous first-registrations don't both become admin.
		err = database.Transaction(func(tx *gorm.DB) error {
			var count int64
			if err := tx.Model(&models.User{}).Count(&count).Error; err != nil {
				return err
			}
			isAdmin = count == 0

			user := models.User{
				ID:        uuid.NewString(),
				Username:  req.Username,
				Password:  string(hash),
				IsAdmin:   isAdmin,
				CreatedAt: time.Now(),
			}
			return tx.Create(&user).Error
		})
		if err != nil {
			c.JSON(http.StatusConflict, gin.H{"error": "username already taken"})
			return
		}

		c.JSON(http.StatusCreated, gin.H{
			"message":  "user created",
			"username": req.Username,
			"is_admin": isAdmin,
		})
	}
}

// EnsureAdminUser creates the default admin account if no users exist.
func EnsureAdminUser(database *gorm.DB, username, password string) error {
	var count int64
	database.Model(&models.User{}).Count(&count)
	if count > 0 {
		return nil
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	return database.Create(&models.User{
		ID:        uuid.NewString(),
		Username:  username,
		Password:  string(hash),
		IsAdmin:   true,
		CreatedAt: time.Now(),
	}).Error
}
