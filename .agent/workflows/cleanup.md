---
description: Stop all running app processes (dev server, tests, Node, Playwright, etc.) to free up resources
---

# Cleanup: Nuclear Process Termination & Resource Recovery

Run ALL steps in order. This is a comprehensive, zero-survivors cleanup — kills every dev process, clears every cache, closes every connection, and reclaims all resources.

## 1. Capture pre-cleanup snapshot

Saves detailed metrics to a temp file for the before/after comparison report in the final step. **This step MUST run first.**

```bash
REPORT_FILE="/tmp/cleanup-report-$(date +%s).txt"
echo "$REPORT_FILE" > /tmp/cleanup-report-path.txt

echo "CLEANUP_TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')" > "$REPORT_FILE"

# --- Node processes ---
node_count=$(pgrep -f 'node' 2>/dev/null | wc -l | tr -d ' ')
echo "BEFORE_NODE_COUNT=$node_count" >> "$REPORT_FILE"
node_list=$(pgrep -afl 'node' 2>/dev/null | grep -vE "Antigravity|Google|Visual Studio|Cursor|Electron|Spotlight|mdworker|CoreServices" || echo "(none)")
echo "BEFORE_NODE_LIST<<ENDLIST" >> "$REPORT_FILE"
echo "$node_list" >> "$REPORT_FILE"
echo "ENDLIST" >> "$REPORT_FILE"

# --- Dev tool processes ---
dev_list=$(pgrep -afl "next|vitest|playwright|drizzle-kit|tsx|ts-node|turbopack|webpack|esbuild|swc|nodemon|jest|chromium|firefox.*marionette" 2>/dev/null || echo "(none)")
dev_count=$(echo "$dev_list" | grep -v "^(none)$" | wc -l | tr -d ' ')
echo "BEFORE_DEV_COUNT=$dev_count" >> "$REPORT_FILE"
echo "BEFORE_DEV_LIST<<ENDLIST" >> "$REPORT_FILE"
echo "$dev_list" >> "$REPORT_FILE"
echo "ENDLIST" >> "$REPORT_FILE"

# --- Ports ---
port_list=""
port_count=0
for port in 3000 3001 3002 3003 4983 5555 8080 8443 9323 24678 42069; do
  pid=$(lsof -ti :$port 2>/dev/null)
  if [ -n "$pid" ]; then
    cmd=$(ps -p "$pid" -o args= 2>/dev/null | head -c 60 || echo "unknown")
    port_list="$port_list    :$port → PID $pid ($cmd)\n"
    port_count=$((port_count + 1))
  fi
done
echo "BEFORE_PORT_COUNT=$port_count" >> "$REPORT_FILE"
echo "BEFORE_PORT_LIST<<ENDLIST" >> "$REPORT_FILE"
[ -n "$port_list" ] && printf "$port_list" >> "$REPORT_FILE" || echo "    (none)" >> "$REPORT_FILE"
echo "ENDLIST" >> "$REPORT_FILE"

# --- Memory ---
mem_used=$(vm_stat 2>/dev/null | awk '/Pages active/ {gsub(/\./,"",$NF); printf "%.0f", $NF * 4096 / 1048576}')
mem_wired=$(vm_stat 2>/dev/null | awk '/Pages wired/ {gsub(/\./,"",$NF); printf "%.0f", $NF * 4096 / 1048576}')
mem_free=$(vm_stat 2>/dev/null | awk '/Pages free/ {gsub(/\./,"",$NF); printf "%.0f", $NF * 4096 / 1048576}')
echo "BEFORE_MEM_ACTIVE=${mem_used:-0}" >> "$REPORT_FILE"
echo "BEFORE_MEM_WIRED=${mem_wired:-0}" >> "$REPORT_FILE"
echo "BEFORE_MEM_FREE=${mem_free:-0}" >> "$REPORT_FILE"

# --- File descriptors ---
fd_node=$(lsof -c node 2>/dev/null | wc -l | tr -d ' ')
echo "BEFORE_FD_NODE=$fd_node" >> "$REPORT_FILE"

# --- Disk cache sizes ---
PROJECT_DIR="/Users/camilopiedra/Documents/YNAB/ynab-app"
next_size=$(du -sh "$PROJECT_DIR/.next" 2>/dev/null | cut -f1 || echo "0B")
cache_size=$(du -sh "$PROJECT_DIR/node_modules/.cache" 2>/dev/null | cut -f1 || echo "0B")
tmp_size=$(du -shc /tmp/next-* /tmp/playwright-* /tmp/vitest-* /tmp/tsx-* 2>/dev/null | tail -1 | cut -f1 || echo "0B")
echo "BEFORE_NEXT_CACHE=$next_size" >> "$REPORT_FILE"
echo "BEFORE_MODULE_CACHE=$cache_size" >> "$REPORT_FILE"
echo "BEFORE_TMP_SIZE=$tmp_size" >> "$REPORT_FILE"

# --- DB connections ---
db_conns=$(psql "$DATABASE_URL" -t -c "SELECT count(*) FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid();" 2>/dev/null | tr -d ' ' || echo "N/A")
echo "BEFORE_DB_CONNS=$db_conns" >> "$REPORT_FILE"

echo "📊 Pre-cleanup snapshot saved to $REPORT_FILE"
```

// turbo

## 2. Kill any process running on dev/test ports

Covers Next.js (3000), alt dev servers (3001-3003), Playwright (4983/9323), Drizzle Studio (5555), HMR websocket (24678), and HTTP test servers.

```bash
for port in 3000 3001 3002 3003 4983 5555 8080 8443 9323 24678 42069; do
  pids=$(lsof -ti :$port 2>/dev/null)
  if [ -n "$pids" ]; then
    echo "$pids" | xargs kill -9 2>/dev/null
    echo "  Killed PIDs on :$port → $pids"
  fi
done
echo "✓ All dev/test ports cleared"
```

// turbo

## 3. Kill all dev processes by name pattern (SIGKILL)

Exhaustive list of every known dev-related process. Uses `-9` (SIGKILL) — no graceful shutdown.

```bash
# Protected pattern: never kill IDE or agent processes
exclude_pattern="Antigravity|Google Chrome|Visual Studio|Cursor|Electron|Spotlight|mdworker|WindowServer|CoreServices"

patterns=(
  # Next.js ecosystem
  "next dev"
  "next-server"
  "next-router-worker"
  "next start"
  "next build"
  "node.*next"
  "node.*\.next"
  "turbopack"
  # Bundlers & compilers
  "webpack"
  "esbuild"
  "swc"
  "@swc/core"
  "napi"
  "babel"
  "rollup"
  "vite"
  # Test runners
  "vitest"
  "jest"
  "playwright"
  "chromium"
  "chrome.*--headless"
  "firefox.*--headless"
  "webkit2"
  # Dev tools
  "drizzle-kit"
  "tsx"
  "ts-node"
  "nodemon"
  "concurrently"
  # Package managers
  "npm run"
  "npm exec"
  "npx"
  "pnpm"
  "yarn"
  # Project scripts
  "import-ynab-data"
  "migrate-db"
  "health-check"
  "check:future"
  "debug-import"
  "seed"
  "node.*ynab"
  # File watchers
  "watchman"
  "fsevents"
  "chokidar"
  "inotifywait"
  # Misc
  "live-server"
  "http-server"
  "serve"
  "browser-sync"
)
killed=0
for pat in "${patterns[@]}"; do
  pids=$(pgrep -f "$pat" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    for pid in $pids; do
      cmd=$(ps -p "$pid" -o args= 2>/dev/null || true)
      if [ -n "$cmd" ] && ! echo "$cmd" | grep -qE "$exclude_pattern"; then
        kill -9 "$pid" 2>/dev/null && killed=$((killed + 1))
      fi
    done
  fi
done
echo "✓ Killed $killed dev processes (Antigravity/IDE protected)"
```

// turbo

## 4. Kill ALL orphan Node.js processes (with IDE protection)

Nuclear option — catches ANY remaining node process. Carefully excludes IDE and system processes.

```bash
exclude_pattern="Antigravity|Google Chrome|Visual Studio|Cursor|Electron|Spotlight|mdworker|WindowServer|CoreServices"

node_pids=$(pgrep -f "node" 2>/dev/null || true)
killed=0
if [ -n "$node_pids" ]; then
  for pid in $node_pids; do
    cmd=$(ps -p "$pid" -o args= 2>/dev/null || true)
    if [ -n "$cmd" ] && ! echo "$cmd" | grep -qE "$exclude_pattern"; then
      kill -9 "$pid" 2>/dev/null && killed=$((killed + 1))
    fi
  done
fi
echo "✓ Killed $killed orphan node processes"
```

// turbo

## 5. Kill Playwright browser instances

Playwright spawns real browser processes (Chromium, Firefox, WebKit) that persist after test crashes.

```bash
pkill -9 -f "Chromium.*--remote-debugging" 2>/dev/null
pkill -9 -f "chrome.*--test-type" 2>/dev/null
pkill -9 -f "firefox.*-marionette" 2>/dev/null
pkill -9 -f "playwright.*server" 2>/dev/null
pkill -9 -f "pw:browser" 2>/dev/null
rm -rf /tmp/playwright-* 2>/dev/null
echo "✓ Playwright browsers and sockets cleaned"
```

// turbo

## 6. Close stale PostgreSQL connections from the app

Drizzle connection pools can leave idle connections open. Closes them without stopping PostgreSQL itself.

```bash
psql "$DATABASE_URL" -c "
  SELECT pg_terminate_backend(pid)
  FROM pg_stat_activity
  WHERE datname = current_database()
    AND pid <> pg_backend_pid()
    AND state = 'idle'
    AND application_name NOT IN ('psql', 'pgAdmin', 'DBeaver', 'TablePlus', 'Postico')
    AND query_start < NOW() - INTERVAL '30 seconds';
" 2>/dev/null && echo "✓ Stale DB connections closed" || echo "⏭  Skipped DB cleanup (no DATABASE_URL or DB not running)"
```

// turbo

## 7. Clean all caches, temp files, and build artifacts

Remove every cache and temp file that could cause stale state on restart.

```bash
PROJECT_DIR="/Users/camilopiedra/Documents/YNAB/ynab-app"

rm -rf "$PROJECT_DIR/.next"
rm -rf "$PROJECT_DIR/node_modules/.cache"
rm -rf "$PROJECT_DIR/node_modules/.vite"
rm -rf "$PROJECT_DIR/node_modules/.vitest"
rm -rf "$PROJECT_DIR/tsconfig.tsbuildinfo"
rm -rf "$PROJECT_DIR/test-results"
rm -rf "$PROJECT_DIR/playwright-report"
rm -rf /tmp/next-*
rm -rf /tmp/playwright-*
rm -rf /tmp/vitest-*
rm -rf /tmp/tsx-*
rm -rf /tmp/drizzle-*
rm -rf /tmp/vite-*
rm -f "$PROJECT_DIR/.git/index.lock" 2>/dev/null
rm -f "$PROJECT_DIR/.git/refs/heads/*.lock" 2>/dev/null
find /tmp -maxdepth 1 -name "*.sock" -user "$(whoami)" -delete 2>/dev/null
find /tmp -maxdepth 1 -name "node-*" -user "$(whoami)" -type d -exec rm -rf {} + 2>/dev/null

echo "✓ All caches and temp files removed"
```

// turbo

## 8. Kill any background terminal commands that are still running

Use the `send_command_input` tool with `Terminate: true` on **every** active command ID from this session that is still running. Check the running terminal commands listed in the user's state metadata. Do NOT skip this step — lingering terminal processes are the #1 source of zombie node/next processes.

## 9. Retry pass — catch anything that respawned

Some processes (especially Next.js workers) respawn after being killed. Wait 2 seconds and sweep again.

```bash
sleep 2
exclude_pattern="Antigravity|Google Chrome|Visual Studio|Cursor|Electron|Spotlight|mdworker|WindowServer|CoreServices"
for pat in "next" "node.*ynab" "esbuild" "swc" "vitest" "playwright" "tsx" "turbopack"; do
  pids=$(pgrep -f "$pat" 2>/dev/null || true)
  for pid in $pids; do
    cmd=$(ps -p "$pid" -o args= 2>/dev/null || true)
    if [ -n "$cmd" ] && ! echo "$cmd" | grep -qE "$exclude_pattern"; then
      kill -9 "$pid" 2>/dev/null
    fi
  done
done
for port in 3000 3001 3002 3003 4983 5555 9323 24678; do
  pids=$(lsof -ti :$port 2>/dev/null)
  [ -n "$pids" ] && echo "$pids" | xargs kill -9 2>/dev/null
done
echo "✓ Retry pass complete"
```

// turbo

## 10. Flush macOS system caches

Reclaim memory and clear DNS cache.

```bash
sudo dscacheutil -flushcache 2>/dev/null || dscacheutil -flushcache 2>/dev/null || true
sudo purge 2>/dev/null || true
echo "✓ macOS system caches flushed (DNS + memory)"
```

// turbo

## 11. Generate before/after comparison report

This is the final step. It reads the pre-cleanup snapshot and compares to current state. **Print the entire report to stdout.**

```bash
REPORT_FILE=$(cat /tmp/cleanup-report-path.txt 2>/dev/null)
if [ ! -f "$REPORT_FILE" ]; then
  echo "⚠️  Pre-cleanup snapshot not found. Skipping comparison."
  exit 0
fi

# Load pre-cleanup values
source "$REPORT_FILE" 2>/dev/null

# Collect post-cleanup values
AFTER_NODE_COUNT=$(pgrep -f 'node' 2>/dev/null | wc -l | tr -d ' ')
exclude="Antigravity|Google|Visual Studio|Cursor|Electron|Spotlight|mdworker|CoreServices"
AFTER_NODE_LIST=$(pgrep -afl 'node' 2>/dev/null | grep -vE "$exclude" || echo "(none)")
AFTER_DEV_LIST=$(pgrep -afl "next|vitest|playwright|drizzle-kit|tsx|ts-node|turbopack|webpack|esbuild|swc|nodemon|jest|chromium|firefox.*marionette" 2>/dev/null || echo "(none)")
AFTER_DEV_COUNT=$(echo "$AFTER_DEV_LIST" | grep -v "^(none)$" | wc -l | tr -d ' ')

AFTER_PORT_COUNT=0
AFTER_PORT_LIST=""
for port in 3000 3001 3002 3003 4983 5555 8080 8443 9323 24678 42069; do
  pid=$(lsof -ti :$port 2>/dev/null)
  if [ -n "$pid" ]; then
    cmd=$(ps -p "$pid" -o args= 2>/dev/null | head -c 60 || echo "unknown")
    AFTER_PORT_LIST="$AFTER_PORT_LIST    :$port → PID $pid ($cmd)\n"
    AFTER_PORT_COUNT=$((AFTER_PORT_COUNT + 1))
  fi
done
[ -z "$AFTER_PORT_LIST" ] && AFTER_PORT_LIST="    (none)\n"

AFTER_MEM_ACTIVE=$(vm_stat 2>/dev/null | awk '/Pages active/ {gsub(/\./,"",$NF); printf "%.0f", $NF * 4096 / 1048576}')
AFTER_MEM_WIRED=$(vm_stat 2>/dev/null | awk '/Pages wired/ {gsub(/\./,"",$NF); printf "%.0f", $NF * 4096 / 1048576}')
AFTER_MEM_FREE=$(vm_stat 2>/dev/null | awk '/Pages free/ {gsub(/\./,"",$NF); printf "%.0f", $NF * 4096 / 1048576}')
AFTER_FD_NODE=$(lsof -c node 2>/dev/null | wc -l | tr -d ' ')

PROJECT_DIR="/Users/camilopiedra/Documents/YNAB/ynab-app"
AFTER_NEXT_CACHE=$(du -sh "$PROJECT_DIR/.next" 2>/dev/null | cut -f1 || echo "0B")
AFTER_MODULE_CACHE=$(du -sh "$PROJECT_DIR/node_modules/.cache" 2>/dev/null | cut -f1 || echo "0B")
AFTER_TMP_SIZE=$(du -shc /tmp/next-* /tmp/playwright-* /tmp/vitest-* /tmp/tsx-* 2>/dev/null | tail -1 | cut -f1 || echo "0B")

AFTER_DB_CONNS=$(psql "$DATABASE_URL" -t -c "SELECT count(*) FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid();" 2>/dev/null | tr -d ' ' || echo "N/A")

# Calculate deltas
delta_node=$((BEFORE_NODE_COUNT - AFTER_NODE_COUNT))
delta_dev=$((BEFORE_DEV_COUNT - AFTER_DEV_COUNT))
delta_ports=$((BEFORE_PORT_COUNT - AFTER_PORT_COUNT))
delta_fd=$((BEFORE_FD_NODE - AFTER_FD_NODE))
delta_mem_active=$((${BEFORE_MEM_ACTIVE:-0} - ${AFTER_MEM_ACTIVE:-0}))
delta_mem_free=$((${AFTER_MEM_FREE:-0} - ${BEFORE_MEM_FREE:-0}))

# Helper for delta display
format_delta() {
  local val=$1
  if [ "$val" -gt 0 ] 2>/dev/null; then
    echo "↓ $val freed"
  elif [ "$val" -lt 0 ] 2>/dev/null; then
    echo "↑ $(echo $val | tr -d '-') added"
  else
    echo "— no change"
  fi
}

# Print the report
echo ""
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║              🧹 CLEANUP REPORT — $(date '+%Y-%m-%d %H:%M:%S')              ║"
echo "╠══════════════════════════════════════════════════════════════════╣"
echo "║  Started: $CLEANUP_TIMESTAMP                                   ║"
echo "║  Finished: $(date '+%Y-%m-%d %H:%M:%S')                                  ║"
echo "╚══════════════════════════════════════════════════════════════════╝"

echo ""
echo "┌──────────────────────────────────────────────────────────────────┐"
echo "│  📊 RESOURCE COMPARISON                                         │"
echo "├──────────────────────────┬──────────┬──────────┬────────────────┤"
echo "│ Metric                   │  Before  │  After   │    Delta       │"
echo "├──────────────────────────┼──────────┼──────────┼────────────────┤"
printf "│ %-24s │ %8s │ %8s │ %-14s │\n" "Node processes" "$BEFORE_NODE_COUNT" "$AFTER_NODE_COUNT" "$(format_delta $delta_node)"
printf "│ %-24s │ %8s │ %8s │ %-14s │\n" "Dev tool processes" "$BEFORE_DEV_COUNT" "$AFTER_DEV_COUNT" "$(format_delta $delta_dev)"
printf "│ %-24s │ %8s │ %8s │ %-14s │\n" "Occupied ports" "$BEFORE_PORT_COUNT" "$AFTER_PORT_COUNT" "$(format_delta $delta_ports)"
printf "│ %-24s │ %8s │ %8s │ %-14s │\n" "Node file descriptors" "$BEFORE_FD_NODE" "$AFTER_FD_NODE" "$(format_delta $delta_fd)"
printf "│ %-24s │ %5s MB │ %5s MB │ %-14s │\n" "Active memory" "${BEFORE_MEM_ACTIVE:-?}" "${AFTER_MEM_ACTIVE:-?}" "$(format_delta $delta_mem_active) MB"
printf "│ %-24s │ %5s MB │ %5s MB │ %-14s │\n" "Free memory" "${BEFORE_MEM_FREE:-?}" "${AFTER_MEM_FREE:-?}" "$(format_delta $delta_mem_free) MB"
printf "│ %-24s │ %8s │ %8s │                │\n" "DB connections" "${BEFORE_DB_CONNS:-N/A}" "${AFTER_DB_CONNS:-N/A}"
echo "├──────────────────────────┴──────────┴──────────┴────────────────┤"
printf "│ %-24s │ %8s │ %8s │                │\n" ".next cache" "${BEFORE_NEXT_CACHE}" "${AFTER_NEXT_CACHE}"
printf "│ %-24s │ %8s │ %8s │                │\n" "node_modules/.cache" "${BEFORE_MODULE_CACHE}" "${AFTER_MODULE_CACHE}"
printf "│ %-24s │ %8s │ %8s │                │\n" "/tmp dev files" "${BEFORE_TMP_SIZE}" "${AFTER_TMP_SIZE}"
echo "└───────────────────────────────────────────────────────────────────┘"

echo ""
echo "┌──────────────────────────────────────────────────────────────────┐"
echo "│  🔌 PORTS — BEFORE                                              │"
echo "├──────────────────────────────────────────────────────────────────┤"
printf "$BEFORE_PORT_LIST" 2>/dev/null | while read -r line; do echo "│  $line"; done
[ "$BEFORE_PORT_COUNT" -eq 0 ] && echo "│    (none)"
echo "│                                                                  │"
echo "│  🔌 PORTS — AFTER                                               │"
echo "├──────────────────────────────────────────────────────────────────┤"
printf "$AFTER_PORT_LIST" 2>/dev/null | while read -r line; do echo "│  $line"; done
[ "$AFTER_PORT_COUNT" -eq 0 ] && echo "│    (none)"
echo "└──────────────────────────────────────────────────────────────────┘"

echo ""
echo "┌──────────────────────────────────────────────────────────────────┐"
echo "│  ⚙️  DEV PROCESSES — BEFORE ($BEFORE_DEV_COUNT)                  │"
echo "├──────────────────────────────────────────────────────────────────┤"
echo "$BEFORE_DEV_LIST" | head -20 | while read -r line; do printf "│  %.64s\n" "$line"; done
[ "$BEFORE_DEV_COUNT" -gt 20 ] && echo "│    ... and $((BEFORE_DEV_COUNT - 20)) more"
echo "│                                                                  │"
echo "│  ⚙️  DEV PROCESSES — AFTER ($AFTER_DEV_COUNT)                    │"
echo "├──────────────────────────────────────────────────────────────────┤"
echo "$AFTER_DEV_LIST" | head -20 | while read -r line; do printf "│  %.64s\n" "$line"; done
echo "└──────────────────────────────────────────────────────────────────┘"

echo ""
echo "┌──────────────────────────────────────────────────────────────────┐"
echo "│  🔍 ORPHAN NODE — BEFORE                                        │"
echo "├──────────────────────────────────────────────────────────────────┤"
echo "$BEFORE_NODE_LIST" | head -15 | while read -r line; do printf "│  %.64s\n" "$line"; done
echo "│                                                                  │"
echo "│  🔍 ORPHAN NODE — AFTER                                         │"
echo "├──────────────────────────────────────────────────────────────────┤"
echo "$AFTER_NODE_LIST" | head -15 | while read -r line; do printf "│  %.64s\n" "$line"; done
echo "└──────────────────────────────────────────────────────────────────┘"

# Final verdict
echo ""
total_issues=0
[ "$AFTER_DEV_COUNT" -gt 0 ] && total_issues=$((total_issues + AFTER_DEV_COUNT))
[ "$AFTER_PORT_COUNT" -gt 0 ] && total_issues=$((total_issues + AFTER_PORT_COUNT))

if [ "$total_issues" -eq 0 ]; then
  echo "╔══════════════════════════════════════════════════════════════════╗"
  echo "║  ✅ VERDICT: SYSTEM CLEAN                                      ║"
  echo "║                                                                 ║"
  echo "║  All dev processes terminated. All ports released.              ║"
  echo "║  All caches purged. Memory reclaimed.                           ║"
  echo "║  Killed $delta_node node process(es), freed $delta_ports port(s),          ║"
  echo "║  released $delta_fd file descriptor(s).                                ║"
  echo "╚══════════════════════════════════════════════════════════════════╝"
else
  echo "╔══════════════════════════════════════════════════════════════════╗"
  echo "║  ⚠️  VERDICT: $total_issues ISSUE(S) REMAINING                           ║"
  echo "║                                                                 ║"
  echo "║  Some processes survived cleanup. Review the report above       ║"
  echo "║  and consider manual intervention for stubborn processes.       ║"
  echo "╚══════════════════════════════════════════════════════════════════╝"
fi

echo ""

# Cleanup the report file
rm -f "$REPORT_FILE" /tmp/cleanup-report-path.txt 2>/dev/null
```

// turbo
