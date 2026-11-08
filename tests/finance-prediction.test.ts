import { describe, it, expect } from 'vitest';
import { calculateMonthEndPrediction, getDaysInMonth } from '@/lib/finance/prediction';
import { calculateSpendingAnalysis } from '@/lib/finance/analysis';
import { Transaction } from '@/types';

// Helper to create test transactions
const createTx = (
  date: string,
  description: string,
  amount: number,
  type: 'income' | 'expense',
  category: string
): Transaction => ({
  id: `tx-${Math.random()}`,
  user_id: 'user-1',
  date,
  description,
  amount,
  type,
  category,
  source: 'manual',
  created_at: new Date().toISOString(),
});

const historyTransactions: Transaction[] = [
  // Sep 2026
  createTx('2026-09-01', 'September Salary', 35000, 'income', 'Income'),
  createTx('2026-09-05', 'House Rent Sep', 8000, 'expense', 'Rent'),
  createTx('2026-09-10', 'Electricity Bill', 2000, 'expense', 'Bills'),
  createTx('2026-09-15', 'Grocery & Food', 6000, 'expense', 'Food'),
  createTx('2026-09-20', 'Fuel & Metro', 3000, 'expense', 'Transport'),

  // Oct 2026
  createTx('2026-10-01', 'October Salary', 35000, 'income', 'Income'),
  createTx('2026-10-05', 'House Rent Oct', 8000, 'expense', 'Rent'),
  createTx('2026-10-10', 'Water & Wi-Fi', 2000, 'expense', 'Bills'),
  createTx('2026-10-15', 'Grocery Market', 5000, 'expense', 'Food'),
  createTx('2026-10-20', 'Uber Rides', 4000, 'expense', 'Transport'),
  createTx('2026-10-25', 'Clothing Shopping', 3000, 'expense', 'Shopping'),
];

describe('Phase 4 - Month-End Prediction & Core Finance Logic', () => {

  it('Requirement: if history has fewer than 2 complete months -> return insufficient data result', () => {
    // 0 history months
    const res0 = calculateMonthEndPrediction({
      transactions: [createTx('2026-11-01', 'Salary', 35000, 'income', 'Income')],
      currentMonth: '2026-11',
      currentDay: 5,
    });
    expect(res0.status).toBe('insufficient_data');
    expect(res0.message).toMatch(/At least 2 complete months/i);
    expect(res0.historyMonthsCount).toBe(0);

    // 1 history month (only Oct)
    const res1 = calculateMonthEndPrediction({
      transactions: [
        createTx('2026-10-01', 'Salary', 35000, 'income', 'Income'),
        createTx('2026-10-05', 'Rent', 8000, 'expense', 'Rent'),
        createTx('2026-11-01', 'Salary', 35000, 'income', 'Income'),
      ],
      currentMonth: '2026-11',
      currentDay: 5,
    });
    expect(res1.status).toBe('insufficient_data');
    expect(res1.historyMonthsCount).toBe(1);
    expect(res1.message).toMatch(/At least 2 complete months/i);
  });

  it('calculates current_balance = opening_balance + income_so_far - spent_so_far', () => {
    const currentTx = [
      createTx('2026-11-01', 'Salary Nov', 35000, 'income', 'Income'),
      createTx('2026-11-02', 'Grocery', 1200, 'expense', 'Food'),
      createTx('2026-11-03', 'Uber', 300, 'expense', 'Transport'),
    ];

    const res = calculateMonthEndPrediction({
      transactions: [...historyTransactions, ...currentTx],
      currentMonth: '2026-11',
      currentDay: 10,
      openingBalance: 5000,
    });

    expect(res.status).toBe('predicted');
    expect(res.opening_balance).toBe(5000);
    expect(res.income_so_far).toBe(35000);
    expect(res.spent_so_far).toBe(1500);
    // 5000 + 35000 - 1500 = 38500
    expect(res.current_balance).toBe(38500);
  });

  it('calculates unpaid_fixed for Rent and Bills correctly', () => {
    // Current month: Nov (has paid 8000 rent, but only 500 bills)
    // Avg rent in history is 8000 -> unpaid rent = max(8000 - 8000, 0) = 0
    // Avg bills in history is 2000 -> unpaid bills = max(2000 - 500, 0) = 1500
    // Total unpaid fixed = 1500
    const currentTx = [
      createTx('2026-11-01', 'Salary', 35000, 'income', 'Income'),
      createTx('2026-11-05', 'Rent Paid', 8000, 'expense', 'Rent'),
      createTx('2026-11-07', 'Mobile Recharge', 500, 'expense', 'Bills'),
    ];

    const res = calculateMonthEndPrediction({
      transactions: [...historyTransactions, ...currentTx],
      currentMonth: '2026-11',
      currentDay: 10,
      openingBalance: 0,
    });

    expect(res.unpaid_fixed).toBe(1500);
    const rentItem = res.unpaid_fixed_breakdown.find((i) => i.category === 'Rent');
    const billsItem = res.unpaid_fixed_breakdown.find((i) => i.category === 'Bills');
    expect(rentItem?.unpaidRemaining).toBe(0);
    expect(billsItem?.unpaidRemaining).toBe(1500);
  });

  it('calculates expected_variable = daily_variable_rate * days_left', () => {
    // Total variable history = 21,000 across 61 days (Sep 30 + Oct 31)
    // Daily rate = 21000 / 61 = 344.262295...
    // November has 30 days. If currentDay = 10, daysLeft = 20.
    // Expected variable = 344.262295... * 20 = 6885.25
    const currentTx = [
      createTx('2026-11-01', 'Salary', 35000, 'income', 'Income'),
      createTx('2026-11-05', 'Rent Paid', 8000, 'expense', 'Rent'),
    ];

    const res = calculateMonthEndPrediction({
      transactions: [...historyTransactions, ...currentTx],
      currentMonth: '2026-11',
      currentDay: 10,
      openingBalance: 0,
    });

    expect(res.total_history_days).toBe(61);
    expect(res.total_variable_history).toBe(21000);
    expect(res.daily_variable_rate).toBeCloseTo(344.26, 1);
    expect(res.days_left).toBe(20);
    expect(res.expected_variable).toBeCloseTo(6885.25, 1);
  });

  it('handles expected_income: 0 if salary already credited, else average history income', () => {
    // Case A: Salary already received this month (income_so_far = 35000)
    const withSalary = calculateMonthEndPrediction({
      transactions: [
        ...historyTransactions,
        createTx('2026-11-01', 'Salary', 35000, 'income', 'Income'),
      ],
      currentMonth: '2026-11',
      currentDay: 5,
    });
    expect(withSalary.expected_income).toBe(0);

    // Case B: Salary NOT yet received this month (income_so_far = 0)
    const withoutSalary = calculateMonthEndPrediction({
      transactions: [
        ...historyTransactions,
        createTx('2026-11-02', 'Morning Breakfast', 100, 'expense', 'Food'),
      ],
      currentMonth: '2026-11',
      currentDay: 5,
    });
    // Expected income is the historical average (35000)
    expect(withoutSalary.expected_income).toBe(35000);
  });

  it('calculates full predicted_month_end_balance accurately', () => {
    // Current:
    // Opening balance = 2000
    // Income so far = 35000
    // Rent paid = 8000, Bills paid = 2000 (all fixed paid -> unpaid_fixed = 0)
    // Variable paid = 3000
    // Current balance = 2000 + 35000 - 13000 = 24000
    // Expected income = 0
    // Days left in Nov (30 - 15) = 15 days
    // Daily variable rate = 21000 / 61 = 344.262295
    // Expected variable = 344.262295 * 15 = 5163.93
    // Predicted balance = 24000 + 0 - 0 - 5163.93 = 18836.07
    const currentTx = [
      createTx('2026-11-01', 'Salary', 35000, 'income', 'Income'),
      createTx('2026-11-05', 'Rent', 8000, 'expense', 'Rent'),
      createTx('2026-11-06', 'Bills', 2000, 'expense', 'Bills'),
      createTx('2026-11-10', 'Food', 3000, 'expense', 'Food'),
    ];

    const res = calculateMonthEndPrediction({
      transactions: [...historyTransactions, ...currentTx],
      currentMonth: '2026-11',
      currentDay: 15,
      openingBalance: 2000,
    });

    expect(res.current_balance).toBe(24000); // 2000 + 35000 - 13000 = 24000
    expect(res.unpaid_fixed).toBe(0);
    expect(res.expected_variable).toBeCloseTo(5163.93, 1);
    expect(res.predicted_month_end_balance).toBeCloseTo(18836.07, 1);
    expect(res.overspendingRisk).toBe('on_track');
  });

  it('Requirement: High expenses trigger overspending alert (at_risk or overspent)', () => {
    // User has already spent 38,000 when income is 35,000 and opening balance is 1000
    const highSpendTx = [
      createTx('2026-11-01', 'Salary', 35000, 'income', 'Income'),
      createTx('2026-11-05', 'High Shopping Spend', 38000, 'expense', 'Shopping'),
    ];

    const res = calculateMonthEndPrediction({
      transactions: [...historyTransactions, ...highSpendTx],
      currentMonth: '2026-11',
      currentDay: 10,
      openingBalance: 1000,
    });

    // 38000 > 35000 + 1000
    expect(res.overspendingRisk).toBe('overspent');
  });

  it('Requirement: Low expenses result in higher projected balance and on_track', () => {
    const lowSpendTx = [
      createTx('2026-11-01', 'Salary', 35000, 'income', 'Income'),
      createTx('2026-11-05', 'Rent', 8000, 'expense', 'Rent'),
      createTx('2026-11-10', 'Groceries', 1500, 'expense', 'Food'),
    ];

    const res = calculateMonthEndPrediction({
      transactions: [...historyTransactions, ...lowSpendTx],
      currentMonth: '2026-11',
      currentDay: 28, // Near end of month, very little left to spend
      openingBalance: 10000,
    });

    expect(res.overspendingRisk).toBe('on_track');
    expect(res.predicted_month_end_balance).toBeGreaterThan(25000);
  });
});

describe('Phase 4 - Spending Analysis & Health Indicators', () => {
  const testTransactions: Transaction[] = [
    // October 2026
    {
      id: '1',
      user_id: 'u1',
      date: '2026-10-01',
      description: 'Salary',
      amount: 35000,
      type: 'income',
      category: 'Income',
      source: 'manual',
      created_at: '',
    },
    {
      id: '2',
      user_id: 'u1',
      date: '2026-10-05',
      description: 'Rent',
      amount: 8000,
      type: 'expense',
      category: 'Rent',
      source: 'manual',
      created_at: '',
    },
    {
      id: '3',
      user_id: 'u1',
      date: '2026-10-10',
      description: 'Bills',
      amount: 2000,
      type: 'expense',
      category: 'Bills',
      source: 'manual',
      created_at: '',
    },
    {
      id: '4',
      user_id: 'u1',
      date: '2026-10-15',
      description: 'Food',
      amount: 5000,
      type: 'expense',
      category: 'Food',
      source: 'manual',
      created_at: '',
    },
    // November 2026
    {
      id: '5',
      user_id: 'u1',
      date: '2026-11-01',
      description: 'Salary',
      amount: 35000,
      type: 'income',
      category: 'Income',
      source: 'manual',
      created_at: '',
    },
    {
      id: '6',
      user_id: 'u1',
      date: '2026-11-05',
      description: 'Rent',
      amount: 8000,
      type: 'expense',
      category: 'Rent',
      source: 'manual',
      created_at: '',
    },
    {
      id: '7',
      user_id: 'u1',
      date: '2026-11-10',
      description: 'Food',
      amount: 6000,
      type: 'expense',
      category: 'Food',
      source: 'manual',
      created_at: '',
    },
  ];

  it('correctly splits Fixed (Rent, Bills) vs Variable categories', () => {
    const analysis = calculateSpendingAnalysis({
      transactions: testTransactions,
      selectedMonth: '2026-11',
    });

    expect(analysis.totalIncome).toBe(35000);
    expect(analysis.totalExpenses).toBe(14000); // 8000 + 6000
    expect(analysis.netSavings).toBe(21000);

    // Fixed = Rent (8000)
    expect(analysis.fixedVariableSplit.totalFixed).toBe(8000);
    // Variable = Food (6000)
    expect(analysis.fixedVariableSplit.totalVariable).toBe(6000);

    const rentItem = analysis.categoryBreakdown.find((c) => c.category === 'Rent');
    const foodItem = analysis.categoryBreakdown.find((c) => c.category === 'Food');
    expect(rentItem?.isFixed).toBe(true);
    expect(foodItem?.isFixed).toBe(false);
  });

  it('computes Financial Health Indicator based on savings rate thresholds with >= 2 complete history months', () => {
    // 2 complete months in history (Sep and Oct)
    const analysis = calculateSpendingAnalysis({
      transactions: [...historyTransactions, ...testTransactions],
      selectedMonth: '2026-11',
    });

    expect(analysis.financialHealth.savingsRate).toBeGreaterThanOrEqual(20);
    expect(analysis.financialHealth.status).toBe('Healthy');
  });

  it('identifies Fair (10-20%) and Needs attention (< 10%) health status, or Not enough history (< 2 complete months)', () => {
    // Fewer than 2 complete months -> 'Not enough history'
    const notEnoughAnalysis = calculateSpendingAnalysis({
      transactions: [
        createTx('2026-11-01', 'Salary', 35000, 'income', 'Income'),
        createTx('2026-11-05', 'Food', 5000, 'expense', 'Food'),
      ],
      selectedMonth: '2026-11',
    });
    expect(notEnoughAnalysis.financialHealth.status).toBe('Not enough history');

    // 15% savings rate: Income 35000, Expenses 29750 in 2 complete history months
    const fairTx: Transaction[] = [
      createTx('2026-09-01', 'Salary', 35000, 'income', 'Income'),
      createTx('2026-09-05', 'Expenses', 29750, 'expense', 'Food'),
      createTx('2026-10-01', 'Salary', 35000, 'income', 'Income'),
      createTx('2026-10-05', 'Expenses', 29750, 'expense', 'Food'),
      createTx('2026-11-01', 'Salary', 35000, 'income', 'Income'),
      createTx('2026-11-05', 'Expenses', 29750, 'expense', 'Food'),
    ];
    const fairAnalysis = calculateSpendingAnalysis({
      transactions: fairTx,
      selectedMonth: '2026-11',
    });
    expect(fairAnalysis.financialHealth.status).toBe('Fair');

    // 5% savings rate: Income 35000, Expenses 33250 in 2 complete history months
    const poorTx: Transaction[] = [
      createTx('2026-09-01', 'Salary', 35000, 'income', 'Income'),
      createTx('2026-09-05', 'Expenses', 33250, 'expense', 'Food'),
      createTx('2026-10-01', 'Salary', 35000, 'income', 'Income'),
      createTx('2026-10-05', 'Expenses', 33250, 'expense', 'Food'),
      createTx('2026-11-01', 'Salary', 35000, 'income', 'Income'),
      createTx('2026-11-05', 'Expenses', 33250, 'expense', 'Food'),
    ];
    const poorAnalysis = calculateSpendingAnalysis({
      transactions: poorTx,
      selectedMonth: '2026-11',
    });
    expect(poorAnalysis.financialHealth.status).toBe('Needs attention');
  });

  it('generates chronological monthly trends', () => {
    const analysis = calculateSpendingAnalysis({
      transactions: testTransactions,
      selectedMonth: '2026-11',
    });

    expect(analysis.monthlyTrends.length).toBe(2);
    expect(analysis.monthlyTrends[0].month).toBe('2026-10');
    expect(analysis.monthlyTrends[1].month).toBe('2026-11');
    expect(analysis.monthlyTrends[0].expenses).toBe(15000);
    expect(analysis.monthlyTrends[1].expenses).toBe(14000);
  });
});
