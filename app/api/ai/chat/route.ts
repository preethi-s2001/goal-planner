import { NextRequest, NextResponse } from 'next/server';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { calculateMonthEndPrediction, parseDateParts } from '@/lib/finance/prediction';
import { calculateSpendingAnalysis } from '@/lib/finance/analysis';
import { calculateBudgetStatus } from '@/lib/finance/budgets';
import {
  calculateCombinedGoalsFeasibility,
  calculateAverageMonthlySurplus,
} from '@/lib/finance/goals';
import { fetchAllUserTransactions } from '@/lib/finance/transactions';
import { resolveOpeningBalance } from '@/lib/finance/monthly-balance';
import { buildFinancialContext, buildAssistantChatPrompt } from '@/lib/ai/prompts';
import { callClaudeApi, isAnthropicConfigured, AnthropicMessage } from '@/lib/ai/anthropic';
import { checkAndRecordAiUsage } from '@/lib/ai/rate-limit';
import { Transaction, Budget, Goal } from '@/types';
import { z } from 'zod';

function isDemoMode() {
  return (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') && !isSupabaseConfigured();
}

const ChatPayloadSchema = z.object({
  message: z.string().min(1, 'Message is required').max(1000, 'Message too long'),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Invalid month format (YYYY-MM)').optional(),
  today: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, 'Invalid date format (YYYY-MM-DD)').optional(),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(4000),
      })
    )
    .max(20)
    .optional(),
});

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured() && !isDemoMode()) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const parseResult = ChatPayloadSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid chat parameters', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { message, month, today: inputToday, history = [] } = parseResult.data;

    const now = new Date();
    const today = inputToday ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const selectedMonth = month ?? today.slice(0, 7);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user && !isDemoMode()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user?.id ?? 'demo-user';

    // Enforce shared daily AI generation rate limit (5 per day)
    const usageCheck = await checkAndRecordAiUsage(supabase, userId, 'chat');
    if (usageCheck.serviceError) {
      return NextResponse.json(
        { error: 'Service Unavailable: Rate limiter service failed' },
        { status: 503 }
      );
    }
    if (!usageCheck.allowed) {
      return NextResponse.json(
        { error: 'Daily AI limit reached (5 generations per day). Please try again tomorrow.' },
        { status: 429 }
      );
    }

    let transactions: Transaction[] = [];
    let budgets: Budget[] = [];
    let goals: Goal[] = [];
    let openingBalance = 0;

    if (user) {
      // Item 17: Paged fetching of transactions
      transactions = await fetchAllUserTransactions(supabase, user.id);

      const [bRes, gRes] = await Promise.all([
        supabase.from('budgets').select('*').eq('user_id', user.id),
        supabase.from('goals').select('*').eq('user_id', user.id),
      ]);

      budgets = (bRes.data as Budget[]) ?? [];
      goals = (gRes.data as Goal[]) ?? [];

      // Item 14: Default opening balance to previous month's closing balance if no monthly_settings row exists
      const resolved = await resolveOpeningBalance({
        supabase,
        userId: user.id,
        selectedMonth,
        allTransactions: transactions,
      });
      openingBalance = resolved.openingBalance;
    } else {
      transactions = [
        { id: 'd-1', user_id: 'demo', date: `${selectedMonth}-01`, description: 'Salary Credit', amount: 35000, type: 'income', category: 'Income', source: 'manual', created_at: '' },
        { id: 'd-2', user_id: 'demo', date: `${selectedMonth}-05`, description: 'House Rent', amount: 8000, type: 'expense', category: 'Rent', source: 'manual', created_at: '' },
        { id: 'd-3', user_id: 'demo', date: `${selectedMonth}-08`, description: 'Electricity & Wifi', amount: 2200, type: 'expense', category: 'Bills', source: 'manual', created_at: '' },
        { id: 'd-4', user_id: 'demo', date: `${selectedMonth}-12`, description: 'Groceries Store', amount: 4800, type: 'expense', category: 'Food', source: 'manual', created_at: '' },
        { id: 'd-5', user_id: 'demo', date: `${selectedMonth}-16`, description: 'Cab & Metro Commute', amount: 2800, type: 'expense', category: 'Transport', source: 'manual', created_at: '' },
        { id: 'd-6', user_id: 'demo', date: `${selectedMonth}-20`, description: 'Amazon Shopping', amount: 3500, type: 'expense', category: 'Shopping', source: 'manual', created_at: '' },
      ];
      budgets = [
        { id: 'b-1', user_id: 'demo', category: 'Food', monthly_limit: 5000, created_at: '' },
        { id: 'b-2', user_id: 'demo', category: 'Shopping', monthly_limit: 4000, created_at: '' },
      ];
      goals = [
        { id: 'g-1', user_id: 'demo', name: 'Emergency Fund', target_amount: 50000, saved_amount: 15000, target_months: 6, created_at: '' },
      ];
    }

    // Calculations (Item 10: pass client today)
    const prediction = calculateMonthEndPrediction({
      transactions,
      currentMonth: selectedMonth,
      today,
      openingBalance,
    });

    const analysis = calculateSpendingAnalysis({
      transactions,
      selectedMonth,
    });

    const spentByCategory: Record<string, number> = {};
    for (const t of transactions) {
      const { monthStr } = parseDateParts(t.date);
      if (monthStr === selectedMonth && t.type === 'expense') {
        spentByCategory[t.category] = (spentByCategory[t.category] ?? 0) + Number(t.amount);
      }
    }

    const evaluatedBudgets = budgets.map((b) => {
      const spent = spentByCategory[b.category] ?? 0;
      return calculateBudgetStatus({
        category: b.category,
        limit: Number(b.monthly_limit),
        spent,
      });
    });

    const monthlySurplus = user
      ? calculateAverageMonthlySurplus(transactions, selectedMonth)
      : 12000;
    const combinedGoals = calculateCombinedGoalsFeasibility({
      goals,
      monthlySurplus,
    });

    const context = buildFinancialContext({
      selectedMonth,
      analysis,
      prediction,
      budgets: evaluatedBudgets,
      goals: combinedGoals.goals,
      combinedGoals,
    });

    const messages = buildAssistantChatPrompt({
      userMessage: message,
      context,
      conversationHistory: history as AnthropicMessage[],
    });

    const response = await callClaudeApi({
      messages,
      maxTokens: 1200,
    });

    return NextResponse.json({
      month: selectedMonth,
      today,
      reply: response.text,
      source: response.source,
      hasAnthropicKey: isAnthropicConfigured(),
    });
  } catch (err) {
    console.error('Chat POST error:', err);
    return NextResponse.json({ error: 'Failed to process chat query' }, { status: 500 });
  }
}
