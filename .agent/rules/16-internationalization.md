---
description: Mandatory internationalization (i18n) rules — all user-facing text must be translated, never hardcoded.
---

# Internationalization (i18n) — Mandatory Rules

**Every user-facing string MUST be internationalized.** This rule is **MANDATORY** for ALL code — components, pages, modals, toasts, error messages, and E2E tests.

## 1. Stack

| Layer        | Tool           | Location                               |
| :----------- | :------------- | :------------------------------------- |
| **Messages** | JSON files     | `messages/es.json`, `messages/en.json` |
| **React**    | `next-intl`    | `useTranslations(namespace)`           |
| **E2E**      | `i18n-helpers` | `tests/i18n-helpers.ts` → `t(key)`     |
| **Locale**   | Cookie         | `NEXT_LOCALE` (es / en)                |

## 2. Component Rules (Strict)

### ✅ CORRECT — Use `useTranslations`

```typescript
const t = useTranslations('accounts');
return <label>{t('nameLabel')}</label>;
```

### ❌ FORBIDDEN — Hardcoded strings

```typescript
// NEVER do this
return <label>Account Name</label>;
return <label>Nombre de la Cuenta</label>;
return <button>Save</button>;
```

### When Adding New UI Text

1. Add the key to **BOTH** `messages/es.json` AND `messages/en.json` under the correct namespace.
2. Use `useTranslations(namespace)` in the component.
3. Run `npm run check:i18n-keys` to verify key parity.

### Namespace Convention

Keys are organized by feature namespace. Use the existing namespace if one exists:

| Namespace      | Scope                                 |
| :------------- | :------------------------------------ |
| `common`       | Shared labels (loading, save, cancel) |
| `auth`         | Login, register, password             |
| `sidebar`      | Navigation, account groups            |
| `accounts`     | Account CRUD modal                    |
| `transactions` | Transaction entry, transfers          |
| `budget`       | Budget table, RTA, inspector          |
| `budgetList`   | Budget selector, create/edit budget   |
| `share`        | Budget sharing modal                  |
| `profile`      | Profile settings modal                |

If no namespace fits, create a new one — add it to both locale files.

## 3. E2E Test Rules (Strict)

### ✅ CORRECT — Use `t()` helper

```typescript
import { t, TEST_LOCALE } from "./i18n-helpers";

await page.getByLabel(t("auth.email")).fill("user@test.com");
await page.getByRole("button", { name: t("auth.login") }).click();
```

### ❌ FORBIDDEN — Hardcoded strings in tests

```typescript
// NEVER do this
await page.getByLabel("Email").fill("...");
await page.getByLabel("Contraseña").fill("...");
await page.getByRole("button", { name: /Iniciar Sesión/i }).click();
```

### Locale Cookie for Unauthenticated Flows

Tests that manage their own auth (e.g., `storageState: { cookies: [], origins: [] }`) **MUST** pin the locale cookie:

```typescript
test.beforeEach(async ({ page }) => {
  await page.context().addCookies([
    {
      name: "NEXT_LOCALE",
      value: TEST_LOCALE,
      domain: "localhost",
      path: "/",
    },
  ]);
});
```

## 4. CI Guards (Mandatory)

Two scripts enforce i18n compliance. Both run in CI and can be run locally:

| Script                     | npm command                    | What it checks                                             |
| :------------------------- | :----------------------------- | :--------------------------------------------------------- |
| `check-locale-strings.sh`  | `npm run check:locale-strings` | Scans `tests/*.spec.ts` for hardcoded UI strings (es + en) |
| `check-i18n-key-parity.sh` | `npm run check:i18n-keys`      | Validates `es.json` and `en.json` have identical key paths |

### When to Run

- **After adding new i18n keys:** `npm run check:i18n-keys`
- **After writing E2E tests:** `npm run check:locale-strings`
- **Before committing:** Both run automatically via the test workflow

## 5. What This Means in Practice

When modifying ANY frontend code:

- ✅ Use `useTranslations(namespace)` for all user-facing text
- ✅ Add keys to BOTH locale files simultaneously
- ✅ Use `t('namespace.key')` in E2E tests
- ✅ Use `data-testid` for elements that don't have translatable labels
- ✅ Run CI guard scripts after adding keys or writing tests
- ❌ Hardcode any user-facing string in components, pages, or modals
- ❌ Hardcode any UI string in E2E test selectors
- ❌ Add a key to only one locale file
- ❌ Use `aria-label="some text"` without translation — use `aria-label={t('key')}`
- ❌ Skip CI guard scripts when adding new i18n content

## 6. Exceptions

The following do NOT require translation:

- **`data-testid` values** — these are internal identifiers, not user-facing
- **CSS class names** and technical attributes
- **Log messages** (`console.log`, server-side logging)
- **API error codes** returned as JSON (e.g., `{ error: 'UNAUTHORIZED' }`)
- **Database column names** and SQL
- **Environment variable names**
