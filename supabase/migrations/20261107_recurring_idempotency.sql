-- ==============================================================================
-- Migration: Add recurring_item_id & recurring_month with non-partial unique index
-- ==============================================================================

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS recurring_item_id UUID NULL REFERENCES public.recurring_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recurring_month VARCHAR(7) NULL;

-- Drop previous partial index if it exists
DROP INDEX IF EXISTS public.idx_transactions_recurring_unique;

-- Non-partial unique index to strictly enforce that one recurring item can only generate
-- at most one transaction per month (YYYY-MM).
-- Allows ON CONFLICT (recurring_item_id, recurring_month) in upsert operations.
-- In Postgres, NULLs are distinct, so manual transactions (recurring_item_id IS NULL) are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_recurring_unique
  ON public.transactions (recurring_item_id, recurring_month);
