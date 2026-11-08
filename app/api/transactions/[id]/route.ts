import { NextRequest, NextResponse } from 'next/server';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { z } from 'zod';

const updateTransactionSchema = z.object({
  amount: z.number().positive('Amount must be greater than zero'),
  description: z.string().min(1, 'Description is required').max(255, 'Description too long'),
  type: z.enum(['income', 'expense']),
  category: z.string().min(1, 'Category is required').max(50),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  learnRule: z
    .object({
      keyword: z.string().min(1).max(100),
      category: z.string().min(1).max(50),
    })
    .optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const configured = isSupabaseConfigured();
  const isDev = process.env.NODE_ENV === 'development';

  // Issue 3: Fail closed
  if (!configured && !isDev) {
    return NextResponse.json(
      { error: 'Service Unavailable: Database configuration missing' },
      { status: 503 }
    );
  }

  try {
    const id = params.id;
    const body = await request.json();
    const parsed = updateTransactionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || 'Invalid input data' },
        { status: 400 }
      );
    }

    const { amount, description, type, category, date, learnRule } = parsed.data;

    if (configured) {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      if (learnRule && learnRule.keyword.trim()) {
        const kw = learnRule.keyword.trim().toLowerCase();
        await supabase.from('category_rules').upsert(
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
        .update({
          amount,
          description: description.trim(),
          type,
          category,
          date,
        })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .maybeSingle();

      if (error) {
        return NextResponse.json(
          { error: 'Failed to update transaction' },
          { status: 500 }
        );
      }

      // Issue 6: Return 404 when matching transaction not found
      if (!data) {
        return NextResponse.json(
          { error: 'Transaction not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ transaction: data });
    }

    // Demo mode
    return NextResponse.json({
      transaction: {
        id,
        amount,
        description,
        type,
        category,
        date,
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'An unexpected error occurred while updating the transaction' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const configured = isSupabaseConfigured();
  const isDev = process.env.NODE_ENV === 'development';

  // Issue 3: Fail closed
  if (!configured && !isDev) {
    return NextResponse.json(
      { error: 'Service Unavailable: Database configuration missing' },
      { status: 503 }
    );
  }

  try {
    const id = params.id;

    if (configured) {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const { data, error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)
        .select();

      if (error) {
        return NextResponse.json(
          { error: 'Failed to delete transaction' },
          { status: 500 }
        );
      }

      // Issue 6: Return 404 if no row was deleted
      if (!data || data.length === 0) {
        return NextResponse.json(
          { error: 'Transaction not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true });
    }

    // Demo mode
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: 'An unexpected error occurred while deleting the transaction' },
      { status: 500 }
    );
  }
}
