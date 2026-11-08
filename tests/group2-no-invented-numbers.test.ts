import { describe, it, expect } from 'vitest';
import {
  generateLocalFallbackResponse,
  parseQueryAmount,
} from '@/lib/ai/anthropic';
import {
  buildFinancialContext,
  buildMonthlyReviewPrompt,
} from '@/lib/ai/prompts';
import {
  calculateAverageMonthlySurplus,
  calculateGoalFeasibility,
  calculateCombinedGoalsFeasibility,
} from '@/lib/finance/goals';
import { Goal } from '@/types';

describe('Group 2 & 2b - Never Invent Numbers', () => {
  describe('Item 2b-2: Investment Guardrail & negative lookahead', () => {
    it('refuses mutual funds with SEBI disclaimer', () => {
      const reply = generateLocalFallbackResponse([
        { role: 'user', content: 'Should I invest in mutual funds or SIP?' },
      ]);
      expect(reply).toContain('strictly a mathematical budgeting');
      expect(reply).toContain('SEBI-registered investment advisor');
      expect(reply).toContain('Budgeting tool only. Not financial or investment advice.');
    });

    it('refuses stocks and crypto investment questions', () => {
      const reply = generateLocalFallbackResponse([
        { role: 'user', content: 'What stocks or crypto should I buy with my extra cash?' },
      ]);
      expect(reply).toContain('cannot recommend stocks, mutual funds, crypto');
      expect(reply).toContain('SEBI-registered investment advisor');
    });

    it('refuses SIP queries with whole word match', () => {
      const reply = generateLocalFallbackResponse([
        { role: 'user', content: 'Can you recommend a good sip for 5000 a month?' },
      ]);
      expect(reply).toContain('cannot recommend stocks, mutual funds, crypto, SIPs');
    });

    it('does NOT refuse "stock up on groceries" or "stocking up"', () => {
      const reply = generateLocalFallbackResponse([
        { role: 'user', content: 'Can I afford to stock up on groceries for ₹4,000 this weekend?' },
      ]);
      // Should NOT be refused as investment advice
      expect(reply).not.toContain('SEBI-registered investment advisor');
      expect(reply).not.toContain('cannot recommend stocks');
      expect(reply).toContain('Affordability Analysis for a ₹4,000 Expense');
    });

    it('refuses "stock up on tea and also buy mutual funds"', () => {
      const reply = generateLocalFallbackResponse([
        { role: 'user', content: 'Can I stock up on tea and also buy mutual funds?' },
      ]);
      // Must be refused because of mutual funds even though "stock up" is present
      expect(reply).toContain('cannot recommend stocks, mutual funds, crypto');
      expect(reply).toContain('SEBI-registered investment advisor');
    });
  });

  describe('Item 2b-1 & Item 8: Amount parsing shorthand and NaN bug fix', () => {
    it('parses "60k" as 60000', () => {
      const parsed = parseQueryAmount('Can I afford 60k for a scooter?');
      expect(parsed.amount).toBe(60000);
      expect(parsed.needsClarification).toBe(false);
    });

    it('parses "60 k" as 60000', () => {
      const parsed = parseQueryAmount('Can I afford 60 k for a scooter?');
      expect(parsed.amount).toBe(60000);
      expect(parsed.needsClarification).toBe(false);
    });

    it('parses "1.5 lakh" as 150000', () => {
      const parsed = parseQueryAmount('Can I buy a laptop for 1.5 lakh?');
      expect(parsed.amount).toBe(150000);
      expect(parsed.needsClarification).toBe(false);
    });

    it('parses "1.5 lac" as 150000', () => {
      const parsed = parseQueryAmount('Can I buy a bike for 1.5 lac?');
      expect(parsed.amount).toBe(150000);
      expect(parsed.needsClarification).toBe(false);
    });

    it('parses "2 L" as 200000', () => {
      const parsed = parseQueryAmount('Can I afford 2 L for a course?');
      expect(parsed.amount).toBe(200000);
      expect(parsed.needsClarification).toBe(false);
    });

    it('parses "1 crore" as 10000000', () => {
      const parsed = parseQueryAmount('Can I afford 1 crore for a house?');
      expect(parsed.amount).toBe(10000000);
      expect(parsed.needsClarification).toBe(false);
    });

    it('parses "1,50,000" as 150000', () => {
      const parsed = parseQueryAmount('Can I buy a phone for 1,50,000?');
      expect(parsed.amount).toBe(150000);
      expect(parsed.needsClarification).toBe(false);
    });

    it('parses "₹15,000" as 15000', () => {
      const parsed = parseQueryAmount('Can I afford ₹15,000 this month?');
      expect(parsed.amount).toBe(15000);
      expect(parsed.needsClarification).toBe(false);
    });

    it('asks user when no number is given', () => {
      const parsed = parseQueryAmount('Can I afford a new phone?');
      expect(parsed.amount).toBeNull();
      expect(parsed.needsClarification).toBe(false);

      const reply = generateLocalFallbackResponse([
        { role: 'user', content: 'Can I afford a new phone?' },
      ]);
      expect(reply).not.toContain('₹NaN');
      expect(reply).toContain('Could you please specify the amount');
    });

    it('picks the purchase amount when salary is also mentioned: "my salary is 35000, can I afford a bike for 60000?" -> 60000', () => {
      const parsed = parseQueryAmount('my salary is 35000, can I afford a bike for 60000?');
      expect(parsed.amount).toBe(60000);
      expect(parsed.needsClarification).toBe(false);

      const reply = generateLocalFallbackResponse([
        { role: 'user', content: 'my salary is 35000, can I afford a bike for 60000?' },
      ]);
      expect(reply).toContain('Affordability Analysis for a ₹60,000 Expense');
    });

    it('picks purchase price shorthand over income: "I earn 35k, can I buy a laptop for 1.5 lakh?" -> 150000', () => {
      const parsed = parseQueryAmount('I earn 35k, can I buy a laptop for 1.5 lakh?');
      expect(parsed.amount).toBe(150000);
      expect(parsed.needsClarification).toBe(false);

      const reply = generateLocalFallbackResponse([
        { role: 'user', content: 'I earn 35k, can I buy a laptop for 1.5 lakh?' },
      ]);
      expect(reply).toContain('Affordability Analysis for a ₹1,50,000 Expense');
    });

    it('combines compound amounts: "5 lakh and 20 thousand" -> 520000', () => {
      const parsed = parseQueryAmount('Can I afford 5 lakh and 20 thousand for wedding shopping?');
      expect(parsed.amount).toBe(520000);
      expect(parsed.needsClarification).toBe(false);

      const reply = generateLocalFallbackResponse([
        { role: 'user', content: 'Can I afford 5 lakh and 20 thousand for wedding shopping?' },
      ]);
      expect(reply).toContain('Affordability Analysis for a ₹5,20,000 Expense');
    });

    it('asks user in ambiguous multiple amount cases', () => {
      const parsed = parseQueryAmount('Can I spend 50000 or 70000?');
      expect(parsed.amount).toBeNull();
      expect(parsed.needsClarification).toBe(true);

      const reply = generateLocalFallbackResponse([
        { role: 'user', content: 'Can I spend 50000 or 70000?' },
      ]);
      expect(reply).toContain('Could you please specify the amount');
    });
  });

  describe('Items 5 & 7: Offline Summary Adapts to Real Data and Never Invents Figures', () => {
    it('reports "Not Enough Data" and never invents figures for month with no data', () => {
      const context = buildFinancialContext({
        selectedMonth: '2026-11',
        analysis: null,
        prediction: null,
        budgets: null,
        goals: null,
      });

      expect(context.hasData).toBe(false);

      const prompt = buildMonthlyReviewPrompt(context);
      const reply = generateLocalFallbackResponse([{ role: 'user', content: prompt }]);

      expect(reply).toContain('Not Enough Data');
      expect(reply).toContain('There are no recorded transactions or income entries');
      expect(reply).not.toContain('₹35,000');
      expect(reply).not.toContain('₹26,000');
      expect(reply).not.toContain('₹10,000');
      expect(reply).not.toContain('₹12,000');
    });

    it('never says "stable" when user has a negative savings rate / deficit spending', () => {
      const context = buildFinancialContext({
        selectedMonth: '2026-11',
        analysis: {
          currentMonth: '2026-11',
          totalIncome: 20000,
          totalExpenses: 28000,
          netSavings: -8000,
          savingsRate: -40,
          categoryBreakdown: [
            { category: 'Food', amount: 15000, percentage: 53.6, isFixed: false, historyMonthlyAverage: 8000, diffFromAverage: 7000, diffPercentage: 87.5 },
            { category: 'Shopping', amount: 13000, percentage: 46.4, isFixed: false, historyMonthlyAverage: 5000, diffFromAverage: 8000, diffPercentage: 160 },
          ],
          fixedVariableSplit: { totalFixed: 0, fixedPercentage: 0, totalVariable: 28000, variablePercentage: 100, totalExpenses: 28000 },
          monthlyTrends: [],
          financialHealth: { savingsRate: -40, status: 'Needs attention', description: '', averageMonthlyIncome: 20000, averageMonthlyExpenses: 28000, averageMonthlySurplus: -8000 },
        },
        prediction: {
          status: 'predicted',
          opening_balance: 5000,
          income_so_far: 20000,
          spent_so_far: 28000,
          current_balance: -3000,
          historyMonthsCount: 2,
          historyMonths: ['2026-09', '2026-10'],
          unpaid_fixed: 0,
          unpaid_fixed_breakdown: [],
          daily_variable_rate: 100,
          total_variable_history: 6000,
          total_history_days: 60,
          days_left: 10,
          days_in_month: 30,
          current_day: 20,
          expected_variable: 1000,
          expected_income: 0,
          average_monthly_income_history: 20000,
          predicted_month_end_balance: -3000,
          predicted_savings: -8000,
          overspendingRisk: 'at_risk' as const,
          explanation: { formula: '', steps: [] },
        },
      });

      const prompt = `Please generate a comprehensive, highly personalized Monthly Financial Review for 2026-11 based strictly on the following verified financial numbers:\n${JSON.stringify(context, null, 2)}`;
      const reply = generateLocalFallbackResponse([{ role: 'user', content: prompt }]);

      expect(reply.toLowerCase()).not.toContain('stable');
      expect(reply).toContain('Deficit Spending');
      expect(reply).toContain('negative savings rate');
      expect(reply).toContain('₹8,000');
    });

    it('generates trims and tips strictly from actual user top categories', () => {
      const context = buildFinancialContext({
        selectedMonth: '2026-11',
        analysis: {
          currentMonth: '2026-11',
          totalIncome: 50000,
          totalExpenses: 30000,
          netSavings: 20000,
          savingsRate: 40,
          categoryBreakdown: [
            { category: 'Rent', amount: 15000, percentage: 50, isFixed: true, historyMonthlyAverage: 15000, diffFromAverage: 0, diffPercentage: 0 },
            { category: 'Swiggy & Dining', amount: 9000, percentage: 30, isFixed: false, historyMonthlyAverage: 6000, diffFromAverage: 3000, diffPercentage: 50 },
            { category: 'Gadgets & Tech', amount: 6000, percentage: 20, isFixed: false, historyMonthlyAverage: 2000, diffFromAverage: 4000, diffPercentage: 200 },
          ],
          fixedVariableSplit: { totalFixed: 15000, fixedPercentage: 50, totalVariable: 15000, variablePercentage: 50, totalExpenses: 30000 },
          monthlyTrends: [],
          financialHealth: { savingsRate: 40, status: 'Healthy', description: '', averageMonthlyIncome: 50000, averageMonthlyExpenses: 30000, averageMonthlySurplus: 20000 },
        },
      });

      const prompt = `Please generate a comprehensive, highly personalized Monthly Financial Review for 2026-11 based strictly on the following verified financial numbers:\n${JSON.stringify(context, null, 2)}`;
      const reply = generateLocalFallbackResponse([{ role: 'user', content: prompt }]);

      expect(reply).toContain('Swiggy & Dining');
      expect(reply).toContain('Gadgets & Tech');
      expect(reply).toContain('₹1,350/month');
      expect(reply).toContain('₹900/month');
    });
  });

  describe('Item 2b-3 & Item 6: Surplus History Requirements and Null Handling', () => {
    it('calculates average monthly surplus strictly from complete history months', () => {
      const txs = [
        { date: '2026-08-01', amount: 40000, type: 'income' },
        { date: '2026-08-10', amount: 25000, type: 'expense' },
        { date: '2026-09-01', amount: 40000, type: 'income' },
        { date: '2026-09-15', amount: 30000, type: 'expense' },
        { date: '2026-10-01', amount: 40000, type: 'income' },
        { date: '2026-10-05', amount: 35000, type: 'expense' },
      ];

      const surplus = calculateAverageMonthlySurplus(txs, '2026-10');
      expect(surplus).toBe(12500);
    });

    it('returns null and does NOT fall back to current (partial) month when no complete history month exists', () => {
      const txs = [
        { date: '2026-10-01', amount: 30000, type: 'income' },
        { date: '2026-10-05', amount: 22000, type: 'expense' },
      ];

      // Item 2b-3: Must NOT fall back to current month
      const surplus = calculateAverageMonthlySurplus(txs, '2026-10');
      expect(surplus).toBeNull();
    });

    it('shows "Not enough history to judge feasibility yet" while still showing monthly needed when surplus is null', () => {
      const goal: Goal = {
        id: 'g-1',
        user_id: 'user-1',
        name: 'Emergency Fund',
        target_amount: 60000,
        saved_amount: 12000,
        target_months: 6,
        created_at: '',
      };

      const result = calculateGoalFeasibility({
        goal,
        monthlySurplus: null,
      });

      expect(result.verdict).toBe('Not enough history to judge feasibility yet');
      expect(result.monthly_needed).toBe(8000); // (60000 - 12000) / 6 = 8000
      expect(result.share_of_surplus).toBeNull();
      expect(result.months_at_full_surplus).toBe('Not enough history');
    });

    it('combined goals feasibility handles null monthlySurplus', () => {
      const goals: Goal[] = [
        {
          id: 'g-1',
          user_id: 'user-1',
          name: 'Emergency Fund',
          target_amount: 60000,
          saved_amount: 12000,
          target_months: 6,
          created_at: '',
        },
      ];

      const combined = calculateCombinedGoalsFeasibility({
        goals,
        monthlySurplus: null,
      });

      expect(combined.monthlySurplus).toBeNull();
      expect(combined.combinedShareOfSurplus).toBeNull();
      expect(combined.totalMonthlyNeeded).toBe(8000);
      expect(combined.goals[0].verdict).toBe('Not enough history to judge feasibility yet');
      expect(combined.warningMessage).toContain('Not enough history');
    });

    it('passes through <= 0 surplus so goals show "Not realistic (no monthly surplus)"', () => {
      const goals: Goal[] = [
        {
          id: 'g-1',
          user_id: 'user-1',
          name: 'Emergency Fund',
          target_amount: 50000,
          saved_amount: 10000,
          target_months: 6,
          created_at: '',
        },
      ];

      const resultZero = calculateCombinedGoalsFeasibility({
        goals,
        monthlySurplus: 0,
      });
      expect(resultZero.goals[0].verdict).toBe('Not realistic (no monthly surplus)');
      expect(resultZero.goals[0].share_of_surplus).toBeNull();
      expect(resultZero.goals[0].months_at_full_surplus).toBe('Not reachable');

      const resultNegative = calculateCombinedGoalsFeasibility({
        goals,
        monthlySurplus: -5000,
      });
      expect(resultNegative.goals[0].verdict).toBe('Not realistic (no monthly surplus)');
      expect(resultNegative.goals[0].share_of_surplus).toBeNull();
      expect(resultNegative.goals[0].months_at_full_surplus).toBe('Not reachable');
    });
  });
});

