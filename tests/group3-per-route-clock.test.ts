import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Create a fluent chainable mock for Supabase queries
function createQueryChain() {
  const chain: any = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    gte: vi.fn(() => chain),
    lte: vi.fn(() => chain),
    order: vi.fn(() => chain),
    range: vi.fn(() => Promise.resolve({ data: [], error: null })),
    limit: vi.fn(() => chain),
    maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
    single: vi.fn(() => Promise.resolve({ data: null, error: null })),
    upsert: vi.fn(() => Promise.resolve({ data: null, error: null })),
    insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
    then: (resolve: any) => resolve({ data: [], error: null }),
  };
  return chain;
}

// Mock Supabase server client so route handlers can run safely in test environment
vi.mock('@/lib/supabase/server', () => {
  return {
    isSupabaseConfigured: () => false,
    createClient: () => ({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'test-user-123', email: 'test@example.com' } },
          error: null,
        }),
      },
      from: vi.fn(() => createQueryChain()),
      rpc: vi.fn().mockResolvedValue({
        data: [{ allowed: true, remaining: 5 }],
        error: null,
      }),
    }),
  };
});

// Import route handlers
import { GET as getDashboard } from '@/app/api/finance/dashboard/route';
import { GET as getBudgets } from '@/app/api/budgets/route';
import { GET as getGoals } from '@/app/api/goals/route';
import { GET as getReview, POST as postReview } from '@/app/api/ai/review/route';
import { POST as postChat } from '@/app/api/ai/chat/route';

describe('Per-route local clock tests: today=2026-11-01 treated as November when server clock is 2026-10-31', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Simulate server clock in UTC on 31 Oct (e.g. 20:00 UTC)
    vi.setSystemTime(new Date('2026-10-31T20:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('1. /api/finance/dashboard (GET): treats today=2026-11-01 as November', async () => {
    const req = new NextRequest('http://localhost:3000/api/finance/dashboard?today=2026-11-01');
    const res = await getDashboard(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.currentMonth).toBe('2026-11');
    expect(json.today).toBe('2026-11-01');
  });

  it('2. /api/budgets (GET): treats today=2026-11-01 as November', async () => {
    const req = new NextRequest('http://localhost:3000/api/budgets?today=2026-11-01');
    const res = await getBudgets(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.currentMonth).toBe('2026-11');
  });

  it('3. /api/goals (GET): treats today=2026-11-01 as November', async () => {
    const req = new NextRequest('http://localhost:3000/api/goals?today=2026-11-01');
    const res = await getGoals(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.currentMonth).toBe('2026-11');
    expect(json.today).toBe('2026-11-01');
  });

  it('4. /api/ai/review (GET): treats today=2026-11-01 as November', async () => {
    const req = new NextRequest('http://localhost:3000/api/ai/review?today=2026-11-01');
    const res = await getReview(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.month).toBe('2026-11');
  });

  it('5. /api/ai/review (POST): treats today=2026-11-01 as November', async () => {
    const req = new NextRequest('http://localhost:3000/api/ai/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ today: '2026-11-01' }),
    });
    const res = await postReview(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.month).toBe('2026-11');
  });

  it('6. /api/ai/chat (POST): treats today=2026-11-01 as November', async () => {
    const req = new NextRequest('http://localhost:3000/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Can I afford a phone for 15000?',
        today: '2026-11-01',
      }),
    });
    const res = await postChat(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.month).toBe('2026-11');
  });
});
