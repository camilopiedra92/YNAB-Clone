# Audit Log

Permanent health record for the codebase. Each audit is versioned and never overwritten.

| Date       | Run | Score  | P0  | P1  | P2  | P3  | Total | Summary                                                                                                                                                            |
| ---------- | --- | ------ | --- | --- | --- | --- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-02-10 | 2   | 8.7/10 | 0   | 0   | 3   | 3   | 6     | All 13 prior findings resolved. 6 new: extract reconciliation modal, add share DTO, `requireBudgetAccess` consistency, npm cache perms, 2 eslint-disable comments. |
| 2026-02-10 | 1   | 8.2/10 | 0   | 3   | 6   | 4   | 13    | First audit. Split `budget/page.tsx`, add `clock.ts` tests, fix `.env.example`, clean all `eslint-disable`, override esbuild vuln. All 13 resolved same day.       |
