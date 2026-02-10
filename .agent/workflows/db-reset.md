---
description: Wipe and reimport the database without running tests or restarting the dev server
---

# DB Reset (Lightweight)

Quick database wipe and reimport. Use this for fast iterations when you just need fresh data.
For the full suite (tests + restart), use `/factory-reset` instead.

// turbo-all

## 1. Stop the dev server (if running)

```bash
lsof -ti :3000 | xargs kill 2>/dev/null || true
```

## 2. Run migrations

```bash
npm run db:migrate
```

## 3. Import YNAB data

```bash
npm run db:import
```

Expected output: accounts created, transactions imported, transfers linked, budget entries imported, "Data import completed successfully!"

## 4. Restart the dev server (optional)

If you want to immediately use the app:

```bash
npm run dev
```
