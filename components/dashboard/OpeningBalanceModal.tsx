'use client';

import React, { useState } from 'react';
import { X, IndianRupee, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

interface OpeningBalanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentMonth: string;
  initialBalance: number;
  onSuccess: (newBalance: number) => void;
}

export function OpeningBalanceModal({
  isOpen,
  onClose,
  currentMonth,
  initialBalance,
  onSuccess,
}: OpeningBalanceModalProps) {
  const [balance, setBalance] = useState(String(initialBalance || 0));
  const [loading, setLoading] = useState(false);
  const { success: toastSuccess, error: toastError } = useToast();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(balance);
    if (isNaN(num) || num < 0) {
      toastError('Invalid Balance', 'Opening balance must be a non-negative number.');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch('/api/monthly-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month: currentMonth,
          opening_balance: num,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toastError('Failed to save', data.error || 'Please try again.');
        return;
      }

      toastSuccess('Opening Balance Saved', `Set to ₹${num.toLocaleString('en-IN')} for ${currentMonth}`);
      onSuccess(num);
      onClose();
    } catch {
      toastError('Network error', 'Could not save opening balance.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl border border-slate-200 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Opening Balance</h3>
            <p className="text-xs text-slate-500">For {currentMonth}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Starting bank/cash balance at beginning of month:
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-slate-400 font-semibold text-sm">₹</span>
              <input
                type="number"
                step="any"
                min="0"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                placeholder="e.g. 5000"
                className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Used to predict your exact month-end balance.
            </p>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors flex items-center gap-1.5 shadow-xs disabled:opacity-50"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Save Balance</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
