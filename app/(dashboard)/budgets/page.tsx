'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import {
  WalletCards,
  Plus,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Edit2,
  Trash2,
  Loader2,
  Sparkles,
  Info,
  Clock,
  ArrowRight,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { DEFAULT_EXPENSE_CATEGORIES } from '@/types';
import type { BudgetStatusResult, BudgetAlertLevel } from '@/lib/finance/budgets';
import { useToast } from '@/components/ui/Toast';

interface EvaluatedBudget extends BudgetStatusResult {
  id?: string;
  monthly_limit: number;
}

const DEFAULT_STARTER_LIMITS: Record<string, number> = {
  Rent: 8000,
  Food: 5000,
  Transport: 3000,
  Shopping: 4000,
  Bills: 2500,
  Entertainment: 2000,
  Health: 1500,
  Others: 2000,
};

function BudgetsContent() {
  const [budgets, setBudgets] = useState<EvaluatedBudget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit / Add modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<string>('Food');
  const [limitInput, setLimitInput] = useState<string>('5000');
  const [saving, setSaving] = useState(false);

  const { success: toastSuccess, error: toastError, info: toastInfo } = useToast();

  const fetchBudgets = async () => {
    try {
      setLoading(true);
      setError(null);
      const today = new Date().toLocaleDateString('en-CA');
      const res = await fetch(`/api/budgets?today=${today}`);
      if (!res.ok) throw new Error('Failed to load budgets');
      const data = await res.json();
      setBudgets(data.budgets || []);
    } catch (err: any) {
      setError(err.message || 'Could not load category budgets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBudgets();
  }, []);

  const handleOpenEdit = (category: string, currentLimit: number) => {
    setEditingCategory(category);
    setLimitInput(String(currentLimit));
    setModalOpen(true);
  };

  const handleOpenAdd = () => {
    const existingCats = new Set(budgets.map((b) => b.category));
    const available = DEFAULT_EXPENSE_CATEGORIES.find((c) => !existingCats.has(c)) || 'Food';
    setEditingCategory(available);
    setLimitInput(String(DEFAULT_STARTER_LIMITS[available] || 3000));
    setModalOpen(true);
  };

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    const limitNum = parseFloat(limitInput);
    if (isNaN(limitNum) || limitNum < 0) {
      toastError('Invalid Limit', 'Budget limit must be a positive number.');
      return;
    }

    try {
      setSaving(true);
      const res = await fetch('/api/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: editingCategory,
          monthly_limit: limitNum,
          today: new Date().toLocaleDateString('en-CA'),
        }),
      });

      if (!res.ok) throw new Error('Failed to save budget');
      toastSuccess('Budget Saved', `Set ₹${limitNum.toLocaleString('en-IN')}/mo limit for ${editingCategory}`);
      setModalOpen(false);
      fetchBudgets();
    } catch {
      toastError('Error', 'Could not save budget.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBudget = async (category: string) => {
    if (!confirm(`Remove monthly budget limit for ${category}?`)) return;

    try {
      const res = await fetch(`/api/budgets?category=${encodeURIComponent(category)}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete budget');
      toastInfo('Budget Removed', `Limit removed for ${category}`);
      fetchBudgets();
    } catch {
      toastError('Error', 'Could not delete budget.');
    }
  };

  const handleApplyStarters = async () => {
    try {
      setLoading(true);
      for (const [cat, limit] of Object.entries(DEFAULT_STARTER_LIMITS)) {
        await fetch('/api/budgets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category: cat, monthly_limit: limit }),
        });
      }
      toastSuccess('Starter Budgets Applied', 'Configured 8 starter category budgets for ₹35,000/mo salary.');
      fetchBudgets();
    } catch {
      toastError('Error', 'Could not apply starter budgets');
    }
  };

  // Summary counts
  const totalBudgeted = budgets.reduce((acc, b) => acc + b.monthly_limit, 0);
  const totalSpent = budgets.reduce((acc, b) => acc + b.spent, 0);
  const alertCount = budgets.filter((b) => b.level !== 'normal').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            Budgets & Proactive Spending Alerts
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Set monthly guardrails per category with mid-month pace projections and proactive alert tiers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {budgets.length === 0 && (
            <button
              onClick={handleApplyStarters}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Apply Starter Budgets</span>
            </button>
          )}
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs transition-all"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Set Category Budget</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          <p className="text-xs text-slate-500 font-medium">Evaluating budget pacing…</p>
        </div>
      ) : error ? (
        <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <span>{error}</span>
          <button onClick={fetchBudgets} className="px-3 py-1 rounded bg-rose-600 text-white font-semibold">
            Retry
          </button>
        </div>
      ) : (
        <>
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Total Monthly Limits
              </span>
              <p className="text-2xl font-extrabold text-slate-900 mt-1 tracking-tight">
                {formatCurrency(totalBudgeted)}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">Across {budgets.length} configured categories</p>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Spent in Budgeted Categories
              </span>
              <p className="text-2xl font-extrabold text-slate-900 mt-1 tracking-tight">
                {formatCurrency(totalSpent)}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                {totalBudgeted > 0
                  ? `${Math.round((totalSpent / totalBudgeted) * 100)}% of total planned allocation`
                  : 'No budgets set'}
              </p>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Active Alerts
              </span>
              <div className="flex items-center gap-2 mt-1">
                <p
                  className={`text-2xl font-extrabold tracking-tight ${
                    alertCount > 0 ? 'text-amber-600' : 'text-emerald-600'
                  }`}
                >
                  {alertCount}
                </p>
                <span className="text-xs font-semibold text-slate-500">
                  {alertCount === 0 ? 'All categories on track' : 'Categories need attention'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">75%, 90%, 100%, and pace warnings</p>
            </div>
          </div>

          {/* Active Alerts List Banner */}
          {alertCount > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Budget Attention Required This Month</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {budgets
                  .filter((b) => b.level !== 'normal')
                  .map((b) => (
                    <div
                      key={b.category}
                      className="p-2.5 rounded-xl bg-white border border-amber-100 flex items-center justify-between"
                    >
                      <span className="font-semibold text-slate-800">{b.category}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          b.level === 'exceeded'
                            ? 'bg-rose-100 text-rose-800'
                            : b.level === 'fully_used'
                            ? 'bg-purple-100 text-purple-800'
                            : b.level === 'warning_90'
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {b.alertMessage}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Budgets Progress Cards Grid */}
          {budgets.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-200/80 shadow-xs space-y-4 max-w-md mx-auto">
              <div className="h-12 w-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                <WalletCards className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">No Monthly Budgets Set Yet</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Set limits to monitor your spending, prevent month-end overdrafts, and receive mid-month pace alerts.
                </p>
              </div>
              <button
                onClick={handleApplyStarters}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-colors shadow-xs"
              >
                <Sparkles className="w-4 h-4" />
                <span>Apply Starter Budgets (Recommended)</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {budgets.map((b) => (
                <div
                  key={b.category}
                  className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-3 relative group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm text-slate-900">{b.category}</h4>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            b.isFixed ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {b.isFixed ? 'Fixed' : 'Variable'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Limit: {formatCurrency(b.monthly_limit)} / month
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEdit(b.category, b.monthly_limit)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                        title="Edit limit"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteBudget(b.category)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        title="Delete budget"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800">
                        {formatCurrency(b.spent)}{' '}
                        <span className="text-[11px] font-normal text-slate-400">spent</span>
                      </span>
                      <span
                        className={`font-bold ${
                          b.level === 'exceeded'
                            ? 'text-rose-600'
                            : b.level === 'fully_used'
                            ? 'text-purple-600'
                            : b.level === 'warning_90'
                            ? 'text-orange-600'
                            : b.level === 'warning_75'
                            ? 'text-amber-600'
                            : 'text-slate-600'
                        }`}
                      >
                        {b.percentage}%
                      </span>
                    </div>

                    <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          b.level === 'exceeded'
                            ? 'bg-rose-500'
                            : b.level === 'fully_used'
                            ? 'bg-purple-600'
                            : b.level === 'warning_90'
                            ? 'bg-orange-500'
                            : b.level === 'warning_75'
                            ? 'bg-amber-400'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(b.percentage, 100)}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-1">
                      <span className="text-slate-500">
                        {b.remaining > 0
                          ? `₹${b.remaining.toLocaleString('en-IN')} remaining`
                          : b.spent === b.monthly_limit
                          ? 'Zero balance left'
                          : `Exceeded by ₹${(b.spent - b.monthly_limit).toLocaleString('en-IN')}`}
                      </span>

                      {/* Status Badges */}
                      {b.alertMessage && (
                        <span
                          className={`font-semibold capitalize ${
                            b.level === 'exceeded'
                              ? 'text-rose-600'
                              : b.level === 'fully_used'
                              ? 'text-purple-700'
                              : b.level === 'warning_90'
                              ? 'text-orange-700'
                              : 'text-amber-700'
                          }`}
                        >
                          {b.alertMessage}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Edit / Add Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl border border-slate-200 space-y-4">
            <h3 className="font-bold text-slate-900 text-sm">Configure Category Budget</h3>

            <form onSubmit={handleSaveBudget} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Category
                </label>
                <select
                  value={editingCategory}
                  onChange={(e) => {
                    setEditingCategory(e.target.value);
                    if (!limitInput || limitInput === '0') {
                      setLimitInput(String(DEFAULT_STARTER_LIMITS[e.target.value] || 3000));
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium bg-white focus:ring-2 focus:ring-emerald-500"
                >
                  {DEFAULT_EXPENSE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Monthly Limit (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 font-semibold text-sm">₹</span>
                  <input
                    type="number"
                    min="1"
                    step="100"
                    value={limitInput}
                    onChange={(e) => setLimitInput(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500"
                    placeholder="e.g. 5000"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Limit</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BudgetsPage() {
  return (
    <Suspense
      fallback={
        <div className="py-24 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      }
    >
      <BudgetsContent />
    </Suspense>
  );
}
