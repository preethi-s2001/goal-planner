import { Transaction, FIXED_CATEGORIES } from '@/types';
import { getCompleteHistoryMonths } from './complete-months';

export interface UnpaidFixedItem {
  category: string;
  historyMonthlyAverage: number;
  paidThisMonth: number;
  unpaidRemaining: number;
}

export type PredictionStatus = 'predicted' | 'insufficient_data';

export interface MonthEndPredictionResult {
  status: PredictionStatus;
  message?: string;
  opening_balance: number;
  income_so_far: number;
  spent_so_far: number;
  current_balance: number;
  // Intermediate calculation fields
  historyMonthsCount: number;
  historyMonths: string[]; // ['YYYY-MM', ...]
  unpaid_fixed: number;
  unpaid_fixed_breakdown: UnpaidFixedItem[];
  daily_variable_rate: number;
  total_variable_history: number;
  total_history_days: number;
  days_left: number;
  days_in_month: number;
  current_day: number;
  expected_variable: number;
  expected_income: number;
  average_monthly_income_history: number;
  predicted_month_end_balance: number;
  predicted_savings: number; // predicted_month_end_balance - opening_balance
  overspendingRisk: 'on_track' | 'at_risk' | 'overspent';
  explanation: {
    formula: string;
    steps: { label: string; value: string; detail: string }[];
  };
}

/**
 * Gets the number of days in a given YYYY-MM month.
 */
export function getDaysInMonth(year: number, monthIndex: number): number {
  // monthIndex is 1-based (1 for Jan, 2 for Feb, etc.)
  return new Date(year, monthIndex, 0).getDate();
}

/**
 * Parses 'YYYY-MM-DD' into year, month (1-based), day.
 */
export function parseDateParts(dateStr: string): { year: number; month: number; day: number; monthStr: string } {
  const parts = dateStr.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  const monthStr = `${parts[0]}-${String(month).padStart(2, '0')}`;
  return { year, month, day, monthStr };
}

/**
 * Calculates Month-End Prediction using the exact Project Brief formulas:
 *
 * 1. History = all complete months before the current month.
 *    If history has fewer than 2 complete months -> return 'insufficient_data'
 * 2. current_balance = opening_balance + income_so_far - spent_so_far
 * 3. unpaid_fixed = for each fixed category (Rent, Bills):
 *      max(average monthly spend in history - already paid this month, 0), summed
 * 4. daily_variable_rate = total variable spend in history / total days in those history months
 * 5. expected_variable = daily_variable_rate * days_left (days_left = days in month - today's day)
 * 6. expected_income = 0 if income already received this month, else average monthly income in history
 * 7. predicted_month_end_balance = current_balance + expected_income - unpaid_fixed - expected_variable
 */
export function calculateMonthEndPrediction(params: {
  transactions: Transaction[];
  currentMonth: string; // 'YYYY-MM'
  today?: string; // 'YYYY-MM-DD'
  currentDay?: number; // 1-31 (defaults to current date day or 15)
  openingBalance?: number;
}): MonthEndPredictionResult {
  const { transactions, currentMonth, openingBalance = 0 } = params;

  const [currentYear, currentMonthNum] = currentMonth.split('-').map(Number);
  const daysInCurrentMonth = getDaysInMonth(currentYear, currentMonthNum);

  // Item 10: Use client local date for "today" when provided
  const now = new Date();
  const defaultToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const todayStr =
    params.today ??
    (params.currentDay
      ? `${currentMonth}-${String(Math.min(params.currentDay, daysInCurrentMonth)).padStart(2, '0')}`
      : defaultToday);
  const todayMonth = todayStr.slice(0, 7);

  // Item 12: If the selected month is in the future: insufficient data
  if (currentMonth > todayMonth) {
    return {
      status: 'insufficient_data',
      message: 'Cannot project future months that have not started yet.',
      opening_balance: openingBalance,
      income_so_far: 0,
      spent_so_far: 0,
      current_balance: openingBalance,
      historyMonthsCount: 0,
      historyMonths: [],
      unpaid_fixed: 0,
      unpaid_fixed_breakdown: [],
      daily_variable_rate: 0,
      total_variable_history: 0,
      total_history_days: 0,
      days_left: daysInCurrentMonth,
      days_in_month: daysInCurrentMonth,
      current_day: 1,
      expected_variable: 0,
      expected_income: 0,
      average_monthly_income_history: 0,
      predicted_month_end_balance: openingBalance,
      predicted_savings: 0,
      overspendingRisk: 'on_track',
      explanation: {
        formula: 'Insufficient Data',
        steps: [
          {
            label: 'Future Month',
            value: currentMonth,
            detail: 'This month has not started yet; no forecast can be calculated.',
          },
        ],
      },
    };
  }

  // Item 12: If selected month is in the past: days_left = 0 and result is actual closing balance
  const isPastMonth = currentMonth < todayMonth;
  const currentDay = isPastMonth
    ? daysInCurrentMonth
    : (params.currentDay ?? (todayMonth === currentMonth ? parseDateParts(todayStr).day : daysInCurrentMonth));
  const daysLeft = isPastMonth ? 0 : Math.max(daysInCurrentMonth - currentDay, 0);

  // Item 13: "A history month counts as complete only if it is before the current month AND (it is not the user's first data month OR its first transaction is on or before the 7th)."
  const { completeMonths, count: historyMonthsCount } = getCompleteHistoryMonths(transactions, currentMonth);
  const completeMonthsSet = new Set(completeMonths);

  const currentMonthTx: Transaction[] = [];
  const historyTx: Transaction[] = [];

  for (const t of transactions) {
    const { monthStr } = parseDateParts(t.date);
    if (monthStr === currentMonth) {
      currentMonthTx.push(t);
    } else if (completeMonthsSet.has(monthStr)) {
      historyTx.push(t);
    }
  }

  // Item 11: "calculateMonthEndPrediction must count only current-month transactions dated <= today for income_so_far, spent_so_far and paid-this-month. Future-dated items (e.g. recurring salary on the 28th) are 'scheduled', not received or paid."
  let incomeSoFar = 0;
  let spentSoFar = 0;
  const currentPaidByCategory: Record<string, number> = {};

  for (const t of currentMonthTx) {
    // If current month, ignore future-dated transactions (> todayStr)
    if (!isPastMonth && t.date > todayStr) {
      continue;
    }

    const amt = Number(t.amount);
    if (t.type === 'income') {
      incomeSoFar += amt;
    } else if (t.type === 'expense') {
      spentSoFar += amt;
      currentPaidByCategory[t.category] = (currentPaidByCategory[t.category] ?? 0) + amt;
    }
  }

  const currentBalance = openingBalance + incomeSoFar - spentSoFar;

  // Item 12: Past month closing balance result
  if (isPastMonth) {
    return {
      status: 'predicted',
      opening_balance: Math.round(openingBalance * 100) / 100,
      income_so_far: Math.round(incomeSoFar * 100) / 100,
      spent_so_far: Math.round(spentSoFar * 100) / 100,
      current_balance: Math.round(currentBalance * 100) / 100,
      historyMonthsCount,
      historyMonths: completeMonths,
      unpaid_fixed: 0,
      unpaid_fixed_breakdown: [],
      daily_variable_rate: 0,
      total_variable_history: 0,
      total_history_days: 0,
      days_left: 0,
      days_in_month: daysInCurrentMonth,
      current_day: daysInCurrentMonth,
      expected_variable: 0,
      expected_income: 0,
      average_monthly_income_history: 0,
      predicted_month_end_balance: Math.round(currentBalance * 100) / 100,
      predicted_savings: Math.round((currentBalance - openingBalance) * 100) / 100,
      overspendingRisk: currentBalance < 0 ? 'overspent' : 'on_track',
      explanation: {
        formula: 'Opening Balance + Income - Expenses',
        steps: [
          {
            label: 'Actual Closing Balance',
            value: `₹${currentBalance.toLocaleString('en-IN')}`,
            detail: `Final closing balance recorded for completed month ${currentMonth}.`,
          },
          {
            label: 'History Used',
            value: `${historyMonthsCount} complete months used`,
            detail: completeMonths.join(', ') || 'None',
          },
        ],
      },
    };
  }

  // Rule: If history has fewer than 2 complete months -> return insufficient data result
  if (historyMonthsCount < 2) {
    const overspendingRisk =
      spentSoFar > openingBalance + incomeSoFar ? 'overspent' : 'on_track';

    return {
      status: 'insufficient_data',
      message:
        'At least 2 complete months of transaction history are required to project your month-end balance. Add past transactions or import a bank statement to unlock predictions.',
      opening_balance: openingBalance,
      income_so_far: Math.round(incomeSoFar * 100) / 100,
      spent_so_far: Math.round(spentSoFar * 100) / 100,
      current_balance: Math.round(currentBalance * 100) / 100,
      historyMonthsCount,
      historyMonths: completeMonths,
      unpaid_fixed: 0,
      unpaid_fixed_breakdown: [],
      daily_variable_rate: 0,
      total_variable_history: 0,
      total_history_days: 0,
      days_left: daysLeft,
      days_in_month: daysInCurrentMonth,
      current_day: currentDay,
      expected_variable: 0,
      expected_income: 0,
      average_monthly_income_history: 0,
      predicted_month_end_balance: Math.round(currentBalance * 100) / 100,
      predicted_savings: Math.round((currentBalance - openingBalance) * 100) / 100,
      overspendingRisk,
      explanation: {
        formula: 'Opening Balance + Income So Far - Expenses So Far',
        steps: [
          {
            label: 'Current Balance',
            value: `₹${currentBalance.toLocaleString('en-IN')}`,
            detail: 'Calculated from actual transactions recorded this month.',
          },
          {
            label: 'History Used',
            value: `${historyMonthsCount} complete months used`,
            detail: completeMonths.join(', ') || 'None',
          },
        ],
      },
    };
  }

  // 1. Unpaid Fixed Expenses
  const fixedHistorySpend: Record<string, number> = {};
  for (const cat of FIXED_CATEGORIES) {
    fixedHistorySpend[cat] = 0;
  }

  // 2. Variable Expenses in History
  let totalVariableHistory = 0;
  let totalIncomeHistory = 0;

  for (const t of historyTx) {
    const amt = Number(t.amount);
    if (t.type === 'income') {
      totalIncomeHistory += amt;
    } else if (t.type === 'expense') {
      if ((FIXED_CATEGORIES as readonly string[]).includes(t.category)) {
        fixedHistorySpend[t.category] = (fixedHistorySpend[t.category] ?? 0) + amt;
      } else {
        totalVariableHistory += amt;
      }
    }
  }

  const unpaidFixedBreakdown: UnpaidFixedItem[] = [];
  let totalUnpaidFixed = 0;

  for (const cat of FIXED_CATEGORIES) {
    const totalSpent = fixedHistorySpend[cat] ?? 0;
    const avgMonthly = totalSpent / historyMonthsCount;
    const paidThisMonth = currentPaidByCategory[cat] ?? 0;
    const unpaid = Math.max(avgMonthly - paidThisMonth, 0);

    totalUnpaidFixed += unpaid;
    unpaidFixedBreakdown.push({
      category: cat,
      historyMonthlyAverage: Math.round(avgMonthly * 100) / 100,
      paidThisMonth: Math.round(paidThisMonth * 100) / 100,
      unpaidRemaining: Math.round(unpaid * 100) / 100,
    });
  }

  // 3. Daily Variable Rate = total variable spend in history / total days in those history months
  let totalHistoryDays = 0;
  for (const mStr of completeMonths) {
    const [y, m] = mStr.split('-').map(Number);
    totalHistoryDays += getDaysInMonth(y, m);
  }

  const dailyVariableRate =
    totalHistoryDays > 0 ? totalVariableHistory / totalHistoryDays : 0;
  const expectedVariable = dailyVariableRate * daysLeft;

  // 4. Expected Income = 0 if income already received this month, else average monthly income in history
  const averageMonthlyIncomeHistory = totalIncomeHistory / historyMonthsCount;
  const expectedIncome = incomeSoFar > 0 ? 0 : averageMonthlyIncomeHistory;

  // 5. Predicted Month-End Balance = current_balance + expected_income - unpaid_fixed - expected_variable
  const predictedMonthEndBalance =
    currentBalance + expectedIncome - totalUnpaidFixed - expectedVariable;
  const predictedSavings = predictedMonthEndBalance - openingBalance;

  // Determine overspending status
  let overspendingRisk: 'on_track' | 'at_risk' | 'overspent' = 'on_track';
  if (spentSoFar > openingBalance + (incomeSoFar > 0 ? incomeSoFar : averageMonthlyIncomeHistory)) {
    overspendingRisk = 'overspent';
  } else if (predictedMonthEndBalance < 0) {
    overspendingRisk = 'at_risk';
  } else if (predictedMonthEndBalance < openingBalance * 0.5 && openingBalance > 0) {
    overspendingRisk = 'at_risk';
  }

  return {
    status: 'predicted',
    opening_balance: Math.round(openingBalance * 100) / 100,
    income_so_far: Math.round(incomeSoFar * 100) / 100,
    spent_so_far: Math.round(spentSoFar * 100) / 100,
    current_balance: Math.round(currentBalance * 100) / 100,
    historyMonthsCount,
    historyMonths: completeMonths,
    unpaid_fixed: Math.round(totalUnpaidFixed * 100) / 100,
    unpaid_fixed_breakdown: unpaidFixedBreakdown,
    daily_variable_rate: Math.round(dailyVariableRate * 100) / 100,
    total_variable_history: Math.round(totalVariableHistory * 100) / 100,
    total_history_days: totalHistoryDays,
    days_left: daysLeft,
    days_in_month: daysInCurrentMonth,
    current_day: currentDay,
    expected_variable: Math.round(expectedVariable * 100) / 100,
    expected_income: Math.round(expectedIncome * 100) / 100,
    average_monthly_income_history: Math.round(averageMonthlyIncomeHistory * 100) / 100,
    predicted_month_end_balance: Math.round(predictedMonthEndBalance * 100) / 100,
    predicted_savings: Math.round(predictedSavings * 100) / 100,
    overspendingRisk,
    explanation: {
      formula:
        'Predicted Balance = Current Balance + Expected Income - Unpaid Fixed Bills - Expected Variable Spending',
      steps: [
        {
          label: 'History Used',
          value: `${historyMonthsCount} complete months used`,
          detail: `Used complete history months: ${completeMonths.join(', ')} (${totalHistoryDays} days total).`,
        },
        {
          label: 'Current Balance',
          value: `₹${Math.round(currentBalance).toLocaleString('en-IN')}`,
          detail: `Opening balance (₹${Math.round(openingBalance).toLocaleString('en-IN')}) + Income so far (₹${Math.round(incomeSoFar).toLocaleString('en-IN')}) - Spent so far (₹${Math.round(spentSoFar).toLocaleString('en-IN')})`,
        },
        {
          label: 'Expected Future Income',
          value: `+₹${Math.round(expectedIncome).toLocaleString('en-IN')}`,
          detail:
            incomeSoFar > 0
              ? 'Salary already recorded this month (no additional salary expected).'
              : `Awaiting salary credit; projected from historical average of ₹${Math.round(averageMonthlyIncomeHistory).toLocaleString('en-IN')}/mo.`,
        },
        {
          label: 'Unpaid Fixed Expenses (Rent & Bills)',
          value: `-₹${Math.round(totalUnpaidFixed).toLocaleString('en-IN')}`,
          detail: unpaidFixedBreakdown
            .map(
              (item) =>
                `${item.category}: avg ₹${Math.round(item.historyMonthlyAverage).toLocaleString('en-IN')} - paid ₹${Math.round(item.paidThisMonth).toLocaleString('en-IN')} = ₹${Math.round(item.unpaidRemaining).toLocaleString('en-IN')}`
            )
            .join(' | '),
        },
        {
          label: `Expected Variable Spending (${daysLeft} days remaining)`,
          value: `-₹${Math.round(expectedVariable).toLocaleString('en-IN')}`,
          detail: `Daily variable burn ₹${Math.round(dailyVariableRate).toLocaleString('en-IN')}/day × ${daysLeft} days left in ${currentMonth}.`,
        },
        {
          label: 'Projected Month-End Balance',
          value: `₹${Math.round(predictedMonthEndBalance).toLocaleString('en-IN')}`,
          detail: `Expected to save ₹${Math.round(predictedSavings).toLocaleString('en-IN')} this month.`,
        },
      ],
    },
  };
}
