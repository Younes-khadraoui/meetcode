package main

import (
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

type Session struct {
	ID        string    `json:"id"`
	CreatedAt time.Time `json:"created_at"`
	Host      string    `json:"host"`
	Members   []string  `json:"members"`
	Clients   []*websocket.Conn
}

var (
	sessions = sync.Map{}
	mu       sync.Mutex
	upgrader = websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
		CheckOrigin: func(r *http.Request) bool {
			return true
		},
	}
)

func main() {
	server := echo.New()

	server.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOrigins: []string{"*"},
		AllowMethods: []string{http.MethodGet, http.MethodPost},
	}))

	server.GET("/", handleRoot)
	server.GET("/session/:sessionID", sessionHandler)
	server.POST("/create-meeting", createMeetingHandler)

	server.Logger.Fatal(server.Start(":8000"))
}

func handleRoot(c echo.Context) error {
	return c.String(http.StatusOK, "Welcome to the Meetcode Api")
}

func createMeetingHandler(c echo.Context) error {
	var req struct {
		Host string `json:"host"`
	}

	if err := c.Bind(&req); err != nil || req.Host == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request, host is required"})
	}

	sessionID := generateSessionID()

	_, exists := sessions.Load(sessionID)
	if exists {
		return c.JSON(http.StatusConflict, map[string]string{"error": "Session ID already exists"})
	}

	session := &Session{
		ID:        sessionID,
		CreatedAt: time.Now(),
		Host:      req.Host,
		Members:   []string{},
		Clients:   []*websocket.Conn{},
	}

	sessions.Store(sessionID, session)

	return c.JSON(http.StatusOK, map[string]string{
		"type":     "MEETING_CREATED",
		"endpoint": sessionID,
	})
}

func sessionHandler(c echo.Context) error {
	sessionID := c.Param("sessionID")
	conn, err := upgrader.Upgrade(c.Response().Writer, c.Request(), nil)
	if err != nil {
		log.Println("WebSocket upgrade failed:", err)
		return err
	}
	defer conn.Close()
	defer func() {
		log.Printf("WebSocket connection closed for session '%s'\n", sessionID)
		conn.Close()
	}()

	// Read WebSocket messages
	for {
		var msg map[string]interface{}
		err := conn.ReadJSON(&msg)
		if err != nil {
			log.Println("Failed to read WebSocket message:", err)
			break
		}

		msgType, ok := msg["type"].(string)
		if !ok {
			log.Println("Message type not found")
			continue
		}

		fmt.Println("messg type", msgType)

		switch msgType {
		case "JOIN_MEETING":
			handleJoinMeeting(conn, msg, sessionID)
		case "OFFER", "ANSWER", "CANDIDATE":
			handleWebRTCSignaling(conn, msg)
		default:
			log.Println("Unknown action:", msgType)
		}
	}

	return nil
}

func handleJoinMeeting(conn *websocket.Conn, msg map[string]interface{}, sessionID string) {
	member, _ := msg["member"].(string)
	if member == "" {
		conn.WriteJSON(map[string]string{"type": "INVALID_REQUEST"})
		return
	}

	sessionID = normalizeSessionID(sessionID)
	value, exists := sessions.Load(sessionID)
	if !exists {
		log.Printf("Session '%s' does not exist\n", sessionID)
		conn.WriteJSON(map[string]string{"type": "SESSION_NOT_FOUND"})
		return
	}

	session := value.(*Session)

	mu.Lock()
	session.Members = append(session.Members, member)
	session.Clients = append(session.Clients, conn)
	mu.Unlock()

	for _, client := range session.Clients {
		if client != conn {
			log.Printf("Notifying other clients about new member '%s'\n", member)
			client.WriteJSON(map[string]string{
				"type":      "NEW_MEMBER",
				"member":    member,
				"sessionID": sessionID,
			})
		}
	}
}

func handleWebRTCSignaling(conn *websocket.Conn, msg map[string]interface{}) {
	sessionID, ok := msg["sessionID"].(string)
	if !ok {
		log.Println("Session ID not found in signaling message")
		return
	}

	fmt.Println(sessionID)

	sessionID = normalizeSessionID(sessionID)
	value, exists := sessions.Load(sessionID)
	if !exists {
		log.Printf("Session '%s' not found for signaling message\n", sessionID)
		return
	}

	session := value.(*Session)

	msgType, ok := msg["type"].(string)
	if !ok {
		log.Println("Message type not found in signaling message")
		return
	}

	log.Printf("Signaling message received: Type=%s, Session=%s, Data=%+v\n", msgType, sessionID, msg)

	switch msgType {
	case "OFFER":
		log.Printf("Received OFFER from member '%s' in session '%s'. Broadcasting to other clients...\n", msg["member"], sessionID)
		for _, client := range session.Clients {
			if client != conn {
				err := client.WriteJSON(map[string]interface{}{
					"type":      "OFFER",
					"offer":     msg["offer"],
					"member":    msg["member"],
					"sessionID": sessionID,
				})
				if err != nil {
					log.Printf("Failed to send OFFER to a client: %v\n", err)
				} else {
					log.Printf("OFFER successfully sent to a client in session '%s'\n", sessionID)
				}
			}
		}
	case "ANSWER":
		log.Printf("Broadcasting ANSWER from member '%s' to session '%s'\n", msg["member"], sessionID)
		for _, client := range session.Clients {
			if client != conn {
				client.WriteJSON(map[string]interface{}{
					"type":      "ANSWER",
					"answer":    msg["answer"],
					"member":    msg["member"],
					"sessionID": sessionID,
				})
			}
		}
	case "CANDIDATE":
		log.Printf("Broadcasting CANDIDATE from member '%s' to session '%s'\n", msg["member"], sessionID)
		for _, client := range session.Clients {
			if client != conn {
				client.WriteJSON(map[string]interface{}{
					"type":      "CANDIDATE",
					"candidate": msg["candidate"],
					"member":    msg["member"],
					"sessionID": sessionID,
				})
			}
		}
	default:
		log.Println("Unknown signaling type:", msgType)
	}
}

func generateSessionID() string {
	return uuid.New().String()
}

func normalizeSessionID(sessionID string) string {
    if len(sessionID) > 8 && sessionID[:8] == "session/" {
        return sessionID[8:]
    }
    return sessionID
}