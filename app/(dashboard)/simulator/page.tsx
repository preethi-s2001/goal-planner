'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import {
  Sliders,
  TrendingUp,
  ArrowRight,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  Target,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Plus,
  Info,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Calendar,
  Layers,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { simulateScenario, type SimulationResult } from '@/lib/finance/simulator';
import { Goal, DEFAULT_EXPENSE_CATEGORIES } from '@/types';
import { useToast } from '@/components/ui/Toast';

const DEFAULT_BASELINE_INCOME = 35000;
const DEFAULT_BASELINE_SPENDS: Record<string, number> = {
  Rent: 8000,
  Food: 5000,
  Transport: 3000,
  Shopping: 4000,
  Bills: 2500,
  Entertainment: 2000,
  Health: 1500,
  Others: 2000,
};

function SimulatorContent() {
  const [loading, setLoading] = useState(true);
  const [baselineIncome, setBaselineIncome] = useState<number>(DEFAULT_BASELINE_INCOME);
  const [baselineCategorySpends, setBaselineCategorySpends] = useState<Record<string, number>>(DEFAULT_BASELINE_SPENDS);
  const [currentBalance, setCurrentBalance] = useState<number>(0);
  const [goals, setGoals] = useState<Goal[]>([]);

  // Simulation controls state
  const [salaryChange, setSalaryChange] = useState<number>(0);
  const [categoryChanges, setCategoryChanges] = useState<Record<string, number>>({});

  const { info: toastInfo, success: toastSuccess } = useToast();

  // Load real financial data from dashboard & goals APIs
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const today = new Date().toLocaleDateString('en-CA');
        const [dashRes, goalsRes] = await Promise.all([
          fetch(`/api/finance/dashboard?today=${today}`).catch(() => null),
          fetch(`/api/goals?today=${today}`).catch(() => null),
        ]);

        if (dashRes && dashRes.ok) {
          const dashData = await dashRes.json();
          // Extract expected or history average income
          if (dashData.prediction?.expected_income && dashData.prediction.expected_income > 0) {
            setBaselineIncome(dashData.prediction.expected_income);
          } else if (dashData.analysis?.summary?.totalIncome && dashData.analysis.summary.totalIncome > 0) {
            setBaselineIncome(dashData.analysis.summary.totalIncome);
          }

          if (dashData.prediction?.current_balance !== undefined) {
            setCurrentBalance(dashData.prediction.current_balance);
          }

          // Category spends
          if (dashData.analysis?.categoryBreakdown && Array.isArray(dashData.analysis.categoryBreakdown)) {
            const spends: Record<string, number> = {};
            for (const item of dashData.analysis.categoryBreakdown) {
              if (item.category && item.category !== 'Income') {
                spends[item.category] = item.spentThisMonth || item.historyMonthlyAverage || 0;
              }
            }
            // Ensure standard categories exist
            for (const cat of DEFAULT_EXPENSE_CATEGORIES) {
              if (spends[cat] === undefined) {
                spends[cat] = DEFAULT_BASELINE_SPENDS[cat] || 0;
              }
            }
            setBaselineCategorySpends(spends);
          }
        }

        if (goalsRes && goalsRes.ok) {
          const goalsData = await goalsRes.json();
          if (Array.isArray(goalsData.goals)) {
            setGoals(goalsData.goals);
          }
        }
      } catch (err) {
        console.error('Failed to load simulator data:', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // Compute simulation purely in memory without mutating stored data
  const simulation: SimulationResult = useMemo(() => {
    return simulateScenario({
      baselineIncome,
      baselineCategorySpends,
      salaryChange,
      categoryChanges,
      currentBalance,
      goals,
    });
  }, [baselineIncome, baselineCategorySpends, salaryChange, categoryChanges, currentBalance, goals]);

  // Adjust category delta
  const handleCategoryChange = (category: string, delta: number) => {
    setCategoryChanges((prev) => {
      const currentDelta = prev[category] || 0;
      const base = baselineCategorySpends[category] || 0;
      // Cap reduction so spend doesn't go below 0
      const nextDelta = Math.max(currentDelta + delta, -base);
      return {
        ...prev,
        [category]: nextDelta,
      };
    });
  };

  const handleReset = () => {
    setSalaryChange(0);
    setCategoryChanges({});
    toastInfo('Simulator reset to baseline');
  };

  // Quick preset scenarios
  const applyPresetHike = (amount: number) => {
    setSalaryChange(amount);
    toastSuccess(`Applied ${amount >= 0 ? '+' : ''}${formatCurrency(amount)} salary scenario`);
  };

  const applyPresetDiet = () => {
    // Cut Food by 1500, Shopping by 1500, Entertainment by 1000
    setCategoryChanges({
      Food: -1500,
      Shopping: -1500,
      Entertainment: -1000,
    });
    toastSuccess('Applied "Spend Lean" scenario (-₹4,000/mo cuts)');
  };

  const isSimulated = salaryChange !== 0 || Object.values(categoryChanges).some((v) => v !== 0);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">What-if Simulator</h2>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200/60">
              <Sparkles className="w-2.5 h-2.5" />
              Sandbox
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Test salary raises, rent adjustments, or grocery cuts. Computes surplus changes and goal timelines instantly without touching your live data.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isSimulated && (
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition shadow-xs"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              Reset All
            </button>
          )}
          <Link
            href="/goals"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition shadow-xs"
          >
            <Target className="w-3.5 h-3.5 text-indigo-600" />
            Manage Goals
          </Link>
        </div>
      </div>

      {loading && (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200/80 shadow-xs">
          <Loader2 className="w-8 h-8 text-purple-600 animate-spin mx-auto mb-3" />
          <p className="text-xs font-medium text-slate-600">Loading baseline parameters for simulation...</p>
        </div>
      )}

      {!loading && (
        <>
          {/* Quick Scenario Preset Buttons */}
          <div className="p-4 bg-purple-50/50 rounded-2xl border border-purple-100 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-purple-700" />
              <span className="text-xs font-bold text-purple-950">Quick Simulation Presets:</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => applyPresetHike(5000)}
                className="px-2.5 py-1 text-xs font-semibold bg-white text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-50 transition shadow-2xs"
              >
                +₹5,000 Raise
              </button>
              <button
                onClick={() => applyPresetHike(10000)}
                className="px-2.5 py-1 text-xs font-semibold bg-white text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-50 transition shadow-2xs"
              >
                +₹10,000 Promotion
              </button>
              <button
                onClick={applyPresetDiet}
                className="px-2.5 py-1 text-xs font-semibold bg-white text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-50 transition shadow-2xs"
              >
                Cut Discretionary Spend (-₹4k)
              </button>
            </div>
          </div>

          {/* Before & After Comparison Scorecard */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Monthly Surplus Card */}
            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[11px] font-medium uppercase tracking-wider">Monthly Surplus</span>
                <TrendingUp className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-lg sm:text-xl font-bold text-slate-900">
                  {formatCurrency(simulation.newSurplus)}
                </span>
                {simulation.surplusDifference !== 0 && (
                  <span
                    className={`inline-flex items-center text-[11px] font-bold px-1.5 py-0.5 rounded ${
                      simulation.surplusDifference > 0
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    {simulation.surplusDifference > 0 ? '+' : ''}
                    {formatCurrency(simulation.surplusDifference)}/mo
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-400">
                Baseline: {formatCurrency(simulation.baselineSurplus)}/mo
              </div>
            </div>

            {/* Savings Rate Card */}
            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[11px] font-medium uppercase tracking-wider">Savings Rate</span>
                <Sparkles className="w-4 h-4 text-purple-600" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-lg sm:text-xl font-bold text-slate-900">
                  {simulation.newSavingsRate}%
                </span>
                {simulation.newSavingsRate !== simulation.baselineSavingsRate && (
                  <span
                    className={`inline-flex items-center text-[11px] font-bold px-1.5 py-0.5 rounded ${
                      simulation.newSavingsRate > simulation.baselineSavingsRate
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-rose-50 text-rose-700'
                    }`}
                  >
                    {simulation.newSavingsRate > simulation.baselineSavingsRate ? '▲' : '▼'}{' '}
                    {Math.abs(Math.round((simulation.newSavingsRate - simulation.baselineSavingsRate) * 10) / 10)}%
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-400">
                Baseline: {simulation.baselineSavingsRate}%
              </div>
            </div>

            {/* 1-Month Projected Balance */}
            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[11px] font-medium uppercase tracking-wider">1-Month Projected</span>
                <Wallet className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="text-lg sm:text-xl font-bold text-slate-900">
                {formatCurrency(simulation.projectedBalanceAfterOneMonth)}
              </div>
              <div className="text-[11px] text-slate-400">
                Current bank cash: {formatCurrency(simulation.currentBalance)}
              </div>
            </div>

            {/* Total Monthly Spend */}
            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[11px] font-medium uppercase tracking-wider">Total Expenses</span>
                <Layers className="w-4 h-4 text-slate-500" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-lg sm:text-xl font-bold text-slate-900">
                  {formatCurrency(simulation.newExpenses)}
                </span>
                {simulation.expensesChange !== 0 && (
                  <span
                    className={`inline-flex items-center text-[11px] font-bold px-1.5 py-0.5 rounded ${
                      simulation.expensesChange < 0
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-rose-50 text-rose-700'
                    }`}
                  >
                    {simulation.expensesChange > 0 ? '+' : ''}
                    {formatCurrency(simulation.expensesChange)}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-400">
                Income: {formatCurrency(simulation.newIncome)}
              </div>
            </div>
          </div>

          {/* Interactive Simulation Controls */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left 5 Cols: Salary & Controls */}
            <div className="lg:col-span-5 space-y-4">
              {/* Salary Adjuster Box */}
              <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Monthly Income Scenario</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Simulate an appraisal, job switch, or freelance earnings.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-600">Simulated Salary Adjustment:</span>
                    <span className={`text-xs font-bold ${
                      salaryChange > 0 ? 'text-emerald-600' : salaryChange < 0 ? 'text-rose-600' : 'text-slate-800'
                    }`}>
                      {salaryChange > 0 ? `+${formatCurrency(salaryChange)}` : formatCurrency(salaryChange)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSalaryChange((prev) => prev - 1000)}
                      className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <input
                      type="range"
                      min="-15000"
                      max="30000"
                      step="1000"
                      value={salaryChange}
                      onChange={(e) => setSalaryChange(parseInt(e.target.value, 10))}
                      className="w-full accent-purple-600 cursor-pointer"
                    />
                    <button
                      onClick={() => setSalaryChange((prev) => prev + 1000)}
                      className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-4 gap-1.5 pt-1">
                    {[-3000, 2000, 5000, 10000].map((val) => (
                      <button
                        key={val}
                        onClick={() => setSalaryChange(val)}
                        className={`py-1 text-[10px] font-semibold rounded-md border transition ${
                          salaryChange === val
                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {val > 0 ? `+₹${val / 1000}k` : `-₹${Math.abs(val) / 1000}k`}
                      </button>
                    ))}
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Baseline Income:</span>
                      <span className="font-semibold text-slate-800">{formatCurrency(baselineIncome)}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-200/60 pt-1">
                      <span className="text-slate-700 font-medium">New Simulated Income:</span>
                      <span className="font-bold text-slate-900">{formatCurrency(simulation.newIncome)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Assumptions & Disclaimer Card */}
              <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-indigo-600" />
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Simulation Assumptions
                  </h4>
                </div>
                <ul className="text-xs text-slate-600 space-y-2 leading-relaxed">
                  {simulation.assumptions.map((assump, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-indigo-600 font-bold shrink-0">•</span>
                      <span>{assump}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Right 7 Cols: Category Spends Breakdown */}
            <div className="lg:col-span-7">
              <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">Category Spending Scenarios</h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Increase or reduce spending per category to immediately see impact on surplus.
                    </p>
                  </div>
                  {Object.keys(categoryChanges).length > 0 && (
                    <button
                      onClick={() => setCategoryChanges({})}
                      className="text-[11px] font-semibold text-purple-600 hover:text-purple-700 hover:underline"
                    >
                      Reset Categories
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  {simulation.categoryBreakdown.map((item) => {
                    const isAdjusted = item.change !== 0;

                    return (
                      <div
                        key={item.category}
                        className={`p-3 rounded-xl border transition ${
                          isAdjusted
                            ? 'bg-purple-50/30 border-purple-200'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-900">{item.category}</span>
                              {isAdjusted && (
                                <span
                                  className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                    item.change > 0
                                      ? 'bg-rose-50 text-rose-700'
                                      : 'bg-emerald-50 text-emerald-700'
                                  }`}
                                >
                                  {item.change > 0 ? `+${formatCurrency(item.change)}` : formatCurrency(item.change)}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              Baseline: {formatCurrency(item.baselineSpend)} &rarr; New:{' '}
                              <span className="font-bold text-slate-800">{formatCurrency(item.newSpend)}</span>
                            </div>
                          </div>

                          {/* Quick Adjust Buttons */}
                          <div className="flex items-center gap-1.5 self-end sm:self-center">
                            <button
                              onClick={() => handleCategoryChange(item.category, -1000)}
                              className="px-2 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
                              title="Cut ₹1,000"
                            >
                              -₹1k
                            </button>
                            <button
                              onClick={() => handleCategoryChange(item.category, -500)}
                              className="px-2 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
                              title="Cut ₹500"
                            >
                              -₹500
                            </button>
                            <button
                              onClick={() => handleCategoryChange(item.category, 500)}
                              className="px-2 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
                              title="Add ₹500"
                            >
                              +₹500
                            </button>
                            <button
                              onClick={() => handleCategoryChange(item.category, 1000)}
                              className="px-2 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
                              title="Add ₹1,000"
                            >
                              +₹1k
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Goal Timelines Impact Section */}
          <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-indigo-600" />
                  <h3 className="font-bold text-sm text-slate-900">
                    Impact on Goal Timelines
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  How the simulated monthly surplus accelerates or delays each of your goals (saving 100% surplus toward each).
                </p>
              </div>

              <Link
                href="/goals"
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:underline flex items-center gap-1"
              >
                Go to Goals <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {simulation.goalTimelines.length === 0 ? (
              <div className="p-6 text-center bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-xs text-slate-500">
                  No active goals found. Set up milestones on the{' '}
                  <Link href="/goals" className="font-semibold text-indigo-600 hover:underline">
                    Goal Planner
                  </Link>{' '}
                  page to view simulated timelines!
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      <th className="pb-2.5">Goal Name</th>
                      <th className="pb-2.5">Remaining</th>
                      <th className="pb-2.5">Baseline Timeline</th>
                      <th className="pb-2.5">Simulated Timeline</th>
                      <th className="pb-2.5 text-right">Impact</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {simulation.goalTimelines.map((g) => {
                      const diff = g.timelineDifferenceMonths;
                      const isFaster = typeof diff === 'number' && diff < 0;
                      const isSlower = typeof diff === 'number' && diff > 0;
                      const isUnchanged = diff === 0;

                      return (
                        <tr key={g.goalId} className="hover:bg-slate-50/70 transition">
                          <td className="py-3 font-semibold text-slate-900">
                            {g.name}
                          </td>
                          <td className="py-3 text-slate-600">
                            {formatCurrency(g.remaining)}
                          </td>
                          <td className="py-3 text-slate-600">
                            {typeof g.monthsBefore === 'number'
                              ? `${g.monthsBefore} months`
                              : g.monthsBefore}
                          </td>
                          <td className="py-3 font-semibold text-slate-900">
                            {typeof g.monthsAfter === 'number'
                              ? `${g.monthsAfter} months`
                              : g.monthsAfter}
                          </td>
                          <td className="py-3 text-right">
                            {isFaster && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                ⚡ {Math.abs(diff)} {Math.abs(diff) === 1 ? 'month' : 'months'} faster!
                              </span>
                            )}
                            {isSlower && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                ⚠ {diff} {diff === 1 ? 'month' : 'months'} slower
                              </span>
                            )}
                            {isUnchanged && (
                              <span className="text-slate-400 font-medium">Unchanged</span>
                            )}
                            {diff === null && (
                              <span className="text-slate-400 font-medium">
                                {g.monthsAfter === 'Not reachable' ? 'Not reachable' : '—'}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Mandatory Disclaimer Footer */}
          <div className="pt-4 border-t border-slate-200 text-center">
            <p className="text-[11px] text-slate-600 font-medium flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              Budgeting tool only. Not financial or investment advice.
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              This simulation executes in-memory for educational planning only. No data is stored, and investment returns or inflation are excluded.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

export default function SimulatorPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center">
          <Loader2 className="w-8 h-8 text-purple-600 animate-spin mx-auto" />
          <p className="text-xs text-slate-500 mt-2">Loading Simulator...</p>
        </div>
      }
    >
      <SimulatorContent />
    </Suspense>
  );
}