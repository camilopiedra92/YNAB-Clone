#!/bin/sh
set -e

echo "🚀 Starting YNAB App (Production Mode)..."

# 1. Wait for DB (optional, but good practice if using wait-for-it, skipping for now as Cloud providers usually handle this)

# 2. Run Migrations (Critical Step)
echo "📦 Running database migrations..."
if npm run db:migrate:prod; then
    echo "✅ Migrations applied successfully."
else
    echo "❌ CRITICAL: Migrations failed. Aborting startup to protect data integrity."
    exit 1
fi

# 3. Start Application
echo "🟢 Starting Next.js server..."
exec node server.js
