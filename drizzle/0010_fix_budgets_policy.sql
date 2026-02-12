-- Fix RLS policy for budgets table
-- Previous policy (0006) was too restrictive for dashboard listing (where app.budget_id is null).
-- New policy allows access if:
-- 1. You are the owner (user_id matches)
-- 2. You are a member (in budget_shares)
-- 3. You are in the budget context (app.budget_id matches) - fail safe

DROP POLICY IF EXISTS budgets_user_isolation ON budgets;

CREATE POLICY budgets_access_policy ON budgets
  USING (
    -- 1. Owner
    user_id::text = NULLIF(current_setting('app.user_id', true), '')
    
    OR
    
    -- 2. Member (via shares)
    -- RLS on budget_shares is already active, so this subquery is safe and filtered
    id IN (
      SELECT budget_id 
      FROM budget_shares 
      WHERE user_id::text = NULLIF(current_setting('app.user_id', true), '')
    )
    
    OR
    
    -- 3. Active Context (Fail Safe)
    id = NULLIF(current_setting('app.budget_id', true), '')::int
  );
