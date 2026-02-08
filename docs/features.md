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
- **Drag & Drop**: Reorder categories and groups using a modern DND interface.

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

## Advanced Logic

- **Credit Card Handling**: Automatic movement of "funded" money from spending categories to CC Payment categories.
- **Overspending Alerts**: Visual indicators for cash overspending (Red) and credit overspending (Yellow).
- **Inflow Tracking**: Proper handling of "Inflow: Ready to Assign" transactions vs. returns to specific categories.

## Technical Highlights

- **Optimistic Updates**: Immediate UI feedback for assignments and transaction changes.
- **Sync Status**: Real-time indicator of background database synchronization.
- **Currency Processing**: Robust currency input handling for different locales.

## Currently Unimplemented / Roadmap

- **Goals/Targets**: Advanced YNAB targets (Needed for specific date, Savings Balance, etc.) are currently approximated in the Inspector but not fully implemented as entities.
- **Reports**: Visual charts for spending patterns and net worth.
- **File Import**: Native QFX/CSV import (currently relies on specialized scripts).
- **Search & Filter**: Advanced transaction searching within account views.
