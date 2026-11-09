'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { z } from 'zod';
import { Lock, ArrowRight, AlertCircle, Loader2, CheckCircle2, KeyRound } from 'lucide-react';

const resetSchema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(8, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlError = searchParams.get('error_description') || searchParams.get('error');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(urlError);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const supabaseConfigured = isSupabaseConfigured();

  useEffect(() => {
    async function checkAuthSession() {
      if (!supabaseConfigured) {
        setCheckingSession(false);
        return;
      }

      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session) {
          setHasSession(true);
        } else {
          // Listen for auth state change in case the callback exchange is still finalizing
          const {
            data: { subscription },
          } = supabase.auth.onAuthStateChange((event, newSession) => {
            if (newSession) {
              setHasSession(true);
            }
          });
          return () => {
            subscription.unsubscribe();
          };
        }
      } catch (err) {
        console.error('Session check error:', err);
      } finally {
        setCheckingSession(false);
      }
    }

    checkAuthSession();
  }, [supabaseConfigured]);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const result = resetSchema.safeParse({ password, confirmPassword });
    if (!result.success) {
      setErrorMsg(result.error.errors[0]?.message || 'Please verify password fields');
      return;
    }

    if (!supabaseConfigured) {
      setErrorMsg('Supabase is not configured yet. Configure Supabase in .env.local to update password.');
      return;
    }

    try {
      setLoading(true);
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        setErrorMsg(error.message);
        return;
      }

      setSuccessMsg('Your password has been reset successfully! Redirecting to dashboard...');
      setTimeout(() => {
        router.push('/dashboard');
        router.refresh();
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="bg-white rounded-2xl border border-surface-border p-8 shadow-xs flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
        <p className="text-xs text-slate-500 font-medium">Verifying reset session...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-surface-border p-6 sm:p-8 lg:p-10 shadow-xs">
      <div className="mb-6">
        <div className="h-10 w-10 rounded-xl bg-ink-50 text-ink flex items-center justify-center mb-3">
          <KeyRound className="w-5 h-5 text-accent" />
        </div>
        <h2 className="font-serif text-2xl sm:text-3xl font-normal text-ink tracking-tight">
          Set new password
        </h2>
        <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
          Create a secure new password for your Goal Planner account.
        </p>
      </div>

      {errorMsg && (
        <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="mb-5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      {!hasSession && supabaseConfigured && !successMsg && (
        <div className="mb-5 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1.5">
          <p className="font-semibold flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            No active password reset session detected
          </p>
          <p>
            Please make sure you clicked the link directly from your email. If your link expired,{' '}
            <Link href="/forgot-password" className="text-amber-950 font-semibold underline">
              request a new password reset link here
            </Link>.
          </p>
        </div>
      )}

      <form onSubmit={handleUpdatePassword} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-ink mb-1.5" htmlFor="password">
            New password (min 8 characters)
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
            <input
              id="password"
              type="password"
              required
              minLength={8}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-surface-border text-sm focus:outline-hidden focus:ring-2 focus:ring-ink focus:border-ink placeholder:text-slate-400 transition-colors"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-ink mb-1.5" htmlFor="confirmPassword">
            Confirm new password
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
            <input
              id="confirmPassword"
              type="password"
              required
              minLength={8}
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-surface-border text-sm focus:outline-hidden focus:ring-2 focus:ring-ink focus:border-ink placeholder:text-slate-400 transition-colors"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || (!hasSession && supabaseConfigured)}
          className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-accent hover:bg-accent-600 active:scale-[0.99] text-white font-medium text-sm transition-all focus:outline-hidden focus:ring-2 focus:ring-ink shadow-xs disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin text-white" />
          ) : (
            <>
              <span>Update Password</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-white rounded-2xl border border-surface-border p-8 shadow-xs flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-accent" />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
