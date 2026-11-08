import { NextRequest, NextResponse } from 'next/server';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import {
  calculateGoalFeasibility,
  calculateCombinedGoalsFeasibility,
  calculateAverageMonthlySurplus,
} from '@/lib/finance/goals';
import { fetchAllUserTransactions } from '@/lib/finance/transactions';
import { parseDateParts } from '@/lib/finance/prediction';
import { Goal, Transaction } from '@/types';
import { z } from 'zod';

function isDemoMode() {
  return (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') && !isSupabaseConfigured();
}

const TodaySchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, 'Invalid date format (YYYY-MM-DD)')
  .optional();

const CreateGoalSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  target_amount: z.number().finite().positive('Target amount must be positive').max(100000000),
  saved_amount: z.number().finite().nonnegative('Saved amount cannot be negative').max(100000000),
  target_months: z.number().int().positive('Timeline must be at least 1 month').max(360),
  today: TodaySchema,
});

const UpdateGoalSchema = CreateGoalSchema.extend({
  id: z.string().uuid(),
  today: TodaySchema,
});

let demoGoals: Goal[] = [
  {
    id: 'g-demo-1',
    user_id: 'demo',
    name: 'New Bike (150cc)',
    target_amount: 60000,
    saved_amount: 12000,
    target_months: 12,
    created_at: new Date().toISOString(),
  },
  {
    id: 'g-demo-2',
    user_id: 'demo',
    name: 'Emergency Fund (3 Months Living Expenses)',
    target_amount: 75000,
    saved_amount: 25000,
    target_months: 10,
    created_at: new Date().toISOString(),
  },
];

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

    const rawToday = request.nextUrl.searchParams.get('today');
    const parseToday = TodaySchema.safeParse(rawToday ?? undefined);
    if (!parseToday.success) {
      return NextResponse.json({ error: 'Invalid today date parameter' }, { status: 400 });
    }
    const now = new Date();
    const defaultToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const today = parseToday.data ?? defaultToday;
    const currentMonth = today.slice(0, 7);

    let goals: Goal[] = [];
    let monthlySurplus: number | null = isDemoMode() ? 12000 : null;

    if (user) {
      const goalsRes = await supabase
        .from('goals')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      goals = (goalsRes.data as Goal[]) ?? [];
      const allTx = await fetchAllUserTransactions(supabase, user.id, 'date, amount, type');

      monthlySurplus = calculateAverageMonthlySurplus(allTx, currentMonth);
    } else {
      goals = [...demoGoals];
      monthlySurplus = 12000;
    }

    const combined = calculateCombinedGoalsFeasibility({ goals, monthlySurplus });

    return NextResponse.json({
      currentMonth,
      today,
      goals: combined.goals,
      combinedAnalysis: combined,
      monthlySurplus,
    });
  } catch (err) {
    console.error('Goals GET error:', err);
    return NextResponse.json({ error: 'Failed to fetch goals' }, { status: 500 });
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
    const parseResult = CreateGoalSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid goal parameters', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { name, target_amount, saved_amount, target_months } = parseResult.data;

    if (!user) {
      const newGoal: Goal = {
        id: `g-demo-${Date.now()}`,
        user_id: 'demo',
        name,
        target_amount,
        saved_amount,
        target_months,
        created_at: new Date().toISOString(),
      };
      demoGoals.unshift(newGoal);
      return NextResponse.json({ success: true, goal: newGoal });
    }

    const { data, error } = await supabase
      .from('goals')
      .insert({
        user_id: user.id,
        name,
        target_amount,
        saved_amount,
        target_months,
      })
      .select('*')
      .single();

    if (error) {
      console.error('Create goal error:', error);
      return NextResponse.json({ error: 'Failed to create goal' }, { status: 500 });
    }

    return NextResponse.json({ success: true, goal: data });
  } catch (err) {
    console.error('Goals POST error:', err);
    return NextResponse.json({ error: 'Failed to create goal' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
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
    const parseResult = UpdateGoalSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid goal parameters', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { id, name, target_amount, saved_amount, target_months } = parseResult.data;

    if (!user) {
      const idx = demoGoals.findIndex((g) => g.id === id);
      if (idx >= 0) {
        demoGoals[idx] = {
          ...demoGoals[idx],
          name,
          target_amount,
          saved_amount,
          target_months,
        };
        return NextResponse.json({ success: true, goal: demoGoals[idx] });
      }
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('goals')
      .update({
        name,
        target_amount,
        saved_amount,
        target_months,
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select('*')
      .maybeSingle();

    if (error) {
      console.error('Update goal error:', error);
      return NextResponse.json({ error: 'Failed to update goal' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, goal: data });
  } catch (err) {
    console.error('Goals PUT error:', err);
    return NextResponse.json({ error: 'Failed to update goal' }, { status: 500 });
  }
}

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

    const id = request.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Missing goal id' }, { status: 400 });
    }

    if (!user) {
      demoGoals = demoGoals.filter((g) => g.id !== id);
      return NextResponse.json({ success: true });
    }

    const { error } = await supabase
      .from('goals')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Delete goal error:', error);
      return NextResponse.json({ error: 'Failed to delete goal' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Goals DELETE error:', err);
    return NextResponse.json({ error: 'Failed to delete goal' }, { status: 500 });
  }
}
