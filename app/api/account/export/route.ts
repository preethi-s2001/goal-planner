import { NextRequest, NextResponse } from 'next/server';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { Transaction, Budget, Goal, RecurringItem, CategoryRule } from '@/types';
import Papa from 'papaparse';

function isDemoMode() {
  return process.env.NODE_ENV === 'development' && !isSupabaseConfigured();
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

    const format = request.nextUrl.searchParams.get('format') || 'json';
    const now = new Date().toISOString().split('T')[0];

    let transactions: Transaction[] = [];
    let budgets: Budget[] = [];
    let goals: Goal[] = [];
    let recurringItems: RecurringItem[] = [];
    let categoryRules: CategoryRule[] = [];
    let monthlySettings: any[] = [];
    let customCategories: any[] = [];

    if (user) {
      // 1. Page through all transactions so the 1000-row Supabase limit cannot truncate
      let allTransactions: Transaction[] = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data: pageData, error: pageErr } = await supabase
          .from('transactions')
          .select('*')
          .eq('user_id', user.id)
          .order('date', { ascending: false })
          .order('id', { ascending: false })
          .range(from, from + pageSize - 1);

        if (pageErr) {
          console.error('Export pagination error:', pageErr);
          throw pageErr;
        }

        if (pageData && pageData.length > 0) {
          allTransactions = allTransactions.concat(pageData as Transaction[]);
          if (pageData.length < pageSize) {
            hasMore = false;
          } else {
            from += pageSize;
          }
        } else {
          hasMore = false;
        }
      }

      transactions = allTransactions;

      // 2. Fetch associated settings, rules, budgets, and goals
      const [bRes, gRes, rRes, cRes, mRes, custRes] = await Promise.all([
        supabase.from('budgets').select('*').eq('user_id', user.id),
        supabase.from('goals').select('*').eq('user_id', user.id),
        supabase.from('recurring_items').select('*').eq('user_id', user.id),
        supabase.from('category_rules').select('*').eq('user_id', user.id),
        supabase.from('monthly_settings').select('*').eq('user_id', user.id),
        supabase.from('custom_categories').select('*').eq('user_id', user.id),
      ]);

      budgets = (bRes.data as Budget[]) || [];
      goals = (gRes.data as Goal[]) || [];
      recurringItems = (rRes.data as RecurringItem[]) || [];
      categoryRules = (cRes.data as CategoryRule[]) || [];
      monthlySettings = mRes.data || [];
      customCategories = custRes.data || [];
    } else {
      // Demo dataset
      transactions = [
        { id: 'd-1', user_id: 'demo', date: '2026-11-01', description: 'Salary Credit - November', amount: 35000, type: 'income', category: 'Income', source: 'manual', created_at: '' },
        { id: 'd-2', user_id: 'demo', date: '2026-11-05', description: 'House Rent - Nov', amount: 8000, type: 'expense', category: 'Rent', source: 'manual', created_at: '' },
        { id: 'd-3', user_id: 'demo', date: '2026-11-06', description: 'Swiggy Dinner Order', amount: 420, type: 'expense', category: 'Food', source: 'manual', created_at: '' },
        { id: 'd-4', user_id: 'demo', date: '2026-11-07', description: 'Uber Auto to Office', amount: 180, type: 'expense', category: 'Transport', source: 'manual', created_at: '' },
      ];
      budgets = [
        { id: 'b-1', user_id: 'demo', category: 'Food', monthly_limit: 5000, created_at: '' },
        { id: 'b-2', user_id: 'demo', category: 'Shopping', monthly_limit: 4000, created_at: '' },
      ];
      goals = [
        { id: 'g-1', user_id: 'demo', name: 'Emergency Fund', target_amount: 50000, saved_amount: 15000, target_months: 6, created_at: '' },
      ];
      recurringItems = [
        { id: 'r-1', user_id: 'demo', description: 'House Rent', amount: 8000, type: 'expense', category: 'Rent', day_of_month: 5, active: true, created_at: '' },
      ];
      categoryRules = [
        { id: 'c-1', user_id: 'demo', keyword: 'swiggy', category: 'Food', created_at: '' },
      ];
      monthlySettings = [{ month: '2026-11', opening_balance: 5000 }];
      customCategories = [{ name: 'Freelance', type: 'income' }];
    }

    // 1. Export as CSV (Transactions only with escapeFormulae to protect against CSV formula injection)
    if (format === 'csv') {
      const csvRows = transactions.map((t) => ({
        Date: t.date,
        Description: t.description,
        Amount: t.amount,
        Type: t.type,
        Category: t.category,
        Source: t.source,
      }));

      const csvString = Papa.unparse(csvRows, {
        quotes: true,
        header: true,
        escapeFormulae: true,
      });

      return new NextResponse(csvString, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="goal-planner-transactions-${now}.csv"`,
        },
      });
    }

    // 2. Export as Full Portable JSON Backup (including monthly_settings and custom_categories)
    const backupData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      user: {
        id: user ? user.id : 'demo-user',
        email: user ? user.email : 'demo@example.com',
      },
      counts: {
        transactions: transactions.length,
        budgets: budgets.length,
        goals: goals.length,
        recurringItems: recurringItems.length,
        categoryRules: categoryRules.length,
        monthly_settings: monthlySettings.length,
        custom_categories: customCategories.length,
      },
      transactions,
      budgets,
      goals,
      recurringItems,
      categoryRules,
      monthly_settings: monthlySettings,
      custom_categories: customCategories,
    };

    return new NextResponse(JSON.stringify(backupData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="goal-planner-backup-${now}.json"`,
      },
    });
  } catch (err) {
    console.error('Account Export error:', err);
    return NextResponse.json({ error: 'Failed to export financial data' }, { status: 500 });
  }
}
