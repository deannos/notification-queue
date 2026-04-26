package hub

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"sync"
	"time"
)

type ticketEntry struct {
	userID    string
	expiresAt time.Time
}

// TicketStore issues short-lived opaque tokens that map to a user ID,
// allowing WebSocket clients to avoid putting a JWT in the URL.
type TicketStore struct {
	mu      sync.Mutex
	tickets map[string]ticketEntry
}

// NewTicketStore creates a TicketStore whose cleanup goroutine stops when ctx is cancelled.
func NewTicketStore(ctx context.Context) *TicketStore {
	ts := &TicketStore{tickets: make(map[string]ticketEntry)}
	go ts.cleanupLoop(ctx)
	return ts
}

func (ts *TicketStore) Issue(userID string) (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	ticket := hex.EncodeToString(b)
	ts.mu.Lock()
	ts.tickets[ticket] = ticketEntry{userID: userID, expiresAt: time.Now().Add(30 * time.Second)}
	ts.mu.Unlock()
	return ticket, nil
}

func (ts *TicketStore) Consume(ticket string) (string, bool) {
	ts.mu.Lock()
	defer ts.mu.Unlock()
	e, ok := ts.tickets[ticket]
	if !ok || time.Now().After(e.expiresAt) {
		delete(ts.tickets, ticket)
		return "", false
	}
	delete(ts.tickets, ticket)
	return e.userID, true
}

func (ts *TicketStore) cleanupLoop(ctx context.Context) {
	t := time.NewTicker(time.Minute)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			now := time.Now()
			ts.mu.Lock()
			for k, v := range ts.tickets {
				if now.After(v.expiresAt) {
					delete(ts.tickets, k)
				}
			}
			ts.mu.Unlock()
		}
	}
}
