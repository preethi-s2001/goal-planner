import { isSupabaseConfigured } from '@/lib/supabase/server';

export const MAX_AI_GENERATIONS_PER_DAY = 5;

// In-memory fallback usage map STRICTLY for demo mode (NODE_ENV === 'development' without Supabase)
const inMemoryUsageMap = new Map<string, number[]>();

export function resetAiUsageForTesting() {
  inMemoryUsageMap.clear();
}

export interface QuotaCheckResult {
  allowed: boolean;
  remaining: number;
  serviceError?: boolean;
}

/**
 * Enforces a daily limit of 5 AI generations per user, shared between review and chat.
 * Atomically consumes quota via the SECURITY DEFINER RPC 'consume_ai_quota'.
 *
 * FAILS CLOSED:
 * If Supabase is configured and the RPC returns an error, returns { allowed: false, remaining: 0, serviceError: true }.
 * The route MUST return HTTP 503 Service Unavailable.
 *
 * In-memory fallback is allowed ONLY when Supabase is not configured and NODE_ENV === 'development'.
 */
export async function checkAndRecordAiUsage(
  supabase: any,
  userId: string,
  endpoint: 'review' | 'chat'
): Promise<QuotaCheckResult> {
  const isConfigured = isSupabaseConfigured();
  const isDemoMode = !isConfigured && (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test');

  if (isConfigured && supabase) {
    try {
      const { data, error } = await supabase.rpc('consume_ai_quota', {
        p_endpoint: endpoint,
        p_daily_limit: MAX_AI_GENERATIONS_PER_DAY,
      });

      if (error) {
        console.error('consume_ai_quota RPC error:', error);
        // Fail closed!
        return { allowed: false, remaining: 0, serviceError: true };
      }

      // RPC RETURNS TABLE(allowed BOOLEAN, remaining INT)
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) {
        console.error('consume_ai_quota returned empty result');
        return { allowed: false, remaining: 0, serviceError: true };
      }

      return {
        allowed: Boolean(row.allowed),
        remaining: typeof row.remaining === 'number' ? row.remaining : 0,
        serviceError: false,
      };
    } catch (err) {
      console.error('Exception calling consume_ai_quota RPC:', err);
      // Fail closed!
      return { allowed: false, remaining: 0, serviceError: true };
    }
  }

  // Demo mode fallback only in development/test with no Supabase
  if (isDemoMode) {
    const now = Date.now();
    const cutoff = now - 24 * 60 * 60 * 1000;
    const existing = (inMemoryUsageMap.get(userId) ?? []).filter((ts) => ts > cutoff);

    if (existing.length >= MAX_AI_GENERATIONS_PER_DAY) {
      inMemoryUsageMap.set(userId, existing);
      return { allowed: false, remaining: 0 };
    }

    existing.push(now);
    inMemoryUsageMap.set(userId, existing);

    return { allowed: true, remaining: MAX_AI_GENERATIONS_PER_DAY - existing.length };
  }

  // Any other scenario fails closed
  return { allowed: false, remaining: 0, serviceError: true };
}
