package hub

import (
	"log"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 4096
)

// Client is a single WebSocket connection belonging to a user.
type Client struct {
	UserID string
	conn   *websocket.Conn
	send   chan []byte
	hub    *Hub
}

// Broadcast carries a payload destined for all connections of a specific user.
type Broadcast struct {
	UserID  string
	Payload []byte
}

// Hub maintains the set of active WebSocket clients and broadcasts messages.
type Hub struct {
	clients    map[string][]*Client
	register   chan *Client
	unregister chan *Client
	broadcast  chan *Broadcast
	mu         sync.RWMutex
}

func New() *Hub {
	return &Hub{
		clients:    make(map[string][]*Client),
		register:   make(chan *Client, 256),
		unregister: make(chan *Client, 256),
		broadcast:  make(chan *Broadcast, 1024),
	}
}

// Run starts the hub event loop. Call in a separate goroutine.
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client.UserID] = append(h.clients[client.UserID], client)
			h.mu.Unlock()
			log.Printf("hub: client registered user=%s total=%d", client.UserID, len(h.clients[client.UserID]))

		case client := <-h.unregister:
			h.mu.Lock()
			clients := h.clients[client.UserID]
			for i, c := range clients {
				if c == client {
					h.clients[client.UserID] = append(clients[:i], clients[i+1:]...)
					close(client.send)
					break
				}
			}
			if len(h.clients[client.UserID]) == 0 {
				delete(h.clients, client.UserID)
			}
			h.mu.Unlock()
			log.Printf("hub: client unregistered user=%s", client.UserID)

		case msg := <-h.broadcast:
			h.mu.RLock()
			clients := make([]*Client, len(h.clients[msg.UserID]))
			copy(clients, h.clients[msg.UserID])
			h.mu.RUnlock()

			for _, c := range clients {
				select {
				case c.send <- msg.Payload:
				default:
					// Slow client — drop and unregister asynchronously.
					go func(cl *Client) { h.unregister <- cl }(c)
				}
			}
		}
	}
}

// Send broadcasts a JSON payload to all connections belonging to userID.
func (h *Hub) Send(userID string, payload []byte) {
	h.broadcast <- &Broadcast{UserID: userID, Payload: payload}
}

// NewClient creates a Client and registers it with the hub.
func (h *Hub) NewClient(userID string, conn *websocket.Conn) *Client {
	c := &Client{
		UserID: userID,
		conn:   conn,
		send:   make(chan []byte, 256),
		hub:    h,
	}
	h.register <- c
	return c
}

// WritePump pumps messages from the send channel to the WebSocket connection.
func (c *Client) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.hub.unregister <- c
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := c.conn.WriteMessage(websocket.TextMessage, message); err != nil {
				return
			}

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// ReadPump reads from the WebSocket. Keeps the connection alive and detects disconnects.
func (c *Client) ReadPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()

	c.conn.SetReadLimit(maxMessageSize)
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, _, err := c.conn.ReadMessage()
		if err != nil {
			break
		}
	}
}
