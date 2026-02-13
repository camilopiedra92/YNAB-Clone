---
description: Start the app — verify environment, dependencies, database, and launch the Next.js dev server
---

# Start: Launch the YNAB App

Follow these steps to ensure a stable environment and launch the development server. These steps incorporate fixes for common errors like `EPERM` permission issues and database connectivity.

## 1. Verify Environment (.env)

Ensure the `.env` file exists. If not, copy it from the example.

```bash
[ -f .env ] || cp .env.example .env && echo ".env file created from .env.example"
```

// turbo

## 2. Ensure dependencies are installed

```bash
./scripts/with-local-tmp.sh npm install
```

// turbo

## 3. Clear Port Conflicts

Ensure port 3000 is available.

```bash
lsof -ti :3000 | xargs kill 2>/dev/null; echo "Port 3000 cleared"
```

// turbo

## 4. Run Pre-flight Health Check (Database & Connectivity)

Running the project health check ensures the database is accessible and the environment is valid.
Note: All scripts use `./scripts/with-local-tmp.sh` to avoid `EPERM` errors on this system.

```bash
npm run health:check
```

// turbo

## 5. Start the Next.js dev server

The `npm run dev` command automatically handles migrations and uses the `.tmp` directory for stability.

```bash
npm run dev
```

Run this command with `WaitMsBeforeAsync: 8000` so it starts running in the background and you can capture initial output (including migrations).

## 6. Verify the server is up

Use the `command_status` tool on the previous command's ID with `WaitDurationSeconds: 15` to wait for compilation. Look for "Ready" or "✓ Ready" in the output.

## 7. Open the app in the browser

Open `http://localhost:3000` in the browser to confirm it loads correctly.

---

### Stability Notes (Learned from Errors)

- **Permission Issues (`EPERM`)**: All `package.json` scripts use `./scripts/with-local-tmp.sh` to redirect temp files to a project-local `.tmp/` directory.
- **Database Readiness**: The app requires a running PostgreSQL instance. Ensure it is accessible before starting.
- **Migrations**: `npm run dev` automatically runs `npm run db:migrate`. If you see migration errors, check your `DATABASE_URL` in `.env`.
