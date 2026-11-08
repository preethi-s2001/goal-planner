import { FIXED_CATEGORIES } from '@/types';

export type BudgetAlertLevel =
  | 'normal'
  | 'warning_75'
  | 'warning_90'
  | 'fully_used'
  | 'exceeded'
  | 'pace_warning';

export interface BudgetStatusResult {
  category: string;
  spent: number;
  limit: number;
  percentage: number;
  remaining: number;
  level: BudgetAlertLevel;
  alertMessage: string | null;
  projectedPace: number | null;
  isOverBudget: boolean;
  isFixed: boolean;
}

/**
 * Calculates budget status and pace warnings for a category.
 *
 * Exact rules per Project Brief:
 * - pct = spent / limit * 100
 * - pct > 100 -> "exceeded"
 * - pct = 100 -> "budget fully used" (NOT "exceeded")
 * - pct >= 90 -> "consider limiting spending"
 * - pct >= 75 -> "keep an eye on it"
 * - Pace check for variable categories only:
 *     pace = spent / today's day * days in month
 *     if pace > limit and no higher alert applies ->
 *     "at this pace you will spend about ₹X, above your ₹Y budget"
 * - Skip pace check for Rent and Bills (fixed categories).
 */
export function calculateBudgetStatus(params: {
  category: string;
  spent: number;
  limit: number;
  currentDay?: number;
  daysInMonth?: number;
}): BudgetStatusResult {
  const { category, spent, limit } = params;
  const isFixed = (FIXED_CATEGORIES as readonly string[]).includes(category);

  if (limit <= 0) {
    return {
      category,
      spent,
      limit: 0,
      percentage: spent > 0 ? 100 : 0,
      remaining: 0,
      level: spent > 0 ? 'exceeded' : 'normal',
      alertMessage: spent > 0 ? 'exceeded' : null,
      projectedPace: null,
      isOverBudget: spent > 0,
      isFixed,
    };
  }

  const pct = (spent / limit) * 100;
  let roundedPct = Math.round(pct * 10) / 10;
  if (pct > 100 && roundedPct <= 100) {
    roundedPct = 100.1;
  }
  const remaining = Math.max(limit - spent, 0);

  // Exact threshold checks
  if (pct > 100) {
    return {
      category,
      spent,
      limit,
      percentage: roundedPct,
      remaining: 0,
      level: 'exceeded',
      alertMessage: 'exceeded',
      projectedPace: null,
      isOverBudget: true,
      isFixed,
    };
  }

  if (pct === 100) {
    return {
      category,
      spent,
      limit,
      percentage: 100,
      remaining: 0,
      level: 'fully_used',
      alertMessage: 'budget fully used',
      projectedPace: null,
      isOverBudget: false,
      isFixed,
    };
  }

  if (pct >= 90) {
    return {
      category,
      spent,
      limit,
      percentage: roundedPct,
      remaining,
      level: 'warning_90',
      alertMessage: 'consider limiting spending',
      projectedPace: null,
      isOverBudget: false,
      isFixed,
    };
  }

  if (pct >= 75) {
    return {
      category,
      spent,
      limit,
      percentage: roundedPct,
      remaining,
      level: 'warning_75',
      alertMessage: 'keep an eye on it',
      projectedPace: null,
      isOverBudget: false,
      isFixed,
    };
  }

  // Item 16: Budget pace warnings: only after day 5 and when spent >= 10% of the limit
  const currentDay = params.currentDay ?? new Date().getDate();
  const now = new Date();
  const daysInMonth =
    params.daysInMonth ?? new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  if (!isFixed && currentDay > 5 && spent >= limit * 0.1) {
    const pace = Math.round((spent / currentDay) * daysInMonth);
    if (pace > limit) {
      return {
        category,
        spent,
        limit,
        percentage: roundedPct,
        remaining,
        level: 'pace_warning',
        alertMessage: `at this pace you will spend about ₹${pace.toLocaleString('en-IN')}, above your ₹${limit.toLocaleString('en-IN')} budget`,
        projectedPace: pace,
        isOverBudget: false,
        isFixed,
      };
    }
  }

  return {
    category,
    spent,
    limit,
    percentage: roundedPct,
    remaining,
    level: 'normal',
    alertMessage: null,
    projectedPace: null,
    isOverBudget: false,
    isFixed,
  };
}
