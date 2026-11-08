import { NextRequest, NextResponse } from 'next/server';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { z } from 'zod';

function isDemoMode() {
  return process.env.NODE_ENV === 'development' && !isSupabaseConfigured();
}

function isValidDateString(dateStr: string): boolean {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return false;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return false;
  if (year < 1990 || year > 2099) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  const daysInMonth = new Date(year, month, 0).getDate();
  return day <= daysInMonth;
}

const CommitRowSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])-\d{2}$/, 'Invalid date format')
    .refine(isValidDateString, 'Impossible date (e.g. Feb 31)'),
  description: z.string().min(1).max(500),
  amount: z.number().finite().positive().max(9999999.99),
  type: z.enum(['income', 'expense']),
  category: z.string().min(1).max(100),
});

const CommitBodySchema = z.object({
  rows: z.array(CommitRowSchema).min(1).max(2000),
  batchId: z.string().uuid(),
});

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
    const parseResult = CommitBodySchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { rows, batchId } = parseResult.data;

    if (!user) {
      // Demo mode: just return success without saving
      return NextResponse.json({ savedCount: rows.length, batchId });
    }

    // Check no transactions already exist for this batchId (prevent double-commit)
    const { count } = await supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('import_batch_id', batchId)
      .eq('user_id', user.id);

    if ((count ?? 0) > 0) {
      return NextResponse.json(
        { error: 'This import batch has already been committed.' },
        { status: 409 }
      );
    }

    const records = rows.map((row) => ({
      user_id: user.id,
      date: row.date,
      description: row.description,
      amount: row.amount,
      type: row.type,
      category: row.category,
      source: 'csv' as const,
      import_batch_id: batchId,
    }));

    const { error } = await supabase.from('transactions').insert(records);

    if (error) {
      console.error('CSV commit error:', error);
      return NextResponse.json({ error: 'Failed to save transactions. Please try again.' }, { status: 500 });
    }

    return NextResponse.json({ savedCount: records.length, batchId });
  } catch (err) {
    console.error('CSV commit error:', err);
    return NextResponse.json({ error: 'Failed to save transactions. Please try again.' }, { status: 500 });
  }
}
