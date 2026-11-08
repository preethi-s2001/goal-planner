import { describe, it, expect } from 'vitest';
import {
  buildFinancialContext,
  buildMonthlyReviewPrompt,
  buildAssistantChatPrompt,
  SYSTEM_FINANCIAL_COACH_PROMPT,
} from '@/lib/ai/prompts';
import {
  generateLocalFallbackResponse,
  isAnthropicConfigured,
} from '@/lib/ai/anthropic';

describe('Phase 6: AI Financial Review & Coach Prompt Engineering', () => {
  it('correctly calculates income, expenses, surplus, and savings rate in financial context', () => {
    const context = buildFinancialContext({
      selectedMonth: '2026-11',
      analysis: {
        currentMonth: '2026-11',
        totalIncome: 40000,
        totalExpenses: 28000,
        netSavings: 12000,
        savingsRate: 30,
        categoryBreakdown: [
          { category: 'Rent', amount: 10000, percentage: 35.7, isFixed: true, historyMonthlyAverage: 10000, diffFromAverage: 0, diffPercentage: 0 },
          { category: 'Food', amount: 6000, percentage: 21.4, isFixed: false, historyMonthlyAverage: 5000, diffFromAverage: 1000, diffPercentage: 20 },
        ],
        fixedVariableSplit: {
          totalFixed: 10000,
          fixedPercentage: 35.7,
          totalVariable: 18000,
          variablePercentage: 64.3,
          totalExpenses: 28000,
        },
        monthlyTrends: [],
        financialHealth: {
          savingsRate: 30,
          status: 'Healthy',
          description: 'Strong savings margin',
          averageMonthlyIncome: 40000,
          averageMonthlyExpenses: 28000,
          averageMonthlySurplus: 12000,
        },
      },
      prediction: {
        status: 'predicted',
        opening_balance: 5000,
        income_so_far: 40000,
        spent_so_far: 28000,
        current_balance: 17000,
        historyMonthsCount: 2,
        historyMonths: ['2026-09', '2026-10'],
        unpaid_fixed: 0,
        unpaid_fixed_breakdown: [],
        daily_variable_rate: 500,
        total_variable_history: 30000,
        total_history_days: 60,
        days_left: 23,
        days_in_month: 30,
        current_day: 7,
        expected_variable: 11500,
        expected_income: 40000,
        average_monthly_income_history: 40000,
        predicted_month_end_balance: 5500,
        predicted_savings: 500,
        overspendingRisk: 'on_track',
        explanation: { formula: '', steps: [] },
      },
      budgets: [
        {
          category: 'Food',
          limit: 5000,
          spent: 6000,
          percentage: 120,
          remaining: 0,
          isOverBudget: true,
          isFixed: false,
          level: 'exceeded',
          alertMessage: 'Budget exceeded by ₹1,000',
          projectedPace: null,
        },
      ],
      goals: [
        {
          id: 'g-1',
          name: 'Emergency Fund',
          target_amount: 50000,
          saved_amount: 20000,
          remaining: 30000,
          target_months: 6,
          monthly_needed: 5000,
          share_of_surplus: 41.7,
          verdict: 'Comfortable',
          months_at_full_surplus: 3,
          isAchieved: false,
          progressPercentage: 40,
        },
      ],
    });

    expect(context.income).toBe(40000);
    expect(context.expenses).toBe(28000);
    expect(context.surplus).toBe(12000);
    expect(context.savingsRate).toBe(30);
    expect(context.categoryBreakdown).toHaveLength(2);
    expect(context.budgetAlerts).toHaveLength(1);
    expect(context.budgetAlerts[0].category).toBe('Food');
    expect(context.goals[0].name).toBe('Goal 1');
  });

  it('handles zero income safely without throwing division by zero', () => {
    const context = buildFinancialContext({
      selectedMonth: '2026-11',
      analysis: {
        currentMonth: '2026-11',
        totalIncome: 0,
        totalExpenses: 5000,
        netSavings: -5000,
        savingsRate: 0,
        categoryBreakdown: [],
        fixedVariableSplit: {
          totalFixed: 5000,
          fixedPercentage: 100,
          totalVariable: 0,
          variablePercentage: 0,
          totalExpenses: 5000,
        },
        monthlyTrends: [],
        financialHealth: {
          savingsRate: 0,
          status: 'Needs attention',
          description: 'Expenses exceed income',
          averageMonthlyIncome: 0,
          averageMonthlyExpenses: 5000,
          averageMonthlySurplus: -5000,
        },
      },
    });

    expect(context.income).toBe(0);
    expect(context.savingsRate).toBe(0);
    expect(context.surplus).toBe(-5000);
  });

  it('builds review prompt containing the 4 required structured sections and disclaimer', () => {
    const context = buildFinancialContext({ selectedMonth: '2026-11' });
    const prompt = buildMonthlyReviewPrompt(context);

    expect(prompt).toContain('### 1. Executive Summary & Health Status');
    expect(prompt).toContain('### 2. Key Spending Observations & Anomalies');
    expect(prompt).toContain('### 3. Actionable Trims & Optimizations');
    expect(prompt).toContain('### 4. Milestone Forecast & Goal Progress');
    expect(prompt).toContain('Budgeting tool only. Not financial or investment advice.');
  });

  it('system prompt strictly forbids financial and investment advice', () => {
    expect(SYSTEM_FINANCIAL_COACH_PROMPT).toContain('STRICTLY BUDGETING ONLY');
    expect(SYSTEM_FINANCIAL_COACH_PROMPT).toContain('ABSOLUTELY NO FINANCIAL OR INVESTMENT ADVICE');
    expect(SYSTEM_FINANCIAL_COACH_PROMPT).toContain('Budgeting tool only. Not financial or investment advice.');
  });

  it('assistant chat prompt injects verified context into the first message', () => {
    const context = buildFinancialContext({ selectedMonth: '2026-11' });
    const messages = buildAssistantChatPrompt({
      userMessage: 'Can I afford a ₹15,000 phone?',
      context,
      conversationHistory: [],
    });

    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe('user');
    expect(messages[0].content).toContain('Here is my current verified financial context');
    expect(messages[0].content).toContain('Can I afford a ₹15,000 phone?');
  });

  it('deterministic review generator formats structured review with disclaimer', () => {
    const mockPrompt = `Please generate a comprehensive, highly personalized Monthly Financial Review:
    {"income": 35000, "expenses": 25000, "surplus": 10000, "savingsRate": 28.6, "selectedMonth": "2026-11"}`;

    const review = generateLocalFallbackResponse([{ role: 'user', content: mockPrompt }]);

    expect(review).toContain('### 1. Executive Summary & Health Status');
    expect(review).toContain('### 2. Key Spending Observations & Anomalies');
    expect(review).toContain('### 3. Actionable Trims & Optimizations');
    expect(review).toContain('### 4. Milestone Forecast & Goal Progress');
    expect(review).toContain('Budgeting tool only. Not financial or investment advice.');
  });

  it('refuses investment queries (stocks, crypto, mutual funds) with SEBI RIA recommendation', () => {
    const queries = [
      'Which stocks should I buy with my ₹10,000 surplus?',
      'Can you recommend a good mutual fund or SIP?',
      'Should I invest in crypto or share market?',
    ];

    for (const q of queries) {
      const reply = generateLocalFallbackResponse([{ role: 'user', content: q }]);
      expect(reply.toLowerCase()).toContain('cannot recommend');
      expect(reply).toContain('SEBI-registered');
      expect(reply).toContain('Budgeting tool only. Not financial or investment advice.');
    }
  });

  it('handles affordability queries with cash flow impact calculations', () => {
    const reply = generateLocalFallbackResponse([{ role: 'user', content: 'Can I afford a ₹12,000 laptop purchase?' }]);
    expect(reply).toContain('Affordability Analysis');
    expect(reply).toContain('₹12,000');
    expect(reply).toContain('Budgeting tool only. Not financial or investment advice.');
  });
});
