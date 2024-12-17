package main

import (
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"golang.org/x/exp/rand"
)

var sessions = make(map[string]Session)
var mu sync.Mutex

type Session struct {
	ID        string    `json:"id"`
	Create_at time.Time `json:"create_at"`
	Host      string    `json:"host"`
	Members   []string  `json:"members"`
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func main() {
	server := echo.New()

	DefaultCORSConfig := middleware.CORSConfig{
		AllowOrigins: []string{"*"},
		AllowMethods: []string{http.MethodGet, http.MethodHead, http.MethodPut, http.MethodPatch, http.MethodPost, http.MethodDelete},
	}

	server.Use(middleware.CORSWithConfig(DefaultCORSConfig))

	server.GET("/", handleRoot)

	server.GET("/ws", wsHandler)

	server.GET("/ws/:id", wsHandler)

	server.Logger.Fatal(server.Start(":8000"))
}

func handleRoot(c echo.Context) error {
	return c.String(http.StatusOK, "Hello world")
}

func wsHandler(c echo.Context) error {
	conn, err := upgrader.Upgrade(c.Response().Writer, c.Request(), nil)
	if err != nil {
		log.Println(err)
		return nil
	}

	defer conn.Close()

	for {
		var msg = make(map[string]string)
		err := conn.ReadJSON(&msg)
		if err != nil {
			log.Fatal("Cant read client message")
		}

		if msg["action"] == "CREATE_MEETING" {
			sessionID := generateSessionID()

			mu.Lock()
			sessions[sessionID] = Session{
				ID:        sessionID,
				Create_at: time.Now(),
				Host:      msg["host"],
				Members:   []string{},
			}
			mu.Unlock()

			res := map[string]string{
				"action":     "MEETING_CREATED",
				"sessionURL": "http:localhost:3000/" + sessionID,
			}
			conn.WriteJSON(res)
		}

		if msg["action"] == "JOIN_MEETING" {
			sessionID := msg["sessionID"]

			mu.Lock()
			session := sessions[sessionID]
			session.Members = append(session.Members, msg["member"])
			sessions[sessionID] = session
			mu.Unlock()

			res := map[string]string{
				"action": "JOINING_MEET",
			}
			conn.WriteJSON(res)
		}
	}
}

func generateSessionID() string {
	return fmt.Sprintf("%06d", rand.Intn(1000000))
}

