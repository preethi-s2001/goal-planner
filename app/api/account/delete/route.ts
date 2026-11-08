import { NextRequest, NextResponse } from 'next/server';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { z } from 'zod';

function isDemoMode() {
  return process.env.NODE_ENV === 'development' && !isSupabaseConfigured();
}

const DeletePayloadSchema = z.object({
  action: z.enum(['clear_data', 'delete_account']),
  confirmation: z.literal('DELETE', {
    errorMap: () => ({ message: 'Please type DELETE to confirm' }),
  }),
});

// Tables cleared on clear_data (ai_usage is preserved so daily quota cannot be bypassed)
const CLEAR_DATA_TABLES = [
  'transactions',
  'budgets',
  'goals',
  'recurring_items',
  'category_rules',
  'monthly_settings',
  'custom_categories',
  'ai_reviews',
] as const;

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured() && !isDemoMode()) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const parseResult = DeletePayloadSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid confirmation payload', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { action } = parseResult.data;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user && !isDemoMode()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user) {
      if (action === 'delete_account') {
        // 1. Create admin client FIRST. If it fails, return error BEFORE deleting anything.
        let adminClient;
        try {
          adminClient = createAdminClient();
        } catch (adminClientErr: any) {
          console.error('Failed to initialize admin client for account deletion:', adminClientErr);
          return NextResponse.json(
            { error: 'Server configuration error: missing admin credentials for account deletion' },
            { status: 500 }
          );
        }

        // 2. Call auth.admin.deleteUser(user.id) only.
        // All child tables (profiles, transactions, budgets, goals, recurring_items,
        // category_rules, monthly_settings, custom_categories, ai_reviews, ai_usage)
        // enforce ON DELETE CASCADE referencing auth.users(id).
        const { error: authAdminError } = await adminClient.auth.admin.deleteUser(user.id);
        if (authAdminError) {
          console.error('Failed to delete auth user from Supabase:', authAdminError);
          return NextResponse.json(
            { error: 'Failed to delete user account. Please try again later.' },
            { status: 500 }
          );
        }

        // 3. Terminate user session
        await supabase.auth.signOut();

        return NextResponse.json({
          success: true,
          message: 'Your account and all associated data have been permanently deleted.',
        });
      }

      if (action === 'clear_data') {
        // Clear financial tables only. clear_data must NOT delete ai_usage.
        for (const table of CLEAR_DATA_TABLES) {
          const { error } = await supabase.from(table).delete().eq('user_id', user.id);
          if (error) {
            console.error(`Failed to delete rows from ${table}:`, error);
            return NextResponse.json(
              { error: 'Failed to clear financial data. Please try again.' },
              { status: 500 }
            );
          }
        }

        return NextResponse.json({
          success: true,
          message: 'All your financial records, budgets, rules, and goals have been cleared.',
        });
      }
    } else {
      // Demo Mode response
      return NextResponse.json({
        success: true,
        message:
          action === 'clear_data'
            ? 'Demo financial records cleared.'
            : 'Demo account reset successfully.',
      });
    }
  } catch (err: any) {
    console.error('Account Delete error:', err);
    return NextResponse.json(
      { error: 'Failed to process account deletion request. Please try again.' },
      { status: 500 }
    );
  }
}
