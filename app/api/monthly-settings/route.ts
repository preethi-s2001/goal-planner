import { NextRequest, NextResponse } from 'next/server';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { fetchAllUserTransactions } from '@/lib/finance/transactions';
import { resolveOpeningBalance } from '@/lib/finance/monthly-balance';
import { z } from 'zod';

function isDemoMode() {
  return process.env.NODE_ENV === 'development' && !isSupabaseConfigured();
}

const MonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Invalid month format (YYYY-MM)');

const SettingsBodySchema = z.object({
  month: MonthSchema,
  opening_balance: z.number().finite().nonnegative('Opening balance cannot be negative'),
});

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured() && !isDemoMode()) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }

  try {
    const monthParam = request.nextUrl.searchParams.get('month');
    const parseResult = MonthSchema.safeParse(monthParam);
    if (!parseResult.success) {
      return NextResponse.json({ error: 'Invalid or missing month parameter' }, { status: 400 });
    }

    const month = parseResult.data;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user && !isDemoMode()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!user) {
      return NextResponse.json({ month, opening_balance: 0, needsConfirmation: false });
    }

    const transactions = await fetchAllUserTransactions(supabase, user.id, 'id, user_id, date, amount, type, category');
    const resolved = await resolveOpeningBalance({
      supabase,
      userId: user.id,
      selectedMonth: month,
      allTransactions: transactions,
    });

    return NextResponse.json({
      month,
      opening_balance: resolved.openingBalance,
      needsConfirmation: resolved.needsConfirmation,
    });
  } catch (err) {
    console.error('Monthly settings GET error:', err);
    return NextResponse.json({ error: 'Failed to fetch monthly settings' }, { status: 500 });
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
    const parseResult = SettingsBodySchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { month, opening_balance } = parseResult.data;

    if (!user) {
      return NextResponse.json({ month, opening_balance });
    }

    const { data, error } = await supabase
      .from('monthly_settings')
      .upsert(
        {
          user_id: user.id,
          month,
          opening_balance,
        },
        { onConflict: 'user_id,month' }
      )
      .select('month, opening_balance')
      .single();

    if (error) {
      console.error('Upsert monthly settings error:', error);
      return NextResponse.json({ error: 'Failed to save monthly settings' }, { status: 500 });
    }

    return NextResponse.json({
      month: data.month,
      opening_balance: Number(data.opening_balance),
    });
  } catch (err) {
    console.error('Monthly settings POST error:', err);
    return NextResponse.json({ error: 'Failed to save monthly settings' }, { status: 500 });
  }
}
