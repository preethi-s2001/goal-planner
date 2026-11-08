'use client';

import React, { useState, useEffect } from 'react';
import { Tag, Plus, Trash2, Loader2, Sparkles, ShieldCheck } from 'lucide-react';
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from '@/types';
import { useToast } from '@/components/ui/Toast';

export function CategoryRulesManager() {
  const { success, error: toastError } = useToast();

  const [rules, setRules] = useState<Array<{ id: string; keyword: string; category: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState('Food');
  const [submitting, setSubmitting] = useState(false);

  const fetchRules = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/category-rules');
      const data = await res.json();
      if (res.ok && data.rules) {
        setRules(data.rules);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword.trim()) return;

    try {
      setSubmitting(true);
      const res = await fetch('/api/category-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: keyword.trim().toLowerCase(),
          category,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save rule');
      }

      success('Rule Saved', `Descriptions containing "${keyword.trim()}" will auto-categorize as ${category}`);
      setKeyword('');
      setShowAddForm(false);
      fetchRules();
    } catch (err: any) {
      toastError('Error', err.message || 'Could not add rule');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRule = async (id: string, kw: string) => {
    try {
      const res = await fetch(`/api/category-rules?id=${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setRules((prev) => prev.filter((r) => r.id !== id));
        success('Rule Removed', `Rule for "${kw}" deleted`);
      }
    } catch {
      toastError('Error', 'Failed to delete rule');
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <span>Learned Categorization Rules</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Rules learned when you change a category or custom keyword associations.
          </p>
        </div>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add Custom Rule</span>
        </button>
      </div>

      {showAddForm && (
        <form
          onSubmit={handleAddRule}
          className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3 animate-in fade-in duration-150"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                If description contains keyword:
              </label>
              <input
                type="text"
                required
                placeholder="e.g. netflix, chai, salon"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Automatically assign category:
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-emerald-500"
              >
                {[...DEFAULT_EXPENSE_CATEGORIES, ...DEFAULT_INCOME_CATEGORIES].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-600 hover:bg-slate-100 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5"
            >
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              <span>Save Rule</span>
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="py-6 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
        </div>
      ) : rules.length === 0 ? (
        <div className="py-6 text-center text-slate-400 text-xs">
          No custom rules yet. When you enter transactions and accept &quot;Always use this category&quot;, rules will appear here.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className="p-2.5 rounded-xl border border-slate-200/90 bg-slate-50 flex items-center justify-between gap-2 text-xs"
            >
              <div className="min-w-0">
                <span className="font-semibold text-slate-800 truncate block">
                  &quot;{rule.keyword}&quot;
                </span>
                <span className="text-[11px] text-emerald-700 font-medium block">
                  &rarr; {rule.category}
                </span>
              </div>
              <button
                onClick={() => handleDeleteRule(rule.id, rule.keyword)}
                className="p-1 rounded text-slate-400 hover:text-rose-600 transition-colors"
                title="Delete rule"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
