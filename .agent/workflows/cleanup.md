---
description: Stop all running app processes (dev server, tests, Node, Playwright, etc.) to free up resources
---

# Cleanup: Stop All Running Processes

Run the following steps to kill all app-related processes and free system resources.

## 1. Kill any process running on common dev/test ports

Covers Next.js dev server (3000), Playwright test server, Drizzle Studio, and any other tenant dev servers that may be using nearby ports.

```bash
for port in 3000 3001 3002 3003 4983 5555 9323; do
  lsof -ti :$port | xargs kill -9 2>/dev/null
done
echo "All dev/test ports cleared"
```

// turbo

## 2. Kill all Node.js / Next.js / test processes related to the project

```bash
pkill -f "next dev" 2>/dev/null
pkill -f "next-server" 2>/dev/null
pkill -f "next start" 2>/dev/null
pkill -f "vitest" 2>/dev/null
pkill -f "playwright" 2>/dev/null
pkill -f "drizzle-kit" 2>/dev/null
pkill -f "tsx/esm" 2>/dev/null
pkill -f "import-ynab-data" 2>/dev/null
pkill -f "migrate-db" 2>/dev/null
pkill -f "health-check" 2>/dev/null
echo "All Node/Next/test/script processes terminated"
```

// turbo

## 3. Kill any background terminal commands that are still running

Use the `send_command_input` tool with `Terminate: true` on any active command IDs from this session that are still running.

## 4. Verify cleanup is complete

```bash
echo "=== Port check ==="
for port in 3000 3001 3002 3003 4983 5555 9323; do
  lsof -i :$port 2>/dev/null && echo "⚠️  Port $port still in use" || true
done
echo ""
echo "=== Node process check ==="
pgrep -afl "next|vitest|playwright|drizzle-kit|tsx" 2>/dev/null || echo "No remaining Node processes"
echo ""
echo "All clean ✅"
```

// turbo
