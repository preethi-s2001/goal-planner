import { Transaction, Goal } from '@/types';
import { MonthEndPredictionResult } from '@/lib/finance/prediction';
import { SpendingAnalysisResult } from '@/lib/finance/analysis';
import { BudgetStatusResult } from '@/lib/finance/budgets';
import { GoalFeasibilityResult, CombinedGoalsResult } from '@/lib/finance/goals';

export interface FinancialContextPayload {
  selectedMonth: string;
  hasData: boolean;
  income: number;
  expenses: number;
  surplus: number;
  savingsRate: number;
  openingBalance: number;
  currentBalance: number;
  predictedMonthEndBalance: number;
  overspendingRisk: string;
  categoryBreakdown: {
    category: string;
    spentThisMonth: number;
    historyMonthlyAverage: number;
    variancePercentage: number;
    isHigherThanHistory: boolean;
  }[];
  budgetAlerts: {
    category: string;
    limit: number;
    spent: number;
    percentUsed: number;
    level: string;
    alertMessage: string | null;
  }[];
  goals: {
    name: string;
    targetAmount: number;
    savedAmount: number;
    remaining: number;
    targetMonths: number;
    monthlyNeeded: number;
    verdict: string;
    shareOfSurplus: number | null;
  }[];
  combinedGoalsExceedsSurplus: boolean;
  combinedGoalsWarning: string | null;
}

export const SYSTEM_FINANCIAL_COACH_PROMPT = `You are a supportive, mathematically precise personal finance coach specifically designed for first-salary earners in India (typically earning ₹25,000 - ₹50,000/month).

CRITICAL DIRECTIVES:
1. STRICTLY BUDGETING ONLY: You provide mathematical budgeting observations, cash-flow projections, category spending comparisons, and goal planning calculations ONLY.
2. ABSOLUTELY NO FINANCIAL OR INVESTMENT ADVICE: NEVER recommend mutual funds, equity stocks, crypto, insurance plans, loans, credit cards, or financial products. If the user asks for investment advice, politely refuse: state that you are a budgeting tool only and advise them to consult a SEBI-registered investment advisor.
3. MANDATORY DISCLAIMER: Every single response must conclude with:
   "Budgeting tool only. Not financial or investment advice."
4. INDIAN CONTEXT: Use Indian Rupee (₹) symbol, Lakhs/Thousands notation where appropriate, and reference typical Indian expenses (Rent, Swiggy/Zomato, UPI commute, BESCOM/electricity, Wi-Fi, Diwali/family gifting).
5. TONE: Empathetic, encouraging, practical, and grounded in the user's real numbers. Never judge past spending; offer realistic, bite-sized adjustments.`;

/**
 * Builds a structured, clean financial context from the analysis, prediction, budgets, and goals data.
 */
export function buildFinancialContext(params: {
  selectedMonth: string;
  analysis?: SpendingAnalysisResult | null;
  prediction?: MonthEndPredictionResult | null;
  budgets?: BudgetStatusResult[] | null;
  goals?: GoalFeasibilityResult[] | null;
  combinedGoals?: CombinedGoalsResult | null;
}): FinancialContextPayload {
  const { selectedMonth, analysis, prediction, budgets, goals, combinedGoals } = params;

  const income = analysis?.totalIncome ?? prediction?.expected_income ?? 0;
  const expenses = analysis?.totalExpenses ?? prediction?.spent_so_far ?? 0;
  const surplus = income - expenses;
  const savingsRate = income > 0 ? Math.round((surplus / income) * 1000) / 10 : 0;

  const categoryBreakdown = (analysis?.categoryBreakdown ?? [])
    .filter((c) => c.category !== 'Income')
    .map((c) => ({
      category: c.category,
      spentThisMonth: c.amount,
      historyMonthlyAverage: c.historyMonthlyAverage,
      variancePercentage: c.diffPercentage ?? 0,
      isHigherThanHistory: c.diffFromAverage > 0,
    }));

  const hasData = income > 0 || expenses > 0 || categoryBreakdown.length > 0;

  const budgetAlerts = (budgets ?? [])
    .filter((b) => b.level !== 'normal')
    .map((b) => ({
      category: b.category,
      limit: b.limit,
      spent: b.spent,
      percentUsed: b.percentage,
      level: b.level,
      alertMessage: b.alertMessage,
    }));

  // Item 18: In the AI context, replace goal names with generic labels (Goal 1, Goal 2)
  const goalItems = (goals ?? []).map((g, index) => ({
    name: `Goal ${index + 1}`,
    targetAmount: g.target_amount,
    savedAmount: g.saved_amount,
    remaining: g.remaining,
    targetMonths: g.target_months,
    monthlyNeeded: g.monthly_needed,
    verdict: g.verdict,
    shareOfSurplus: g.share_of_surplus,
  }));

  return {
    selectedMonth,
    hasData,
    income,
    expenses,
    surplus,
    savingsRate,
    openingBalance: prediction?.opening_balance ?? 0,
    currentBalance: prediction?.current_balance ?? 0,
    predictedMonthEndBalance: prediction?.predicted_month_end_balance ?? 0,
    overspendingRisk: prediction?.overspendingRisk ?? 'on_track',
    categoryBreakdown,
    budgetAlerts,
    goals: goalItems,
    combinedGoalsExceedsSurplus: combinedGoals?.exceedsSurplus ?? false,
    combinedGoalsWarning: combinedGoals?.warningMessage ?? null,
  };
}

/**
 * Creates the review generation prompt for Claude.
 */
export function buildMonthlyReviewPrompt(context: FinancialContextPayload): string {
  if (!context.hasData) {
    return `The user has requested a Monthly Financial Review for ${context.selectedMonth}, but there is not enough transaction or income data recorded for this month yet.

Please generate a clear response structured with the 4 standard markdown headings:
### 1. Executive Summary & Health Status
### 2. Key Spending Observations & Anomalies
### 3. Actionable Trims & Optimizations
### 4. Milestone Forecast & Goal Progress

Explain that there is not enough transaction data recorded for ${context.selectedMonth} to calculate financial performance figures, and encourage the user to add transactions. Do not invent or assume any figures or amounts. End with the mandatory disclaimer:
"Budgeting tool only. Not financial or investment advice."`;
  }

  return `Please generate a comprehensive, highly personalized Monthly Financial Review for ${context.selectedMonth} based strictly on the following verified financial numbers:

${JSON.stringify(context, null, 2)}

Provide the review structured in these 4 distinct sections with markdown headings:

### 1. Executive Summary & Health Status
- State the monthly income (₹), total expenses (₹), net surplus (₹), and savings rate (%).
- Assign a clear Financial Health Status: "Strong & On-Track", "Moderate - Minor Adjustments Needed", or "Action Required - High Cash Burn".
- Give an encouraging 2-sentence summary of where the user stands.

### 2. Key Spending Observations & Anomalies
- Highlight top spending categories and any category that is significantly higher than historical average.
- Call out any category budget alerts (e.g. food, shopping, entertainment).
- Note fixed vs variable cost balance.

### 3. Actionable Trims & Optimizations
- Provide 2-3 specific, bite-sized, realistic adjustments with concrete rupee values (e.g., "Trimming ₹1,200 from dining out...").
- Explain how these trims directly protect the predicted month-end balance.

### 4. Milestone Forecast & Goal Progress
- Review progress on active goals (saved vs target).
- State whether the goals comfortably fit within the monthly surplus.
- Provide a clear recommendation on timeline or prioritization.

Remember: Budgeting mathematics only. No investment or product advice. End with the mandatory disclaimer:
"Budgeting tool only. Not financial or investment advice."`;
}

/**
 * Creates the context-aware prompt for assistant chat questions.
 */
export function buildAssistantChatPrompt(params: {
  userMessage: string;
  context: FinancialContextPayload;
  conversationHistory: { role: 'user' | 'assistant'; content: string }[];
}): { role: 'user' | 'assistant'; content: string }[] {
  const { userMessage, context, conversationHistory } = params;

  const messages: { role: 'user' | 'assistant'; content: string }[] = [];

  // Provide initial context injection as the first exchange if history is empty
  const contextMessage = `Here is my current verified financial context for ${context.selectedMonth}:
- Monthly Income: ₹${context.income.toLocaleString('en-IN')}
- Total Expenses: ₹${context.expenses.toLocaleString('en-IN')}
- Estimated Monthly Surplus: ₹${context.surplus.toLocaleString('en-IN')} (${context.savingsRate}% savings rate)
- Current Bank Cash Balance: ₹${context.currentBalance.toLocaleString('en-IN')}
- Predicted Month-End Balance: ₹${context.predictedMonthEndBalance.toLocaleString('en-IN')} (Risk status: ${context.overspendingRisk})
- Category Spending: ${context.categoryBreakdown.map((c) => `${c.category}: ₹${c.spentThisMonth.toLocaleString('en-IN')}${c.variancePercentage ? ` (${c.variancePercentage > 0 ? '+' : ''}${c.variancePercentage}% vs history)` : ''}`).join(', ')}
- Budget Alerts: ${context.budgetAlerts.length > 0 ? context.budgetAlerts.map((a) => `${a.category} (${a.percentUsed}% used: ${a.alertMessage})`).join('; ') : 'All categories within limits'}
- Active Goals: ${context.goals.length > 0 ? context.goals.map((g) => `${g.name}: Target ₹${g.targetAmount.toLocaleString('en-IN')}, Remaining ₹${g.remaining.toLocaleString('en-IN')}, Monthly Needed ₹${g.monthlyNeeded.toLocaleString('en-IN')}/mo (${g.verdict})`).join('; ') : 'No goals registered'}`;

  // Add conversation history
  if (conversationHistory.length === 0) {
    messages.push({
      role: 'user',
      content: `${contextMessage}\n\nMy Question: ${userMessage}`,
    });
  } else {
    // Add context as system reminder in first user turn
    const firstMsg = conversationHistory[0];
    messages.push({
      role: firstMsg.role,
      content: `${contextMessage}\n\n${firstMsg.content}`,
    });

    for (let i = 1; i < conversationHistory.length; i++) {
      messages.push(conversationHistory[i]);
    }

    messages.push({
      role: 'user',
      content: userMessage,
    });
  }

  return messages;
}
