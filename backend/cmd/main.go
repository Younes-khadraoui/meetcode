package main

import (
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

func main() {
	server := echo.New()

	DefaultCORSConfig := middleware.CORSConfig{
		AllowOrigins: []string{"*"},
		AllowMethods: []string{http.MethodGet, http.MethodHead, http.MethodPut, http.MethodPatch, http.MethodPost, http.MethodDelete},
	}

	server.Use(middleware.CORSWithConfig(DefaultCORSConfig))

	server.GET("/", handleRoot)

	server.Logger.Fatal(server.Start(":8000"))
}

func handleRoot(c echo.Context) error {
	return c.String(http.StatusOK, "Hello world")
}
