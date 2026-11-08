-- Migration: Add ai_reviews, ai_usage with hardened SELECT-only RLS, and atomic consume_ai_quota RPC

-- 1. AI Reviews Table
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

-- 2. AI Usage Rate-Limiting Table
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

-- 3. Atomic Quota Consumption RPC (SECURITY DEFINER with advisory lock)
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
