# Features Overview

The YNAB Clone aims to replicate the core experience of "You Need A Budget". Below is a breakdown of implemented features and how they compare to the original.

## Core Budgeting Features

- **Category Management**: Create, rename, hide, and reorganize categories and category groups.
- **Monthly Budgeting**: Assign funds to categories month-by-month.
- **Ready to Assign (RTA)**: Real-time calculation of available funds with a detailed breakdown popup showing inflows, outflows, and future assignments.
- **Budget Inspector**: A right-side panel providing:
  - Month Summary (Assigned, Activity, Available).
  - Auto-assign options (Underfunded, Average Assigned, etc.).
  - Quick actions to reset assigned or available amounts.
  - "Cost to Be Me" metrics.
- **Move Money Between Categories**: Move available funds between spending categories via the Availability Bubble popup. Validates source balance, prevents self-moves, updates both categories atomically.
- **Drag & Drop**: Reorder categories and groups using a modern DND interface.
- **Budget Date Bounds**: Navigation and date selector restricted to months with actual data, preventing navigation to empty months.

## Account & Transaction Management

- **Account Views**: Dedicated views for individual accounts (Checking, Credit Card, etc.) and an "All Accounts" view.
- **Virtualized Transaction List**: Handles large datasets efficiently using `react-virtual`, allowing smooth scrolling through thousands of transactions.
- **Transaction Entry**: Comprehensive modal for creating and editing transactions, including:
  - Payee selection.
  - Category assignment.
  - Memo field.
  - Cleared/Uncleared status toggling.
  - Flags.
- **Transfers**: Easily move money between accounts by selecting the "Transfer: [Account Name]" payee.
- **Reconciliation**: Multi-step flow to verify account balances against bank statements.

## Multi-Tenant & Collaboration

- **SaaS Multi-Tenancy**: Full multi-budget support with user authentication (NextAuth.js) and budget-scoped data isolation.
- **Budget Sharing**: Invite other users to collaborate on a budget via email. Shared users have full read/write access.
- **Row-Level Security (RLS)**: PostgreSQL RLS policies enforce data isolation at the database level, preventing cross-tenant data leaks even if application-level scoping has bugs.
- **Transaction-per-Request**: All budget-scoped API operations run within a single database transaction for RLS context consistency.

## Internationalization (i18n)

- **Multi-language Support**: Full Spanish (es) and English (en) translations via `next-intl`.
- **Locale Detection**: Automatic locale detection with cookie-based persistence (`NEXT_LOCALE`).
- **Structured Messages**: All user-facing strings stored in `messages/es.json` and `messages/en.json` with nested key structure.
- **CI Guard**: `check-locale-strings.sh` scans for hardcoded strings in E2E tests; `check-i18n-key-parity.sh` validates key parity between locales.

## Advanced Logic

- **Credit Card Handling**: Automatic movement of "funded" money from spending categories to CC Payment categories.
- **Overspending Alerts**: Visual indicators for cash overspending (Red) and credit overspending (Yellow).
- **Inflow Tracking**: Proper handling of "Inflow: Ready to Assign" transactions vs. returns to specific categories.

## Technical Highlights

- **Optimistic Updates**: Immediate UI feedback for assignments and transaction changes, powered by pure engine functions.
- **Sync Status**: Real-time indicator of background database synchronization.
- **Currency Processing**: Robust currency input handling for different locales.
- **Financial Engine**: All financial math in pure, testable functions (`lib/engine/`) — zero DB/HTTP dependencies.
- **Error Tracking**: Sentry integration with budget context tagging.

## Currently Unimplemented / Roadmap

- **Goals/Targets**: Advanced YNAB targets (Needed for specific date, Savings Balance, etc.) are currently approximated in the Inspector but not fully implemented as entities.
- **Reports**: Visual charts for spending patterns and net worth (page exists at `/reports` but charts are not implemented).
- **File Import**: Native QFX/CSV import (currently relies on specialized scripts).
- **Search & Filter**: Advanced transaction searching within account views.
- **Multi-Currency**: Dynamic formatting based on budget currency settings (schema supports it, UI defaults to COP).

See [ROADMAP.md](ROADMAP.md) for the full prioritized backlog.
