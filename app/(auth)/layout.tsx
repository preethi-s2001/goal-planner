import { ReactNode } from 'react';
import Link from 'next/link';
import { IndianRupee, ShieldCheck } from 'lucide-react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/50 via-slate-50 to-slate-100 flex flex-col justify-between p-4 sm:p-6">
      {/* Brand Header */}
      <header className="max-w-md w-full mx-auto pt-6 sm:pt-10 flex flex-col items-center text-center">
        <Link href="/" className="flex items-center gap-2 group mb-2">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform">
            <IndianRupee className="w-5 h-5 stroke-[2.5]" />
          </div>
          <span className="font-extrabold text-2xl text-slate-900 tracking-tight">
            Goal Planner
          </span>
        </Link>
        <p className="text-xs sm:text-sm text-slate-500 font-medium">
          Personal finance planning for first-salary earners
        </p>
      </header>

      {/* Auth Card Container */}
      <main className="max-w-md w-full mx-auto my-6">{children}</main>

      {/* Mandatory Disclaimer Footer */}
      <footer className="max-w-md w-full mx-auto pb-4 text-center text-xs text-slate-500 space-y-1">
        <div className="flex items-center justify-center gap-1.5 text-slate-600 font-medium">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Budgeting tool only. Not financial or investment advice.</span>
        </div>
        <p className="text-[11px] text-slate-400">
          All data is strictly private and protected by Row Level Security.
        </p>
      </footer>
    </div>
  );
}
