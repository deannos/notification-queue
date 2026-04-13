package handlers_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/deannos/notification-queue/auth"
	"github.com/deannos/notification-queue/config"
	"github.com/deannos/notification-queue/db"
	"github.com/deannos/notification-queue/handlers"
	"github.com/deannos/notification-queue/hub"
	"github.com/deannos/notification-queue/middleware"
	"github.com/deannos/notification-queue/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

func init() {
	gin.SetMode(gin.TestMode)
}

func setupDB(t *testing.T) *gorm.DB {
	t.Helper()
	database, err := db.Open(":memory:")
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	if err := db.Migrate(database); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return database
}

func TestHealthHandler_OK(t *testing.T) {
	database := setupDB(t)
	r := gin.New()
	r.GET("/health", handlers.HealthHandler(database))

	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/health", nil))

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var body map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body["status"] != "ok" {
		t.Fatalf("expected status ok, got %q", body["status"])
	}
}

func TestLogin_Success(t *testing.T) {
	database := setupDB(t)
	cfg := &config.Config{JWTSecret: "test-secret", JWTExpiryHours: 1}

	if err := handlers.EnsureAdminUser(database, "admin", "admin"); err != nil {
		t.Fatal(err)
	}

	r := gin.New()
	r.POST("/auth/login", handlers.Login(database, cfg))

	body, _ := json.Marshal(map[string]string{"username": "admin", "password": "admin"})
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/auth/login", bytes.NewReader(body)))

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["token"] == "" {
		t.Fatal("expected token in response")
	}
}

func TestLogin_WrongPassword(t *testing.T) {
	database := setupDB(t)
	cfg := &config.Config{JWTSecret: "test-secret", JWTExpiryHours: 1}
	handlers.EnsureAdminUser(database, "admin", "admin")

	r := gin.New()
	r.POST("/auth/login", handlers.Login(database, cfg))

	body, _ := json.Marshal(map[string]string{"username": "admin", "password": "wrong"})
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/auth/login", bytes.NewReader(body)))

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}
}

func TestSendNotification_Success(t *testing.T) {
	database := setupDB(t)
	h := hub.New()
	go h.Run()

	// Create a user and app
	userID := uuid.NewString()
	plainToken, _ := auth.GenerateAppToken()
	app := models.App{
		ID:          uuid.NewString(),
		UserID:      userID,
		Name:        "TestApp",
		TokenPrefix: auth.TokenPrefix(plainToken),
		TokenHash:   auth.HashToken(plainToken),
		CreatedAt:   time.Now(),
	}
	database.Create(&app)

	r := gin.New()
	r.POST("/message", middleware.AppTokenAuth(database), handlers.SendNotification(database, h))

	body, _ := json.Marshal(map[string]interface{}{
		"title":    "Hello",
		"message":  "World",
		"priority": 5,
	})
	req := httptest.NewRequest(http.MethodPost, "/message", bytes.NewReader(body))
	req.Header.Set("X-App-Token", plainToken)
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", w.Code, w.Body.String())
	}

	var notif map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &notif)
	if notif["title"] != "Hello" {
		t.Fatalf("expected title Hello, got %v", notif["title"])
	}
}

func TestListNotifications(t *testing.T) {
	database := setupDB(t)
	cfg := &config.Config{JWTSecret: "test-secret", JWTExpiryHours: 1}

	handlers.EnsureAdminUser(database, "admin", "admin")

	// Get user ID
	var user models.User
	database.Where("username = ?", "admin").First(&user)

	// Create app + notification
	app := models.App{
		ID:          uuid.NewString(),
		UserID:      user.ID,
		Name:        "TestApp",
		TokenPrefix: "aaaaaaaa",
		TokenHash:   "testhash",
		CreatedAt:   time.Now(),
	}
	database.Create(&app)
	database.Create(&models.Notification{
		ID:        uuid.NewString(),
		AppID:     app.ID,
		Title:     "Test",
		Message:   "Body",
		Priority:  5,
		CreatedAt: time.Now(),
	})

	token, _ := auth.GenerateToken(user.ID, user.IsAdmin, cfg.JWTSecret, cfg.JWTExpiryHours)

	r := gin.New()
	r.GET("/api/v1/notification", middleware.JWTAuth(cfg), handlers.ListNotifications(database))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/notification", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	if total, ok := resp["total"].(float64); !ok || total != 1 {
		t.Fatalf("expected total 1, got %v", resp["total"])
	}
}
