-- Diagnostic SQL: Find ghost entries in budget_months
-- Ghost entries (assigned=0, activity=0, available=0) corrupt RTA
-- by making MAX(month) pick a sparse future month.

-- 1. Check budget_months entry counts per month
SELECT month, COUNT(*) as entries
FROM budget_months
GROUP BY month
ORDER BY month;

-- 2. Find ghost entries
SELECT bm.id, bm.month, c.name as category, bm.assigned, bm.activity, bm.available
FROM budget_months bm
JOIN categories c ON bm.category_id = c.id
WHERE bm.assigned = 0 AND bm.activity = 0 AND bm.available = 0
ORDER BY bm.month DESC;

-- 3. Find overspent categories (credit vs cash overspending)
-- Replace YYYY-MM with the target month
SELECT
  bm.category_id,
  c.name,
  bm.available,
  cg.name as group_name,
  CASE
    WHEN c.name LIKE '%Payment%' THEN 'CC_PAYMENT (skip)'
    ELSE 'REGULAR'
  END as type
FROM budget_months bm
JOIN categories c ON bm.category_id = c.id
JOIN category_groups cg ON c.category_group_id = cg.id
WHERE bm.month = '2026-02'  -- ← change this
  AND bm.available < 0
  AND cg.is_income = 0
ORDER BY bm.available ASC;

-- 4. Check available propagation for a specific category
-- Replace ? with the category_id
SELECT month, assigned, activity, available
FROM budget_months
WHERE category_id = 1  -- ← change this
ORDER BY month;

-- 5. Check future month assignments
SELECT month, SUM(assigned) as total_assigned
FROM budget_months bm
JOIN categories c ON bm.category_id = c.id
JOIN category_groups cg ON c.category_group_id = cg.id
WHERE cg.is_income = 0
  AND month > '2026-02'  -- ← change to latest complete month
GROUP BY month
ORDER BY month;
