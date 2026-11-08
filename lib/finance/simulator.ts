import { Goal, Transaction } from '@/types';
import { parseDateParts } from './prediction';
import { getCompleteHistoryMonths } from './complete-months';

export interface CategorySimulationItem {
  category: string;
  baselineSpend: number;
  change: number;
  newSpend: number;
}

export interface GoalTimelineSimulation {
  goalId: string;
  name: string;
  target_amount: number;
  saved_amount: number;
  remaining: number;
  monthsBefore: number | 'Not reachable';
  monthsAfter: number | 'Not reachable';
  timelineDifferenceMonths: number | null; // negative means faster!
}

export interface SimulationResult {
  baselineIncome: number;
  salaryChange: number;
  newIncome: number;

  baselineExpenses: number;
  expensesChange: number;
  newExpenses: number;

  baselineSurplus: number;
  newSurplus: number;
  surplusDifference: number;

  baselineSavingsRate: number;
  newSavingsRate: number;

  currentBalance: number;
  projectedBalanceAfterOneMonth: number;

  categoryBreakdown: CategorySimulationItem[];
  goalTimelines: GoalTimelineSimulation[];

  assumptions: string[];
}

/**
 * Pure simulation function that never modifies stored data.
 * Computes before/after surplus comparisons, category adjustments,
 * and recalculated goal timelines under the new surplus.
 */
export function simulateScenario(params: {
  baselineIncome: number;
  baselineCategorySpends: Record<string, number>;
  salaryChange?: number;
  categoryChanges?: Record<string, number>;
  currentBalance?: number;
  goals?: Goal[];
}): SimulationResult {
  const {
    baselineIncome,
    baselineCategorySpends,
    salaryChange = 0,
    categoryChanges = {},
    currentBalance = 0,
    goals = [],
  } = params;

  // 1. Income
  const newIncome = Math.max(baselineIncome + salaryChange, 0);

  // 2. Category Spends
  let baselineExpenses = 0;
  let newExpenses = 0;
  const categoryBreakdown: CategorySimulationItem[] = [];

  for (const [cat, baseSpend] of Object.entries(baselineCategorySpends)) {
    const change = categoryChanges[cat] || 0;
    const newSpend = Math.max(baseSpend + change, 0);

    baselineExpenses += baseSpend;
    newExpenses += newSpend;

    categoryBreakdown.push({
      category: cat,
      baselineSpend: Math.round(baseSpend * 100) / 100,
      change: Math.round(change * 100) / 100,
      newSpend: Math.round(newSpend * 100) / 100,
    });
  }

  // Handle any additional categories in categoryChanges not in baseline
  for (const [cat, change] of Object.entries(categoryChanges)) {
    if (!baselineCategorySpends.hasOwnProperty(cat)) {
      const newSpend = Math.max(change, 0);
      newExpenses += newSpend;
      categoryBreakdown.push({
        category: cat,
        baselineSpend: 0,
        change: Math.round(change * 100) / 100,
        newSpend: Math.round(newSpend * 100) / 100,
      });
    }
  }

  // 3. Surpluses
  const baselineSurplus = baselineIncome - baselineExpenses;
  const newSurplus = newIncome - newExpenses;
  const surplusDifference = newSurplus - baselineSurplus;

  // 4. Savings Rates
  const baselineSavingsRate =
    baselineIncome > 0 ? Math.round((baselineSurplus / baselineIncome) * 1000) / 10 : 0;
  const newSavingsRate =
    newIncome > 0 ? Math.round((newSurplus / newIncome) * 1000) / 10 : 0;

  // 5. Projected 1-month balance
  const projectedBalanceAfterOneMonth = currentBalance + newSurplus;

  // 6. Goal Timelines Before vs After
  const goalTimelines: GoalTimelineSimulation[] = goals.map((g) => {
    const target = Number(g.target_amount);
    const saved = Number(g.saved_amount);
    const remaining = Math.max(target - saved, 0);

    if (remaining <= 0) {
      return {
        goalId: g.id,
        name: g.name,
        target_amount: target,
        saved_amount: saved,
        remaining: 0,
        monthsBefore: 0,
        monthsAfter: 0,
        timelineDifferenceMonths: 0,
      };
    }

    const monthsBefore =
      baselineSurplus > 0 ? Math.ceil(remaining / baselineSurplus) : 'Not reachable';
    const monthsAfter =
      newSurplus > 0 ? Math.ceil(remaining / newSurplus) : 'Not reachable';

    let diff: number | null = null;
    if (typeof monthsBefore === 'number' && typeof monthsAfter === 'number') {
      diff = monthsAfter - monthsBefore;
    }

    return {
      goalId: g.id,
      name: g.name,
      target_amount: target,
      saved_amount: saved,
      remaining: Math.round(remaining * 100) / 100,
      monthsBefore,
      monthsAfter,
      timelineDifferenceMonths: diff,
    };
  });

  return {
    baselineIncome: Math.round(baselineIncome * 100) / 100,
    salaryChange: Math.round(salaryChange * 100) / 100,
    newIncome: Math.round(newIncome * 100) / 100,

    baselineExpenses: Math.round(baselineExpenses * 100) / 100,
    expensesChange: Math.round((newExpenses - baselineExpenses) * 100) / 100,
    newExpenses: Math.round(newExpenses * 100) / 100,

    baselineSurplus: Math.round(baselineSurplus * 100) / 100,
    newSurplus: Math.round(newSurplus * 100) / 100,
    surplusDifference: Math.round(surplusDifference * 100) / 100,

    baselineSavingsRate,
    newSavingsRate,

    currentBalance: Math.round(currentBalance * 100) / 100,
    projectedBalanceAfterOneMonth: Math.round(projectedBalanceAfterOneMonth * 100) / 100,

    categoryBreakdown,
    goalTimelines,

    assumptions: [
      'The simulated changes are permanent starting next month.',
      'You save 100% of your net monthly surplus toward one goal at a time.',
      'Inflation, investment yields, and interest rates are excluded (budgeting math only).',
    ],
  };
}

/**
 * Calculates baseline income and category spends for the simulator strictly using
 * complete history months per the shared complete month rule.
 */
export function calculateSimulatorBaseline(
  transactions: Transaction[],
  currentMonth: string
): {
  baselineIncome: number;
  baselineCategorySpends: Record<string, number>;
  completeMonthsCount: number;
  completeMonths: string[];
} {
  const { completeMonths, count } = getCompleteHistoryMonths(transactions, currentMonth);

  const categorySums: Record<string, number> = {};
  let totalIncome = 0;

  if (count > 0) {
    const monthSet = new Set(completeMonths);
    for (const t of transactions) {
      const { monthStr } = parseDateParts(t.date);
      if (monthSet.has(monthStr)) {
        const amt = Number(t.amount);
        if (t.type === 'income') {
          totalIncome += amt;
        } else if (t.type === 'expense') {
          categorySums[t.category] = (categorySums[t.category] ?? 0) + amt;
        }
      }
    }
    const baselineCategorySpends: Record<string, number> = {};
    for (const [cat, sum] of Object.entries(categorySums)) {
      baselineCategorySpends[cat] = Math.round((sum / count) * 100) / 100;
    }
    return {
      baselineIncome: Math.round((totalIncome / count) * 100) / 100,
      baselineCategorySpends,
      completeMonthsCount: count,
      completeMonths,
    };
  }

  return {
    baselineIncome: 0,
    baselineCategorySpends: {},
    completeMonthsCount: 0,
    completeMonths: [],
  };
}
