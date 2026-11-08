-- ==============================================================================
-- Goal Planner - Supabase Database Schema & Row Level Security (RLS) Policies
-- ==============================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  currency TEXT NOT NULL DEFAULT 'INR',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Custom Categories Table (User-added custom categories beyond default)
CREATE TABLE IF NOT EXISTS public.custom_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'expense' CHECK (type IN ('income', 'expense')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT custom_categories_user_name_key UNIQUE (user_id, name)
);

-- 4. Recurring Items Table (Defined before transactions for foreign key reference)
CREATE TABLE IF NOT EXISTS public.recurring_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  category TEXT NOT NULL,
  day_of_month INTEGER NOT NULL CHECK (day_of_month BETWEEN 1 AND 31),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Transactions Table
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  category TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('csv', 'manual', 'recurring')),
  import_batch_id UUID NULL,
  recurring_item_id UUID NULL REFERENCES public.recurring_items(id) ON DELETE SET NULL,
  recurring_month VARCHAR(7) NULL, -- 'YYYY-MM'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Category Rules (User-learned categorization keywords)
CREATE TABLE IF NOT EXISTS public.category_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  category TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT category_rules_user_keyword_key UNIQUE (user_id, keyword)
);

-- 7. Budgets Table (Per-category monthly limits)
CREATE TABLE IF NOT EXISTS public.budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  monthly_limit NUMERIC(12,2) NOT NULL CHECK (monthly_limit >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT budgets_user_category_key UNIQUE (user_id, category)
);

-- 8. Goals Table
CREATE TABLE IF NOT EXISTS public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_amount NUMERIC(12,2) NOT NULL CHECK (target_amount > 0),
  saved_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (saved_amount >= 0),
  target_months INTEGER NOT NULL CHECK (target_months > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Monthly Settings Table (Opening balances per month)
CREATE TABLE IF NOT EXISTS public.monthly_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month VARCHAR(7) NOT NULL, -- Format: YYYY-MM
  opening_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT monthly_settings_user_month_key UNIQUE (user_id, month)
);

-- ==============================================================================
-- Indexes for Performance & Idempotency
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON public.transactions (user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_category ON public.transactions (user_id, category);
CREATE INDEX IF NOT EXISTS idx_transactions_batch_id ON public.transactions (user_id, import_batch_id);

-- Enforce strict recurring idempotency: 1 recurring item generates at most 1 transaction per month
-- Non-partial index allows ON CONFLICT (recurring_item_id, recurring_month). In Postgres, NULLs are distinct.
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_recurring_unique
  ON public.transactions (recurring_item_id, recurring_month);

CREATE INDEX IF NOT EXISTS idx_category_rules_user ON public.category_rules (user_id);
CREATE INDEX IF NOT EXISTS idx_budgets_user ON public.budgets (user_id);
CREATE INDEX IF NOT EXISTS idx_goals_user ON public.goals (user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_user ON public.recurring_items (user_id, active);
CREATE INDEX IF NOT EXISTS idx_monthly_settings_user_month ON public.monthly_settings (user_id, month);

-- ==============================================================================
-- Row Level Security (RLS) - Absolute User Isolation
-- ==============================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_settings ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can delete own profile" ON public.profiles;
CREATE POLICY "Users can delete own profile" ON public.profiles
  FOR DELETE USING (auth.uid() = id);

-- Custom Categories Policies
DROP POLICY IF EXISTS "Users manage own custom categories" ON public.custom_categories;
CREATE POLICY "Users manage own custom categories" ON public.custom_categories
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Recurring Items Policies
DROP POLICY IF EXISTS "Users manage own recurring items" ON public.recurring_items;
CREATE POLICY "Users manage own recurring items" ON public.recurring_items
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Transactions Policies
DROP POLICY IF EXISTS "Users manage own transactions" ON public.transactions;
CREATE POLICY "Users manage own transactions" ON public.transactions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Category Rules Policies
DROP POLICY IF EXISTS "Users manage own category rules" ON public.category_rules;
CREATE POLICY "Users manage own category rules" ON public.category_rules
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Budgets Policies
DROP POLICY IF EXISTS "Users manage own budgets" ON public.budgets;
CREATE POLICY "Users manage own budgets" ON public.budgets
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Goals Policies
DROP POLICY IF EXISTS "Users manage own goals" ON public.goals;
CREATE POLICY "Users manage own goals" ON public.goals
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Monthly Settings Policies
DROP POLICY IF EXISTS "Users manage own monthly settings" ON public.monthly_settings;
CREATE POLICY "Users manage own monthly settings" ON public.monthly_settings
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 10. AI Reviews Table
CREATE TABLE IF NOT EXISTS public.ai_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month VARCHAR(7) NOT NULL, -- 'YYYY-MM'
  review TEXT NOT NULL,
  source TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ai_reviews_user_month_key UNIQUE (user_id, month)
);

ALTER TABLE public.ai_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own AI reviews" ON public.ai_reviews;
DROP POLICY IF EXISTS "Users manage own AI reviews" ON public.ai_reviews;
CREATE POLICY "Users manage own AI reviews"
  ON public.ai_reviews
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_ai_reviews_user_month ON public.ai_reviews (user_id, month);

-- 11. AI Usage Rate-Limiting Table
CREATE TABLE IF NOT EXISTS public.ai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL, -- 'review' or 'chat'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

-- Hardened RLS: Authenticated users can ONLY SELECT their own usage rows.
-- Users cannot directly insert, update or delete usage rows to bypass daily quota.
DROP POLICY IF EXISTS "Users can manage their own AI usage" ON public.ai_usage;
DROP POLICY IF EXISTS "Users manage own AI usage" ON public.ai_usage;
DROP POLICY IF EXISTS "Users can read own AI usage" ON public.ai_usage;
CREATE POLICY "Users can read own AI usage"
  ON public.ai_usage
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_ai_usage_user_time ON public.ai_usage (user_id, created_at DESC);

-- 12. Atomic Quota Consumption RPC (SECURITY DEFINER with advisory lock)
CREATE OR REPLACE FUNCTION public.consume_ai_quota(
  p_endpoint TEXT,
  p_daily_limit INT DEFAULT 5
)
RETURNS TABLE(allowed BOOLEAN, remaining INT) AS $$
DECLARE
  v_user_id UUID;
  v_count INT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 0;
    RETURN;
  END IF;

  -- Acquire an advisory transaction lock per user to serialize concurrent requests
  PERFORM pg_advisory_xact_lock(hashtext(v_user_id::text));

  -- Count usage rows in the rolling 24-hour window
  SELECT COUNT(*)
  INTO v_count
  FROM public.ai_usage
  WHERE user_id = v_user_id
    AND created_at >= (NOW() - INTERVAL '24 hours');

  IF v_count >= p_daily_limit THEN
    RETURN QUERY SELECT FALSE, 0;
  ELSE
    INSERT INTO public.ai_usage (user_id, endpoint, created_at)
    VALUES (v_user_id, p_endpoint, NOW());

    RETURN QUERY SELECT TRUE, GREATEST(0, p_daily_limit - (v_count + 1));
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ==============================================================================
-- Trigger to Automatically Create Profile upon Signup
-- Search path pinned to public to prevent search-path hijacking attacks
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, currency)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    'INR'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
