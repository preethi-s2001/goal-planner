import { describe, it, expect, vi } from 'vitest';
import { SupabaseClient } from '@supabase/supabase-js';
import { calculateMonthEndPrediction } from '@/lib/finance/prediction';
import { calculateSpendingAnalysis } from '@/lib/finance/analysis';
import { calculateBudgetStatus } from '@/lib/finance/budgets';
import { calculateAverageMonthlySurplus, GoalFeasibilityResult } from '@/lib/finance/goals';
import { calculateSimulatorBaseline } from '@/lib/finance/simulator';
import { getCompleteHistoryMonths } from '@/lib/finance/complete-months';
import { resolveOpeningBalance, getPreviousMonth } from '@/lib/finance/monthly-balance';
import { fetchAllUserTransactions } from '@/lib/finance/transactions';
import { buildFinancialContext } from '@/lib/ai/prompts';
import { Transaction } from '@/types';

const createTx = (
  date: string,
  description: string,
  amount: number,
  type: 'income' | 'expense',
  category: string,
  id?: string
): Transaction => ({
  id: id || `tx-${Math.random()}`,
  user_id: 'user-g3',
  date,
  description,
  amount,
  type,
  category,
  source: 'manual',
  created_at: new Date().toISOString(),
});

describe('GROUP 3 - Forecast Correctness (Items 10 - 18)', () => {
  // =========================================================================
  // ITEM 10: Client local date for "today" (IST 01:00 on 1 Nov must be Nov)
  // =========================================================================
  describe('Item 10: Client local clock for today', () => {
    it('resolves month to November when client sends 01:00 IST on 1 Nov (even if UTC is 31 Oct)', () => {
      // 01:00 IST on 1 Nov 2026 corresponds to 2026-10-31T19:30:00Z in UTC.
      // The client explicitly supplies today = '2026-11-01'.
      const clientToday = '2026-11-01';
      const transactions: Transaction[] = [
        createTx('2026-09-01', 'Sep Salary', 35000, 'income', 'Income'),
        createTx('2026-09-05', 'Sep Rent', 8000, 'expense', 'Rent'),
        createTx('2026-10-01', 'Oct Salary', 35000, 'income', 'Income'),
        createTx('2026-10-05', 'Oct Rent', 8000, 'expense', 'Rent'),
        createTx('2026-11-01', 'Nov Salary', 35000, 'income', 'Income'),
      ];

      const res = calculateMonthEndPrediction({
        transactions,
        currentMonth: '2026-11',
        today: clientToday,
      });

      // currentDay derived from clientToday (1 Nov) -> currentDay = 1, days_left = 29
      expect(res.current_day).toBe(1);
      expect(res.days_left).toBe(29);
      expect(res.status).toBe('predicted');
      expect(res.income_so_far).toBe(35000);
    });
  });

  // =========================================================================
  // ITEM 11: Only transactions dated <= today count; future items scheduled;
  // regression test: seed 42, 15 Oct, opening 10000 -> current 28752, predicted 21766
  // =========================================================================
  describe('Item 11: Current-month transactions dated <= today only', () => {
    it('Regression test: seed 42 sample dataset, 15 Oct, opening 10000 -> current 28752, predicted 21766', () => {
      const historyTransactions: Transaction[] = [
        // Aug 2026 (31 days)
        createTx('2026-08-01', 'Aug Salary', 35000, 'income', 'Income'),
        createTx('2026-08-05', 'Aug Rent', 8000, 'expense', 'Rent'),
        createTx('2026-08-10', 'Aug Bills', 2000, 'expense', 'Bills'),
        createTx('2026-08-15', 'Aug Variable', 13317, 'expense', 'Food'),

        // Sep 2026 (30 days)
        createTx('2026-09-01', 'Sep Salary', 35000, 'income', 'Income'),
        createTx('2026-09-05', 'Sep Rent', 8000, 'expense', 'Rent'),
        createTx('2026-09-10', 'Sep Bills', 2000, 'expense', 'Bills'),
        createTx('2026-09-15', 'Sep Variable', 13317, 'expense', 'Food'),
      ];

      // Current month: Oct 2026 (31 days)
      const currentTransactions: Transaction[] = [
        // Dated <= 15 Oct (received / paid so far)
        createTx('2026-10-01', 'Salary Credit', 35000, 'income', 'Income'),
        createTx('2026-10-05', 'Rent Payment', 8000, 'expense', 'Rent'),
        createTx('2026-10-10', 'Electricity Bill', 2000, 'expense', 'Bills'),
        createTx('2026-10-12', 'Grocery & Meals', 6248, 'expense', 'Food'),

        // Future-dated in current month (> 15 Oct) - must be treated as scheduled and NOT counted in current balance
        createTx('2026-10-20', 'Scheduled Shopping', 4000, 'expense', 'Shopping'),
        createTx('2026-10-28', 'Scheduled Bonus', 10000, 'income', 'Income'),
      ];

      const res = calculateMonthEndPrediction({
        transactions: [...historyTransactions, ...currentTransactions],
        currentMonth: '2026-10',
        today: '2026-10-15',
        openingBalance: 10000,
      });

      // Opening (10000) + Income <= 15th (35000) - Spent <= 15th (8000+2000+6248 = 16248) = 28752
      expect(res.current_balance).toBe(28752);
      expect(res.income_so_far).toBe(35000);
      expect(res.spent_so_far).toBe(16248);

      // Predicted balance matches expected regression figure: 21766
      expect(Math.round(res.predicted_month_end_balance)).toBe(21766);
    });

    it('treats salary dated the 28th while today is the 7th as scheduled (not received)', () => {
      const historyTransactions: Transaction[] = [
        createTx('2026-08-01', 'Aug Salary', 35000, 'income', 'Income'),
        createTx('2026-08-05', 'Aug Rent', 8000, 'expense', 'Rent'),
        createTx('2026-09-01', 'Sep Salary', 35000, 'income', 'Income'),
        createTx('2026-09-05', 'Sep Rent', 8000, 'expense', 'Rent'),
      ];

      const currentTransactions: Transaction[] = [
        createTx('2026-10-03', 'Swiggy Dinner', 450, 'expense', 'Food'),
        createTx('2026-10-28', 'Monthly Salary', 35000, 'income', 'Income'), // Future-dated
      ];

      const res = calculateMonthEndPrediction({
        transactions: [...historyTransactions, ...currentTransactions],
        currentMonth: '2026-10',
        today: '2026-10-07',
        openingBalance: 5000,
      });

      // Salary on 28th is NOT received yet on the 7th
      expect(res.income_so_far).toBe(0);
      expect(res.spent_so_far).toBe(450);
      expect(res.current_balance).toBe(5000 - 450); // 4550

      // Since income so far is 0, expected_income projects historical salary
      expect(res.expected_income).toBe(35000);
    });
  });

  // =========================================================================
  // ITEM 12: Past month -> days_left = 0, actual closing balance; Future month -> insufficient data
  // =========================================================================
  describe('Item 12: Past and future months handling', () => {
    it('returns actual closing balance and days_left = 0 for a past month', () => {
      const transactions: Transaction[] = [
        createTx('2026-08-01', 'Salary', 35000, 'income', 'Income'),
        createTx('2026-08-05', 'Rent', 8000, 'expense', 'Rent'),
        createTx('2026-08-20', 'Food', 5000, 'expense', 'Food'),
      ];

      const res = calculateMonthEndPrediction({
        transactions,
        currentMonth: '2026-08',
        today: '2026-10-15', // Current month is October, August is in the past
        openingBalance: 2000,
      });

      expect(res.status).toBe('predicted');
      expect(res.days_left).toBe(0);
      expect(res.expected_variable).toBe(0);
      expect(res.expected_income).toBe(0);
      expect(res.unpaid_fixed).toBe(0);
      // Closing balance = 2000 + 35000 - 13000 = 24000
      expect(res.predicted_month_end_balance).toBe(24000);
      expect(res.current_balance).toBe(24000);
    });

    it('returns insufficient_data for a future month that has not started yet', () => {
      const res = calculateMonthEndPrediction({
        transactions: [createTx('2026-10-01', 'Salary', 35000, 'income', 'Income')],
        currentMonth: '2026-12',
        today: '2026-10-15',
        openingBalance: 10000,
      });

      expect(res.status).toBe('insufficient_data');
      expect(res.message).toMatch(/not started yet/i);
    });
  });

  // =========================================================================
  // ITEM 13: Complete history month rule: month < currentMonth AND
  // (not user's first data month OR first transaction on or before 7th).
  // Show "N complete months used" in explanation.
  // =========================================================================
  describe('Item 13: Complete history month rule across finance modules', () => {
    it('disqualifies first data month if first transaction is after the 7th', () => {
      const txs = [
        createTx('2026-08-15', 'First Tx Late in Month', 5000, 'expense', 'Food'),
        createTx('2026-09-01', 'Salary', 35000, 'income', 'Income'),
        createTx('2026-09-05', 'Rent', 8000, 'expense', 'Rent'),
      ];

      const { completeMonths, count } = getCompleteHistoryMonths(txs, '2026-10');
      // Aug was the first month but started on 15th (> 7th), so Aug is NOT complete.
      // Sep is the second month, so Sep IS complete.
      expect(completeMonths).toEqual(['2026-09']);
      expect(count).toBe(1);
    });

    it('qualifies first data month if first transaction is on or before the 7th', () => {
      const txs = [
        createTx('2026-08-05', 'First Tx Early in Month', 5000, 'expense', 'Food'),
        createTx('2026-09-01', 'Salary', 35000, 'income', 'Income'),
      ];

      const { completeMonths, count } = getCompleteHistoryMonths(txs, '2026-10');
      // Aug started on 5th (<= 7th), so Aug IS complete. Sep is also complete.
      expect(completeMonths).toEqual(['2026-08', '2026-09']);
      expect(count).toBe(2);
    });

    it('shows "N complete months used" in prediction explanation', () => {
      const txs = [
        createTx('2026-08-01', 'Salary', 35000, 'income', 'Income'),
        createTx('2026-08-05', 'Rent', 8000, 'expense', 'Rent'),
        createTx('2026-09-01', 'Salary', 35000, 'income', 'Income'),
        createTx('2026-09-05', 'Rent', 8000, 'expense', 'Rent'),
        createTx('2026-10-01', 'Salary', 35000, 'income', 'Income'),
      ];

      const res = calculateMonthEndPrediction({
        transactions: txs,
        currentMonth: '2026-10',
        today: '2026-10-15',
        openingBalance: 5000,
      });

      const historyStep = res.explanation.steps.find((s) => s.label === 'History Used');
      expect(historyStep).toBeDefined();
      expect(historyStep?.value).toBe('2 complete months used');
    });

    it('applies the complete month rule consistently in goals surplus and simulator', () => {
      // Incomplete history (first month starts on 12th)
      const txsIncomplete = [
        createTx('2026-09-12', 'Late Start', 1000, 'expense', 'Food'),
        createTx('2026-10-01', 'Current Month Salary', 35000, 'income', 'Income'),
      ];

      // Goals surplus returns null when no complete months exist
      const surplus = calculateAverageMonthlySurplus(txsIncomplete, '2026-10');
      expect(surplus).toBeNull();

      // Simulator baseline handles incomplete history safely
      const sim = calculateSimulatorBaseline(txsIncomplete, '2026-10');
      expect(sim.completeMonthsCount).toBe(0);
      expect(sim.completeMonths).toEqual([]);
    });
  });

  // =========================================================================
  // ITEM 14: Default opening balance to cumulative net of all transactions
  // up to previous month plus earliest saved opening balance + banner
  // =========================================================================
  describe('Item 14: Opening balance fallback to cumulative net from previous months', () => {
    it('returns cumulative net from first data month up to previous month plus earliest saved opening balance', async () => {
      // User transactions across multiple past months
      const allTransactions = [
        // August 2026 (Month 1): Income 35,000, Expense 20,000 -> Net +15,000
        createTx('2026-08-01', 'Aug Salary', 35000, 'income', 'Income'),
        createTx('2026-08-05', 'Aug Rent', 20000, 'expense', 'Rent'),

        // September 2026 (Month 2): Income 40,000, Expense 25,000 -> Net +15,000
        createTx('2026-09-01', 'Sep Salary', 40000, 'income', 'Income'),
        createTx('2026-09-05', 'Sep Rent', 25000, 'expense', 'Rent'),

        // October 2026 (Current Selected Month): transactions here must NOT count toward opening balance
        createTx('2026-10-01', 'Oct Salary', 40000, 'income', 'Income'),
        createTx('2026-10-05', 'Oct Rent', 20000, 'expense', 'Rent'),
      ];

      // Earliest saved opening balance in August is 10,000
      // Mock Supabase: no row for 2026-10, earliest row for 2026-08 with opening_balance 10,000
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn((col1: string, val1: any) => ({
              eq: vi.fn((col2: string, monthVal: string) => ({
                maybeSingle: vi.fn().mockImplementation(async () => {
                  if (monthVal === '2026-10') return { data: null, error: null };
                  return { data: null, error: null };
                }),
              })),
              order: vi.fn(() => ({
                limit: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { opening_balance: 10000, month: '2026-08' },
                    error: null,
                  }),
                })),
              })),
            })),
          })),
        })) as any,
      };

      const result = await resolveOpeningBalance({
        supabase: mockSupabase as unknown as SupabaseClient,
        userId: 'user-1',
        selectedMonth: '2026-10',
        allTransactions,
      });

      // Earliest opening (10000) + Aug Net (15000) + Sep Net (15000) = 40000
      expect(result.openingBalance).toBe(40000);
      expect(result.needsConfirmation).toBe(true);
    });

    it('defaults to cumulative net when user has no saved monthly_settings rows at all', async () => {
      const allTransactions = [
        createTx('2026-08-01', 'Aug Salary', 25000, 'income', 'Income'),
        createTx('2026-08-10', 'Aug Expenses', 15000, 'expense', 'Food'), // +10000
        createTx('2026-09-01', 'Sep Salary', 25000, 'income', 'Income'),
        createTx('2026-09-10', 'Sep Expenses', 20000, 'expense', 'Food'), // +5000
      ];

      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              })),
              order: vi.fn(() => ({
                limit: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                })),
              })),
            })),
          })),
        })) as any,
      };

      const result = await resolveOpeningBalance({
        supabase: mockSupabase as unknown as SupabaseClient,
        userId: 'user-1',
        selectedMonth: '2026-10',
        allTransactions,
      });

      // No saved opening balance (0) + 10000 (Aug) + 5000 (Sep) = 15000
      expect(result.openingBalance).toBe(15000);
      expect(result.needsConfirmation).toBe(true);
    });

    it('returns existing setting without confirmation flag when user has confirmed it', async () => {
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: { opening_balance: 18500 }, error: null }),
              })),
            })),
          })),
        })) as any,
      };

      const result = await resolveOpeningBalance({
        supabase: mockSupabase as unknown as SupabaseClient,
        userId: 'user-1',
        selectedMonth: '2026-10',
        allTransactions: [],
      });

      expect(result.openingBalance).toBe(18500);
      expect(result.needsConfirmation).toBe(false);
    });
  });

  // =========================================================================
  // ITEM 15: Financial health: show "Not enough history" with fewer than 2 complete months
  // =========================================================================
  describe('Item 15: Financial health requires at least 2 complete months', () => {
    it('shows "Not enough history" when history has fewer than 2 complete months', () => {
      const oneMonthTxs = [
        createTx('2026-09-01', 'Salary', 35000, 'income', 'Income'),
        createTx('2026-09-05', 'Rent', 8000, 'expense', 'Rent'),
        createTx('2026-10-01', 'Salary', 35000, 'income', 'Income'),
      ];

      const analysis = calculateSpendingAnalysis({
        transactions: oneMonthTxs,
        selectedMonth: '2026-10',
      });

      expect(analysis.financialHealth.status).toBe('Not enough history');
      expect(analysis.financialHealth.description).toMatch(/At least 2 complete months/i);
    });

    it('evaluates health status when >= 2 complete months exist', () => {
      const twoMonthsTxs = [
        createTx('2026-08-01', 'Salary', 35000, 'income', 'Income'),
        createTx('2026-08-05', 'Rent', 8000, 'expense', 'Rent'),
        createTx('2026-09-01', 'Salary', 35000, 'income', 'Income'),
        createTx('2026-09-05', 'Rent', 8000, 'expense', 'Rent'),
        createTx('2026-10-01', 'Salary', 35000, 'income', 'Income'),
        createTx('2026-10-05', 'Rent', 8000, 'expense', 'Rent'),
      ];

      const analysis = calculateSpendingAnalysis({
        transactions: twoMonthsTxs,
        selectedMonth: '2026-10',
      });

      expect(analysis.financialHealth.status).not.toBe('Not enough history');
      expect(analysis.financialHealth.status).toBe('Healthy');
    });
  });

  // =========================================================================
  // ITEM 16: Budget pace warnings: only after day 5 and when spent >= 10% of limit
  // =========================================================================
  describe('Item 16: Budget pace warnings guardrails', () => {
    it('suppresses pace warning on or before day 5 even if pace is high', () => {
      // Day 4, limit 10000, spent 2000 (20% of limit, daily pace = 500 * 30 = 15000 > 10000)
      const res = calculateBudgetStatus({
        category: 'Food',
        spent: 2000,
        limit: 10000,
        currentDay: 4,
        daysInMonth: 30,
      });

      expect(res.level).toBe('normal');
      expect(res.alertMessage).toBeNull();
    });

    it('suppresses pace warning when spent is less than 10% of the limit', () => {
      // Day 6, limit 10000, spent 800 (8% of limit < 10%)
      const res = calculateBudgetStatus({
        category: 'Shopping',
        spent: 800,
        limit: 10000,
        currentDay: 6,
        daysInMonth: 30,
      });

      expect(res.level).toBe('normal');
      expect(res.alertMessage).toBeNull();
    });

    it('triggers pace warning after day 5 when spent >= 10% of limit and projected pace > limit', () => {
      // Day 8, limit 10000, spent 3500 (35% of limit, pace = (3500/8)*30 = 13125 > 10000)
      const res = calculateBudgetStatus({
        category: 'Food',
        spent: 3500,
        limit: 10000,
        currentDay: 8,
        daysInMonth: 30,
      });

      expect(res.level).toBe('pace_warning');
      expect(res.alertMessage).toMatch(/at this pace you will spend about/i);
    });

    it('never triggers pace warnings for fixed categories (Rent, Bills)', () => {
      const res = calculateBudgetStatus({
        category: 'Rent',
        spent: 8000,
        limit: 10000,
        currentDay: 6,
        daysInMonth: 30,
      });

      expect(res.level).not.toBe('pace_warning');
    });
  });

  // =========================================================================
  // ITEM 17: Paged transaction fetching across routes and export
  // =========================================================================
  describe('Item 17: Paged transaction fetching in 1,000-row batches', () => {
    it('pages through all transactions so 1000-row limit cannot truncate', async () => {
      const mockPage1 = Array.from({ length: 1000 }, (_, i) => ({
        id: `tx-p1-${i}`,
        user_id: 'user-paged',
        date: '2026-10-15',
        description: `Tx ${i}`,
        amount: 100,
        type: 'expense' as const,
        category: 'Food',
        source: 'manual',
        import_batch_id: null,
        created_at: new Date().toISOString(),
      }));

      const mockPage2 = Array.from({ length: 350 }, (_, i) => ({
        id: `tx-p2-${i}`,
        user_id: 'user-paged',
        date: '2026-10-10',
        description: `Tx page 2 ${i}`,
        amount: 200,
        type: 'expense' as const,
        category: 'Shopping',
        source: 'manual',
        import_batch_id: null,
        created_at: new Date().toISOString(),
      }));

      const rangeCalls: { from: number; to: number }[] = [];

      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                order: vi.fn(() => ({
                  range: vi.fn().mockImplementation((from: number, to: number) => {
                    rangeCalls.push({ from, to });
                    if (from === 0) return Promise.resolve({ data: mockPage1, error: null });
                    if (from === 1000) return Promise.resolve({ data: mockPage2, error: null });
                    return Promise.resolve({ data: [], error: null });
                  }),
                })),
              })),
            })),
          })),
        })) as any,
      };

      const rows = await fetchAllUserTransactions(mockSupabase as unknown as SupabaseClient, 'user-paged');

      expect(rows).toHaveLength(1350);
      expect(rangeCalls).toEqual([
        { from: 0, to: 999 },
        { from: 1000, to: 1999 },
      ]);
    });
  });

  // =========================================================================
  // ITEM 18: In AI context, replace goal names with generic labels (Goal 1, Goal 2)
  // =========================================================================
  describe('Item 18: Mask real goal names in AI context', () => {
    it('replaces actual goal names with Goal 1, Goal 2 generic labels', () => {
      const mockGoals: GoalFeasibilityResult[] = [
        {
          id: 'g-1',
          name: 'Buy iPhone 17 Pro Max',
          target_amount: 140000,
          saved_amount: 40000,
          remaining: 100000,
          target_months: 12,
          monthly_needed: 8333,
          verdict: 'Comfortable',
          months_at_full_surplus: 10,
          share_of_surplus: 55.5,
          isAchieved: false,
          progressPercentage: 28.5,
        },
        {
          id: 'g-2',
          name: 'Go to Ladakh Bike Trip',
          target_amount: 60000,
          saved_amount: 10000,
          remaining: 50000,
          target_months: 6,
          monthly_needed: 8333,
          verdict: 'Comfortable',
          months_at_full_surplus: 5,
          share_of_surplus: 55.5,
          isAchieved: false,
          progressPercentage: 16.6,
        },
      ];

      const context = buildFinancialContext({
        selectedMonth: '2026-10',
        goals: mockGoals,
      });

      expect(context.goals[0].name).toBe('Goal 1');
      expect(context.goals[1].name).toBe('Goal 2');

      const stringified = JSON.stringify(context);
      expect(stringified).not.toContain('Buy iPhone 17 Pro Max');
      expect(stringified).not.toContain('Go to Ladakh Bike Trip');
    });
  });
});
