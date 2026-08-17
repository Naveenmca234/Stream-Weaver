# Multi-stage build for StreamWeaver

# Stage 1: Build backend
FROM node:20-alpine AS backend-builder
WORKDIR /app/backend
COPY backend_backup/package*.json ./
RUN npm ci --only=production
COPY backend_backup/tsconfig.json ./
COPY backend_backup/src ./src
RUN npm run build

# Stage 2: Build frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY client/package*.json ./
RUN npm ci
COPY client .
RUN npm run build

# Stage 3: Runtime - Backend
FROM node:20-alpine AS backend-runtime
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

COPY --from=backend-builder /app/backend/dist ./dist
COPY --from=backend-builder /app/backend/node_modules ./node_modules
COPY --from=backend-builder /app/backend/package*.json ./

RUN mkdir -p uploads && chown -R nodejs:nodejs /app

USER nodejs
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

CMD ["npm", "start"]

# Stage 4: Runtime - Frontend with Nginx
FROM nginx:alpine AS frontend-runtime
COPY client/nginx.conf /etc/nginx/nginx.conf
COPY --from=frontend-builder /app/frontend/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1
CMD ["nginx", "-g", "daemon off;"]
