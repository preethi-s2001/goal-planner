import { SupabaseClient } from '@supabase/supabase-js';
import { Transaction } from '@/types';

/**
 * Item 17: Replaces every fetch-all .select('*') of transactions with paged fetching.
 * Uses 1000-row pages with .order('date', { ascending: false }).order('id', { ascending: false }).
 */
export async function fetchAllUserTransactions(
  supabase: SupabaseClient,
  userId: string,
  columns: string = 'id, user_id, date, description, amount, type, category, source, import_batch_id, created_at'
): Promise<Transaction[]> {
  const PAGE_SIZE = 1000;
  const allRows: Transaction[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('transactions')
      .select(columns)
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .order('id', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error('Paged transaction fetch error:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      break;
    }

    allRows.push(...(data as unknown as Transaction[]));

    if (data.length < PAGE_SIZE) {
      break;
    }

    from += PAGE_SIZE;
  }

  return allRows;
}
