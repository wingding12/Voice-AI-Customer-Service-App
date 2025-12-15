# Frontend Dockerfile for Railway deployment
FROM node:20-alpine AS base

# Install dependencies
FROM base AS deps
WORKDIR /app

COPY package*.json ./
COPY apps/web-client/package*.json ./apps/web-client/
COPY packages/shared-types/package*.json ./packages/shared-types/

RUN npm install

# Build stage
FROM base AS builder
WORKDIR /app

# Accept build-time environment variables
ARG VITE_API_URL
ARG VITE_WS_URL

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build shared types first
RUN npm run build -w shared-types 2>/dev/null || true

# Build frontend
RUN npm run build -w web-client

# Production stage with nginx
FROM nginx:alpine AS runner

# Copy built assets
COPY --from=builder /app/apps/web-client/dist /usr/share/nginx/html

# Copy nginx config
COPY apps/web-client/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 5173

CMD ["nginx", "-g", "daemon off;"]

