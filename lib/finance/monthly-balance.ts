import { SupabaseClient } from '@supabase/supabase-js';
import { Transaction } from '@/types';
import { parseDateParts } from './prediction';

export function getPreviousMonth(monthStr: string): string {
  const [year, month] = monthStr.split('-').map(Number);
  if (month === 1) {
    return `${year - 1}-12`;
  }
  return `${year}-${String(month - 1).padStart(2, '0')}`;
}

/**
 * Opening balance default:
 * When no monthly_settings row exists for the month, default to the cumulative net
 * (income minus expenses) of all transactions from the user's first data month up
 * to the previous month, plus the earliest saved opening balance if there is one.
 * Flags needsConfirmation = true.
 */
export async function resolveOpeningBalance(params: {
  supabase: SupabaseClient;
  userId: string;
  selectedMonth: string;
  allTransactions: Transaction[];
}): Promise<{ openingBalance: number; needsConfirmation: boolean }> {
  const { supabase, userId, selectedMonth, allTransactions } = params;

  // 1. Check current month settings
  let currentSettings: { opening_balance: number } | null = null;
  try {
    const { data } = await supabase
      .from('monthly_settings')
      .select('opening_balance')
      .eq('user_id', userId)
      .eq('month', selectedMonth)
      .maybeSingle();
    currentSettings = data;
  } catch (err) {
    // Graceful fallback for mock/demo clients
  }

  if (currentSettings) {
    return {
      openingBalance: Number(currentSettings.opening_balance),
      needsConfirmation: false,
    };
  }

  // 2. Query earliest saved opening balance if there is one
  let earliestOpening = 0;
  try {
    const { data: earliestSettings } = await supabase
      .from('monthly_settings')
      .select('opening_balance, month')
      .eq('user_id', userId)
      .order('month', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (
      earliestSettings &&
      earliestSettings.opening_balance !== undefined &&
      earliestSettings.opening_balance !== null
    ) {
      earliestOpening = Number(earliestSettings.opening_balance);
    }
  } catch (err) {
    // Graceful fallback
  }

  // 3. Calculate cumulative net (income minus expenses) of all transactions
  // from the user's first data month up to the previous month (months < selectedMonth)
  let cumulativeIncome = 0;
  let cumulativeExpenses = 0;

  for (const t of allTransactions) {
    if (!t.date || t.date.length < 7) continue;
    const { monthStr } = parseDateParts(t.date);
    if (monthStr < selectedMonth) {
      const amt = Number(t.amount);
      if (t.type === 'income') {
        cumulativeIncome += amt;
      } else if (t.type === 'expense') {
        cumulativeExpenses += amt;
      }
    }
  }

  const cumulativeNet = cumulativeIncome - cumulativeExpenses;
  const defaultOpening = Math.round((earliestOpening + cumulativeNet) * 100) / 100;

  return {
    openingBalance: defaultOpening,
    needsConfirmation: true,
  };
}
