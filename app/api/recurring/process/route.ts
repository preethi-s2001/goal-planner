import { NextRequest, NextResponse } from 'next/server';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { buildRecurringCandidates } from '@/lib/finance/recurring';
import { RecurringItem } from '@/types';
import { z } from 'zod';

const processMonthSchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must be in YYYY-MM format (01-12)')
    .optional(),
});

export async function POST(request: NextRequest) {
  const configured = isSupabaseConfigured();
  const isDev = process.env.NODE_ENV === 'development';

  // Issue 3: Fail closed. If database not configured and not in development, return 503
  if (!configured && !isDev) {
    return NextResponse.json(
      { error: 'Service Unavailable: Database configuration missing' },
      { status: 503 }
    );
  }

  try {
    let rawMonth: string | undefined;
    try {
      const body = await request.json();
      rawMonth = body?.month;
    } catch {
      // Body empty or not provided
    }

    // Issue 4: Validate month with Zod
    const parsed = processMonthSchema.safeParse({ month: rawMonth });
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || 'Invalid month format' },
        { status: 400 }
      );
    }

    let targetMonth = parsed.data.month;
    if (!targetMonth) {
      const now = new Date();
      targetMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    if (configured) {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      // Fetch active recurring items
      const { data: recurringItems, error: recError } = await supabase
        .from('recurring_items')
        .select('*')
        .eq('user_id', user.id)
        .eq('active', true);

      if (recError) {
        return NextResponse.json(
          { error: 'Failed to fetch recurring items' },
          { status: 500 }
        );
      }

      if (!recurringItems || recurringItems.length === 0) {
        return NextResponse.json({ createdCount: 0, items: [] });
      }

      // Fetch existing transactions for this month that have recurring_item_id
      const { data: existingTransactions, error: txError } = await supabase
        .from('transactions')
        .select('recurring_item_id, recurring_month')
        .eq('user_id', user.id)
        .eq('recurring_month', targetMonth)
        .not('recurring_item_id', 'is', null);

      if (txError) {
        return NextResponse.json(
          { error: 'Failed to check existing transactions' },
          { status: 500 }
        );
      }

      // Issue 1: Use tested library function
      const candidates = buildRecurringCandidates(
        recurringItems as RecurringItem[],
        existingTransactions || [],
        targetMonth,
        user.id
      );

      if (candidates.length === 0) {
        return NextResponse.json({
          createdCount: 0,
          message: 'All active recurring items are already generated for this month.',
        });
      }

      // Upsert with ignoreDuplicates to guarantee parallel and mid-month idempotency
      const { data: created, error: insertError } = await supabase
        .from('transactions')
        .upsert(candidates, {
          onConflict: 'recurring_item_id,recurring_month',
          ignoreDuplicates: true,
        })
        .select();

      if (insertError) {
        return NextResponse.json(
          { error: 'Failed to generate recurring transactions' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        createdCount: created?.length || 0,
        items: created || [],
      });
    }

    // Demo mode (Development only)
    return NextResponse.json({
      createdCount: 0,
      message: 'All demo recurring items are up to date.',
    });
  } catch {
    return NextResponse.json(
      { error: 'An unexpected error occurred while processing recurring items' },
      { status: 500 }
    );
  }
}
