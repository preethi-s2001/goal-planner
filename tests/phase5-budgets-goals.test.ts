import { describe, it, expect } from 'vitest';
import { calculateBudgetStatus } from '@/lib/finance/budgets';
import {
  calculateGoalFeasibility,
  calculateCombinedGoalsFeasibility,
} from '@/lib/finance/goals';
import { simulateScenario } from '@/lib/finance/simulator';
import { Goal } from '@/types';

describe('Phase 5 - Budgets & Alert Thresholds', () => {
  it('Requirement: Spending exactly equal to budget -> "budget fully used", NOT "exceeded"', () => {
    const res = calculateBudgetStatus({
      category: 'Food',
      spent: 5000,
      limit: 5000,
    });

    expect(res.percentage).toBe(100);
    expect(res.level).toBe('fully_used');
    expect(res.alertMessage).toBe('budget fully used');
    expect(res.isOverBudget).toBe(false);
  });

  it('Requirement: Spending > 100% -> "exceeded"', () => {
    const res = calculateBudgetStatus({
      category: 'Shopping',
      spent: 5100,
      limit: 5000,
    });

    expect(res.percentage).toBe(102);
    expect(res.level).toBe('exceeded');
    expect(res.alertMessage).toBe('exceeded');
    expect(res.isOverBudget).toBe(true);
  });

  it('Requirement: Spending >= 90% and < 100% -> "consider limiting spending"', () => {
    const res = calculateBudgetStatus({
      category: 'Food',
      spent: 4600,
      limit: 5000, // 92%
    });

    expect(res.percentage).toBe(92);
    expect(res.level).toBe('warning_90');
    expect(res.alertMessage).toBe('consider limiting spending');
    expect(res.isOverBudget).toBe(false);
  });

  it('Requirement: Spending >= 75% and < 90% -> "keep an eye on it"', () => {
    const res = calculateBudgetStatus({
      category: 'Transport',
      spent: 2400,
      limit: 3000, // 80%
    });

    expect(res.percentage).toBe(80);
    expect(res.level).toBe('warning_75');
    expect(res.alertMessage).toBe('keep an eye on it');
  });

  it('Requirement: Pace check for variable categories only (mid-month spending rate)', () => {
    // Current day = 10, days in month = 30.
    // Food limit = 5000. Spent so far = 2000 (40% of limit, below 75%).
    // Projected pace = 2000 / 10 * 30 = 6000 (> 5000 limit!).
    const res = calculateBudgetStatus({
      category: 'Food',
      spent: 2000,
      limit: 5000,
      currentDay: 10,
      daysInMonth: 30,
    });

    expect(res.level).toBe('pace_warning');
    expect(res.projectedPace).toBe(6000);
    expect(res.alertMessage).toMatch(/at this pace you will spend about ₹6,000, above your ₹5,000 budget/i);
  });

  it('Requirement: Skip pace check for Rent and Bills (fixed categories)', () => {
    // On Day 5, Rent is 8000 out of 8000 (or 4000 on day 5 of 8000).
    // Even if 4000 / 5 * 30 = 24000 > 8000, Rent MUST skip the pace check!
    const rentRes = calculateBudgetStatus({
      category: 'Rent',
      spent: 4000,
      limit: 8000,
      currentDay: 5,
      daysInMonth: 30,
    });

    expect(rentRes.isFixed).toBe(true);
    expect(rentRes.level).toBe('normal');
    expect(rentRes.alertMessage).toBeNull();

    const billsRes = calculateBudgetStatus({
      category: 'Bills',
      spent: 1000,
      limit: 2500,
      currentDay: 5,
      daysInMonth: 30,
    });

    expect(billsRes.isFixed).toBe(true);
    expect(billsRes.level).toBe('normal');
  });
});

describe('Phase 5 - Goal Planning & Feasibility', () => {
  it('Requirement: Goal already achieved -> "Already achieved"', () => {
    const goal: Goal = {
      id: 'g-1',
      user_id: 'u-1',
      name: 'Emergency Fund',
      target_amount: 50000,
      saved_amount: 50000,
      target_months: 6,
      created_at: '',
    };

    const res = calculateGoalFeasibility({ goal, monthlySurplus: 10000 });
    expect(res.isAchieved).toBe(true);
    expect(res.verdict).toBe('Already achieved');
    expect(res.remaining).toBe(0);
    expect(res.monthly_needed).toBe(0);
    expect(res.months_at_full_surplus).toBe(0);
  });

  it('Requirement: New goal added -> monthly savings recalculated (₹60,000 target, ₹12,000 saved, 12 months -> ₹4,000/month)', () => {
    const bikeGoal: Goal = {
      id: 'g-2',
      user_id: 'u-1',
      name: 'New Bike',
      target_amount: 60000,
      saved_amount: 12000,
      target_months: 12,
      created_at: '',
    };

    // Remaining = 48,000. 48,000 / 12 = 4,000/month.
    // If monthly surplus is 10,000:
    // Share = 4,000 / 10,000 = 40% (<= 50% -> 'Comfortable')
    // Months at full surplus = ceil(48,000 / 10,000) = 5 months
    const res = calculateGoalFeasibility({ goal: bikeGoal, monthlySurplus: 10000 });
    expect(res.remaining).toBe(48000);
    expect(res.monthly_needed).toBe(4000);
    expect(res.share_of_surplus).toBe(40);
    expect(res.verdict).toBe('Comfortable');
    expect(res.months_at_full_surplus).toBe(5);
  });

  it('verdict thresholds: Comfortable (<= 50%), Tight (<= 100%), Not realistic (> 100%)', () => {
    const baseGoal: Goal = {
      id: 'g-3',
      user_id: 'u-1',
      name: 'Laptop',
      target_amount: 60000,
      saved_amount: 0,
      target_months: 10, // 6,000 / month
      created_at: '',
    };

    // 1. Surplus 15,000: 6,000 / 15,000 = 40% -> Comfortable
    expect(calculateGoalFeasibility({ goal: baseGoal, monthlySurplus: 15000 }).verdict).toBe('Comfortable');

    // 2. Surplus 8,000: 6,000 / 8,000 = 75% -> Tight but possible
    expect(calculateGoalFeasibility({ goal: baseGoal, monthlySurplus: 8000 }).verdict).toBe('Tight but possible');

    // 3. Surplus 5,000: 6,000 / 5,000 = 120% -> Not realistic in this time
    expect(calculateGoalFeasibility({ goal: baseGoal, monthlySurplus: 5000 }).verdict).toBe('Not realistic in this time');
  });

  it('Requirement: Salary drops so surplus <= 0 -> goals show "Not reachable", no divide by zero', () => {
    const goal: Goal = {
      id: 'g-4',
      user_id: 'u-1',
      name: 'Travel Goa',
      target_amount: 25000,
      saved_amount: 5000,
      target_months: 5,
      created_at: '',
    };

    const res = calculateGoalFeasibility({ goal, monthlySurplus: 0 });
    expect(res.verdict).toBe('Not realistic (no monthly surplus)');
    expect(res.months_at_full_surplus).toBe('Not reachable');
    expect(res.share_of_surplus).toBeNull();

    const negativeSurplusRes = calculateGoalFeasibility({ goal, monthlySurplus: -2500 });
    expect(negativeSurplusRes.verdict).toBe('Not realistic (no monthly surplus)');
    expect(negativeSurplusRes.months_at_full_surplus).toBe('Not reachable');
  });

  it('Combined check: warns if sum of monthly needed exceeds monthly surplus', () => {
    const goals: Goal[] = [
      { id: '1', user_id: 'u', name: 'Bike', target_amount: 60000, saved_amount: 12000, target_months: 12, created_at: '' }, // 4000/mo
      { id: '2', user_id: 'u', name: 'Phone', target_amount: 40000, saved_amount: 10000, target_months: 5, created_at: '' }, // 6000/mo
    ];
    // Total needed = 4000 + 6000 = 10,000/mo.
    // Surplus is 8,000 -> 10,000 exceeds 8,000!
    const combined = calculateCombinedGoalsFeasibility({ goals, monthlySurplus: 8000 });
    expect(combined.totalMonthlyNeeded).toBe(10000);
    expect(combined.exceedsSurplus).toBe(true);
    expect(combined.warningMessage).toMatch(/exceeds your ₹8,000 monthly surplus/i);
  });
});

describe('Phase 5 - What-If Simulator', () => {
  const baselineCategorySpends = {
    Rent: 8000,
    Bills: 2000,
    Food: 5000,
    Transport: 3000,
    Shopping: 4000,
    Others: 1000,
  };
  // Baseline Expenses = 23,000.
  // Baseline Income = 35,000.
  // Baseline Surplus = 12,000.
  const baselineIncome = 35000;

  it('Requirement: Rent increased by ₹2,000 -> surplus falls by ₹2,000', () => {
    const res = simulateScenario({
      baselineIncome,
      baselineCategorySpends,
      categoryChanges: { Rent: 2000 },
    });

    expect(res.baselineSurplus).toBe(12000);
    expect(res.newExpenses).toBe(25000);
    expect(res.newSurplus).toBe(10000);
    expect(res.surplusDifference).toBe(-2000);
  });

  it('handles simultaneous salary raise and lifestyle adjustments', () => {
    // Salary raise +5,000 (40,000)
    // Rent +1,000 (9,000)
    // Food -500 (4,500)
    // New expenses = 23,000 + 500 = 23,500
    // New surplus = 40,000 - 23,500 = 16,500 (+4,500)
    const res = simulateScenario({
      baselineIncome,
      baselineCategorySpends,
      salaryChange: 5000,
      categoryChanges: { Rent: 1000, Food: -500 },
    });

    expect(res.newIncome).toBe(40000);
    expect(res.newExpenses).toBe(23500);
    expect(res.newSurplus).toBe(16500);
    expect(res.surplusDifference).toBe(4500);
  });

  it('recalculates goal timeline before and after simulation', () => {
    const bikeGoal: Goal = {
      id: 'g-bike',
      user_id: 'u-1',
      name: 'Bike',
      target_amount: 60000,
      saved_amount: 0,
      target_months: 12,
      created_at: '',
    };

    // Baseline surplus = 12,000 -> months = ceil(60,000 / 12,000) = 5 months
    // New surplus = 15,000 (+3,000 salary) -> months = ceil(60,000 / 15,000) = 4 months (1 month faster!)
    const res = simulateScenario({
      baselineIncome,
      baselineCategorySpends,
      salaryChange: 3000,
      goals: [bikeGoal],
    });

    const goalRes = res.goalTimelines[0];
    expect(goalRes.monthsBefore).toBe(5);
    expect(goalRes.monthsAfter).toBe(4);
    expect(goalRes.timelineDifferenceMonths).toBe(-1); // 1 month sooner
  });

  it('never modifies input objects (pure simulation)', () => {
    const originalSpends = { ...baselineCategorySpends };
    const categoryChanges = { Rent: 2000 };

    simulateScenario({
      baselineIncome,
      baselineCategorySpends: originalSpends,
      categoryChanges,
    });

    expect(originalSpends.Rent).toBe(8000);
    expect(categoryChanges.Rent).toBe(2000);
  });
});
