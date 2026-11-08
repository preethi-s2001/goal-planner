import { NextRequest, NextResponse } from 'next/server';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { calculateBudgetStatus } from '@/lib/finance/budgets';
import { parseDateParts } from '@/lib/finance/prediction';
import { Budget, Transaction, DEFAULT_EXPENSE_CATEGORIES } from '@/types';
import { z } from 'zod';

function isDemoMode() {
  return (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') && !isSupabaseConfigured();
}

const UpsertBudgetSchema = z.object({
  category: z.string().min(1).max(100),
  monthly_limit: z.number().finite().nonnegative('Monthly limit cannot be negative'),
});

const MonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Invalid month format (YYYY-MM)').optional();
const TodaySchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, 'Invalid date format (YYYY-MM-DD)').optional();

// Demo budgets for testing in development
let demoBudgets: Budget[] = [
  { id: 'b-1', user_id: 'demo', category: 'Rent', monthly_limit: 8000, created_at: '' },
  { id: 'b-2', user_id: 'demo', category: 'Food', monthly_limit: 5000, created_at: '' },
  { id: 'b-3', user_id: 'demo', category: 'Transport', monthly_limit: 3000, created_at: '' },
  { id: 'b-4', user_id: 'demo', category: 'Shopping', monthly_limit: 4000, created_at: '' },
  { id: 'b-5', user_id: 'demo', category: 'Bills', monthly_limit: 2500, created_at: '' },
  { id: 'b-6', user_id: 'demo', category: 'Entertainment', monthly_limit: 2000, created_at: '' },
];

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured() && !isDemoMode()) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }

  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user && !isDemoMode()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rawToday = request.nextUrl.searchParams.get('today');
    const rawMonth = request.nextUrl.searchParams.get('month');
    const parseToday = TodaySchema.safeParse(rawToday ?? undefined);
    const parseMonth = MonthSchema.safeParse(rawMonth ?? undefined);

    const now = new Date();
    const today = parseToday.success && parseToday.data ? parseToday.data : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const currentMonth = parseMonth.success && parseMonth.data ? parseMonth.data : today.slice(0, 7);
    const [year, monthNum, dayNum] = today.split('-').map(Number);
    const daysInMonth = new Date(Number(currentMonth.slice(0, 4)), Number(currentMonth.slice(5, 7)), 0).getDate();
    const currentDay = currentMonth === today.slice(0, 7) ? dayNum : (currentMonth < today.slice(0, 7) ? daysInMonth : 1);

    let budgets: Budget[] = [];
    let transactions: Transaction[] = [];

    if (user) {
      const budgetsRes = await supabase
        .from('budgets')
        .select('*')
        .eq('user_id', user.id)
        .order('category');

      budgets = (budgetsRes.data as Budget[]) ?? [];

      // Item 17: Paged fetching of transactions for the budget month
      const PAGE_SIZE = 1000;
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from('transactions')
          .select('id, user_id, date, amount, type, category')
          .eq('user_id', user.id)
          .gte('date', `${currentMonth}-01`)
          .lte('date', `${currentMonth}-${daysInMonth}`)
          .order('date', { ascending: false })
          .order('id', { ascending: false })
          .range(from, from + PAGE_SIZE - 1);

        if (error) {
          console.error('Error fetching budgets transactions:', error);
          break;
        }
        if (!data || data.length === 0) break;
        transactions.push(...(data as Transaction[]));
        if (data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
    } else {
      budgets = [...demoBudgets];
      // Sample spends for demo
      transactions = [
        { id: '1', user_id: 'demo', date: `${currentMonth}-05`, description: 'Rent payment', amount: 8000, type: 'expense', category: 'Rent', source: 'manual', created_at: '' },
        { id: '2', user_id: 'demo', date: `${currentMonth}-06`, description: 'Groceries and food', amount: 4600, type: 'expense', category: 'Food', source: 'manual', created_at: '' }, // 92% -> warning_90
        { id: '3', user_id: 'demo', date: `${currentMonth}-07`, description: 'Cab commute', amount: 2400, type: 'expense', category: 'Transport', source: 'manual', created_at: '' }, // 80% -> warning_75
        { id: '4', user_id: 'demo', date: `${currentMonth}-08`, description: 'Shopping store', amount: 4200, type: 'expense', category: 'Shopping', source: 'manual', created_at: '' }, // 105% -> exceeded
        { id: '5', user_id: 'demo', date: `${currentMonth}-09`, description: 'Electricity and wifi', amount: 1500, type: 'expense', category: 'Bills', source: 'manual', created_at: '' },
      ];
    }

    // Calculate current month spend per category
    const spentByCategory: Record<string, number> = {};
    for (const t of transactions) {
      if (t.type === 'expense') {
        spentByCategory[t.category] = (spentByCategory[t.category] || 0) + Number(t.amount);
      }
    }

    // Evaluate budget status for each budget
    const evaluatedBudgets = budgets.map((b) => {
      const spent = spentByCategory[b.category] || 0;
      const status = calculateBudgetStatus({
        category: b.category,
        spent,
        limit: Number(b.monthly_limit),
        currentDay,
        daysInMonth,
      });

      return {
        ...b,
        monthly_limit: Number(b.monthly_limit),
        ...status,
      };
    });

    return NextResponse.json({
      budgets: evaluatedBudgets,
      currentMonth,
      currentDay,
      daysInMonth,
    });
  } catch (err) {
    console.error('Budgets GET error:', err);
    return NextResponse.json({ error: 'Failed to fetch budgets' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured() && !isDemoMode()) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }

  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user && !isDemoMode()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parseResult = UpsertBudgetSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid budget parameters', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { category, monthly_limit } = parseResult.data;

    if (!user) {
      const idx = demoBudgets.findIndex((b) => b.category === category);
      if (idx >= 0) {
        demoBudgets[idx].monthly_limit = monthly_limit;
      } else {
        demoBudgets.push({
          id: `b-${Date.now()}`,
          user_id: 'demo',
          category,
          monthly_limit,
          created_at: new Date().toISOString(),
        });
      }
      return NextResponse.json({ success: true, budget: { category, monthly_limit } });
    }

    const { data, error } = await supabase
      .from('budgets')
      .upsert(
        {
          user_id: user.id,
          category,
          monthly_limit,
        },
        { onConflict: 'user_id,category' }
      )
      .select('*')
      .single();

    if (error) {
      console.error('Upsert budget error:', error);
      return NextResponse.json({ error: 'Failed to save budget' }, { status: 500 });
    }

    return NextResponse.json({ success: true, budget: data });
  } catch (err) {
    console.error('Budgets POST error:', err);
    return NextResponse.json({ error: 'Failed to save budget' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!isSupabaseConfigured() && !isDemoMode()) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }

  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user && !isDemoMode()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const id = request.nextUrl.searchParams.get('id');
    const category = request.nextUrl.searchParams.get('category');

    if (!id && !category) {
      return NextResponse.json({ error: 'Missing budget id or category' }, { status: 400 });
    }

    if (!user) {
      demoBudgets = demoBudgets.filter((b) => b.id !== id && b.category !== category);
      return NextResponse.json({ success: true });
    }

    let query = supabase.from('budgets').delete().eq('user_id', user.id);
    if (id) query = query.eq('id', id);
    if (category) query = query.eq('category', category);

    const { error } = await query;
    if (error) {
      console.error('Delete budget error:', error);
      return NextResponse.json({ error: 'Failed to delete budget' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Budgets DELETE error:', err);
    return NextResponse.json({ error: 'Failed to delete budget' }, { status: 500 });
  }
}
