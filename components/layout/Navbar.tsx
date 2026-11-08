'use client';

import Link from 'next/link';
import { IndianRupee, Plus, Sparkles, User } from 'lucide-react';
import { usePathname } from 'next/navigation';

interface NavbarProps {
  displayName?: string | null;
  userEmail?: string | null;
  onAddTransactionClick?: () => void;
}

export function Navbar({ displayName, userEmail, onAddTransactionClick }: NavbarProps) {
  const pathname = usePathname();

  // Page title calculation
  const getPageTitle = () => {
    if (pathname.startsWith('/dashboard')) return 'Dashboard Overview';
    if (pathname.startsWith('/transactions')) return 'Transactions & Records';
    if (pathname.startsWith('/analysis')) return 'Spending Analysis';
    if (pathname.startsWith('/budgets')) return 'Budgets & Alerts';
    if (pathname.startsWith('/goals')) return 'Goal Planner';
    if (pathname.startsWith('/simulator')) return 'What-if Simulator';
    if (pathname.startsWith('/settings')) return 'Account Settings';
    return 'Goal Planner';
  };

  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between">
      {/* Mobile Brand / Desktop Title */}
      <div className="flex items-center gap-3">
        {/* Mobile Brand Icon */}
        <div className="md:hidden flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white">
            <IndianRupee className="w-4 h-4 stroke-[2.5]" />
          </div>
          <span className="font-bold text-slate-900 tracking-tight text-base">
            Goal Planner
          </span>
        </div>

        {/* Desktop Title */}
        <div className="hidden md:block">
          <h1 className="text-lg font-bold text-slate-800 leading-tight">
            {getPageTitle()}
          </h1>
          <p className="text-xs text-slate-500 font-normal">
            Personal budgeting & goal projections
          </p>
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Quick Add Transaction Button (prominent on every screen) */}
        <Link
          href="/transactions?action=new"
          className="inline-flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium text-xs sm:text-sm hover:bg-emerald-700 active:scale-[0.98] transition-all shadow-xs shadow-emerald-600/20"
        >
          <Plus className="w-4 h-4" />
          <span>Add Transaction</span>
        </Link>

        {/* User Pill / Profile Shortcut */}
        <Link
          href="/settings"
          className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-slate-700"
          title="Account Settings"
        >
          <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs uppercase">
            {displayName ? displayName[0] : (userEmail ? userEmail[0] : 'U')}
          </div>
          <span className="hidden sm:inline text-xs font-semibold max-w-[100px] truncate">
            {displayName || (userEmail ? userEmail.split('@')[0] : 'Account')}
          </span>
        </Link>
      </div>
    </header>
  );
}
