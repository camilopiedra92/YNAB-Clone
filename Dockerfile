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

# Commit SHA for deployment traceability (passed via --build-arg)
ARG COMMIT_SHA=unknown

# Build-time environment variables (Dummy placeholders for validation)
# We use standard ENV instead of ARG to prevent inheriting real secrets from build-args.
# Next.js validates these at build time, but we don't need real values here.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV AUTH_SECRET="build-time-placeholder-secret-at-least-32-characters"
ENV AUTH_TRUST_HOST="true"
ENV AUTH_URL="http://localhost:3000"

# Build the Next.js standalone output
# Call next build directly — with-local-tmp.sh is dev-only
RUN npm run build:scripts
RUN npx next build

# ── Stage 3: Production Runner ────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

# Commit SHA for deployment traceability (/api/health)
ARG COMMIT_SHA=unknown
ENV COMMIT_SHA=$COMMIT_SHA

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# OCI metadata labels
LABEL org.opencontainers.image.source="https://github.com/camilopiedra92/YNAB-Clone"
LABEL org.opencontainers.image.revision="$COMMIT_SHA"

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

# Copy compiled scripts (needed for db:migrate:prod)
COPY --from=builder /app/scripts/dist ./scripts/dist
COPY --from=builder /app/scripts/docker-entrypoint.sh ./scripts/docker-entrypoint.sh

# Ensure entrypoint is executable
RUN chmod +x ./scripts/docker-entrypoint.sh

# Switch to non-root user
USER nextjs

# Expose the application port
EXPOSE 3000

# Health check for container orchestration (Coolify, Docker Swarm, Kubernetes)
# Uses 127.0.0.1 instead of localhost to avoid IPv6 resolution on Alpine (::1).
# start-period=30s allows migrations to complete before healthchecks begin.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/health || exit 1

# Start via fail-safe entrypoint
CMD ["./scripts/docker-entrypoint.sh"]
