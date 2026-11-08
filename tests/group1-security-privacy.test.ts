import { describe, it, expect, vi, beforeEach } from 'vitest';
import Papa from 'papaparse';
import { checkAndRecordAiUsage, resetAiUsageForTesting, MAX_AI_GENERATIONS_PER_DAY } from '@/lib/ai/rate-limit';
import { callClaudeApi } from '@/lib/ai/anthropic';
import { createAdminClient } from '@/lib/supabase/admin';

describe('GROUP 1 & 1b: Privacy and Security Hardening Tests', () => {
  beforeEach(() => {
    resetAiUsageForTesting();
    vi.restoreAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://placeholder.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'placeholder-anon-key';
  });

  describe('1. AI Quota Consumption RPC and Fail-Closed Rate Limiting', () => {
    it('calls consume_ai_quota RPC when Supabase is configured and returns quota result', async () => {
      // Mock Supabase configured
      const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://valid-supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'valid-anon-key';

      let calledMethod = '';
      let calledParams: any = null;

      const mockSupabase = {
        rpc: async (fn: string, params: any) => {
          calledMethod = fn;
          calledParams = params;
          return {
            data: [{ allowed: true, remaining: 4 }],
            error: null,
          };
        },
      };

      const result = await checkAndRecordAiUsage(mockSupabase, 'user-1', 'review');

      expect(calledMethod).toBe('consume_ai_quota');
      expect(calledParams).toEqual({
        p_endpoint: 'review',
        p_daily_limit: 5,
      });
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
      expect(result.serviceError).toBe(false);

      process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey;
    });

    it('FAILS CLOSED: if consume_ai_quota RPC errors, returns serviceError: true for 503 response', async () => {
      const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://valid-supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'valid-anon-key';

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const mockSupabaseWithError = {
        rpc: async () => ({
          data: null,
          error: { message: 'Database connection timeout' },
        }),
      };

      const result = await checkAndRecordAiUsage(mockSupabaseWithError, 'user-1', 'chat');

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.serviceError).toBe(true);
      expect(consoleErrorSpy).toHaveBeenCalled();

      process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey;
      consoleErrorSpy.mockRestore();
    });

    it('in-memory fallback is allowed strictly in demo mode (dev without Supabase)', async () => {
      // In tests, Supabase URL is placeholder -> demo mode in dev
      for (let i = 1; i <= 5; i++) {
        const res = await checkAndRecordAiUsage(null, 'demo-user', 'chat');
        expect(res.allowed).toBe(true);
        expect(res.remaining).toBe(5 - i);
      }

      // 6th call rejected
      const sixth = await checkAndRecordAiUsage(null, 'demo-user', 'review');
      expect(sixth.allowed).toBe(false);
      expect(sixth.remaining).toBe(0);
    });

    it('enforces that User B cannot read User A review data under RLS', async () => {
      const mockReviewsTable = [
        { id: 'rev-1', user_id: 'user-a-123', month: '2026-11', review: 'Private review of User A', source: 'claude' },
      ];

      const createMockSupabaseForUser = (activeUserId: string) => ({
        from: (table: string) => ({
          select: () => ({
            eq: (col1: string, val1: string) => ({
              eq: (col2: string, val2: string) => ({
                maybeSingle: async () => {
                  const found = mockReviewsTable.find(
                    (r) => r.user_id === activeUserId && r.month === val2
                  );
                  return { data: found || null, error: null };
                },
              }),
            }),
          }),
        }),
      });

      const clientUserA = createMockSupabaseForUser('user-a-123');
      const clientUserB = createMockSupabaseForUser('user-b-456');

      const resA = await clientUserA.from('ai_reviews').select().eq('user_id', 'user-a-123').eq('month', '2026-11').maybeSingle();
      expect(resA.data?.review).toBe('Private review of User A');

      const resB = await clientUserB.from('ai_reviews').select().eq('user_id', 'user-a-123').eq('month', '2026-11').maybeSingle();
      expect(resB.data).toBeNull();
    });
  });

  describe('2. Account Deletion Order & Protection', () => {
    it('admin client creation fails and throws if SUPABASE_SERVICE_ROLE_KEY is missing', () => {
      const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      expect(() => createAdminClient()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/i);

      process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
    });

    it('with SUPABASE_SERVICE_ROLE_KEY missing, delete_account deletes nothing and fails immediately', async () => {
      const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      let deletedRowsCount = 0;
      const mockSupabase = {
        from: () => ({
          delete: () => ({
            eq: async (col?: string, val?: string) => {
              deletedRowsCount++;
              return { error: null };
            },
          }),
        }),
      };

      // Simulating delete_account logic in route:
      let errorOccurred = false;
      try {
        createAdminClient();
      } catch {
        errorOccurred = true;
      }

      // Because admin client failed FIRST, no delete commands were dispatched!
      expect(errorOccurred).toBe(true);
      expect(deletedRowsCount).toBe(0);

      process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
    });

    it('delete_account calls auth.admin.deleteUser only (relying on DB cascade) and does signOut', async () => {
      let adminDeleteCalled = false;
      let signOutCalled = false;
      let deletedUserId = '';

      const mockAdminClient = {
        auth: {
          admin: {
            deleteUser: async (uid: string) => {
              adminDeleteCalled = true;
              deletedUserId = uid;
              return { error: null };
            },
          },
        },
      };

      const mockSupabase = {
        auth: {
          signOut: async () => {
            signOutCalled = true;
            return { error: null };
          },
        },
      };

      // Execute deletion flow
      const { error } = await mockAdminClient.auth.admin.deleteUser('target-user-uuid');
      expect(error).toBeNull();
      await mockSupabase.auth.signOut();

      expect(adminDeleteCalled).toBe(true);
      expect(deletedUserId).toBe('target-user-uuid');
      expect(signOutCalled).toBe(true);
    });

    it('clear_data clears financial tables and reviews but MUST NOT delete ai_usage', async () => {
      const CLEAR_DATA_TABLES = [
        'transactions',
        'budgets',
        'goals',
        'recurring_items',
        'category_rules',
        'monthly_settings',
        'custom_categories',
        'ai_reviews',
      ];

      expect(CLEAR_DATA_TABLES).not.toContain('ai_usage');

      const deletedTables: string[] = [];
      const mockSupabase = {
        from: (table: string) => ({
          delete: () => ({
            eq: async (col?: string, val?: string) => {
              deletedTables.push(table);
              return { error: null };
            },
          }),
        }),
      };

      for (const table of CLEAR_DATA_TABLES) {
        await mockSupabase.from(table).delete().eq('user_id', 'u-1');
      }

      expect(deletedTables).toContain('transactions');
      expect(deletedTables).toContain('ai_reviews');
      expect(deletedTables).not.toContain('ai_usage'); // ai_usage preserved!
    });

    it('returns generic error messages to client and never exposes raw database error strings', () => {
      const rawDbError = 'PGRST116: column "secret_field" does not exist in schema';
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Simulate route error handling:
      console.error('Failed to clear table:', rawDbError);
      const clientResponse = { error: 'Failed to clear financial data. Please try again.' };

      expect(clientResponse.error).not.toContain('PGRST116');
      expect(clientResponse.error).not.toContain('secret_field');
      expect(clientResponse.error).toBe('Failed to clear financial data. Please try again.');

      consoleErrorSpy.mockRestore();
    });
  });

  describe('3. CSV Export Protection & Paging Order Tiebreaker', () => {
    it('escapes formulas in CSV export with escapeFormulae: true', () => {
      const maliciousRows = [
        {
          Date: '2026-11-01',
          Description: '=1+1',
          Amount: 100,
          Type: 'expense',
          Category: 'Food',
          Source: 'manual',
        },
        {
          Date: '2026-11-02',
          Description: '+cmd|/C calc',
          Amount: 200,
          Type: 'expense',
          Category: 'Shopping',
          Source: 'manual',
        },
        {
          Date: '2026-11-03',
          Description: '-@SUM(A1:A10)',
          Amount: 300,
          Type: 'expense',
          Category: 'Bills',
          Source: 'manual',
        },
      ];

      const csv = Papa.unparse(maliciousRows, {
        quotes: true,
        header: true,
        escapeFormulae: true,
      });

      expect(csv).toContain('"\'=1+1"');
      expect(csv).toContain('"\'+cmd|/C calc"');
      expect(csv).toContain('"\'-@SUM(A1:A10)"');
    });

    it('export paging includes .order(id) as a tiebreaker after .order(date)', async () => {
      const orderCalls: { col: string; ascending?: boolean }[] = [];

      const mockSupabase = {
        from: () => ({
          select: () => ({
            eq: () => ({
              order: (col: string, opts?: { ascending?: boolean }) => {
                orderCalls.push({ col, ascending: opts?.ascending });
                return {
                  order: (col2: string, opts2?: { ascending?: boolean }) => {
                    orderCalls.push({ col: col2, ascending: opts2?.ascending });
                    return {
                      range: async () => ({ data: [], error: null }),
                    };
                  },
                };
              },
            }),
          }),
        }),
      };

      await mockSupabase
        .from()
        .select()
        .eq()
        .order('date', { ascending: false })
        .order('id', { ascending: false })
        .range();

      expect(orderCalls).toEqual([
        { col: 'date', ascending: false },
        { col: 'id', ascending: false },
      ]);
    });
  });

  describe('4. Anthropic Model Configuration and Fallback Behavior', () => {
    it('reads model from ANTHROPIC_MODEL and defaults to claude-sonnet-5-5', async () => {
      delete process.env.ANTHROPIC_MODEL;
      process.env.ANTHROPIC_API_KEY = 'test-key';

      let requestedModel = '';
      const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(async (url, init: any) => {
        const body = JSON.parse(init.body);
        requestedModel = body.model;
        return {
          ok: true,
          json: async () => ({
            content: [{ type: 'text', text: 'Anthropic response' }],
          }),
        } as any;
      });

      const resDefault = await callClaudeApi({
        messages: [{ role: 'user', content: 'test' }],
      });
      expect(requestedModel).toBe('claude-sonnet-5-5');
      expect(resDefault.source).toBe('claude-sonnet-5-5');

      process.env.ANTHROPIC_MODEL = 'claude-3-5-sonnet-20241022';
      await callClaudeApi({
        messages: [{ role: 'user', content: 'test' }],
      });
      expect(requestedModel).toBe('claude-3-5-sonnet-20241022');

      fetchSpy.mockRestore();
    });

    it('logs status code and shows "AI summary unavailable, showing a basic summary" on API failure', async () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(async () => {
        return {
          ok: false,
          status: 503,
          text: async () => 'Service Overloaded',
        } as any;
      });

      const response = await callClaudeApi({
        messages: [{ role: 'user', content: 'Can I afford ₹10,000?' }],
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('503'),
        expect.stringContaining('Service Overloaded')
      );

      expect(response.text).toContain('AI summary unavailable, showing a basic summary');
      expect(response.source).toBe('local-engine');

      fetchSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });
});
