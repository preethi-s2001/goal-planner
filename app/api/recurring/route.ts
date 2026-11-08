import { NextRequest, NextResponse } from 'next/server';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { z } from 'zod';
import { RecurringItem } from '@/types';

const createRecurringSchema = z.object({
  description: z.string().min(1, 'Description is required').max(200, 'Description too long'),
  amount: z.number().positive('Amount must be greater than zero'),
  type: z.enum(['income', 'expense']),
  category: z.string().min(1, 'Category is required').max(50),
  day_of_month: z.number().int().min(1, 'Day must be between 1 and 31').max(31, 'Day must be between 1 and 31'),
  active: z.boolean().default(true),
});

const updateRecurringSchema = z.object({
  id: z.string().min(1, 'Item ID is required'),
  description: z.string().min(1).max(200).optional(),
  amount: z.number().positive('Amount must be positive').optional(),
  type: z.enum(['income', 'expense']).optional(),
  category: z.string().min(1).max(50).optional(),
  day_of_month: z.number().int().min(1).max(31).optional(),
  active: z.boolean().optional(),
});

let demoRecurring: RecurringItem[] = [
  {
    id: 'rec-1',
    user_id: 'demo-user',
    description: 'Monthly Salary',
    amount: 35000,
    type: 'income',
    category: 'Income',
    day_of_month: 1,
    active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'rec-2',
    user_id: 'demo-user',
    description: 'Apartment Rent',
    amount: 8000,
    type: 'expense',
    category: 'Rent',
    day_of_month: 2,
    active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'rec-3',
    user_id: 'demo-user',
    description: 'Wifi Broadband',
    amount: 999,
    type: 'expense',
    category: 'Bills',
    day_of_month: 10,
    active: true,
    created_at: new Date().toISOString(),
  },
];

export async function GET() {
  const configured = isSupabaseConfigured();
  const isDev = process.env.NODE_ENV === 'development';

  if (!configured && !isDev) {
    return NextResponse.json(
      { error: 'Service Unavailable: Database configuration missing' },
      { status: 503 }
    );
  }

  if (configured) {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const { data, error } = await supabase
        .from('recurring_items')
        .select('*')
        .order('day_of_month', { ascending: true });

      if (error) {
        return NextResponse.json(
          { error: 'Failed to retrieve recurring items' },
          { status: 500 }
        );
      }

      return NextResponse.json({ items: data || [] });
    } catch {
      return NextResponse.json(
        { error: 'An unexpected error occurred while fetching recurring items' },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ items: demoRecurring });
}

export async function POST(request: NextRequest) {
  const configured = isSupabaseConfigured();
  const isDev = process.env.NODE_ENV === 'development';

  if (!configured && !isDev) {
    return NextResponse.json(
      { error: 'Service Unavailable: Database configuration missing' },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const parsed = createRecurringSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || 'Invalid recurring item input' },
        { status: 400 }
      );
    }

    const { description, amount, type, category, day_of_month, active } = parsed.data;

    if (configured) {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const { data, error } = await supabase
        .from('recurring_items')
        .insert({
          user_id: user.id,
          description: description.trim(),
          amount,
          type,
          category,
          day_of_month,
          active,
        })
        .select()
        .single();

      if (error) {
        return NextResponse.json(
          { error: 'Failed to save recurring item' },
          { status: 500 }
        );
      }

      return NextResponse.json({ item: data }, { status: 201 });
    }

    // Demo mode
    const newItem: RecurringItem = {
      id: 'rec-' + Date.now(),
      user_id: 'demo-user',
      description: description.trim(),
      amount,
      type,
      category,
      day_of_month,
      active,
      created_at: new Date().toISOString(),
    };
    demoRecurring.push(newItem);
    return NextResponse.json({ item: newItem }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: 'An error occurred while creating the recurring item' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const configured = isSupabaseConfigured();
  const isDev = process.env.NODE_ENV === 'development';

  if (!configured && !isDev) {
    return NextResponse.json(
      { error: 'Service Unavailable: Database configuration missing' },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const parsed = updateRecurringSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || 'Invalid recurring update input' },
        { status: 400 }
      );
    }

    const { id, active, amount, description, type, category, day_of_month } = parsed.data;

    if (configured) {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const updates: any = {};
      if (typeof active === 'boolean') updates.active = active;
      if (typeof amount === 'number') updates.amount = amount;
      if (description) updates.description = description.trim();
      if (type) updates.type = type;
      if (category) updates.category = category;
      if (typeof day_of_month === 'number') updates.day_of_month = day_of_month;

      const { data, error } = await supabase
        .from('recurring_items')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .maybeSingle();

      if (error) {
        return NextResponse.json(
          { error: 'Failed to update recurring item' },
          { status: 500 }
        );
      }

      // Issue 6: Return 404 when matching row not found
      if (!data) {
        return NextResponse.json(
          { error: 'Recurring item not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ item: data });
    }

    // Demo mode
    const item = demoRecurring.find((r) => r.id === id);
    if (!item) {
      return NextResponse.json({ error: 'Recurring item not found' }, { status: 404 });
    }
    if (typeof active === 'boolean') item.active = active;
    if (typeof amount === 'number') item.amount = amount;
    if (description) item.description = description.trim();
    if (type) item.type = type;
    if (category) item.category = category;
    if (typeof day_of_month === 'number') item.day_of_month = day_of_month;
    return NextResponse.json({ item });
  } catch {
    return NextResponse.json(
      { error: 'An error occurred while updating the recurring item' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const configured = isSupabaseConfigured();
  const isDev = process.env.NODE_ENV === 'development';

  if (!configured && !isDev) {
    return NextResponse.json(
      { error: 'Service Unavailable: Database configuration missing' },
      { status: 503 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing item ID' }, { status: 400 });
    }

    if (configured) {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const { data, error } = await supabase
        .from('recurring_items')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)
        .select();

      if (error) {
        return NextResponse.json(
          { error: 'Failed to delete recurring item' },
          { status: 500 }
        );
      }

      // Issue 6: Return 404 if no row deleted
      if (!data || data.length === 0) {
        return NextResponse.json(
          { error: 'Recurring item not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true });
    }

    // Demo mode
    const itemIndex = demoRecurring.findIndex((r) => r.id === id);
    if (itemIndex === -1) {
      return NextResponse.json({ error: 'Recurring item not found' }, { status: 404 });
    }
    demoRecurring.splice(itemIndex, 1);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: 'An error occurred while deleting the recurring item' },
      { status: 500 }
    );
  }
}
