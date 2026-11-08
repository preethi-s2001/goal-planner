'use client';

import React, { useState, useEffect } from 'react';
import {
  RefreshCw,
  Plus,
  Trash2,
  Calendar,
  IndianRupee,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Play,
  ToggleLeft,
  ToggleRight,
  ShieldCheck,
} from 'lucide-react';
import { RecurringItem, DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { useToast } from '@/components/ui/Toast';

interface RecurringItemsManagerProps {
  onRecurringProcessed?: () => void;
}

export function RecurringItemsManager({ onRecurringProcessed }: RecurringItemsManagerProps) {
  const { success, error: toastError, info } = useToast();

  const [items, setItems] = useState<RecurringItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // Form states
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [category, setCategory] = useState('Rent');
  const [dayOfMonth, setDayOfMonth] = useState<number>(1);
  const [submitting, setSubmitting] = useState(false);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/recurring');
      const data = await res.json();
      if (res.ok && data.items) {
        setItems(data.items);
      }
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toastError('Invalid Amount', 'Please enter a valid amount');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch('/api/recurring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: description.trim(),
          amount: numAmount,
          type,
          category,
          day_of_month: dayOfMonth,
          active: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create recurring item');
      }

      success('Recurring Item Added', `"${description}" will repeat on day ${dayOfMonth} of every month.`);
      setDescription('');
      setAmount('');
      setShowAddForm(false);
      fetchItems();
    } catch (err: any) {
      toastError('Error', err.message || 'Could not save recurring item');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (item: RecurringItem) => {
    try {
      const newActive = !item.active;
      const res = await fetch('/api/recurring', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.id,
          active: newActive,
        }),
      });

      if (res.ok) {
        setItems((prev) =>
          prev.map((it) => (it.id === item.id ? { ...it, active: newActive } : it))
        );
        info(
          newActive ? 'Recurring Item Activated' : 'Recurring Item Paused',
          `"${item.description}" is now ${newActive ? 'active' : 'paused'}`
        );
      }
    } catch {
      toastError('Error', 'Failed to toggle status');
    }
  };

  const handleDelete = async (id: string, desc: string) => {
    try {
      const res = await fetch(`/api/recurring?id=${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setItems((prev) => prev.filter((it) => it.id !== id));
        success('Removed', `"${desc}" removed from recurring schedule`);
      }
    } catch {
      toastError('Error', 'Failed to delete recurring item');
    }
  };

  const handleProcessNow = async () => {
    try {
      setProcessing(true);
      const res = await fetch('/api/recurring/process', {
        method: 'POST',
      });
      const data = await res.json();

      if (res.ok) {
        if (data.createdCount > 0) {
          success(
            'Recurring Items Generated!',
            `Created ${data.createdCount} transaction(s) for this month.`
          );
        } else {
          info('Already Up-to-Date', data.message || 'All recurring items are already generated for this month.');
        }

        if (onRecurringProcessed) {
          onRecurringProcessed();
        }
      }
    } catch {
      toastError('Processing Error', 'Failed to generate recurring items');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-5">
      {/* Header & Trigger */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-emerald-600" />
            <span>Recurring Items Schedule</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Automatic monthly entries (salary, rent, subscriptions). Idempotent & never duplicated.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleProcessNow}
            disabled={processing}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-60"
            title="Check and generate any due recurring items for the current month"
          >
            {processing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 text-emerald-600" />
            )}
            <span>Process This Month</span>
          </button>

          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Recurring</span>
          </button>
        </div>
      </div>

      {/* Add Recurring Item Form */}
      {showAddForm && (
        <form
          onSubmit={handleCreate}
          className="p-4 rounded-xl bg-slate-50 border border-slate-200/90 space-y-3.5 animate-in fade-in duration-200"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900">New Recurring Commitment</span>
            <div className="inline-flex p-0.5 bg-slate-200/70 rounded-md text-xs font-semibold">
              <button
                type="button"
                onClick={() => {
                  setType('expense');
                  setCategory('Rent');
                }}
                className={`px-2.5 py-0.5 rounded text-[11px] ${
                  type === 'expense' ? 'bg-rose-600 text-white' : 'text-slate-600'
                }`}
              >
                Expense
              </button>
              <button
                type="button"
                onClick={() => {
                  setType('income');
                  setCategory('Income');
                }}
                className={`px-2.5 py-0.5 rounded text-[11px] ${
                  type === 'income' ? 'bg-emerald-600 text-white' : 'text-slate-600'
                }`}
              >
                Income
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Description
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Monthly Salary, House Rent"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Amount (₹)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="₹ Amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-emerald-500"
              >
                {(type === 'expense'
                  ? DEFAULT_EXPENSE_CATEGORIES
                  : DEFAULT_INCOME_CATEGORIES
                ).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Day of Month (1 - 31)
              </label>
              <input
                type="number"
                min="1"
                max="31"
                required
                value={dayOfMonth}
                onChange={(e) => setDayOfMonth(parseInt(e.target.value, 10) || 1)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5"
            >
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              <span>Save Schedule</span>
            </button>
          </div>
        </form>
      )}

      {/* Items List */}
      {loading ? (
        <div className="py-8 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
        </div>
      ) : items.length === 0 ? (
        <div className="py-8 text-center text-slate-400 text-xs">
          No recurring items configured yet. Click &quot;Add Recurring&quot; to set up salary or rent.
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {items.map((item) => (
            <div
              key={item.id}
              className="py-3 flex items-center justify-between gap-3 text-xs hover:bg-slate-50/70 px-2 rounded-lg transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  onClick={() => handleToggleActive(item)}
                  title={item.active ? 'Click to Pause' : 'Click to Activate'}
                  className="text-slate-400 hover:text-emerald-600 transition-colors"
                >
                  {item.active ? (
                    <ToggleRight className="w-6 h-6 text-emerald-600" />
                  ) : (
                    <ToggleLeft className="w-6 h-6 text-slate-300" />
                  )}
                </button>
                <div className="min-w-0">
                  <p
                    className={`font-semibold text-slate-900 truncate ${
                      !item.active ? 'line-through text-slate-400' : ''
                    }`}
                  >
                    {item.description}
                  </p>
                  <p className="text-[11px] text-slate-500 flex items-center gap-2">
                    <span>{item.category}</span>
                    <span>•</span>
                    <span>Day {item.day_of_month} of each month</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span
                  className={`font-bold text-sm ${
                    item.type === 'income' ? 'text-emerald-600' : 'text-slate-900'
                  }`}
                >
                  {item.type === 'income' ? '+' : '-'}
                  {formatCurrency(item.amount)}
                </span>

                <button
                  onClick={() => handleDelete(item.id, item.description)}
                  className="p-1 rounded text-slate-300 hover:text-rose-600 transition-colors"
                  title="Delete recurring item"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
