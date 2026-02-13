# YNAB Clone

[![CI](https://github.com/camilopiedra92/YNAB-Clone/actions/workflows/ci.yml/badge.svg)](https://github.com/camilopiedra92/YNAB-Clone/actions/workflows/ci.yml)

A powerful personal finance management application inspired by [YNAB (You Need A Budget)](https://www.youneedabudget.com/). Built with Next.js, PostgreSQL (via Drizzle ORM), and TanStack Query, this application implements the core principles of zero-based budgeting.

![YNAB Clone Preview](public/preview.png) _(Note: Add a real preview image to the public folder)_

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Visit `http://localhost:3000` to start budgeting.

## 📚 Documentation

Detailed documentation is available in the [`/docs`](./docs) directory:

- **[Architecture](./docs/architecture.md)**: Technical stack, patterns like Optimistic Mutations, and system design.
- **[Business Rules](./docs/business-rules.md)**: Deep dive into RTA calculations, Credit Card funding logic, and overspending behavior.
- **[Data Model](./docs/data-model.md)**: Database schema details and Entity Relationship diagrams.
- **[Features Audit](./docs/features.md)**: Overview of implemented features and comparison with original YNAB.
- **[Developer Guide](./docs/developer-guide.md)**: Setup instructions, database management, and common workflows.
- **[Deployment Guide](./docs/DEPLOYMENT.md)**: Production setup on Hetzner + Coolify, including database migration strategies.

## ✨ Core Pillars

### 1. Zero-Based Budgeting

Every dollar gets a job. The "Ready to Assign" (RTA) engine ensures you only budget money you actually have.

### 2. Credit Card Mastery

Credit card transactions automatically move money from spending categories to your payment category, ensuring you're always ready to pay the bill.

### 3. Snappy Performance

Optimistic UI updates mean you never wait for a spinner when assigning money or adding transactions. Virtualized lists keep the experience fluid even with years of history.

## 🛠 Tech Stack

- **Frontend**: Next.js 16, Tailwind CSS 4, TanStack Virtual
- **Backend**: Next.js App Router (API Layer)
- **Database**: PostgreSQL (Drizzle ORM)
- **State Management**: TanStack Query (React Query)

## 🤝 Contributing

This project enforces a strict architectural and commit protocol.

👉 **READ [CONTRIBUTING.md](./CONTRIBUTING.md) BEFORE WRITING ANY CODE.**

For setup and development details, please refer to the [Developer Guide](./docs/developer-guide.md).

---

_Disclaimer: This is an independent clone and is not affiliated with, endorsed by, or sponsored by You Need A Budget, LLC._
