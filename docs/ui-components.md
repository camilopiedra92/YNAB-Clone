# UI Design System & UX Standards

This budget application is built with a focus on "Visual Clarity" and "Fluid Performance." This document details the aesthetic foundations and component architecture of the frontend.

## 🎨 Visual Identity (Aesthetic Foundation)

The UI follows a **modern minimal/premium** aesthetic, prioritizing data readability and a "calm" financial experience.

### Typography
- **Primary Font**: `Inter` (Sans-serif). Configured with variable weights to differentiate between category names (Medium) and numerical data (Regular/Monospace where appropriate).
- **Scale**: Uses standard Tailwind increments, with `text-sm` being the baseline for tabular data to maximize information density without clutter.

### Color Palette (Semantics)
| Type | Color | Logic |
| :--- | :--- | :--- |
| **Success** | `Emerald-600` | Positive balances, cleared transactions, funded RTA. |
| **Neutral** | `Slate-300/400` | Zero balances, labels, inactive states. |
| **Credit Warning** | `Amber-500` | Credit overspending (Unfunded debt). |
| **Urgent Warning** | `Red-500` | Cash overspending, negative RTA. |
| **Background** | `White` / `Slate-50` | Clean workspace with subtle elevation. |

## 🏗 Component Architecture

### 1. The Virtualized Ledger (`VirtualTransactionTable`)
The most complex UI component. It solves the performance bottleneck of 1,000+ line items.
- **Library**: `@tanstack/react-virtual`.
- **Logic**: Each row is fixed-height, and the table "recycles" DOM nodes as you scroll.
- **UX Features**: Sticky headers for account names and dates during scroll.

### 2. Intelligent Inputs
- **`CurrencyInput`**: A specialized component that handles real-time locale-aware formatting (e.g., $1.234.567,00) while piping raw numbers to the API.
- **`DatePicker`**: Streamlined for rapid transaction entry.
- **`BudgetItemRow`**: Implements inline editing for the `assigned` field with keyboard focus management and automatic save on `Enter` or `Blur`.

### 3. Structural Layout
- **Navigation Sidebar**: Fixed-width Sidebar with clear categorization of "Budget" and "Accounts". Includes real-time balance aggregations.
- **Inspector Panel**: A contextual side-panel that updates based on the current month's selection, providing deep-dive metrics without leaving the main view.

## ✨ Micro-Animations & Feedback

- **Optimistic State Transitions**: When clicking the "Cleared" circle icon on a transaction, the UI flips state immediately with a subtle color transition before the server confirms.
- **Sonner Toasts**: Non-blocking notifications for errors or destructive actions (e.g., deleting a transaction).
- **Glassmorphism**: Subtle use of backdrop filters in popovers and modals to maintain context of the page behind the interaction.

## 📱 Responsiveness
- **Desktop First**: Primarily designed for high-density financial work.
- **Tablet/Mobile Adjustments**: Layout shifts from a three-column (Sidebar, Main, Inspector) to a stacked view on smaller viewports.
