---
description: Wipe the database, reimport YNAB data, run tests, and restart the dev server
---

# Factory Reset

Wipes the database, reimports all YNAB export data, runs the test suite, and restarts the dev server. Use this to get a clean, verified instance from scratch.

> [!IMPORTANT]
> **Infrastructure Note:** This project uses `./scripts/with-local-tmp.sh` to redirect all temporary files to a local `.tmp/` directory, bypassing macOS permission issues (`EPERM`). Scripts also use `--env-file=.env` for environment loading.

## Prerequisites

- **YNAB export CSV files:** Paths are configured via `YNAB_REGISTER_CSV` and `YNAB_PLAN_CSV` in `.env`.
- The import script must exist at `scripts/import-ynab-data.ts`

## Steps

// turbo-all

1. **Stop the running dev server** (if any):

```bash
lsof -ti :3000 | xargs kill 2>/dev/null || true
```

2. **Run migrations** to ensure the schema is up to date:

```bash
npm run db:migrate
```

3. **Run the YNAB data import script** (this wipes and populates the database):

```bash
npm run db:import
```

Expected output should show:

- Accounts created (e.g., Ahorros, Mastercard Black)
- Transactions imported (approx. 5,600+)
- Transfers linked
- Budget entries imported (approx. 2,700+)
- "Data import completed successfully!"

4. **Run tests** to verify data integrity:

```bash
npm run test
```

5. **Restart the dev server** with the freshly imported data:

```bash
npm run dev
```

6. **Verify the import** by opening `http://localhost:3000/budget` and confirming balances match your YNAB export.

## Troubleshooting

- **EPERM: operation not permitted (mkdir):**
  - This occurs on macOS when `tsx` or `vitest` try to write to system `/var/folders`.
  - **Fix:** All `npm` scripts use `./scripts/with-local-tmp.sh` which creates `.tmp/` and sets `TMPDIR` automatically.
- **ZodError: DATABASE_URL is undefined:**
  - Occurs if environment variables are not loaded during script execution.
  - **Fix:** Use `node --env-file=.env` when running scripts directly or through `npm run`.
- **Database Connection Failed:**
  - Ensure PostgreSQL is running (`brew services start postgresql`).
  - Check `.env` for correct `DATABASE_URL`.
- **CSV files not found:**
  - Verify `YNAB_REGISTER_CSV` and `YNAB_PLAN_CSV` in `.env` point to your export files.
- **Port 3000 stuck:**
  - Try `lsof -ti :3000 | xargs kill` to stop lingering processes.
