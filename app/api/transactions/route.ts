import { NextRequest, NextResponse } from 'next/server';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { z } from 'zod';
import { Transaction } from '@/types';

const transactionQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must be in YYYY-MM format (01-12)')
    .optional(),
  category: z.string().max(50).optional(),
  type: z.enum(['all', 'income', 'expense']).optional(),
  search: z.string().max(100, 'Search query too long').optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

const createTransactionSchema = z.object({
  amount: z.number().positive('Amount must be greater than zero'),
  description: z.string().min(1, 'Description is required').max(255, 'Description too long'),
  type: z.enum(['income', 'expense']),
  category: z.string().min(1, 'Category is required').max(50),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  source: z.enum(['manual', 'csv', 'recurring']).default('manual'),
  recurring_item_id: z.string().uuid().optional().nullable(),
  recurring_month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional().nullable(),
  learnRule: z
    .object({
      keyword: z.string().min(1).max(100),
      category: z.string().min(1).max(50),
    })
    .optional(),
});

let demoTransactions: Transaction[] = [
  {
    id: 'demo-1',
    user_id: 'demo-user',
    date: '2026-11-01',
    description: 'Monthly Salary Credit',
    amount: 35000,
    type: 'income',
    category: 'Income',
    source: 'recurring',
    recurring_month: '2026-11',
    created_at: new Date(2026, 10, 1).toISOString(),
  },
  {
    id: 'demo-2',
    user_id: 'demo-user',
    date: '2026-11-02',
    description: 'Apartment Rent',
    amount: 8000,
    type: 'expense',
    category: 'Rent',
    source: 'recurring',
    recurring_month: '2026-11',
    created_at: new Date(2026, 10, 2).toISOString(),
  },
  {
    id: 'demo-3',
    user_id: 'demo-user',
    date: '2026-11-03',
    description: 'Swiggy Dinner with team',
    amount: 680,
    type: 'expense',
    category: 'Food',
    source: 'manual',
    created_at: new Date(2026, 10, 3).toISOString(),
  },
  {
    id: 'demo-4',
    user_id: 'demo-user',
    date: '2026-11-04',
    description: 'Metro smartcard recharge',
    amount: 500,
    type: 'expense',
    category: 'Transport',
    source: 'manual',
    created_at: new Date(2026, 10, 4).toISOString(),
  },
  {
    id: 'demo-5',
    user_id: 'demo-user',
    date: '2026-11-05',
    description: 'Airtel mobile & wifi recharge',
    amount: 999,
    type: 'expense',
    category: 'Bills',
    source: 'manual',
    created_at: new Date(2026, 10, 5).toISOString(),
  },
];

export async function GET(request: NextRequest) {
  const configured = isSupabaseConfigured();
  const isDev = process.env.NODE_ENV === 'development';

  if (!configured && !isDev) {
    return NextResponse.json(
      { error: 'Service Unavailable: Database configuration missing' },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const rawQuery = {
    month: searchParams.get('month') || undefined,
    category: searchParams.get('category') || undefined,
    type: (searchParams.get('type') as any) || undefined,
    search: searchParams.get('search') || undefined,
    limit: searchParams.get('limit') || undefined,
  };

  // Issue 4: Validate query params with Zod
  const parsed = transactionQuerySchema.safeParse(rawQuery);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message || 'Invalid query parameters' },
      { status: 400 }
    );
  }

  const { month, category, type, search, limit } = parsed.data;

  if (configured) {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      let query = supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (month) {
        const startDate = `${month}-01`;
        const [yearStr, monthStr] = month.split('-');
        const y = parseInt(yearStr, 10);
        const m = parseInt(monthStr, 10);
        const lastDay = new Date(y, m, 0).getDate();
        const endDate = `${month}-${String(lastDay).padStart(2, '0')}`;
        query = query.gte('date', startDate).lte('date', endDate);
      }

      if (category && category !== 'All') {
        query = query.eq('category', category);
      }

      if (type && type !== 'all') {
        query = query.eq('type', type);
      }

      if (search) {
        query = query.ilike('description', `%${search}%`);
      }

      if (limit) {
        query = query.limit(limit);
      }

      const { data, error } = await query;
      if (error) {
        return NextResponse.json(
          { error: 'Failed to retrieve transactions' },
          { status: 500 }
        );
      }

      return NextResponse.json({ transactions: data || [] });
    } catch {
      return NextResponse.json(
        { error: 'An unexpected error occurred while fetching transactions' },
        { status: 500 }
      );
    }
  }

  // Demo mode (Development only)
  let filtered = [...demoTransactions];

  if (month) {
    filtered = filtered.filter((t) => t.date.startsWith(month));
  }
  if (category && category !== 'All') {
    filtered = filtered.filter((t) => t.category === category);
  }
  if (type && type !== 'all') {
    filtered = filtered.filter((t) => t.type === type);
  }
  if (search) {
    const s = search.toLowerCase();
    filtered = filtered.filter((t) => t.description.toLowerCase().includes(s));
  }

  filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  if (limit) {
    filtered = filtered.slice(0, limit);
  }

  return NextResponse.json({ transactions: filtered });
}

export async function POST(request: NextRequest) {
  const configured = isSupabaseConfigured();
  const isDev = process.env.NODE_ENV === 'development';

  if (!configured && !isDev) {
    return NextResponse.json(
      { error: 'Service Unavailable: Database configuration missing' },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const parsed = createTransactionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || 'Invalid transaction input' },
        { status: 400 }
      );
    }

    const {
      amount,
      description,
      type,
      category,
      date,
      source,
      recurring_item_id,
      recurring_month,
      learnRule,
    } = parsed.data;

    if (configured) {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      // If user opted to learn a keyword rule
      if (learnRule && learnRule.keyword.trim()) {
        const kw = learnRule.keyword.trim().toLowerCase();
        await supabase
          .from('category_rules')
          .upsert(
            {
              user_id: user.id,
              keyword: kw,
              category: learnRule.category,
            },
            { onConflict: 'user_id,keyword' }
          );
      }

      const { data, error } = await supabase
        .from('transactions')
        .insert({
          user_id: user.id,
          date,
          description: description.trim(),
          amount,
          type,
          category,
          source,
          recurring_item_id: recurring_item_id || null,
          recurring_month: recurring_month || null,
        })
        .select()
        .single();

      if (error) {
        return NextResponse.json(
          { error: 'Failed to save transaction' },
          { status: 500 }
        );
      }

      return NextResponse.json({ transaction: data }, { status: 201 });
    }

    // Demo mode
    const newTx: Transaction = {
      id: 'demo-' + Date.now(),
      user_id: 'demo-user',
      date,
      description: description.trim(),
      amount,
      type,
      category,
      source,
      recurring_item_id: recurring_item_id || null,
      recurring_month: recurring_month || null,
      created_at: new Date().toISOString(),
    };

    demoTransactions.unshift(newTx);
    return NextResponse.json({ transaction: newTx }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: 'An unexpected error occurred while saving transaction' },
      { status: 500 }
    );
  }
}
