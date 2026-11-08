import { RecurringItem, Transaction } from '@/types';

export interface GenerateRecurringCandidate {
  user_id: string;
  recurring_item_id: string;
  recurring_month: string; // 'YYYY-MM'
  date: string; // 'YYYY-MM-DD'
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  source: 'recurring';
}

/**
 * Builds candidate recurring transactions for a given month ('YYYY-MM').
 * Identified strictly by (recurring_item_id, recurring_month), NOT by description or amount.
 *
 * Guarantees:
 * 1. Changing an item's amount mid-month will NOT create a duplicate transaction.
 * 2. Two items with identical descriptions/amounts will BOTH generate (distinct recurring_item_id).
 * 3. Calling multiple times generates 0 duplicates.
 */
export function buildRecurringCandidates(
  recurringItems: RecurringItem[],
  existingMonthlyTransactions: Array<{
    recurring_item_id?: string | null;
    recurring_month?: string | null;
  }>,
  month: string,
  userId: string = 'demo-user'
): GenerateRecurringCandidate[] {
  const [yearStr, monthStr] = month.split('-');
  const year = parseInt(yearStr, 10);
  const monthNum = parseInt(monthStr, 10);
  const lastDayOfMonth = new Date(year, monthNum, 0).getDate();

  // Set of recurring item IDs already generated for this specific month
  const generatedItemIds = new Set<string>();

  for (const tx of existingMonthlyTransactions) {
    if (tx.recurring_item_id && tx.recurring_month === month) {
      generatedItemIds.add(tx.recurring_item_id);
    }
  }

  const candidates: GenerateRecurringCandidate[] = [];

  for (const item of recurringItems) {
    // Only active recurring items are eligible
    if (!item.active) continue;

    // Idempotency: skip if already generated for this month
    if (generatedItemIds.has(item.id)) continue;

    const clampedDay = Math.min(item.day_of_month, lastDayOfMonth);
    const txDate = `${month}-${String(clampedDay).padStart(2, '0')}`;

    candidates.push({
      user_id: userId,
      recurring_item_id: item.id,
      recurring_month: month,
      date: txDate,
      description: item.description,
      amount: item.amount,
      type: item.type,
      category: item.category,
      source: 'recurring',
    });

    // Mark as queued within this batch
    generatedItemIds.add(item.id);
  }

  return candidates;
}
