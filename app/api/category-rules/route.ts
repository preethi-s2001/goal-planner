import { NextRequest, NextResponse } from 'next/server';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { z } from 'zod';

const ruleSchema = z.object({
  keyword: z.string().min(1, 'Keyword is required').max(100, 'Keyword too long'),
  category: z.string().min(1, 'Category is required').max(50),
});

let demoRules = [
  { id: 'rule-1', user_id: 'demo-user', keyword: 'swiggy', category: 'Food', created_at: new Date().toISOString() },
  { id: 'rule-2', user_id: 'demo-user', keyword: 'uber', category: 'Transport', created_at: new Date().toISOString() },
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
        .from('category_rules')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        return NextResponse.json(
          { error: 'Failed to retrieve categorization rules' },
          { status: 500 }
        );
      }

      return NextResponse.json({ rules: data || [] });
    } catch {
      return NextResponse.json(
        { error: 'An unexpected error occurred while fetching rules' },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ rules: demoRules });
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
    const parsed = ruleSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || 'Invalid rule input' },
        { status: 400 }
      );
    }

    const keyword = parsed.data.keyword.trim().toLowerCase();
    const category = parsed.data.category.trim();

    if (configured) {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const { data, error } = await supabase
        .from('category_rules')
        .upsert(
          {
            user_id: user.id,
            keyword,
            category,
          },
          { onConflict: 'user_id,keyword' }
        )
        .select()
        .single();

      if (error) {
        return NextResponse.json(
          { error: 'Failed to save categorization rule' },
          { status: 500 }
        );
      }

      return NextResponse.json({ rule: data }, { status: 201 });
    }

    // Demo mode
    const existingIndex = demoRules.findIndex((r) => r.keyword === keyword);
    if (existingIndex >= 0) {
      demoRules[existingIndex].category = category;
      return NextResponse.json({ rule: demoRules[existingIndex] });
    }
    const newRule = {
      id: 'rule-' + Date.now(),
      user_id: 'demo-user',
      keyword,
      category,
      created_at: new Date().toISOString(),
    };
    demoRules.unshift(newRule);
    return NextResponse.json({ rule: newRule }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: 'An unexpected error occurred while saving the rule' },
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
    const keyword = searchParams.get('keyword');

    if (!id && !keyword) {
      return NextResponse.json({ error: 'Missing rule ID or keyword' }, { status: 400 });
    }

    if (configured) {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      let query = supabase.from('category_rules').delete().eq('user_id', user.id);
      if (id) query = query.eq('id', id);
      if (keyword) query = query.eq('keyword', keyword.toLowerCase());

      const { data, error } = await query.select();
      if (error) {
        return NextResponse.json(
          { error: 'Failed to delete categorization rule' },
          { status: 500 }
        );
      }

      // Issue 6: Return 404 if no row matched
      if (!data || data.length === 0) {
        return NextResponse.json(
          { error: 'Categorization rule not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true });
    }

    // Demo mode
    const prevCount = demoRules.length;
    if (id) {
      demoRules = demoRules.filter((r) => r.id !== id);
    } else if (keyword) {
      demoRules = demoRules.filter((r) => r.keyword !== keyword.toLowerCase());
    }
    if (demoRules.length === prevCount) {
      return NextResponse.json({ error: 'Categorization rule not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: 'An unexpected error occurred while deleting the rule' },
      { status: 500 }
    );
  }
}
