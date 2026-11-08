'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Plus,
  IndianRupee,
  Calendar,
  Sparkles,
  ArrowRight,
  Check,
  Loader2,
  Tag,
  Clock,
} from 'lucide-react';
import {
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
  Transaction,
  CategoryRule,
} from '@/types';
import {
  categorizeDescription,
  suggestKeywordFromDescription,
} from '@/lib/finance/categorizer';
import { getLocalDateString } from '@/lib/utils';
import { useToast } from '@/components/ui/Toast';

interface QuickEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (transaction: Transaction) => void;
  recentTransactions?: Transaction[];
}

export function QuickEntryModal({
  isOpen,
  onClose,
  onSuccess,
  recentTransactions = [],
}: QuickEntryModalProps) {
  const { success, error: toastError } = useToast();

  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [category, setCategory] = useState<string>('Food');
  const [date, setDate] = useState(() => getLocalDateString());
  const [userRules, setUserRules] = useState<CategoryRule[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Learning prompt state
  const [autoCategory, setAutoCategory] = useState<string>('');
  const [learnKeyword, setLearnKeyword] = useState<string>('');
  const [shouldLearnRule, setShouldLearnRule] = useState<boolean>(false);

  // Load user rules on mount
  useEffect(() => {
    if (!isOpen) return;

    fetch('/api/category-rules')
      .then((res) => (res.ok ? res.json() : { rules: [] }))
      .then((data) => {
        if (data.rules) setUserRules(data.rules);
      })
      .catch(() => {});
  }, [isOpen]);

  // Derive top 5 recent merchants/descriptions for 1-tap quick suggestions
  const recentSuggestions = useMemo(() => {
    const seen = new Set<string>();
    const suggestions: { description: string; category: string; type: 'income' | 'expense' }[] = [];

    for (const tx of recentTransactions) {
      const desc = tx.description.trim();
      const lower = desc.toLowerCase();
      if (!seen.has(lower) && desc.length > 0) {
        seen.add(lower);
        suggestions.push({
          description: desc,
          category: tx.category,
          type: tx.type,
        });
      }
      if (suggestions.length >= 5) break;
    }

    // Default starters if user has no recent transactions yet
    if (suggestions.length === 0) {
      return [
        { description: 'Swiggy Dinner', category: 'Food', type: 'expense' as const },
        { description: 'Uber to Office', category: 'Transport', type: 'expense' as const },
        { description: 'Grocery Market', category: 'Food', type: 'expense' as const },
        { description: 'Mobile Recharge', category: 'Bills', type: 'expense' as const },
        { description: 'Amazon Order', category: 'Shopping', type: 'expense' as const },
      ];
    }

    return suggestions;
  }, [recentTransactions]);

  // Auto-categorize whenever description changes
  const handleDescriptionChange = (val: string) => {
    setDescription(val);
    if (!val.trim()) return;

    const detected = categorizeDescription(val, userRules, type);
    setAutoCategory(detected);

    if (detected === 'Income') {
      setType('income');
      setCategory('Income');
    } else {
      if (detected !== 'Others') {
        setCategory(detected);
      }
    }

    const keyword = suggestKeywordFromDescription(val);
    setLearnKeyword(keyword);
  };

  // Handle one-tap pre-fill from recent suggestions
  const handleApplySuggestion = (s: { description: string; category: string; type: 'income' | 'expense' }) => {
    setDescription(s.description);
    setType(s.type);
    setCategory(s.category);
    setAutoCategory(s.category);
    setLearnKeyword(suggestKeywordFromDescription(s.description));
  };

  const handleTypeToggle = (newType: 'expense' | 'income') => {
    setType(newType);
    if (newType === 'income') {
      const detected = description.trim()
        ? categorizeDescription(description, userRules, 'income')
        : 'Income';
      setCategory(detected);
    } else {
      const detected = description.trim()
        ? categorizeDescription(description, userRules, 'expense')
        : 'Food';
      setCategory(detected !== 'Others' && detected !== 'Income' ? detected : 'Food');
    }
  };

  const availableCategories =
    type === 'expense' ? DEFAULT_EXPENSE_CATEGORIES : DEFAULT_INCOME_CATEGORIES;

  // Check if current category differs from auto-categorized or is custom
  const showLearnPrompt = Boolean(
    learnKeyword &&
    category &&
    category !== 'Others' &&
    category !== autoCategory &&
    description.trim().length >= 3
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount.replace(/,/g, ''));

    if (isNaN(numAmount) || numAmount <= 0) {
      toastError('Invalid Amount', 'Please enter a valid amount greater than ₹0');
      return;
    }

    if (!description.trim()) {
      toastError('Description Needed', 'Please add a merchant or note for this entry');
      return;
    }

    try {
      setIsSubmitting(true);

      const payload: any = {
        amount: numAmount,
        description: description.trim(),
        type,
        category,
        date,
        source: 'manual',
      };

      if (shouldLearnRule && learnKeyword && category) {
        payload.learnRule = {
          keyword: learnKeyword,
          category,
        };
      }

      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to record transaction');
      }

      success(
        'Transaction Recorded!',
        `₹${numAmount.toLocaleString('en-IN')} for ${description.trim()} saved`
      );

      // Reset form
      setAmount('');
      setDescription('');
      setCategory(type === 'expense' ? 'Food' : 'Income');
      setShouldLearnRule(false);

      if (onSuccess && data.transaction) {
        onSuccess(data.transaction);
      }

      onClose();
    } catch (err: any) {
      toastError('Error', err.message || 'Could not save transaction');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div
        className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-entry-title"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <Plus className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h2 id="quick-entry-title" className="font-bold text-base text-slate-900 leading-tight">
                Quick Transaction Entry
              </h2>
              <p className="text-xs text-slate-500">Record in under 10 seconds</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
          {/* 1. Type Switcher & Amount */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Amount
              </span>

              {/* Expense / Income Toggle */}
              <div className="inline-flex p-1 bg-slate-100 rounded-lg text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => handleTypeToggle('expense')}
                  className={`px-3 py-1 rounded-md transition-all ${
                    type === 'expense'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Expense
                </button>
                <button
                  type="button"
                  onClick={() => handleTypeToggle('income')}
                  className={`px-3 py-1 rounded-md transition-all ${
                    type === 'income'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Income
                </button>
              </div>
            </div>

            {/* Big Amount Input with Numeric Keypad */}
            <div className="relative">
              <span className="absolute left-4 top-3 text-2xl font-bold text-slate-400">
                ₹
              </span>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                required
                autoFocus
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 text-2xl font-extrabold text-slate-900 placeholder:text-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all tracking-tight"
              />
            </div>
          </div>

          {/* 2. Description Input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700" htmlFor="tx-desc">
              Description / Merchant
            </label>
            <input
              id="tx-desc"
              type="text"
              required
              placeholder="e.g. Swiggy, Uber, Jio Recharge"
              value={description}
              onChange={(e) => handleDescriptionChange(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 placeholder:text-slate-400 transition-colors"
            />
          </div>

          {/* 3. One-Tap Recent Suggestions */}
          {recentSuggestions.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>One-tap suggestions</span>
              </span>
              <div className="flex flex-wrap gap-1.5">
                {recentSuggestions.map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleApplySuggestion(s)}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-emerald-50 hover:border-emerald-200 border border-slate-200 text-xs font-medium text-slate-700 hover:text-emerald-800 transition-colors"
                  >
                    {s.description} ({s.category})
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 4. Category Chips */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700">Category</label>
              {autoCategory && (
                <span className="text-[11px] text-emerald-600 font-medium">
                  Auto-detected: <strong>{autoCategory}</strong>
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {availableCategories.map((cat) => {
                const isSelected = category === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      isSelected
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 5. Rule Learning Prompt (When Category overridden) */}
          {showLearnPrompt && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5 animate-in fade-in duration-200">
              <Sparkles className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">Remember this categorization?</p>
                <p className="text-[11px] text-amber-800 mt-0.5">
                  Always use category <strong>&quot;{category}&quot;</strong> for descriptions containing &quot;{learnKeyword}&quot;?
                </p>
                <label className="mt-2 inline-flex items-center gap-1.5 cursor-pointer font-medium text-amber-950">
                  <input
                    type="checkbox"
                    checked={shouldLearnRule}
                    onChange={(e) => setShouldLearnRule(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Yes, learn this rule</span>
                </label>
              </div>
            </div>
          )}

          {/* 6. Date Picker */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700" htmlFor="tx-date">
              Date
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
              <input
                id="tx-date"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-semibold text-sm transition-all shadow-md shadow-emerald-600/20 flex items-center gap-2 disabled:opacity-60"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>Save Transaction</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
