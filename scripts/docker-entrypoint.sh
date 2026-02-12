#!/bin/sh
set -e

echo "🚀 Starting YNAB App (Production Mode)..."

# 1. Run Migrations (Critical Step)
echo "📦 Running database migrations..."
# The migration script includes a retry mechanism for DB connection
if npm run db:migrate:prod; then
    echo "✅ Migrations applied successfully."
else
    echo "❌ CRITICAL: Migrations failed. Aborting startup to protect data integrity."
    exit 1
fi

# 3. Start Application
echo "🟢 Starting Next.js server..."
exec node server.js
