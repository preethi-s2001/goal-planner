import { NextRequest, NextResponse } from 'next/server';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { calculateMonthEndPrediction } from '@/lib/finance/prediction';
import { calculateSpendingAnalysis } from '@/lib/finance/analysis';
import { fetchAllUserTransactions } from '@/lib/finance/transactions';
import { resolveOpeningBalance } from '@/lib/finance/monthly-balance';
import { Transaction } from '@/types';
import { z } from 'zod';

function isDemoMode() {
  return (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') && !isSupabaseConfigured();
}

const MonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Invalid month format (YYYY-MM)').optional();
const TodaySchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, 'Invalid date format (YYYY-MM-DD)').optional();

// Rich demo transactions with 2+ complete months of history (Sep 2026, Oct 2026, Nov 2026)
const DEMO_TRANSACTIONS: Transaction[] = [
  // September 2026 (Month 1 complete history)
  { id: 'd-1', user_id: 'demo', date: '2026-09-01', description: 'Salary Credit - September', amount: 35000, type: 'income', category: 'Income', source: 'manual', created_at: '' },
  { id: 'd-2', user_id: 'demo', date: '2026-09-05', description: 'House Rent - Sep', amount: 8000, type: 'expense', category: 'Rent', source: 'manual', created_at: '' },
  { id: 'd-3', user_id: 'demo', date: '2026-09-08', description: 'BESCOM Electricity Bill', amount: 1200, type: 'expense', category: 'Bills', source: 'manual', created_at: '' },
  { id: 'd-4', user_id: 'demo', date: '2026-09-10', description: 'Jio Fiber & Mobile', amount: 999, type: 'expense', category: 'Bills', source: 'manual', created_at: '' },
  { id: 'd-5', user_id: 'demo', date: '2026-09-12', description: 'Nature Basket Grocery', amount: 4800, type: 'expense', category: 'Food', source: 'manual', created_at: '' },
  { id: 'd-6', user_id: 'demo', date: '2026-09-16', description: 'Uber Commute', amount: 2800, type: 'expense', category: 'Transport', source: 'manual', created_at: '' },
  { id: 'd-7', user_id: 'demo', date: '2026-09-22', description: 'Amazon Purchase', amount: 3500, type: 'expense', category: 'Shopping', source: 'manual', created_at: '' },
  { id: 'd-8', user_id: 'demo', date: '2026-09-27', description: 'PVR Movie & Dinner', amount: 1500, type: 'expense', category: 'Entertainment', source: 'manual', created_at: '' },

  // October 2026 (Month 2 complete history)
  { id: 'd-9', user_id: 'demo', date: '2026-10-01', description: 'Salary Credit - October', amount: 35000, type: 'income', category: 'Income', source: 'manual', created_at: '' },
  { id: 'd-10', user_id: 'demo', date: '2026-10-05', description: 'House Rent - Oct', amount: 8000, type: 'expense', category: 'Rent', source: 'manual', created_at: '' },
  { id: 'd-11', user_id: 'demo', date: '2026-10-09', description: 'BESCOM Electricity Bill', amount: 1350, type: 'expense', category: 'Bills', source: 'manual', created_at: '' },
  { id: 'd-12', user_id: 'demo', date: '2026-10-10', description: 'Jio Mobile Recharge', amount: 749, type: 'expense', category: 'Bills', source: 'manual', created_at: '' },
  { id: 'd-13', user_id: 'demo', date: '2026-10-14', description: 'Supermarket Groceries', amount: 5200, type: 'expense', category: 'Food', source: 'manual', created_at: '' },
  { id: 'd-14', user_id: 'demo', date: '2026-10-18', description: 'Metro Card Recharge', amount: 3100, type: 'expense', category: 'Transport', source: 'manual', created_at: '' },
  { id: 'd-15', user_id: 'demo', date: '2026-10-22', description: 'Flipkart Diwali Sale', amount: 4200, type: 'expense', category: 'Shopping', source: 'manual', created_at: '' },
  { id: 'd-16', user_id: 'demo', date: '2026-10-28', description: 'Spotify & Weekend Outing', amount: 1800, type: 'expense', category: 'Entertainment', source: 'manual', created_at: '' },

  // November 2026 (Current Month)
  { id: 'd-17', user_id: 'demo', date: '2026-11-01', description: 'Salary Credit - November', amount: 35000, type: 'income', category: 'Income', source: 'manual', created_at: '' },
  { id: 'd-18', user_id: 'demo', date: '2026-11-05', description: 'House Rent - Nov', amount: 8000, type: 'expense', category: 'Rent', source: 'manual', created_at: '' },
  { id: 'd-19', user_id: 'demo', date: '2026-11-06', description: 'Swiggy Dinner Order', amount: 420, type: 'expense', category: 'Food', source: 'manual', created_at: '' },
  { id: 'd-20', user_id: 'demo', date: '2026-11-07', description: 'Uber Auto to Office', amount: 180, type: 'expense', category: 'Transport', source: 'manual', created_at: '' },
];

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured() && !isDemoMode()) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }

  try {
    const rawMonth = request.nextUrl.searchParams.get('month');
    const parseMonthResult = MonthSchema.safeParse(rawMonth ?? undefined);
    if (!parseMonthResult.success) {
      return NextResponse.json({ error: 'Invalid month parameter' }, { status: 400 });
    }

    // Item 10: Client sends local date (YYYY-MM-DD) for today
    const rawToday = request.nextUrl.searchParams.get('today');
    const parseTodayResult = TodaySchema.safeParse(rawToday ?? undefined);
    if (!parseTodayResult.success) {
      return NextResponse.json({ error: 'Invalid today date parameter' }, { status: 400 });
    }

    const now = new Date();
    const today = parseTodayResult.data ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const defaultMonth = today.slice(0, 7);
    const currentMonth = parseMonthResult.data ?? defaultMonth;

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user && !isDemoMode()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let transactions: Transaction[] = [];
    let openingBalance = 0;
    let openingBalanceNeedsConfirmation = false;

    if (user) {
      // Item 17: Replace every fetch-all of transactions with paged fetching
      transactions = await fetchAllUserTransactions(supabase, user.id);

      // Item 14: Default opening balance to previous month's closing balance if no monthly_settings row exists
      const resolved = await resolveOpeningBalance({
        supabase,
        userId: user.id,
        selectedMonth: currentMonth,
        allTransactions: transactions,
      });
      openingBalance = resolved.openingBalance;
      openingBalanceNeedsConfirmation = resolved.needsConfirmation;
    } else {
      // Demo mode
      transactions = DEMO_TRANSACTIONS;
      openingBalance = 5000;
    }

    // Extract all unique months available in data
    const monthSet = new Set<string>();
    monthSet.add(currentMonth);
    for (const t of transactions) {
      if (t.date && t.date.length >= 7) {
        monthSet.add(t.date.slice(0, 7));
      }
    }
    const availableMonths = Array.from(monthSet).sort().reverse();

    // Calculate prediction and analysis
    const prediction = calculateMonthEndPrediction({
      transactions,
      currentMonth,
      today,
      openingBalance,
    });

    const analysis = calculateSpendingAnalysis({
      transactions,
      selectedMonth: currentMonth,
    });

    return NextResponse.json({
      currentMonth,
      today,
      openingBalance,
      openingBalanceNeedsConfirmation,
      availableMonths,
      prediction,
      analysis,
      totalTransactionCount: transactions.length,
    });
  } catch (err) {
    console.error('Dashboard finance API error:', err);
    return NextResponse.json({ error: 'Failed to calculate finance summary' }, { status: 500 });
  }
}
