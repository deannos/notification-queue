package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
)

// GenerateAppToken produces a cryptographically random 64-char hex token.
func GenerateAppToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("generate token: %w", err)
	}
	return hex.EncodeToString(b), nil
}

// HashToken returns the SHA-256 hex digest of a plaintext token.
// SHA-256 is appropriate here because tokens are high-entropy random strings (not passwords).
func HashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

// TokenPrefix returns the first 8 characters of a token, used for fast DB lookup.
func TokenPrefix(token string) string {
	if len(token) < 8 {
		return token
	}
	return token[:8]
}
