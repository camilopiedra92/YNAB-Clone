# Bad Commit Message Anti-Patterns

Each example shows what's wrong and how to fix it.

## ❌ No type prefix

```
add login feature
```

**Problem:** Missing `type(scope):` prefix — not Conventional Commits format.
**Fix:** `feat(auth): add login feature`

---

## ❌ Past tense

```
fix(rta): fixed ghost entry bug
```

**Problem:** "fixed" is past tense. Use imperative mood ("fix", not "fixed").
**Fix:** `fix(rta): exclude ghost entries from latest month query`

---

## ❌ Present participle (-ing)

```
feat(engine): adding milliunit branded type
```

**Problem:** "adding" is gerund/progressive. Use bare imperative.
**Fix:** `feat(engine): add milliunit branded type`

---

## ❌ Capitalized description

```
fix(api): Fix the budget endpoint
```

**Problem:** Description starts with uppercase "Fix". Convention is lowercase.
**Fix:** `fix(api): fix the budget endpoint`

---

## ❌ Trailing period

```
docs: update readme with setup instructions.
```

**Problem:** Description ends with a period. Omit it.
**Fix:** `docs: update readme with setup instructions`

---

## ❌ Too long (>72 chars)

```
feat(transactions): implement the complete transaction import flow with CSV parsing and validation and error handling
```

**Problem:** Header is 113 chars (max 72). Move details to the body.
**Fix:**

```
feat(transactions): implement CSV transaction import flow

Add CSV parsing, column mapping, validation, and error handling
for the transaction import feature.
```

---

## ❌ Vague description

```
fix: update stuff
```

**Problem:** "update stuff" is not descriptive. Be specific about what changed.
**Fix:** `fix(budget): correct available calculation for CC refunds`

---

## ❌ Wrong type

```
feat(db): add index on transactions table
```

**Problem:** Adding an index is a performance improvement, not a feature.
**Fix:** `perf(db): add index on transactions(account_id, date)`

---

## ❌ Missing scope when obvious

```
fix: correct carryforward for CC payment categories
```

**Problem:** The change is clearly in the engine/carryforward domain. Add a scope.
**Fix:** `fix(engine): correct carryforward for CC payment categories`

---

## ❌ Multiple unrelated changes in one commit

```
feat: add transaction import and fix RTA bug and update tests
```

**Problem:** Three unrelated changes bundled. Split into separate commits.
**Fix:**

```
git commit -m "feat(transactions): add CSV import flow"
git commit -m "fix(rta): correct ghost entry latest month selection"
git commit -m "test(engine): add carryforward edge case tests"
```

---

## ❌ Missing BREAKING CHANGE footer

```
feat(api): rename budget endpoints from v1 to v2
```

**Problem:** Renaming endpoints is a breaking change. Must include footer.
**Fix:**

```
feat(api)!: rename budget endpoints from v1 to v2

BREAKING CHANGE: All /api/v1/budgets/* endpoints moved to /api/v2/budgets/*.
Clients must update their base URL.
```

---

## ❌ No blank line before body

```
fix(rta): correct cash balance query
The query was including future-dated transactions which inflated RTA.
```

**Problem:** Missing blank line between header and body.
**Fix:**

```
fix(rta): correct cash balance query

The query was including future-dated transactions which inflated RTA.
```
