package main

import (
	"fmt"
	"log"
	"net/http"

	"github.com/gorilla/websocket"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

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
	for {
		messageType, p, err := conn.ReadMessage()
		fmt.Println("The client sent :", string(p))
		if err != nil {
			log.Println(err)
			return nil
		}
		if err := conn.WriteMessage(messageType, p); err != nil {
			log.Println(err)
			return nil
		}
	}
}
