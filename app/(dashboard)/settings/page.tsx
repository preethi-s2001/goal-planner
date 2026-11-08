'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { z } from 'zod';
import {
  User,
  Lock,
  Download,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Database,
  FileSpreadsheet,
  FileCode,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

const passwordSchema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(8, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export default function SettingsPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwSuccess, setPwSuccess] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);

  // Data Export state
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportingJson, setExportingJson] = useState(false);

  // Deletion Modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteAction, setDeleteAction] = useState<'clear_data' | 'delete_account'>('clear_data');
  const [confirmText, setConfirmText] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  const supabaseConfigured = isSupabaseConfigured();
  const { success: toastSuccess, error: toastError, info: toastInfo } = useToast();

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwSuccess(null);
    setPwError(null);

    const result = passwordSchema.safeParse({
      password: newPassword,
      confirmPassword,
    });

    if (!result.success) {
      setPwError(result.error.errors[0]?.message || 'Invalid password');
      return;
    }

    if (!supabaseConfigured) {
      setPwError('Supabase is not configured yet. Set credentials in .env.local to update password.');
      return;
    }

    try {
      setPwLoading(true);
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        setPwError(error.message);
        return;
      }

      setPwSuccess('Password updated successfully!');
      toastSuccess('Password updated successfully');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update password';
      setPwError(msg);
      toastError(msg);
    } finally {
      setPwLoading(false);
    }
  };

  const handleExport = async (format: 'csv' | 'json') => {
    try {
      if (format === 'csv') setExportingCsv(true);
      else setExportingJson(true);

      const res = await fetch(`/api/account/export?format=${format}`);
      if (!res.ok) throw new Error('Failed to download export');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download =
        format === 'csv'
          ? `goal-planner-transactions-${new Date().toISOString().split('T')[0]}.csv`
          : `goal-planner-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toastSuccess(format === 'csv' ? 'Transactions CSV downloaded!' : 'Full JSON backup downloaded!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Export failed';
      toastError(msg);
    } finally {
      setExportingCsv(false);
      setExportingJson(false);
    }
  };

  const openDeleteModal = (action: 'clear_data' | 'delete_account') => {
    setDeleteAction(action);
    setConfirmText('');
    setDeleteModalOpen(true);
  };

  const handleDeleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmText !== 'DELETE') {
      toastError('Please type DELETE in capital letters to confirm');
      return;
    }

    try {
      setDeleteLoading(true);
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: deleteAction,
          confirmation: 'DELETE',
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to complete deletion');
      }

      const data = await res.json();
      toastSuccess(data.message || 'Action completed successfully');
      setDeleteModalOpen(false);

      if (deleteAction === 'delete_account') {
        router.push('/login');
      } else {
        router.refresh();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Deletion error';
      toastError(msg);
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl pb-12">
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Account Settings</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Manage your security, data exports, backups, and privacy preferences.
        </p>
      </div>

      {/* Supabase Connection Status */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
              supabaseConfigured ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
            }`}
          >
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-slate-900">Database & Auth Status</h3>
            <p className="text-xs text-slate-500">
              {supabaseConfigured
                ? 'Connected to live Supabase PostgreSQL with Row Level Security'
                : 'Using local demo environment (credentials not configured)'}
            </p>
          </div>
        </div>

        <span
          className={`px-3 py-1 rounded-full text-xs font-bold self-start sm:self-center ${
            supabaseConfigured ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
          }`}
        >
          {supabaseConfigured ? 'Connected' : 'Demo Mode'}
        </span>
      </div>

      {/* Password Management */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <Lock className="w-4 h-4 text-slate-500" />
          <h3 className="font-bold text-sm text-slate-900">Change Password</h3>
        </div>

        {pwError && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{pwError}</span>
          </div>
        )}

        {pwSuccess && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>{pwSuccess}</span>
          </div>
        )}

        <form onSubmit={handlePasswordChange} className="space-y-3.5 max-w-md">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              New Password (min 8 characters)
            </label>
            <input
              type="password"
              required
              minLength={8}
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 min-h-[44px]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Confirm New Password
            </label>
            <input
              type="password"
              required
              minLength={8}
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 min-h-[44px]"
            />
          </div>

          <button
            type="submit"
            disabled={pwLoading}
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-60 shadow-xs"
          >
            {pwLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Update Password</span>}
          </button>
        </form>
      </div>

      {/* Data Export & Backup Section */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <Download className="w-4 h-4 text-emerald-600" />
          <h3 className="font-bold text-sm text-slate-900">Export & Backup Data</h3>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          Own your financial history. Export your transactions as a spreadsheet CSV or download a complete portable JSON backup of your budgets, goals, recurring schedules, and custom rules.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <button
            onClick={() => handleExport('csv')}
            disabled={exportingCsv}
            className="min-h-[44px] p-4 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/20 text-left transition flex items-center justify-between group disabled:opacity-50"
          >
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900 group-hover:text-emerald-700">
                  Transactions (CSV)
                </div>
                <div className="text-[11px] text-slate-500">Spreadsheet format</div>
              </div>
            </div>
            {exportingCsv ? <Loader2 className="w-4 h-4 animate-spin text-emerald-600" /> : <Download className="w-4 h-4 text-slate-400 group-hover:text-emerald-600" />}
          </button>

          <button
            onClick={() => handleExport('json')}
            disabled={exportingJson}
            className="min-h-[44px] p-4 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/20 text-left transition flex items-center justify-between group disabled:opacity-50"
          >
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <FileCode className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900 group-hover:text-indigo-700">
                  Complete Backup (JSON)
                </div>
                <div className="text-[11px] text-slate-500">All data & schedules</div>
              </div>
            </div>
            {exportingJson ? <Loader2 className="w-4 h-4 animate-spin text-indigo-600" /> : <Download className="w-4 h-4 text-slate-400 group-hover:text-indigo-600" />}
          </button>
        </div>
      </div>

      {/* Danger Zone: Clear Data & Delete Account */}
      <div className="bg-white rounded-2xl p-6 border border-rose-200/80 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-rose-100">
          <Trash2 className="w-4 h-4 text-rose-600" />
          <h3 className="font-bold text-sm text-rose-900">Danger Zone</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Clear Financial Data */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2.5 flex flex-col justify-between">
            <div>
              <h4 className="text-xs font-bold text-slate-900">Clear Financial Records</h4>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                Deletes all transactions, budgets, goals, and recurring items, but keeps your account credentials active so you can start fresh.
              </p>
            </div>
            <button
              onClick={() => openDeleteModal('clear_data')}
              className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold text-xs transition"
            >
              Clear Financial Data...
            </button>
          </div>

          {/* Delete Entire Account */}
          <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/30 space-y-2.5 flex flex-col justify-between">
            <div>
              <h4 className="text-xs font-bold text-rose-900">Delete Account & All Data</h4>
              <p className="text-[11px] text-rose-700/80 mt-1 leading-relaxed">
                Permanently deletes your profile, credentials, and all stored data. This action is completely irreversible.
              </p>
            </div>
            <button
              onClick={() => openDeleteModal('delete_account')}
              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs transition shadow-xs"
            >
              Delete Account Permanently...
            </button>
          </div>
        </div>
      </div>

      {/* Mandatory Disclaimer Footer */}
      <div className="pt-4 border-t border-slate-200 text-center">
        <p className="text-[11px] text-slate-600 font-medium flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          Budgeting tool only. Not financial or investment advice.
        </p>
        <p className="text-[10px] text-slate-500 mt-0.5">
          Your financial data is private and secured via Row Level Security (RLS). You retain full data ownership with export and deletion controls.
        </p>
      </div>

      {/* Confirmation Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">
                  {deleteAction === 'clear_data' ? 'Clear All Financial Data?' : 'Permanently Delete Account?'}
                </h3>
                <p className="text-xs text-slate-500">
                  {deleteAction === 'clear_data'
                    ? 'All transactions, budgets, and goals will be wiped.'
                    : 'Your account and all associated records will be deleted forever.'}
                </p>
              </div>
            </div>

            <form onSubmit={handleDeleteSubmit} className="space-y-4 pt-1">
              <div className="p-3 bg-rose-50 rounded-xl text-xs text-rose-800 leading-relaxed">
                Please type <strong className="font-mono font-bold text-rose-950">DELETE</strong> in the box below to confirm this irreversible action.
              </div>

              <div>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="Type DELETE to confirm"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono focus:outline-hidden focus:ring-2 focus:ring-rose-500 min-h-[44px]"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setDeleteModalOpen(false)}
                  className="min-h-[44px] px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={confirmText !== 'DELETE' || deleteLoading}
                  className="min-h-[44px] px-5 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition disabled:opacity-40 flex items-center gap-2"
                >
                  {deleteLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <span>Confirm Deletion</span>
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
