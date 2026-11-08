import { NextRequest, NextResponse } from 'next/server';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';

function isDemoMode() {
  return process.env.NODE_ENV === 'development' && !isSupabaseConfigured();
}

export interface ImportBatchSummary {
  batchId: string;
  importedAt: string;
  rowCount: number;
}

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

    if (!user) {
      // In demo mode without DB, return empty batches list
      return NextResponse.json({ batches: [] });
    }

    // Item 17: Paged fetch of transactions with an import_batch_id
    const batchMap = new Map<string, { batchId: string; importedAt: string; rowCount: number }>();
    const PAGE_SIZE = 1000;
    let from = 0;

    while (true) {
      const { data, error } = await supabase
        .from('transactions')
        .select('id, import_batch_id, created_at')
        .eq('user_id', user.id)
        .not('import_batch_id', 'is', null)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(from, from + PAGE_SIZE - 1);

      if (error) {
        console.error('Fetch import batches error:', error);
        return NextResponse.json({ error: 'Failed to fetch import batches' }, { status: 500 });
      }

      if (!data || data.length === 0) break;

      for (const row of data) {
        const bId = row.import_batch_id as string;
        if (!bId) continue;

        const existing = batchMap.get(bId);
        if (existing) {
          existing.rowCount += 1;
        } else {
          batchMap.set(bId, {
            batchId: bId,
            importedAt: row.created_at,
            rowCount: 1,
          });
        }
      }

      if (data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }

    const batches = Array.from(batchMap.values());
    return NextResponse.json({ batches });
  } catch (err) {
    console.error('Fetch import batches error:', err);
    return NextResponse.json({ error: 'Failed to fetch import batches' }, { status: 500 });
  }
}
