FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies for both server and client
COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/

# Build client
WORKDIR /app/client
RUN npm install
COPY client/ ./
RUN npm run build

# Build server
WORKDIR /app/server
RUN npm install
COPY server/ ./
RUN npm run build

# Final production image
FROM node:20-alpine

WORKDIR /app/server

# Install bash and curl for healthchecks
RUN apk add --no-cache bash curl

COPY --from=builder /app/server/package*.json ./
RUN npm install --only=production

COPY --from=builder /app/server/dist ./dist
COPY --from=builder /app/client/dist /app/client/dist

# Create necessary directories
RUN mkdir -p uploads storage

ENV NODE_ENV=production
ENV PORT=5000
ENV CLIENT_PATH=/app/client/dist

EXPOSE 5000

CMD ["node", "dist/server.js"]
