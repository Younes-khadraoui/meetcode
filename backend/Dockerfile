FROM golang:1.22-bullseye AS build

# Set ENV variables
ENV GO111MODULE=on \
    CGO_ENABLED=0 \
    GOOS=linux \
    GOARCH=amd64

WORKDIR /app

# Copy Go modules and download dependencies
COPY go.mod go.sum ./
RUN go mod download

# Copy application source code and build
COPY . ./
WORKDIR /app/cmd
RUN go build -o main .

# Use a minimal image to run the binary
FROM --platform=linux/amd64 alpine:3.14

WORKDIR /root

COPY --from=build /app/cmd/main .
EXPOSE 8000

CMD ["./main"]