'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import {
  Target,
  Plus,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Edit2,
  Trash2,
  Loader2,
  Sparkles,
  Info,
  Calendar,
  PiggyBank,
  Check,
  ChevronRight,
  ShieldCheck,
  Clock,
  ArrowUpRight,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import type { GoalFeasibilityResult, CombinedGoalsResult, GoalVerdict } from '@/lib/finance/goals';
import { useToast } from '@/components/ui/Toast';

interface StarterTemplate {
  name: string;
  target_amount: number;
  saved_amount: number;
  target_months: number;
  categoryHint: string;
}

const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    name: 'Emergency Fund (3 Months)',
    target_amount: 60000,
    saved_amount: 15000,
    target_months: 8,
    categoryHint: 'Safety cushion for unexpected medical or repair costs',
  },
  {
    name: 'Work Laptop / Smartphone',
    target_amount: 45000,
    saved_amount: 10000,
    target_months: 6,
    categoryHint: 'Productivity upgrade for office or side projects',
  },
  {
    name: 'Goa / Mountain Vacation',
    target_amount: 25000,
    saved_amount: 5000,
    target_months: 5,
    categoryHint: 'Travel expenses, flight booking, and stay',
  },
  {
    name: 'Two-Wheeler Down Payment',
    target_amount: 35000,
    saved_amount: 5000,
    target_months: 7,
    categoryHint: 'Scooter or bike down payment to eliminate surge cabs',
  },
  {
    name: 'Diwali / Family Shopping',
    target_amount: 20000,
    saved_amount: 2000,
    target_months: 4,
    categoryHint: 'Gifts and festival expenses planned without debt',
  },
];

function getVerdictBadge(verdict: GoalVerdict) {
  switch (verdict) {
    case 'Already achieved':
      return {
        label: 'Achieved 🎉',
        bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        icon: CheckCircle2,
      };
    case 'Comfortable':
      return {
        label: 'Comfortable',
        bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        icon: CheckCircle2,
      };
    case 'Tight but possible':
      return {
        label: 'Tight but possible',
        bg: 'bg-amber-50 text-amber-700 border-amber-200',
        icon: AlertTriangle,
      };
    case 'Not realistic in this time':
      return {
        label: 'Timeline too short',
        bg: 'bg-rose-50 text-rose-700 border-rose-200',
        icon: AlertCircle,
      };
    case 'Not realistic (no monthly surplus)':
      return {
        label: 'No monthly surplus',
        bg: 'bg-rose-50 text-rose-700 border-rose-200',
        icon: AlertCircle,
      };
    case 'Not enough history to judge feasibility yet':
      return {
        label: 'Not enough history',
        bg: 'bg-slate-100 text-slate-700 border-slate-200',
        icon: Info,
      };
    default:
      return {
        label: verdict,
        bg: 'bg-slate-100 text-slate-700 border-slate-200',
        icon: Info,
      };
  }
}

function GoalsContent() {
  const [goals, setGoals] = useState<GoalFeasibilityResult[]>([]);
  const [combinedAnalysis, setCombinedAnalysis] = useState<CombinedGoalsResult | null>(null);
  const [monthlySurplus, setMonthlySurplus] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create/Edit Goal Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [goalName, setGoalName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [savedAmount, setSavedAmount] = useState('0');
  const [targetMonths, setTargetMonths] = useState('6');
  const [savingGoal, setSavingGoal] = useState(false);

  // Quick Add Savings Modal
  const [savingsModalOpen, setSavingsModalOpen] = useState(false);
  const [activeSavingsGoal, setActiveSavingsGoal] = useState<GoalFeasibilityResult | null>(null);
  const [addAmount, setAddAmount] = useState('');
  const [updatingSavings, setUpdatingSavings] = useState(false);

  // Delete State
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { success: toastSuccess, error: toastError, info: toastInfo } = useToast();

  const fetchGoals = async () => {
    try {
      setLoading(true);
      setError(null);
      const today = new Date().toLocaleDateString('en-CA');
      const res = await fetch(`/api/goals?today=${today}`);
      if (!res.ok) {
        throw new Error('Failed to load goals');
      }
      const data = await res.json();
      setGoals(data.goals || []);
      setCombinedAnalysis(data.combinedAnalysis ?? null);
      setMonthlySurplus(data.monthlySurplus ?? null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch financial goals';
      setError(msg);
      toastError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGoals();
  }, []);

  const openCreateModal = () => {
    setEditingGoalId(null);
    setGoalName('');
    setTargetAmount('');
    setSavedAmount('0');
    setTargetMonths('6');
    setModalOpen(true);
  };

  const openEditModal = (goal: GoalFeasibilityResult) => {
    setEditingGoalId(goal.id);
    setGoalName(goal.name);
    setTargetAmount(String(goal.target_amount));
    setSavedAmount(String(goal.saved_amount));
    setTargetMonths(String(goal.target_months));
    setModalOpen(true);
  };

  const applyTemplate = (tpl: StarterTemplate) => {
    setGoalName(tpl.name);
    setTargetAmount(String(tpl.target_amount));
    setSavedAmount(String(tpl.saved_amount));
    setTargetMonths(String(tpl.target_months));
    toastInfo(`Loaded preset: ${tpl.name}`);
  };

  const handleSaveGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    const tAmount = parseFloat(targetAmount);
    const sAmount = parseFloat(savedAmount || '0');
    const tMonths = parseInt(targetMonths, 10);

    if (!goalName.trim()) {
      toastError('Please enter a goal name');
      return;
    }
    if (isNaN(tAmount) || tAmount <= 0) {
      toastError('Target amount must be a positive number');
      return;
    }
    if (isNaN(sAmount) || sAmount < 0) {
      toastError('Saved amount cannot be negative');
      return;
    }
    if (isNaN(tMonths) || tMonths < 1) {
      toastError('Target timeline must be at least 1 month');
      return;
    }

    try {
      setSavingGoal(true);
      const isEditing = Boolean(editingGoalId);
      const url = '/api/goals';
      const method = isEditing ? 'PUT' : 'POST';
      const today = new Date().toLocaleDateString('en-CA');
      const body = isEditing
        ? { id: editingGoalId, name: goalName.trim(), target_amount: tAmount, saved_amount: sAmount, target_months: tMonths, today }
        : { name: goalName.trim(), target_amount: tAmount, saved_amount: sAmount, target_months: tMonths, today };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to save goal');
      }

      toastSuccess(isEditing ? 'Goal updated successfully' : 'Goal created successfully');
      setModalOpen(false);
      await fetchGoals();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error saving goal';
      toastError(msg);
    } finally {
      setSavingGoal(false);
    }
  };

  const handleDeleteGoal = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete goal "${name}"?`)) {
      return;
    }

    try {
      setDeletingId(id);
      const res = await fetch(`/api/goals?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to delete goal');
      }

      toastSuccess('Goal removed');
      await fetchGoals();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error deleting goal';
      toastError(msg);
    } finally {
      setDeletingId(null);
    }
  };

  const openQuickAddSavings = (goal: GoalFeasibilityResult) => {
    setActiveSavingsGoal(goal);
    setAddAmount('1000');
    setSavingsModalOpen(true);
  };

  const handleAddSavingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSavingsGoal) return;
    const add = parseFloat(addAmount);
    if (isNaN(add) || add <= 0) {
      toastError('Please enter a positive amount to add');
      return;
    }

    const newSaved = activeSavingsGoal.saved_amount + add;

    try {
      setUpdatingSavings(true);
      const res = await fetch('/api/goals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: activeSavingsGoal.id,
          name: activeSavingsGoal.name,
          target_amount: activeSavingsGoal.target_amount,
          saved_amount: newSaved,
          target_months: activeSavingsGoal.target_months,
          today: new Date().toLocaleDateString('en-CA'),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to update savings');
      }

      toastSuccess(`Added ${formatCurrency(add)} to ${activeSavingsGoal.name}!`);
      setSavingsModalOpen(false);
      await fetchGoals();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error adding savings';
      toastError(msg);
    } finally {
      setUpdatingSavings(false);
    }
  };

  // Target preview calculation for modal
  const previewTarget = parseFloat(targetAmount) || 0;
  const previewSaved = parseFloat(savedAmount) || 0;
  const previewMonths = parseInt(targetMonths, 10) || 1;
  const previewRemaining = Math.max(previewTarget - previewSaved, 0);
  const previewMonthly = previewMonths > 0 ? Math.round(previewRemaining / previewMonths) : 0;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Goal Planner</h2>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
              <Sparkles className="w-2.5 h-2.5" />
              Milestones
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Plan realistic savings for gadgets, trips, bikes, and emergency funds based on your actual monthly surplus.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/simulator"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition shadow-xs"
          >
            <TrendingUp className="w-3.5 h-3.5 text-purple-600" />
            What-If Simulator
          </Link>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition shadow-xs"
          >
            <Plus className="w-4 h-4" />
            New Goal
          </button>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200/80 shadow-xs">
          <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mx-auto mb-3" />
          <p className="text-xs font-medium text-slate-600">Calculating goal feasibility and surplus metrics...</p>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchGoals}
            className="px-2.5 py-1 text-xs font-semibold bg-white border border-rose-200 rounded-lg hover:bg-rose-100 transition"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Top Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[11px] font-medium uppercase tracking-wider">Total Saved</span>
                <PiggyBank className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-lg sm:text-xl font-bold text-slate-900">
                {formatCurrency(combinedAnalysis?.totalSavedAmount || 0)}
              </div>
              <div className="text-[11px] text-slate-500 flex items-center gap-1">
                <span>of {formatCurrency(combinedAnalysis?.totalTargetAmount || 0)} target</span>
              </div>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[11px] font-medium uppercase tracking-wider">Remaining to Save</span>
                <Target className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="text-lg sm:text-xl font-bold text-slate-900">
                {formatCurrency(combinedAnalysis?.totalRemaining || 0)}
              </div>
              <div className="text-[11px] text-slate-500">
                Across {goals.length} active {goals.length === 1 ? 'goal' : 'goals'}
              </div>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[11px] font-medium uppercase tracking-wider">Est. Monthly Surplus</span>
                <TrendingUp className="w-4 h-4 text-emerald-600" />
              </div>
              <div className={`text-lg sm:text-xl font-bold ${monthlySurplus !== null && monthlySurplus > 0 ? 'text-emerald-700' : 'text-slate-700'}`}>
                {monthlySurplus !== null ? formatCurrency(monthlySurplus) : 'Not enough history'}
              </div>
              <div className="text-[11px] text-slate-500">
                {monthlySurplus !== null
                  ? monthlySurplus > 0
                    ? 'Available for savings/goals'
                    : 'No net surplus in history'
                  : 'Needs 1 complete month'}
              </div>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[11px] font-medium uppercase tracking-wider">Monthly Needed</span>
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <div className={`text-lg sm:text-xl font-bold ${
                combinedAnalysis?.exceedsSurplus ? 'text-rose-600' : 'text-slate-900'
              }`}>
                {formatCurrency(combinedAnalysis?.totalMonthlyNeeded || 0)}
                <span className="text-xs font-normal text-slate-500">/mo</span>
              </div>
              <div className="text-[11px] text-slate-500">
                {combinedAnalysis?.combinedShareOfSurplus !== null && combinedAnalysis?.combinedShareOfSurplus !== undefined
                  ? `${combinedAnalysis.combinedShareOfSurplus}% of monthly surplus`
                  : 'N/A'}
              </div>
            </div>
          </div>

          {/* Combined Feasibility Warning / Info Banner */}
          {combinedAnalysis && combinedAnalysis.exceedsSurplus && (
            <div className="p-4 bg-rose-50 border border-rose-200/80 rounded-2xl text-rose-900 space-y-2">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-rose-900">
                    Combined Goals Exceed Monthly Surplus
                  </h4>
                  <p className="text-xs text-rose-700 mt-0.5 leading-relaxed">
                    {combinedAnalysis.warningMessage ||
                      `Saving for all active goals simultaneously requires ${formatCurrency(
                        combinedAnalysis.totalMonthlyNeeded
                      )}/month, which is ${formatCurrency(
                        combinedAnalysis.totalMonthlyNeeded - (monthlySurplus ?? 0)
                      )} more than your estimated monthly surplus of ${formatCurrency(monthlySurplus ?? 0)}.`}
                  </p>
                  <p className="text-[11px] text-rose-600/90 font-medium mt-1">
                    💡 Tip: Prioritize your emergency fund first, or extend the target timeline on lower-priority goals to fit your budget.
                  </p>
                </div>
              </div>
            </div>
          )}

          {combinedAnalysis && !combinedAnalysis.exceedsSurplus && goals.length > 0 && combinedAnalysis.combinedShareOfSurplus !== null && (
            <div className="p-3.5 bg-emerald-50/80 border border-emerald-200/70 rounded-2xl text-emerald-900 flex items-center gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <div className="text-xs">
                <span className="font-semibold text-emerald-800">Comfortable Milestone Plan: </span>
                All your active goals combined take{' '}
                <span className="font-bold">{combinedAnalysis.combinedShareOfSurplus}%</span> of your estimated monthly surplus ({formatCurrency(combinedAnalysis.totalMonthlyNeeded)}/mo out of {formatCurrency(monthlySurplus ?? 0)}/mo).
              </div>
            </div>
          )}

          {combinedAnalysis && monthlySurplus === null && goals.length > 0 && (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 flex items-center gap-3">
              <Info className="w-4 h-4 text-slate-500 shrink-0" />
              <div className="text-xs">
                <span className="font-semibold text-slate-700">Not enough history to judge feasibility yet: </span>
                Monthly required amounts are calculated below. Feasibility verdicts and surplus allocations will unlock after your first complete month of transactions.
              </div>
            </div>
          )}

          {/* Empty State */}
          {goals.length === 0 && (
            <div className="p-8 text-center bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-4 max-w-lg mx-auto">
              <div className="h-12 w-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                <Target className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-sm sm:text-base text-slate-900">
                  No Financial Goals Set Yet
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  First-salary earners who plan for specific milestones save 3x more consistently. Choose a common starter template below or create your own custom goal.
                </p>
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <button
                  onClick={openCreateModal}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition"
                >
                  <Plus className="w-4 h-4" />
                  Create Custom Goal
                </button>
              </div>

              {/* Starter Templates quick list */}
              <div className="pt-4 border-t border-slate-100 text-left space-y-2">
                <div className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                  Popular Starter Goals
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {STARTER_TEMPLATES.slice(0, 3).map((tpl) => (
                    <button
                      key={tpl.name}
                      onClick={() => {
                        applyTemplate(tpl);
                        setEditingGoalId(null);
                        setModalOpen(true);
                      }}
                      className="p-2.5 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30 text-left transition flex items-center justify-between group"
                    >
                      <div>
                        <div className="text-xs font-bold text-slate-800 group-hover:text-indigo-600">
                          {tpl.name}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {formatCurrency(tpl.target_amount)} in {tpl.target_months} months
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Goal Cards Grid */}
          {goals.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {goals.map((goal) => {
                const badge = getVerdictBadge(goal.verdict);
                const BadgeIcon = badge.icon;
                const isComplete = goal.isAchieved;

                return (
                  <div
                    key={goal.id}
                    className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between hover:border-slate-300 transition"
                  >
                    <div className="space-y-3">
                      {/* Top row: Name & Verdict */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-bold text-sm text-slate-900 leading-snug">
                            {goal.name}
                          </h3>
                          <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-500">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>Target: {goal.target_months} months</span>
                          </div>
                        </div>

                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badge.bg}`}
                        >
                          <BadgeIcon className="w-3 h-3" />
                          {badge.label}
                        </span>
                      </div>

                      {/* Amounts Display */}
                      <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-100 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500">Saved so far:</span>
                          <span className="font-bold text-slate-900">
                            {formatCurrency(goal.saved_amount)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500">Target amount:</span>
                          <span className="font-semibold text-slate-700">
                            {formatCurrency(goal.target_amount)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60">
                          <span className="text-slate-600 font-medium">Remaining:</span>
                          <span className={`font-bold ${isComplete ? 'text-emerald-600' : 'text-slate-900'}`}>
                            {isComplete ? 'Fully Funded!' : formatCurrency(goal.remaining)}
                          </span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500 font-medium">Progress</span>
                          <span className="font-bold text-slate-800">{goal.progressPercentage}%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              isComplete
                                ? 'bg-emerald-500'
                                : goal.progressPercentage >= 60
                                ? 'bg-indigo-600'
                                : 'bg-emerald-600'
                            }`}
                            style={{ width: `${goal.progressPercentage}%` }}
                          />
                        </div>
                      </div>

                      {/* Feasibility Breakdown */}
                      <div className="text-[11px] text-slate-600 space-y-1 pt-1">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Required per month:</span>
                          <span className="font-bold text-slate-900">
                            {formatCurrency(goal.monthly_needed)}/mo
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Share of monthly surplus:</span>
                          <span className="font-semibold text-slate-700">
                            {goal.share_of_surplus !== null ? `${goal.share_of_surplus}%` : 'N/A'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">At 100% surplus:</span>
                          <span className="font-semibold text-indigo-700">
                            {typeof goal.months_at_full_surplus === 'number'
                              ? `${goal.months_at_full_surplus} months`
                              : goal.months_at_full_surplus}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="pt-4 border-t border-slate-100 mt-4 flex items-center justify-between gap-2">
                      <button
                        onClick={() => openQuickAddSavings(goal)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition"
                      >
                        <Plus className="w-3 h-3" />
                        Add Savings
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEditModal(goal)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                          title="Edit Goal"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteGoal(goal.id, goal.name)}
                          disabled={deletingId === goal.id}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition disabled:opacity-50"
                          title="Delete Goal"
                        >
                          {deletingId === goal.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Starter Templates Drawer / Card when goals exist */}
      {!loading && !error && goals.length > 0 && (
        <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Need Ideas? Quick Starter Presets
              </h3>
            </div>
            <span className="text-[11px] text-slate-400">Click to customize</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {STARTER_TEMPLATES.map((tpl) => (
              <button
                key={tpl.name}
                onClick={() => {
                  applyTemplate(tpl);
                  setEditingGoalId(null);
                  setModalOpen(true);
                }}
                className="p-3 text-left rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/20 transition group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 group-hover:text-indigo-600">
                    {tpl.name}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                    {tpl.target_months} mo
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Target: <span className="font-medium text-slate-700">{formatCurrency(tpl.target_amount)}</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">
                  {tpl.categoryHint}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Mandatory Disclaimer Footer */}
      <div className="pt-4 border-t border-slate-200 text-center">
        <p className="text-[11px] text-slate-600 font-medium flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          Budgeting tool only. Not financial or investment advice.
        </p>
        <p className="text-[10px] text-slate-500 mt-0.5">
          Feasibility verdicts are calculated from your actual historical income and spending surplus. Inflation and market returns are excluded.
        </p>
      </div>

      {/* Create / Edit Goal Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900">
                {editingGoalId ? 'Edit Financial Goal' : 'Create New Financial Goal'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveGoal} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Goal Name</label>
                <input
                  type="text"
                  value={goalName}
                  onChange={(e) => setGoalName(e.target.value)}
                  placeholder="e.g. Emergency Fund, New Laptop, Goa Trip"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Target Amount (₹)</label>
                  <input
                    type="number"
                    step="any"
                    min="1"
                    value={targetAmount}
                    onChange={(e) => setTargetAmount(e.target.value)}
                    placeholder="e.g. 50000"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Saved So Far (₹)</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={savedAmount}
                    onChange={(e) => setSavedAmount(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Target Timeline (Months)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="120"
                    value={targetMonths}
                    onChange={(e) => setTargetMonths(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                  <div className="flex gap-1">
                    {[3, 6, 12].map((m) => (
                      <button
                        type="button"
                        key={m}
                        onClick={() => setTargetMonths(String(m))}
                        className={`px-2 py-1.5 text-[11px] font-semibold rounded-lg border transition ${
                          targetMonths === String(m)
                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {m}m
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Dynamic Live Preview */}
              {previewTarget > 0 && (
                <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 text-xs text-indigo-950 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-indigo-800">Remaining to save:</span>
                    <span className="font-bold">{formatCurrency(previewRemaining)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-indigo-800">Required per month:</span>
                    <span className="font-bold text-indigo-900">{formatCurrency(previewMonthly)}/mo</span>
                  </div>
                  {monthlySurplus !== null && monthlySurplus > 0 && (
                    <div className="text-[11px] text-indigo-700 pt-0.5">
                      Uses ~{Math.round((previewMonthly / monthlySurplus) * 100)}% of your estimated {formatCurrency(monthlySurplus)} surplus.
                    </div>
                  )}
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingGoal}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition disabled:opacity-50"
                >
                  {savingGoal ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      {editingGoalId ? 'Save Changes' : 'Create Goal'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Add Savings Modal */}
      {savingsModalOpen && activeSavingsGoal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-sm w-full p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Add to Savings</h3>
                <p className="text-[11px] text-slate-500">{activeSavingsGoal.name}</p>
              </div>
              <button
                onClick={() => setSavingsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Currently saved:</span>
                <span className="font-bold text-slate-900">{formatCurrency(activeSavingsGoal.saved_amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Target:</span>
                <span className="font-semibold text-slate-700">{formatCurrency(activeSavingsGoal.target_amount)}</span>
              </div>
            </div>

            <form onSubmit={handleAddSavingsSubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Amount to Add (₹)</label>
                <input
                  type="number"
                  step="any"
                  min="1"
                  value={addAmount}
                  onChange={(e) => setAddAmount(e.target.value)}
                  placeholder="e.g. 1000"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              {/* Quick increment pills */}
              <div className="flex gap-1.5">
                {[500, 1000, 2000, 5000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setAddAmount(String(amt))}
                    className="flex-1 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
                  >
                    +₹{amt}
                  </button>
                ))}
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSavingsModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingSavings}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition disabled:opacity-50"
                >
                  {updatingSavings ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Record Savings
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function GoalsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center">
          <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mx-auto" />
          <p className="text-xs text-slate-500 mt-2">Loading Goal Planner...</p>
        </div>
      }
    >
      <GoalsContent />
    </Suspense>
  );
}