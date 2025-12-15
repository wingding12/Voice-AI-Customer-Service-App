# Backend Dockerfile for Railway deployment
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy workspace package files
COPY package*.json ./
COPY apps/backend/package*.json ./apps/backend/
COPY packages/database/package*.json ./packages/database/
COPY packages/shared-types/package*.json ./packages/shared-types/

# Install all dependencies
RUN npm install

# Build stage
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN npm run build -w database 2>/dev/null || true
RUN npm run build -w shared-types 2>/dev/null || true
RUN npm run build -w backend

# Production stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 expressjs

# Copy built assets
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder /app/apps/backend/package.json ./apps/backend/package.json
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/package.json ./package.json

USER expressjs

EXPOSE 3001

ENV PORT=3001

WORKDIR /app/apps/backend

CMD ["node", "dist/server.js"]

