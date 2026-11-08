'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ArrowLeftRight,
  PieChart,
  WalletCards,
  Target,
  Sliders,
  Sparkles,
  Settings,
  LogOut,
  IndianRupee,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const navigationItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Transactions', href: '/transactions', icon: ArrowLeftRight },
  { name: 'Spending Analysis', href: '/analysis', icon: PieChart },
  { name: 'Budgets & Alerts', href: '/budgets', icon: WalletCards },
  { name: 'Goal Planner', href: '/goals', icon: Target },
  { name: 'What-if Simulator', href: '/simulator', icon: Sliders },
  { name: 'AI Coach & Review', href: '/ai-coach', icon: Sparkles },
  { name: 'Settings', href: '/settings', icon: Settings },
];

interface SidebarProps {
  userEmail?: string | null;
  displayName?: string | null;
}

export function Sidebar({ userEmail, displayName }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200 min-h-screen">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-100 flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shadow-sm shadow-emerald-500/20">
          <IndianRupee className="w-5 h-5 stroke-[2.5]" />
        </div>
        <div>
          <span className="font-bold text-slate-900 tracking-tight text-lg block leading-tight">
            Goal Planner
          </span>
          <span className="text-xs text-slate-500 font-medium">
            First-Salary Finance
          </span>
        </div>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Menu
        </div>
        {navigationItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-emerald-50 text-emerald-800 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              )}
            >
              <Icon
                className={cn(
                  'w-5 h-5 flex-shrink-0 transition-colors',
                  isActive ? 'text-emerald-600' : 'text-slate-400 group-hover:text-slate-600'
                )}
              />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* User Section & Disclaimer */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/50 space-y-3">
        {userEmail && (
          <div className="px-3 py-2 rounded-lg bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div className="min-w-0 pr-2">
              <p className="text-xs font-semibold text-slate-900 truncate">
                {displayName || userEmail.split('@')[0]}
              </p>
              <p className="text-[11px] text-slate-500 truncate">{userEmail}</p>
            </div>
            {/* POST-only Signout Form */}
            <form action="/auth/signout" method="POST">
              <button
                type="submit"
                title="Sign Out"
                className="p-1.5 rounded-md hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {/* Required Mandatory Disclaimer */}
        <div className="p-2.5 rounded-lg bg-emerald-50/60 border border-emerald-100 text-[11px] text-slate-600 leading-relaxed flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
          <span>
            <strong>Budgeting tool only.</strong> Not financial or investment advice.
          </span>
        </div>
      </div>
    </aside>
  );
}
