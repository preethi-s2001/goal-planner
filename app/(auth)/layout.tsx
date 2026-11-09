import { ReactNode } from 'react';
import Link from 'next/link';
import { IndianRupee, ShieldCheck, CheckCircle2 } from 'lucide-react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-surface flex flex-col justify-between p-4 sm:p-6 lg:p-8 selection:bg-accent-100 selection:text-accent-900">
      {/* Mobile-only brand header */}
      <header className="lg:hidden w-full max-w-md mx-auto pt-4 pb-2 flex flex-col items-center text-center">
        <Link href="/" className="flex items-center gap-2 group mb-1">
          <div className="h-9 w-9 rounded-xl bg-ink flex items-center justify-center text-white shadow-xs">
            <IndianRupee className="w-4 h-4 stroke-[2.5] text-accent" />
          </div>
          <span className="font-serif text-2xl font-bold text-ink tracking-tight">
            Goal Planner
          </span>
        </Link>
        <p className="text-xs text-slate-500 font-medium">
          First-salary finance planning
        </p>
      </header>

      {/* Main Container: Split layout on desktop, single column on mobile */}
      <main className="max-w-5xl w-full mx-auto my-auto py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Brand Indigo Panel (Desktop only) */}
          <div className="hidden lg:flex lg:col-span-5 bg-ink text-white rounded-3xl p-8 lg:p-10 flex-col justify-between shadow-xs">
            <div className="space-y-6">
              <Link href="/" className="inline-flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-ink-800 border border-ink-700 flex items-center justify-center text-white">
                  <IndianRupee className="w-4 h-4 stroke-[2.5] text-accent" />
                </div>
                <span className="font-serif text-xl font-bold text-white tracking-tight">
                  Goal Planner
                </span>
              </Link>

              <div className="pt-4 space-y-3">
                <span className="text-[11px] uppercase tracking-wider text-accent font-semibold">
                  Calm Editorial Finance
                </span>
                <h2 className="font-serif text-2xl lg:text-3xl font-normal text-white leading-snug">
                  Know your month-end before it arrives.
                </h2>
                <p className="text-xs text-ink-200 leading-relaxed">
                  Budgeting mathematics designed specifically for people handling their first monthly salary in India.
                </p>
              </div>

              <div className="space-y-3 pt-2 text-xs text-ink-100">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                  <span>Formula-driven forecast accounts for unpaid bills and daily burn rate.</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                  <span>Feasibility checks verify if goals fit your actual surplus.</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                  <span>Strict Row Level Security. Zero third-party telemetry sharing.</span>
                </div>
              </div>
            </div>

            <div className="pt-8 border-t border-ink-800 text-[11px] text-ink-300 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-accent shrink-0" />
              <span>Budgeting tool only. Not financial or investment advice.</span>
            </div>
          </div>

          {/* Form Side */}
          <div className="w-full lg:col-span-7 flex flex-col justify-center">
            {children}
          </div>
        </div>
      </main>

      {/* Mandatory Disclaimer Footer (Always present) */}
      <footer className="w-full max-w-5xl mx-auto pt-4 pb-2 text-center text-xs text-slate-500 space-y-1">
        <div className="flex items-center justify-center gap-1.5 text-slate-600 font-medium">
          <ShieldCheck className="w-4 h-4 text-accent inline" />
          <span>Budgeting tool only. Not financial or investment advice.</span>
        </div>
        <p className="text-[11px] text-slate-400">
          All financial data is private and encrypted at rest with Row Level Security.
        </p>
      </footer>
    </div>
  );
}
