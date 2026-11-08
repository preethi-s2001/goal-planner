import { NextRequest, NextResponse } from 'next/server';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { z } from 'zod';

function isDemoMode() {
  return process.env.NODE_ENV === 'development' && !isSupabaseConfigured();
}

const BatchIdSchema = z.string().uuid();

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

    const batchId = request.nextUrl.searchParams.get('batchId');
    const parseResult = BatchIdSchema.safeParse(batchId);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid or missing batchId. Must be a valid UUID.' },
        { status: 400 }
      );
    }

    if (!user) {
      // Demo mode: return success without deleting
      return NextResponse.json({ deletedCount: 0, batchId });
    }

    const { data, error } = await supabase
      .from('transactions')
      .delete()
      .eq('import_batch_id', parseResult.data)
      .eq('user_id', user.id)
      .select('id');

    if (error) {
      console.error('CSV undo error:', error);
      return NextResponse.json({ error: 'Failed to undo import. Please try again.' }, { status: 500 });
    }

    return NextResponse.json({
      deletedCount: data?.length ?? 0,
      batchId: parseResult.data,
    });
  } catch (err) {
    console.error('CSV undo error:', err);
    return NextResponse.json({ error: 'Failed to undo import. Please try again.' }, { status: 500 });
  }
}
