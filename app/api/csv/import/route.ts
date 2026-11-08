import { NextRequest, NextResponse } from 'next/server';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { cleanAndValidateCsv, extractCsvDateRange } from '@/lib/csv/cleaner';
import { CategoryRule, Transaction } from '@/types';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

function isDemoMode() {
  return (
    process.env.NODE_ENV === 'development' && !isSupabaseConfigured()
  );
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

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No file provided. Please attach a CSV file.' }, { status: 400 });
    }

    // Type check
    const fileObj = file as File;
    if (fileObj.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large (${(fileObj.size / 1024 / 1024).toFixed(1)} MB). Maximum size is 5 MB.` },
        { status: 400 }
      );
    }

    const contentType = fileObj.type;
    if (contentType && !['text/csv', 'text/plain', 'application/csv', ''].includes(contentType)) {
      return NextResponse.json({ error: 'Please upload a CSV file (.csv).' }, { status: 400 });
    }

    const csvContent = await fileObj.text();

    // Fetch existing transactions for duplicate detection
    // Issue 4: Filter strictly by the date range covered in CSV, and page through results
    // so Supabase 1000-row limit cannot truncate them.
    let existingTransactions: Transaction[] = [];
    let userRules: CategoryRule[] = [];

    if (user) {
      const { minDate, maxDate } = extractCsvDateRange(csvContent);

      const rulesPromise = supabase
        .from('category_rules')
        .select('*')
        .eq('user_id', user.id);

      const PAGE_SIZE = 1000;
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        let query = supabase
          .from('transactions')
          .select('id, user_id, date, description, amount, type, category, source, import_batch_id, created_at')
          .eq('user_id', user.id);

        if (minDate && maxDate) {
          query = query.gte('date', minDate).lte('date', maxDate);
        }

        const { data, error } = await query.range(from, to);
        if (error || !data || data.length === 0) {
          hasMore = false;
        } else {
          existingTransactions = existingTransactions.concat(data as Transaction[]);
          if (data.length < PAGE_SIZE) {
            hasMore = false;
          } else {
            page++;
          }
        }
      }

      const rulesResult = await rulesPromise;
      userRules = (rulesResult.data as CategoryRule[]) ?? [];
    }

    const result = cleanAndValidateCsv(csvContent, existingTransactions, userRules);

    return NextResponse.json(result);
  } catch (err) {
    console.error('CSV import error:', err);
    return NextResponse.json({ error: 'Failed to process CSV file. Please try again.' }, { status: 500 });
  }
}
