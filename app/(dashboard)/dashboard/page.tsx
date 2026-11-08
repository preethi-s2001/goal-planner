'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import {
  IndianRupee,
  TrendingUp,
  TrendingDown,
  Wallet,
  Calendar,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowLeftRight,
  Target,
  Sliders,
  WalletCards,
  Plus,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Clock,
  Loader2,
  PieChart as PieChartIcon,
  RefreshCw,
  Edit3,
  Layers,
  ArrowUpRight,
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { formatCurrency, formatDate } from '@/lib/utils';
import { QuickEntryModal } from '@/components/transactions/QuickEntryModal';
import { OpeningBalanceModal } from '@/components/dashboard/OpeningBalanceModal';
import type { MonthEndPredictionResult } from '@/lib/finance/prediction';
import type { SpendingAnalysisResult } from '@/lib/finance/analysis';
import type { Transaction } from '@/types';

// Color palette for category pie/bar charts
const CATEGORY_COLORS: Record<string, string> = {
  Rent: '#6366f1', // Indigo
  Food: '#10b981', // Emerald
  Transport: '#f59e0b', // Amber
  Shopping: '#ec4899', // Pink
  Bills: '#06b6d4', // Cyan
  Entertainment: '#8b5cf6', // Purple
  Health: '#14b8a6', // Teal
  Others: '#64748b', // Slate
  Income: '#22c55e', // Green
};

const DEFAULT_COLOR = '#94a3b8';

function DashboardContent() {
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data from API
  const [prediction, setPrediction] = useState<MonthEndPredictionResult | null>(null);
  const [analysis, setAnalysis] = useState<SpendingAnalysisResult | null>(null);
  const [openingBalance, setOpeningBalance] = useState<number>(0);
  const [openingBalanceNeedsConfirmation, setOpeningBalanceNeedsConfirmation] = useState(false);
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);

  // Modals & UI toggles
  const [isQuickEntryOpen, setIsQuickEntryOpen] = useState(false);
  const [isOpeningBalanceOpen, setIsOpeningBalanceOpen] = useState(false);
  const [howCalculatedOpen, setHowCalculatedOpen] = useState(false);

  const fetchDashboardData = async (month: string) => {
    try {
      setLoading(true);
      setError(null);

      // Item 10: Send client local date (YYYY-MM-DD)
      const todayStr = new Date().toLocaleDateString('en-CA');

      const [dashRes, txRes] = await Promise.all([
        fetch(`/api/finance/dashboard?month=${month}&today=${todayStr}`),
        fetch(`/api/transactions?limit=5`),
      ]);

      if (!dashRes.ok) {
        throw new Error('Failed to load dashboard financial data');
      }

      const dashData = await dashRes.json();
      setPrediction(dashData.prediction);
      setAnalysis(dashData.analysis);
      setOpeningBalance(dashData.openingBalance || 0);
      setOpeningBalanceNeedsConfirmation(Boolean(dashData.openingBalanceNeedsConfirmation));
      setAvailableMonths(dashData.availableMonths || [month]);

      if (txRes.ok) {
        const txData = await txRes.json();
        setRecentTransactions(txData.transactions || []);
      }
    } catch (err: any) {
      setError(err.message || 'Could not load financial data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData(selectedMonth);
  }, [selectedMonth]);

  // Chart Data preparation
  const pieChartData = useMemo(() => {
    if (!analysis || !analysis.categoryBreakdown) return [];
    return analysis.categoryBreakdown
      .filter((c) => c.amount > 0)
      .map((c) => ({
        name: c.category,
        value: c.amount,
        color: CATEGORY_COLORS[c.category] || DEFAULT_COLOR,
      }));
  }, [analysis]);

  return (
    <div className="space-y-6">
      {/* Top Banner: Month Selector & Action Buttons */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            Financial Health & Dashboard
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Real-time balance, month-end trajectory, and automated budgeting mathematics.
          </p>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          {/* Month Dropdown */}
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-white font-semibold text-xs text-slate-700 shadow-2xs focus:ring-2 focus:ring-emerald-500"
          >
            {availableMonths.map((m) => {
              const [y, mon] = m.split('-').map(Number);
              const label = new Date(y, mon - 1, 1).toLocaleDateString('en-US', {
                month: 'short',
                year: 'numeric',
              });
              return (
                <option key={m} value={m}>
                  {label} ({m})
                </option>
              );
            })}
          </select>

          {/* Quick Add Button */}
          <button
            onClick={() => setIsQuickEntryOpen(true)}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-semibold text-xs transition-all shadow-xs"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Add Transaction</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-10 h-10 animate-spin text-emerald-600" />
          <p className="text-xs text-slate-500 font-medium">Calculating financial projections…</p>
        </div>
      ) : error ? (
        <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => fetchDashboardData(selectedMonth)}
            className="px-3 py-1.5 rounded-lg bg-rose-600 text-white font-semibold"
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          {/* Item 14: Opening Balance confirmation banner */}
          {openingBalanceNeedsConfirmation && (
            <div className="p-4 bg-amber-50 border border-amber-200/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900 shadow-2xs">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                <p className="text-xs sm:text-sm">
                  <span className="font-bold">Opening Balance Unconfirmed:</span> Defaulted to cumulative net from previous months ({formatCurrency(openingBalance)}). Please confirm or update it.
                </p>
              </div>
              <button
                onClick={() => setIsOpeningBalanceOpen(true)}
                className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold shrink-0 transition"
              >
                Confirm Balance
              </button>
            </div>
          )}

          {/* 4 Key Snapshot Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Current Balance */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs relative group">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Current Balance
                </span>
                <button
                  onClick={() => setIsOpeningBalanceOpen(true)}
                  title="Adjust Opening Balance"
                  className="p-1 rounded-md text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              </div>
              <p
                className={`text-2xl font-extrabold mt-1 tracking-tight ${
                  (prediction?.current_balance ?? 0) >= 0 ? 'text-slate-900' : 'text-rose-600'
                }`}
              >
                {formatCurrency(prediction?.current_balance ?? 0)}
              </p>
              <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-100">
                <span>Start: {formatCurrency(openingBalance)}</span>
                <span className="text-emerald-600 font-semibold">
                  +{formatCurrency(prediction?.income_so_far ?? 0)} in
                </span>
              </div>
            </div>

            {/* Card 2: Spent This Month */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Spent This Month
                </span>
                <div className="h-8 w-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                  <TrendingDown className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-extrabold text-slate-900 mt-1 tracking-tight">
                {formatCurrency(prediction?.spent_so_far ?? 0)}
              </p>
              <div className="text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
                <span>
                  {analysis?.fixedVariableSplit
                    ? `Fixed: ${formatCurrency(analysis.fixedVariableSplit.totalFixed)}`
                    : 'Fixed bills pending'}
                </span>
                <span className="text-slate-400">
                  Var: {formatCurrency(analysis?.fixedVariableSplit.totalVariable ?? 0)}
                </span>
              </div>
            </div>

            {/* Card 3: Month-End Predicted Balance */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Month-End Forecast
                </span>
                {prediction?.status === 'predicted' ? (
                  prediction.overspendingRisk === 'on_track' ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      On Track
                    </span>
                  ) : prediction.overspendingRisk === 'at_risk' ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                      At Risk
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                      Overspent
                    </span>
                  )
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600">
                    Needs History
                  </span>
                )}
              </div>
              <p
                className={`text-2xl font-extrabold mt-1 tracking-tight ${
                  (prediction?.predicted_month_end_balance ?? 0) >= 0
                    ? 'text-teal-700'
                    : 'text-rose-600'
                }`}
              >
                {prediction?.status === 'predicted'
                  ? formatCurrency(prediction.predicted_month_end_balance)
                  : '—'}
              </p>
              <div className="text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
                <span>
                  {prediction?.status === 'predicted'
                    ? `Savings: ${formatCurrency(prediction.predicted_savings)}`
                    : 'Requires 2+ months'}
                </span>
                <button
                  onClick={() => setHowCalculatedOpen((v) => !v)}
                  className="text-indigo-600 hover:text-indigo-800 font-semibold"
                >
                  {howCalculatedOpen ? 'Hide' : 'Explain'}
                </button>
              </div>
            </div>

            {/* Card 4: Financial Health Indicator */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Financial Health
                </span>
                <div
                  className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                    analysis?.financialHealth.status === 'Healthy'
                      ? 'bg-emerald-50 text-emerald-600'
                      : analysis?.financialHealth.status === 'Fair'
                      ? 'bg-amber-50 text-amber-600'
                      : 'bg-rose-50 text-rose-600'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <p className="text-2xl font-extrabold text-slate-900 tracking-tight">
                  {analysis?.financialHealth.status || 'Assessing'}
                </p>
                <span className="text-xs font-semibold text-slate-500">
                  ({analysis?.financialHealth.savingsRate ?? 0}% savings)
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-100 truncate">
                {analysis?.financialHealth.description || 'Tracking monthly flow'}
              </p>
            </div>
          </div>

          {/* "How Was This Calculated?" Interactive Expander */}
          {howCalculatedOpen && prediction && (
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-5 shadow-xs space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-indigo-600" />
                  <h3 className="font-bold text-sm text-indigo-950">
                    How was this Month-End Forecast Calculated?
                  </h3>
                </div>
                <button
                  onClick={() => setHowCalculatedOpen(false)}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                >
                  Close
                </button>
              </div>

              {prediction.status === 'insufficient_data' ? (
                <div className="text-xs text-indigo-900 space-y-2">
                  <p>{prediction.message}</p>
                  <div className="flex gap-3 pt-2">
                    <Link
                      href="/transactions"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-semibold text-xs hover:bg-indigo-700"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Upload Bank Statement (CSV)</span>
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-white border border-indigo-100 font-mono text-xs text-indigo-900 font-semibold">
                    {prediction.explanation.formula}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    {prediction.explanation.steps.map((s, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl bg-white border border-indigo-100 shadow-2xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-700">{s.label}</span>
                          <span className="font-bold text-indigo-950 font-mono">{s.value}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-relaxed">{s.detail}</p>
                      </div>
                    ))}
                  </div>

                  {prediction.unpaid_fixed_breakdown.length > 0 && (
                    <div className="pt-1 text-[11px] text-indigo-800/80">
                      💡 <strong>Fixed Bill Status:</strong>{' '}
                      {prediction.unpaid_fixed_breakdown
                        .map(
                          (item) =>
                            `${item.category}: Paid ₹${item.paidThisMonth.toLocaleString('en-IN')} of avg ₹${item.historyMonthlyAverage.toLocaleString('en-IN')}`
                        )
                        .join(' • ')}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Visual Spending Breakdown & Category Share */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chart: Category Spending Distribution */}
            <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    Category Spending Breakdown ({selectedMonth})
                  </h3>
                  <p className="text-xs text-slate-500">
                    Where your money went this month compared to historical averages.
                  </p>
                </div>
                <Link
                  href="/analysis"
                  className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                >
                  <span>Detailed Analysis</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {analysis?.categoryBreakdown && analysis.categoryBreakdown.length > 0 ? (
                <div className="space-y-4">
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={analysis.categoryBreakdown}
                        margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis
                          dataKey="category"
                          tick={{ fontSize: 11, fill: '#64748b' }}
                          interval={0}
                          angle={-25}
                          textAnchor="end"
                        />
                        <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                        <Tooltip
                          formatter={(value: any) => [`₹${Number(value).toLocaleString('en-IN')}`, 'Spent']}
                          contentStyle={{ borderRadius: '12px', fontSize: '12px', border: '1px solid #e2e8f0' }}
                        />
                        <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                          {analysis.categoryBreakdown.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={CATEGORY_COLORS[entry.category] || DEFAULT_COLOR}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Category Progress Bars */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    {analysis.categoryBreakdown.slice(0, 6).map((cat) => (
                      <div
                        key={cat.category}
                        className="p-3 rounded-xl border border-slate-100 bg-slate-50/50 space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                            <span
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: CATEGORY_COLORS[cat.category] || DEFAULT_COLOR }}
                            />
                            {cat.category}
                          </span>
                          <span className="font-bold text-slate-900">{formatCurrency(cat.amount)}</span>
                        </div>
                        <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(cat.percentage, 100)}%`,
                              backgroundColor: CATEGORY_COLORS[cat.category] || DEFAULT_COLOR,
                            }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-500">
                          <span>{cat.percentage}% of spend</span>
                          <span>
                            {cat.diffPercentage !== null
                              ? `${cat.diffPercentage >= 0 ? '+' : ''}${cat.diffPercentage}% vs avg`
                              : 'No prior baseline'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center text-xs text-slate-500">
                  No expenses recorded in {selectedMonth} yet.
                </div>
              )}
            </div>

            {/* Side Column: Fixed vs Variable & Recent Transactions */}
            <div className="space-y-6">
              {/* Fixed vs Variable Split Card */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-3">
                <h3 className="font-bold text-sm text-slate-900">Fixed vs. Variable Split</h3>
                <p className="text-xs text-slate-500">
                  Fixed expenses are non-negotiable (Rent, Bills). Variable expenses can be adjusted.
                </p>

                {analysis?.fixedVariableSplit && analysis.fixedVariableSplit.totalExpenses > 0 ? (
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between text-xs">
                      <div>
                        <span className="text-indigo-600 font-bold block">
                          Fixed: {formatCurrency(analysis.fixedVariableSplit.totalFixed)}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {analysis.fixedVariableSplit.fixedPercentage}% of budget
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-amber-600 font-bold block">
                          Variable: {formatCurrency(analysis.fixedVariableSplit.totalVariable)}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {analysis.fixedVariableSplit.variablePercentage}% of budget
                        </span>
                      </div>
                    </div>

                    <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex">
                      <div
                        style={{ width: `${analysis.fixedVariableSplit.fixedPercentage}%` }}
                        className="bg-indigo-500 h-full"
                        title={`Fixed: ${analysis.fixedVariableSplit.fixedPercentage}%`}
                      />
                      <div
                        style={{ width: `${analysis.fixedVariableSplit.variablePercentage}%` }}
                        className="bg-amber-400 h-full"
                        title={`Variable: ${analysis.fixedVariableSplit.variablePercentage}%`}
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 py-3">No expenses recorded yet.</p>
                )}
              </div>

              {/* Recent Activity List */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-slate-900">Recent Transactions</h3>
                  <Link
                    href="/transactions"
                    className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
                  >
                    View All
                  </Link>
                </div>

                {recentTransactions.length > 0 ? (
                  <div className="divide-y divide-slate-100 text-xs">
                    {recentTransactions.slice(0, 5).map((t) => (
                      <div key={t.id} className="py-2.5 flex items-center justify-between">
                        <div className="max-w-[180px] truncate">
                          <p className="font-semibold text-slate-800 truncate">{t.description}</p>
                          <span className="text-[10px] text-slate-400">{formatDate(t.date)}</span>
                        </div>
                        <div className="text-right">
                          <span
                            className={`font-bold block ${
                              t.type === 'income' ? 'text-emerald-600' : 'text-slate-900'
                            }`}
                          >
                            {t.type === 'income' ? '+' : '-'}
                            {formatCurrency(t.amount)}
                          </span>
                          <span className="text-[10px] text-slate-500 font-medium">{t.category}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 py-4 text-center">No transactions yet.</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Opening Balance Modal */}
      <OpeningBalanceModal
        isOpen={isOpeningBalanceOpen}
        onClose={() => setIsOpeningBalanceOpen(false)}
        currentMonth={selectedMonth}
        initialBalance={openingBalance}
        onSuccess={(newBal) => {
          setOpeningBalance(newBal);
          fetchDashboardData(selectedMonth);
        }}
      />

      {/* Quick Entry Modal */}
      <QuickEntryModal
        isOpen={isQuickEntryOpen}
        onClose={() => setIsQuickEntryOpen(false)}
        onSuccess={() => fetchDashboardData(selectedMonth)}
        recentTransactions={recentTransactions}
      />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="py-24 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
