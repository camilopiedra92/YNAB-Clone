-- YNAB Clone Database Schema

-- Accounts table
CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('checking', 'savings', 'credit', 'cash', 'investment')),
  balance REAL NOT NULL DEFAULT 0,
  cleared_balance REAL NOT NULL DEFAULT 0,
  uncleared_balance REAL NOT NULL DEFAULT 0,
  note TEXT DEFAULT '',
  closed INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Category Groups
CREATE TABLE IF NOT EXISTS category_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  hidden BOOLEAN NOT NULL DEFAULT 0,
  is_income BOOLEAN NOT NULL DEFAULT 0
);

-- Categories
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_group_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  hidden BOOLEAN NOT NULL DEFAULT 0,
  linked_account_id INTEGER DEFAULT NULL,
  FOREIGN KEY (linked_account_id) REFERENCES accounts(id) ON DELETE SET NULL,
  FOREIGN KEY (category_group_id) REFERENCES category_groups(id) ON DELETE CASCADE
);

-- Budget Months
CREATE TABLE IF NOT EXISTS budget_months (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL,
  month TEXT NOT NULL, -- Format: YYYY-MM
  assigned REAL NOT NULL DEFAULT 0,
  activity REAL NOT NULL DEFAULT 0,
  available REAL NOT NULL DEFAULT 0,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
  UNIQUE(category_id, month)
);

-- Transactions
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL,
  date TEXT NOT NULL, -- Format: YYYY-MM-DD
  payee TEXT,
  category_id INTEGER,
  memo TEXT,
  outflow REAL NOT NULL DEFAULT 0,
  inflow REAL NOT NULL DEFAULT 0,
  cleared TEXT NOT NULL DEFAULT 'Uncleared' CHECK(cleared IN ('Cleared', 'Uncleared', 'Reconciled')),
  flag TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

-- Transfers (to link transfer transactions)
CREATE TABLE IF NOT EXISTS transfers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_transaction_id INTEGER NOT NULL,
  to_transaction_id INTEGER NOT NULL,
  FOREIGN KEY (from_transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
  FOREIGN KEY (to_transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_budget_months_category ON budget_months(category_id);
CREATE INDEX IF NOT EXISTS idx_budget_months_month ON budget_months(month);
