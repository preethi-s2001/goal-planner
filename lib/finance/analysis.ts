import { Transaction, FIXED_CATEGORIES } from '@/types';
import { parseDateParts } from './prediction';
import { getCompleteHistoryMonths } from './complete-months';

export interface CategorySpending {
  category: string;
  amount: number;
  percentage: number;
  isFixed: boolean;
  historyMonthlyAverage: number;
  diffFromAverage: number; // current - average
  diffPercentage: number | null; // ((current - avg) / avg) * 100
}

export interface FixedVariableSplit {
  totalFixed: number;
  fixedPercentage: number;
  totalVariable: number;
  variablePercentage: number;
  totalExpenses: number;
}

export interface MonthlyTrendItem {
  month: string; // 'YYYY-MM'
  label: string; // e.g. 'Nov 2026'
  income: number;
  expenses: number;
  savings: number;
  savingsRate: number;
}

export interface FinancialHealthStatus {
  savingsRate: number; // percentage
  status: 'Healthy' | 'Fair' | 'Needs attention' | 'Not enough history';
  description: string;
  averageMonthlyIncome: number;
  averageMonthlyExpenses: number;
  averageMonthlySurplus: number;
}

export interface SpendingAnalysisResult {
  currentMonth: string;
  totalIncome: number;
  totalExpenses: number;
  netSavings: number;
  savingsRate: number;
  categoryBreakdown: CategorySpending[];
  fixedVariableSplit: FixedVariableSplit;
  monthlyTrends: MonthlyTrendItem[];
  financialHealth: FinancialHealthStatus;
}

/**
 * Calculates complete spending analysis, category distributions,
 * fixed vs variable splits, monthly trends, and financial health status.
 */
export function calculateSpendingAnalysis(params: {
  transactions: Transaction[];
  selectedMonth: string; // 'YYYY-MM'
}): SpendingAnalysisResult {
  const { transactions, selectedMonth } = params;

  // Group all transactions by month
  const monthlyData: Record<
    string,
    { income: number; expenses: number; categories: Record<string, number> }
  > = {};

  for (const t of transactions) {
    const { monthStr } = parseDateParts(t.date);
    if (!monthlyData[monthStr]) {
      monthlyData[monthStr] = { income: 0, expenses: 0, categories: {} };
    }
    const amt = Number(t.amount);
    if (t.type === 'income') {
      monthlyData[monthStr].income += amt;
    } else if (t.type === 'expense') {
      monthlyData[monthStr].expenses += amt;
      monthlyData[monthStr].categories[t.category] =
        (monthlyData[monthStr].categories[t.category] || 0) + amt;
    }
  }

  // Current selected month data
  const currentData = monthlyData[selectedMonth] || {
    income: 0,
    expenses: 0,
    categories: {},
  };
  const totalIncome = Math.round(currentData.income * 100) / 100;
  const totalExpenses = Math.round(currentData.expenses * 100) / 100;
  const netSavings = Math.round((totalIncome - totalExpenses) * 100) / 100;
  const currentSavingsRate =
    totalIncome > 0 ? Math.round(((totalIncome - totalExpenses) / totalIncome) * 1000) / 10 : 0;

  // Item 13: History months count as complete only if before current month AND
  // (not user's first data month OR first tx is on or before 7th)
  const { completeMonths: historyMonths, count: historyMonthsCount } = getCompleteHistoryMonths(
    transactions,
    selectedMonth
  );

  // Calculate average category spend in complete history
  const historyCategorySums: Record<string, number> = {};
  let totalHistoryIncome = 0;
  let totalHistoryExpenses = 0;

  for (const m of historyMonths) {
    const mData = monthlyData[m];
    if (mData) {
      totalHistoryIncome += mData.income;
      totalHistoryExpenses += mData.expenses;
      for (const [cat, amt] of Object.entries(mData.categories)) {
        historyCategorySums[cat] = (historyCategorySums[cat] || 0) + amt;
      }
    }
  }

  // Build category breakdown for selected month
  // Include all categories present in current month OR with history spend
  const allCategories = new Set([
    ...Object.keys(currentData.categories),
    ...Object.keys(historyCategorySums),
  ]);

  const allCategoriesList = Array.from(allCategories);

  let totalFixed = 0;
  let totalVariable = 0;
  const categoryBreakdown: CategorySpending[] = [];

  for (const cat of allCategoriesList) {
    const spent = currentData.categories[cat] || 0;
    const isFixed = (FIXED_CATEGORIES as readonly string[]).includes(cat);

    if (isFixed) {
      totalFixed += spent;
    } else {
      totalVariable += spent;
    }

    const percentage =
      totalExpenses > 0 ? Math.round((spent / totalExpenses) * 1000) / 10 : 0;
    const histAvg =
      historyMonthsCount > 0
        ? Math.round(((historyCategorySums[cat] || 0) / historyMonthsCount) * 100) / 100
        : spent;
    const diffFromAvg = Math.round((spent - histAvg) * 100) / 100;
    const diffPct =
      histAvg > 0 ? Math.round(((spent - histAvg) / histAvg) * 1000) / 10 : null;

    if (spent > 0 || histAvg > 0) {
      categoryBreakdown.push({
        category: cat,
        amount: Math.round(spent * 100) / 100,
        percentage,
        isFixed,
        historyMonthlyAverage: histAvg,
        diffFromAverage: diffFromAvg,
        diffPercentage: diffPct,
      });
    }
  }

  // Sort categories by amount descending
  categoryBreakdown.sort((a, b) => b.amount - a.amount);

  const fixedPercentage =
    totalExpenses > 0 ? Math.round((totalFixed / totalExpenses) * 1000) / 10 : 0;
  const variablePercentage =
    totalExpenses > 0 ? Math.round((totalVariable / totalExpenses) * 1000) / 10 : 0;

  // Monthly trends sorted chronologically
  const allMonths = Object.keys(monthlyData).sort();
  const monthlyTrends: MonthlyTrendItem[] = allMonths.map((mStr) => {
    const [y, m] = mStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, 1);
    const label = dateObj.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    const inc = Math.round(monthlyData[mStr].income * 100) / 100;
    const exp = Math.round(monthlyData[mStr].expenses * 100) / 100;
    const sav = Math.round((inc - exp) * 100) / 100;
    const savRate = inc > 0 ? Math.round((sav / inc) * 1000) / 10 : 0;

    return {
      month: mStr,
      label,
      income: inc,
      expenses: exp,
      savings: sav,
      savingsRate: savRate,
    };
  });

  // Financial Health Indicator per Project Brief:
  // savings_rate = (avg income - avg expenses) / avg income * 100
  // >= 20% "Healthy", 10-20% "Fair", < 10% "Needs attention"
  const avgIncome =
    historyMonthsCount > 0
      ? totalHistoryIncome / historyMonthsCount
      : totalIncome;
  const avgExpenses =
    historyMonthsCount > 0
      ? totalHistoryExpenses / historyMonthsCount
      : totalExpenses;
  const avgSurplus = avgIncome - avgExpenses;
  const baselineSavingsRate =
    avgIncome > 0 ? Math.round((avgSurplus / avgIncome) * 1000) / 10 : 0;

  // Item 15: Financial health: show "Not enough history" with fewer than 2 complete months.
  let healthStatus: 'Healthy' | 'Fair' | 'Needs attention' | 'Not enough history' = 'Needs attention';
  let healthDesc = 'Savings rate is below 10%. Try cutting discretionary variable spends.';

  if (historyMonthsCount < 2) {
    healthStatus = 'Not enough history';
    healthDesc = 'At least 2 complete months of transaction history are required to evaluate your financial health status.';
  } else if (baselineSavingsRate >= 20) {
    healthStatus = 'Healthy';
    healthDesc = `Strong savings rate of ${baselineSavingsRate}% (≥ 20% threshold). Excellent foundation for building an emergency fund.`;
  } else if (baselineSavingsRate >= 10) {
    healthStatus = 'Fair';
    healthDesc = `Moderate savings rate of ${baselineSavingsRate}% (10% - 20% range). Manageable, but vulnerable to unexpected shocks.`;
  }

  return {
    currentMonth: selectedMonth,
    totalIncome,
    totalExpenses,
    netSavings,
    savingsRate: currentSavingsRate,
    categoryBreakdown,
    fixedVariableSplit: {
      totalFixed: Math.round(totalFixed * 100) / 100,
      fixedPercentage,
      totalVariable: Math.round(totalVariable * 100) / 100,
      variablePercentage,
      totalExpenses,
    },
    monthlyTrends,
    financialHealth: {
      savingsRate: baselineSavingsRate,
      status: healthStatus,
      description: healthDesc,
      averageMonthlyIncome: Math.round(avgIncome * 100) / 100,
      averageMonthlyExpenses: Math.round(avgExpenses * 100) / 100,
      averageMonthlySurplus: Math.round(avgSurplus * 100) / 100,
    },
  };
}
