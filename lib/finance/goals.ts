import { Goal } from '@/types';
import { parseDateParts } from './prediction';
import { getCompleteHistoryMonths } from './complete-months';

export type GoalVerdict =
  | 'Already achieved'
  | 'Comfortable'
  | 'Tight but possible'
  | 'Not realistic in this time'
  | 'Not realistic (no monthly surplus)'
  | 'Not enough history to judge feasibility yet';

export interface GoalFeasibilityResult {
  id: string;
  name: string;
  target_amount: number;
  saved_amount: number;
  remaining: number;
  target_months: number;
  monthly_needed: number;
  share_of_surplus: number | null; // percentage of monthly surplus
  verdict: GoalVerdict;
  months_at_full_surplus: number | string; // number or 'Not reachable'
  isAchieved: boolean;
  progressPercentage: number;
}

export interface CombinedGoalsResult {
  totalTargetAmount: number;
  totalSavedAmount: number;
  totalRemaining: number;
  totalMonthlyNeeded: number;
  monthlySurplus: number | null;
  combinedShareOfSurplus: number | null;
  exceedsSurplus: boolean;
  warningMessage: string | null;
  goals: GoalFeasibilityResult[];
}

/**
 * Calculates feasibility metrics for an individual financial goal.
 */
export function calculateGoalFeasibility(params: {
  goal: Goal;
  monthlySurplus: number | null;
}): GoalFeasibilityResult {
  const { goal, monthlySurplus } = params;
  const target = Math.max(Number(goal.target_amount), 0);
  const saved = Math.max(Number(goal.saved_amount), 0);
  const targetMonths = Math.max(Number(goal.target_months), 1);

  const remaining = Math.max(target - saved, 0);
  const progressPercentage =
    target > 0 ? Math.min(Math.round((saved / target) * 1000) / 10, 100) : 100;

  // 1. Goal already achieved
  if (remaining <= 0) {
    return {
      id: goal.id,
      name: goal.name,
      target_amount: target,
      saved_amount: saved,
      remaining: 0,
      target_months: targetMonths,
      monthly_needed: 0,
      share_of_surplus: 0,
      verdict: 'Already achieved',
      months_at_full_surplus: 0,
      isAchieved: true,
      progressPercentage: 100,
    };
  }

  // 2. Monthly needed
  const monthlyNeeded = Math.round((remaining / targetMonths) * 100) / 100;

  // 3. If no complete history month exists (surplus is null)
  if (monthlySurplus === null) {
    return {
      id: goal.id,
      name: goal.name,
      target_amount: target,
      saved_amount: saved,
      remaining: Math.round(remaining * 100) / 100,
      target_months: targetMonths,
      monthly_needed: monthlyNeeded,
      share_of_surplus: null,
      verdict: 'Not enough history to judge feasibility yet',
      months_at_full_surplus: 'Not enough history',
      isAchieved: false,
      progressPercentage,
    };
  }

  // 4. If surplus <= 0, no division by zero
  if (monthlySurplus <= 0) {
    return {
      id: goal.id,
      name: goal.name,
      target_amount: target,
      saved_amount: saved,
      remaining: Math.round(remaining * 100) / 100,
      target_months: targetMonths,
      monthly_needed: monthlyNeeded,
      share_of_surplus: null,
      verdict: 'Not realistic (no monthly surplus)',
      months_at_full_surplus: 'Not reachable',
      isAchieved: false,
      progressPercentage,
    };
  }

  // 5. Surplus > 0
  const share = (monthlyNeeded / monthlySurplus) * 100;
  const roundedShare = Math.round(share * 10) / 10;
  const monthsAtFullSurplus = Math.ceil(remaining / monthlySurplus);

  let verdict: GoalVerdict = 'Not realistic in this time';
  if (share <= 50) {
    verdict = 'Comfortable';
  } else if (share <= 100) {
    verdict = 'Tight but possible';
  } else {
    verdict = 'Not realistic in this time';
  }

  return {
    id: goal.id,
    name: goal.name,
    target_amount: target,
    saved_amount: saved,
    remaining: Math.round(remaining * 100) / 100,
    target_months: targetMonths,
    monthly_needed: monthlyNeeded,
    share_of_surplus: roundedShare,
    verdict,
    months_at_full_surplus: monthsAtFullSurplus,
    isAchieved: false,
    progressPercentage,
  };
}

/**
 * Calculates combined feasibility across all user goals.
 */
export function calculateCombinedGoalsFeasibility(params: {
  goals: Goal[];
  monthlySurplus: number | null;
}): CombinedGoalsResult {
  const { goals, monthlySurplus } = params;

  let totalTarget = 0;
  let totalSaved = 0;
  let totalRemaining = 0;
  let totalMonthlyNeeded = 0;

  const evaluatedGoals: GoalFeasibilityResult[] = [];

  for (const g of goals) {
    const res = calculateGoalFeasibility({ goal: g, monthlySurplus });
    evaluatedGoals.push(res);

    totalTarget += res.target_amount;
    totalSaved += res.saved_amount;
    totalRemaining += res.remaining;
    if (!res.isAchieved) {
      totalMonthlyNeeded += res.monthly_needed;
    }
  }

  if (monthlySurplus === null) {
    return {
      totalTargetAmount: Math.round(totalTarget * 100) / 100,
      totalSavedAmount: Math.round(totalSaved * 100) / 100,
      totalRemaining: Math.round(totalRemaining * 100) / 100,
      totalMonthlyNeeded: Math.round(totalMonthlyNeeded * 100) / 100,
      monthlySurplus: null,
      combinedShareOfSurplus: null,
      exceedsSurplus: false,
      warningMessage: 'Not enough history to judge feasibility yet.',
      goals: evaluatedGoals,
    };
  }

  const exceedsSurplus =
    monthlySurplus <= 0 || (totalMonthlyNeeded > monthlySurplus && totalMonthlyNeeded > 0);
  const combinedShareOfSurplus =
    monthlySurplus > 0 ? Math.round((totalMonthlyNeeded / monthlySurplus) * 1000) / 10 : null;

  let warningMessage: string | null = null;
  if (totalMonthlyNeeded > 0) {
    if (monthlySurplus <= 0) {
      warningMessage =
        'You currently have zero or negative monthly surplus. Goals are not reachable without increasing salary or cutting expenses.';
    } else if (totalMonthlyNeeded > monthlySurplus) {
      warningMessage = `Your active goals require ₹${Math.round(totalMonthlyNeeded).toLocaleString('en-IN')}/month combined, which exceeds your ₹${Math.round(monthlySurplus).toLocaleString('en-IN')} monthly surplus (${combinedShareOfSurplus}%). Consider extending timelines or funding goals one at a time.`;
    }
  }

  return {
    totalTargetAmount: Math.round(totalTarget * 100) / 100,
    totalSavedAmount: Math.round(totalSaved * 100) / 100,
    totalRemaining: Math.round(totalRemaining * 100) / 100,
    totalMonthlyNeeded: Math.round(totalMonthlyNeeded * 100) / 100,
    monthlySurplus: Math.round(monthlySurplus * 100) / 100,
    combinedShareOfSurplus,
    exceedsSurplus,
    warningMessage,
    goals: evaluatedGoals,
  };
}

/**
 * Calculates real average monthly surplus from complete history months (before currentMonth).
 * Item 13: Applies the complete month rule (not user's first data month OR first tx <= 7th).
 * Must NOT fall back to current (partial) month. If no complete history month exists, returns null.
 */
export function calculateAverageMonthlySurplus(
  transactions: { date: string; amount: number; type: string }[],
  currentMonth: string
): number | null {
  const { completeMonths, count } = getCompleteHistoryMonths(transactions, currentMonth);

  if (count === 0) {
    return null;
  }

  const monthlyData: Record<string, { income: number; expenses: number }> = {};
  for (const m of completeMonths) {
    monthlyData[m] = { income: 0, expenses: 0 };
  }

  for (const t of transactions) {
    const { monthStr } = parseDateParts(t.date);
    if (monthlyData[monthStr]) {
      if (t.type === 'income') monthlyData[monthStr].income += Number(t.amount);
      if (t.type === 'expense') monthlyData[monthStr].expenses += Number(t.amount);
    }
  }

  let totalInc = 0;
  let totalExp = 0;
  for (const m of completeMonths) {
    totalInc += monthlyData[m].income;
    totalExp += monthlyData[m].expenses;
  }

  return Math.round((totalInc - totalExp) / count);
}
