# Step 1: Build the React app
FROM node:20 AS builder

WORKDIR /app

# Install pnpm and dependencies
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY pnpm-lock.yaml package.json ./
RUN pnpm install --frozen-lockfile

# Build the React app
COPY . ./
RUN pnpm run build

# Step 2: Serve the build using Nginx
FROM nginx:1.23

COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]