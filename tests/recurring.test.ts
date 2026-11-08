import { describe, it, expect } from 'vitest';
import { buildRecurringCandidates } from '@/lib/finance/recurring';
import { RecurringItem } from '@/types';

describe('Phase 2 - Recurring Items Idempotency & Edge Cases', () => {
  const recurringItem1: RecurringItem = {
    id: 'rec-uuid-1',
    user_id: 'user-1',
    description: 'Monthly Salary',
    amount: 35000,
    type: 'income',
    category: 'Income',
    day_of_month: 1,
    active: true,
    created_at: new Date().toISOString(),
  };

  const recurringItem2: RecurringItem = {
    id: 'rec-uuid-2',
    user_id: 'user-1',
    description: 'Apartment Rent',
    amount: 8000,
    type: 'expense',
    category: 'Rent',
    day_of_month: 5,
    active: true,
    created_at: new Date().toISOString(),
  };

  it('generates candidates when none exist for the month', () => {
    const candidates = buildRecurringCandidates([recurringItem1, recurringItem2], [], '2026-11');
    expect(candidates.length).toBe(2);
    expect(candidates[0].recurring_item_id).toBe('rec-uuid-1');
    expect(candidates[0].recurring_month).toBe('2026-11');
    expect(candidates[1].recurring_item_id).toBe('rec-uuid-2');
  });

  it('Issue 1: Changing a recurring items amount mid-month must NOT create a second transaction', () => {
    // Suppose recurringItem1 was already generated on day 1 for 35,000
    const existing = [
      {
        recurring_item_id: 'rec-uuid-1',
        recurring_month: '2026-11',
      },
    ];

    // Mid-month, the user changes the recurring salary amount from 35,000 to 40,000
    const modifiedItem: RecurringItem = {
      ...recurringItem1,
      amount: 40000,
    };

    const candidates = buildRecurringCandidates([modifiedItem], existing, '2026-11');
    // Must NOT create a second transaction because (rec-uuid-1, 2026-11) is already generated!
    expect(candidates.length).toBe(0);
  });

  it('Issue 1: Two identical items (same description & amount) must BOTH generate', () => {
    // Two separate subscriptions or recurring allowances with the same name and amount
    const allowance1: RecurringItem = {
      id: 'rec-allowance-1',
      user_id: 'user-1',
      description: 'Family Support Allowance',
      amount: 5000,
      type: 'expense',
      category: 'Others',
      day_of_month: 10,
      active: true,
      created_at: new Date().toISOString(),
    };

    const allowance2: RecurringItem = {
      id: 'rec-allowance-2',
      user_id: 'user-1',
      description: 'Family Support Allowance',
      amount: 5000,
      type: 'expense',
      category: 'Others',
      day_of_month: 10,
      active: true,
      created_at: new Date().toISOString(),
    };

    const candidates = buildRecurringCandidates([allowance1, allowance2], [], '2026-11');
    // Both items must be generated because their recurring_item_id is distinct
    expect(candidates.length).toBe(2);
    expect(candidates[0].recurring_item_id).toBe('rec-allowance-1');
    expect(candidates[1].recurring_item_id).toBe('rec-allowance-2');
  });

  it('Issue 1: Double call / parallel calls do not duplicate candidates', () => {
    // First call generates candidates
    const firstCall = buildRecurringCandidates([recurringItem1, recurringItem2], [], '2026-11');
    expect(firstCall.length).toBe(2);

    // Second call simulates existing transactions already recorded in database
    const existingRecorded = firstCall.map((c) => ({
      recurring_item_id: c.recurring_item_id,
      recurring_month: c.recurring_month,
    }));

    const secondCall = buildRecurringCandidates([recurringItem1, recurringItem2], existingRecorded, '2026-11');
    // Exactly 0 new candidates
    expect(secondCall.length).toBe(0);
  });

  it('Issue 1: Deleted-then-reprocessed generates the missing item', () => {
    // Suppose item 1 is generated and kept, but item 2 was deleted from transactions
    const existing = [
      {
        recurring_item_id: 'rec-uuid-1',
        recurring_month: '2026-11',
      },
    ];

    const candidates = buildRecurringCandidates([recurringItem1, recurringItem2], existing, '2026-11');
    // Only item 2 is generated; item 1 is not duplicated
    expect(candidates.length).toBe(1);
    expect(candidates[0].recurring_item_id).toBe('rec-uuid-2');
  });

  it('clamps day of month if recurring day exceeds days in month (e.g. Feb 31 -> Feb 28)', () => {
    const endOfMonthItem: RecurringItem = {
      id: 'rec-end',
      user_id: 'user-1',
      description: 'Month End Bill',
      amount: 2000,
      type: 'expense',
      category: 'Bills',
      day_of_month: 31,
      active: true,
      created_at: new Date().toISOString(),
    };

    const candidates = buildRecurringCandidates([endOfMonthItem], [], '2026-02');
    expect(candidates.length).toBe(1);
    expect(candidates[0].date).toBe('2026-02-28');
  });
});
