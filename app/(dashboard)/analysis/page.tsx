'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import {
  PieChart as PieChartIcon,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Calendar,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  Layers,
  Sparkles,
  ShieldCheck,
  Info,
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
  Legend,
  LineChart,
  Line,
} from 'recharts';
import { formatCurrency } from '@/lib/utils';
import type { SpendingAnalysisResult } from '@/lib/finance/analysis';

const CATEGORY_COLORS: Record<string, string> = {
  Rent: '#6366f1',
  Food: '#10b981',
  Transport: '#f59e0b',
  Shopping: '#ec4899',
  Bills: '#06b6d4',
  Entertainment: '#8b5cf6',
  Health: '#14b8a6',
  Others: '#64748b',
  Income: '#22c55e',
};

const DEFAULT_COLOR = '#94a3b8';

function AnalysisContent() {
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<SpendingAnalysisResult | null>(null);
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);

  const fetchAnalysisData = async (month: string) => {
    try {
      setLoading(true);
      setError(null);

      const today = new Date().toLocaleDateString('en-CA');
      const res = await fetch(`/api/finance/dashboard?month=${month}&today=${today}`);
      if (!res.ok) {
        throw new Error('Failed to load spending analysis');
      }

      const data = await res.json();
      setAnalysis(data.analysis);
      setAvailableMonths(data.availableMonths || [month]);
    } catch (err: any) {
      setError(err.message || 'Could not load spending data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalysisData(selectedMonth);
  }, [selectedMonth]);

  // Donut chart data
  const donutData = useMemo(() => {
    if (!analysis || !analysis.categoryBreakdown) return [];
    return analysis.categoryBreakdown
      .filter((c) => c.amount > 0)
      .map((c) => ({
        name: c.category,
        value: c.amount,
        percentage: c.percentage,
        color: CATEGORY_COLORS[c.category] || DEFAULT_COLOR,
      }));
  }, [analysis]);

  // Bar chart data comparing Current Month vs Historical Average
  const comparisonData = useMemo(() => {
    if (!analysis || !analysis.categoryBreakdown) return [];
    return analysis.categoryBreakdown.map((c) => ({
      category: c.category,
      ThisMonth: c.amount,
      Average: c.historyMonthlyAverage,
    }));
  }, [analysis]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            Spending Analysis & Category Insights
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Visual breakdown of expenses, historical comparisons, and month-on-month trends.
          </p>
        </div>

        {/* Month Selector */}
        <div className="flex items-center gap-2 self-stretch sm:self-auto">
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
        </div>
      </div>

      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-10 h-10 animate-spin text-emerald-600" />
          <p className="text-xs text-slate-500 font-medium">Aggregating category analytics…</p>
        </div>
      ) : error ? (
        <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => fetchAnalysisData(selectedMonth)}
            className="px-3 py-1.5 rounded-lg bg-rose-600 text-white font-semibold"
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          {/* Summary Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Total Inflow
              </span>
              <p className="text-2xl font-extrabold text-emerald-600 mt-1 tracking-tight">
                +{formatCurrency(analysis?.totalIncome ?? 0)}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Recorded this month</p>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Total Outflow
              </span>
              <p className="text-2xl font-extrabold text-slate-900 mt-1 tracking-tight">
                {formatCurrency(analysis?.totalExpenses ?? 0)}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Across all categories</p>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Period Savings
              </span>
              <p
                className={`text-2xl font-extrabold mt-1 tracking-tight ${
                  (analysis?.netSavings ?? 0) >= 0 ? 'text-teal-700' : 'text-rose-600'
                }`}
              >
                {(analysis?.netSavings ?? 0) >= 0 ? '+' : ''}
                {formatCurrency(analysis?.netSavings ?? 0)}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                {analysis?.savingsRate ?? 0}% savings rate
              </p>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Fixed vs Variable
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-lg font-bold text-indigo-700">
                  {analysis?.fixedVariableSplit.fixedPercentage}%
                </span>
                <span className="text-xs text-slate-400">fixed /</span>
                <span className="text-lg font-bold text-amber-600">
                  {analysis?.fixedVariableSplit.variablePercentage}%
                </span>
                <span className="text-xs text-slate-400">variable</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Fixed: Rent & Bills</p>
            </div>
          </div>

          {/* Visual Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: Donut Distribution of Category Spending */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Spending by Category</h3>
                  <p className="text-xs text-slate-500">Distribution for {selectedMonth}</p>
                </div>
                <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <PieChartIcon className="w-4 h-4" />
                </div>
              </div>

              {donutData.length > 0 ? (
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={donutData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={95}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {donutData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN')}`, 'Spent']}
                        contentStyle={{ borderRadius: '12px', fontSize: '12px' }}
                      />
                      <Legend
                        verticalAlign="bottom"
                        height={36}
                        formatter={(val) => <span className="text-xs text-slate-600 font-medium">{val}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="py-20 text-center text-xs text-slate-400">No expenses in this month.</div>
              )}
            </div>

            {/* Chart 2: Category Comparison (This Month vs History Average) */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">This Month vs. Historical Average</h3>
                  <p className="text-xs text-slate-500">Spot where spending deviated from typical patterns</p>
                </div>
                <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <BarChart3 className="w-4 h-4" />
                </div>
              </div>

              {comparisonData.length > 0 ? (
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={comparisonData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
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
                        formatter={(value: any) => [`₹${Number(value).toLocaleString('en-IN')}`]}
                        contentStyle={{ borderRadius: '12px', fontSize: '12px' }}
                      />
                      <Legend
                        verticalAlign="top"
                        align="right"
                        formatter={(val) => (
                          <span className="text-xs text-slate-600 font-medium">
                            {val === 'ThisMonth' ? 'This Month' : 'Monthly Avg'}
                          </span>
                        )}
                      />
                      <Bar dataKey="ThisMonth" fill="#10b981" radius={[4, 4, 0, 0]} name="ThisMonth" />
                      <Bar dataKey="Average" fill="#cbd5e1" radius={[4, 4, 0, 0]} name="Average" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="py-20 text-center text-xs text-slate-400">No comparative data.</div>
              )}
            </div>
          </div>

          {/* Chart 3: Month-on-Month Trends */}
          {analysis?.monthlyTrends && analysis.monthlyTrends.length > 1 && (
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Month-on-Month Financial Trend</h3>
                  <p className="text-xs text-slate-500">Track how your income, spending, and savings evolve over time</p>
                </div>
                <div className="h-8 w-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analysis.monthlyTrends} margin={{ top: 10, right: 10, left: -20, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                    <Tooltip
                      formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN')}`]}
                      contentStyle={{ borderRadius: '12px', fontSize: '12px' }}
                    />
                    <Legend
                      verticalAlign="top"
                      align="right"
                      formatter={(val) => <span className="text-xs text-slate-600 font-medium capitalize">{val}</span>}
                    />
                    <Bar dataKey="income" fill="#22c55e" radius={[4, 4, 0, 0]} name="income" />
                    <Bar dataKey="expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} name="expenses" />
                    <Bar dataKey="savings" fill="#0d9488" radius={[4, 4, 0, 0]} name="savings" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Detailed Category Breakdown Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Category Breakdown & Variance Table</h3>
                <p className="text-xs text-slate-500">Detailed numerical view with history comparison</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4 text-center">Type</th>
                    <th className="py-3 px-4 text-right">Spent This Month</th>
                    <th className="py-3 px-4 text-right">% of Total</th>
                    <th className="py-3 px-4 text-right">Historical Avg</th>
                    <th className="py-3 px-4 text-right">Difference vs Avg</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {analysis?.categoryBreakdown && analysis.categoryBreakdown.length > 0 ? (
                    analysis.categoryBreakdown.map((row) => (
                      <tr key={row.category} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-900 flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: CATEGORY_COLORS[row.category] || DEFAULT_COLOR }}
                          />
                          <span>{row.category}</span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              row.isFixed
                                ? 'bg-indigo-100 text-indigo-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {row.isFixed ? 'Fixed' : 'Variable'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900">
                          {formatCurrency(row.amount)}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-600 font-medium">
                          {row.percentage}%
                        </td>
                        <td className="py-3 px-4 text-right text-slate-500">
                          {formatCurrency(row.historyMonthlyAverage)}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          {row.diffPercentage !== null ? (
                            <span
                              className={`inline-flex items-center gap-0.5 font-semibold ${
                                row.diffPercentage > 10
                                  ? 'text-rose-600'
                                  : row.diffPercentage < -10
                                  ? 'text-emerald-600'
                                  : 'text-slate-600'
                              }`}
                            >
                              {row.diffPercentage > 0 ? (
                                <ArrowUpRight className="w-3.5 h-3.5" />
                              ) : row.diffPercentage < 0 ? (
                                <ArrowDownRight className="w-3.5 h-3.5" />
                              ) : null}
                              {row.diffPercentage >= 0 ? '+' : ''}
                              {row.diffPercentage}% ({formatCurrency(row.diffFromAverage)})
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {row.diffPercentage !== null && row.diffPercentage > 20 ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 border border-rose-200 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                              <AlertTriangle className="w-3 h-3" />
                              Above Avg
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-medium">Normal</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No transactions recorded for this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function AnalysisPage() {
  return (
    <Suspense
      fallback={
        <div className="py-24 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      }
    >
      <AnalysisContent />
    </Suspense>
  );
}
