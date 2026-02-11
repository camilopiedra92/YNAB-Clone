# ══════════════════════════════════════════════════════════════
# YNAB App — Production Dockerfile
# Multi-stage build for minimal image size (~150MB)
# ══════════════════════════════════════════════════════════════

# ── Stage 1: Install Dependencies ─────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app

# Copy only package files first (Docker layer caching)
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# ── Stage 2: Build Application ────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

# Copy dependencies from Stage 1
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time environment variables (non-secret placeholders)
# Next.js validates env at build time — real values injected at runtime
ARG DATABASE_URL=postgresql://build:build@localhost:5432/build
ARG AUTH_SECRET=build-time-placeholder-secret-at-least-32-characters
ARG AUTH_TRUST_HOST=true
ENV DATABASE_URL=$DATABASE_URL
ENV AUTH_SECRET=$AUTH_SECRET
ENV AUTH_TRUST_HOST=$AUTH_TRUST_HOST

# Build the Next.js standalone output
# Call next build directly — with-local-tmp.sh is dev-only
RUN npx next build

# ── Stage 3: Production Runner ────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Security: Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
  adduser --system --uid 1001 nextjs

# Copy standalone output (includes server.js + minimal node_modules)
COPY --from=builder /app/.next/standalone ./

# Copy static assets (not included in standalone by default)
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy Drizzle migrations (needed at runtime for db:migrate)
COPY --from=builder /app/drizzle ./drizzle

# Switch to non-root user
USER nextjs

# Expose the application port
EXPOSE 3000

# Docker-level health check (used by Coolify for container health)
# Requires /api/health endpoint (created in Phase 2)
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/health || exit 1

# Start the standalone Next.js server
CMD ["node", "server.js"]
