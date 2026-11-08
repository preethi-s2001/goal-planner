'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Plus,
  Search,
  IndianRupee,
  RefreshCw,
  Sparkles,
  Edit2,
  Loader2,
  AlertCircle,
  RotateCcw,
  Upload,
} from 'lucide-react';
import { Transaction, DEFAULT_CATEGORIES } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { QuickEntryModal } from '@/components/transactions/QuickEntryModal';
import { EditTransactionModal } from '@/components/transactions/EditTransactionModal';
import { RecurringItemsManager } from '@/components/transactions/RecurringItemsManager';
import { CategoryRulesManager } from '@/components/transactions/CategoryRulesManager';
import { CsvUploader } from '@/components/csv/CsvUploader';
import { useToast } from '@/components/ui/Toast';

function TransactionsContent() {
  const searchParams = useSearchParams();
  const autoOpenNew = searchParams.get('action') === 'new';

  const { success, error: toastError } = useToast();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  // Issue 7: Unfiltered latest transactions for quick-entry suggestions
  const [unfilteredRecent, setUnfilteredRecent] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filters
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedType, setSelectedType] = useState<string>('all');

  // Issue 7: Debounced search state
  const [searchInput, setSearchInput] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchInput]);

  // Active view tab
  const [activeTab, setActiveTab] = useState<'transactions' | 'recurring' | 'rules' | 'import'>('transactions');

  // Modals
  const [isQuickEntryOpen, setIsQuickEntryOpen] = useState(autoOpenNew);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  // Available months list
  const availableMonths = useMemo(() => {
    const list: { label: string; value: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      list.push({ label, value: val });
    }
    return list;
  }, []);

  // Fetch unfiltered recent transactions for suggestions
  const fetchUnfilteredRecent = async () => {
    try {
      const res = await fetch('/api/transactions?limit=5');
      const data = await res.json();
      if (res.ok && data.transactions) {
        setUnfilteredRecent(data.transactions);
      }
    } catch {
      // Non-blocking
    }
  };

  useEffect(() => {
    fetchUnfilteredRecent();
  }, []);

  // Fetch filtered transactions
  const fetchTransactions = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const params = new URLSearchParams();
      if (selectedMonth && selectedMonth !== 'All') params.set('month', selectedMonth);
      if (selectedCategory && selectedCategory !== 'All') params.set('category', selectedCategory);
      if (selectedType && selectedType !== 'all') params.set('type', selectedType);
      if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());

      const res = await fetch(`/api/transactions?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load transactions');
      }

      setTransactions(data.transactions || []);
    } catch (err: any) {
      setLoadError(err.message || 'Could not load transactions. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [selectedMonth, selectedCategory, selectedType, debouncedSearch]);

  // Totals calculations
  const summary = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of transactions) {
      if (t.type === 'income') income += Number(t.amount);
      if (t.type === 'expense') expense += Number(t.amount);
    }
    return {
      income,
      expense,
      net: income - expense,
    };
  }, [transactions]);

  const handleTransactionAdded = (newTx: Transaction) => {
    setTransactions((prev) => [newTx, ...prev]);
    setUnfilteredRecent((prev) => [newTx, ...prev.slice(0, 4)]);
  };

  const handleTransactionUpdated = (updated: Transaction) => {
    setTransactions((prev) =>
      prev.map((t) => (t.id === updated.id ? updated : t))
    );
    setUnfilteredRecent((prev) =>
      prev.map((t) => (t.id === updated.id ? updated : t))
    );
  };

  const handleTransactionDeleted = (deletedId: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== deletedId));
    setUnfilteredRecent((prev) => prev.filter((t) => t.id !== deletedId));
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            Transactions & Spending Records
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Log daily expenses in seconds, manage recurring bills, and view history.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('import')}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-indigo-300 text-indigo-700 hover:bg-indigo-50 font-semibold text-xs sm:text-sm transition-all"
          >
            <Upload className="w-4 h-4" />
            <span>Upload CSV</span>
          </button>
          <button
            onClick={() => setIsQuickEntryOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-semibold text-xs sm:text-sm transition-all shadow-sm shadow-emerald-600/25"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Add Transaction</span>
          </button>
        </div>
      </div>

      {/* Tabs Switcher: Transactions / Recurring Items / Category Rules / Import CSV */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto">
        <button
          onClick={() => setActiveTab('transactions')}
          className={`pb-2.5 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'transactions'
              ? 'border-emerald-600 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          All Transactions ({transactions.length})
        </button>
        <button
          onClick={() => setActiveTab('import')}
          className={`pb-2.5 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'import'
              ? 'border-indigo-600 text-indigo-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Import CSV</span>
        </button>
        <button
          onClick={() => setActiveTab('recurring')}
          className={`pb-2.5 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'recurring'
              ? 'border-emerald-600 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Recurring Schedule</span>
        </button>
        <button
          onClick={() => setActiveTab('rules')}
          className={`pb-2.5 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'rules'
              ? 'border-emerald-600 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Learned Rules</span>
        </button>
      </div>

      {activeTab === 'recurring' && (
        <RecurringItemsManager
          onRecurringProcessed={() => {
            fetchTransactions();
            fetchUnfilteredRecent();
          }}
        />
      )}

      {activeTab === 'rules' && <CategoryRulesManager />}

      {activeTab === 'import' && (
        <CsvUploader
          onImportSuccess={(_batchId, count) => {
            if (count > 0) {
              fetchTransactions();
              fetchUnfilteredRecent();
            }
          }}
        />
      )}

      {activeTab === 'transactions' && (
        <>
          {/* Monthly Inflow/Outflow Totals Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Total Inflow
              </span>
              <p className="text-xl font-extrabold text-emerald-600 mt-1">
                +{formatCurrency(summary.income)}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Total Outflow
              </span>
              <p className="text-xl font-extrabold text-rose-600 mt-1">
                -{formatCurrency(summary.expense)}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Net Period Savings
              </span>
              <p
                className={`text-xl font-extrabold mt-1 ${
                  summary.net >= 0 ? 'text-teal-700' : 'text-rose-700'
                }`}
              >
                {summary.net >= 0 ? '+' : ''}
                {formatCurrency(summary.net)}
              </p>
            </div>
          </div>

          {/* Filter Bar with Debounced Search */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Search Box with 300ms debounce */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                <input
                  type="text"
                  maxLength={100}
                  placeholder="Search description..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Month Picker */}
              <div>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white font-medium text-slate-700 focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="All">All Months</option>
                  {availableMonths.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label} ({m.value})
                    </option>
                  ))}
                </select>
              </div>

              {/* Category Filter */}
              <div>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white font-medium text-slate-700 focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="All">All Categories</option>
                  {DEFAULT_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Type Filter */}
              <div>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white font-medium text-slate-700 focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="all">All Types</option>
                  <option value="expense">Expenses Only</option>
                  <option value="income">Income Only</option>
                </select>
              </div>
            </div>
          </div>

          {/* Issue 7: Error Alert when Load Fails */}
          {loadError && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>{loadError}</span>
              </div>
              <button
                onClick={fetchTransactions}
                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
            </div>
          )}

          {/* Transactions List */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            {loading ? (
              <div className="py-16 flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
                <p className="text-xs text-slate-500">Loading transactions...</p>
              </div>
            ) : transactions.length === 0 ? (
              <div className="py-16 px-4 text-center space-y-3">
                <div className="h-12 w-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                  <IndianRupee className="w-6 h-6 stroke-[2.5]" />
                </div>
                <h3 className="font-bold text-base text-slate-800">
                  No transactions match your filters
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Try adjusting the month or category filters, or click &quot;Add Transaction&quot; to log your first spend.
                </p>
                <button
                  onClick={() => setIsQuickEntryOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold shadow-xs hover:bg-emerald-700"
                >
                  <Plus className="w-4 h-4" />
                  <span>Record Transaction</span>
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Description</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Source</th>
                      <th className="py-3 px-4 text-right">Amount</th>
                      <th className="py-3 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {transactions.map((tx) => (
                      <tr
                        key={tx.id}
                        className="hover:bg-slate-50/80 transition-colors group"
                      >
                        <td className="py-3 px-4 text-slate-600 font-medium whitespace-nowrap">
                          {formatDate(tx.date)}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          {tx.description}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700">
                            {tx.category}
                          </span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              tx.source === 'recurring'
                                ? 'bg-purple-50 text-purple-700 border border-purple-100'
                                : tx.source === 'csv'
                                ? 'bg-blue-50 text-blue-700 border border-blue-100'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {tx.source}
                          </span>
                        </td>
                        <td
                          className={`py-3 px-4 text-right font-bold whitespace-nowrap ${
                            tx.type === 'income'
                              ? 'text-emerald-600'
                              : 'text-slate-900'
                          }`}
                        >
                          {tx.type === 'income' ? '+' : '-'}
                          {formatCurrency(tx.amount)}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <button
                            onClick={() => setEditingTransaction(tx)}
                            className="p-1.5 rounded-md text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                            title="Edit transaction"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Quick Entry Modal with unfiltered top 5 recent suggestions */}
      <QuickEntryModal
        isOpen={isQuickEntryOpen}
        onClose={() => setIsQuickEntryOpen(false)}
        onSuccess={handleTransactionAdded}
        recentTransactions={unfilteredRecent}
      />

      {/* Edit Transaction Modal */}
      <EditTransactionModal
        transaction={editingTransaction}
        isOpen={Boolean(editingTransaction)}
        onClose={() => setEditingTransaction(null)}
        onUpdated={handleTransactionUpdated}
        onDeleted={handleTransactionDeleted}
      />
    </div>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense
      fallback={
        <div className="py-16 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      }
    >
      <TransactionsContent />
    </Suspense>
  );
}
