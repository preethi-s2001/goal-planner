'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ArrowLeftRight,
  PieChart,
  WalletCards,
  Target,
  Menu,
  Sliders,
  Sparkles,
  Settings,
  X,
  LogOut,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export function BottomNav() {
  const pathname = usePathname();
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const mainItems = [
    { name: 'Home', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Spend', href: '/transactions', icon: ArrowLeftRight },
    { name: 'Analysis', href: '/analysis', icon: PieChart },
    { name: 'Budgets', href: '/budgets', icon: WalletCards },
    { name: 'Goals', href: '/goals', icon: Target },
  ];

  return (
    <>
      {/* Mobile Drawer for More Items */}
      {isMoreOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex flex-col justify-end">
          <div
            className="bg-white rounded-t-2xl p-5 border-t border-slate-200 shadow-xl space-y-4 animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="font-semibold text-slate-800">More Tools</span>
              <button
                onClick={() => setIsMoreOpen(false)}
                className="p-2 rounded-full hover:bg-slate-100 text-slate-500"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Link
                href="/ai-coach"
                onClick={() => setIsMoreOpen(false)}
                className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center gap-3 text-slate-700 hover:bg-emerald-50 hover:border-emerald-200 transition-colors col-span-2"
              >
                <Sparkles className="w-5 h-5 text-indigo-600" />
                <span className="text-sm font-semibold text-slate-900">AI Coach & Review</span>
              </Link>
              <Link
                href="/simulator"
                onClick={() => setIsMoreOpen(false)}
                className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center gap-3 text-slate-700 hover:bg-emerald-50 hover:border-emerald-200 transition-colors"
              >
                <Sliders className="w-5 h-5 text-emerald-600" />
                <span className="text-sm font-medium">What-if Simulator</span>
              </Link>
              <Link
                href="/settings"
                onClick={() => setIsMoreOpen(false)}
                className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center gap-3 text-slate-700 hover:bg-emerald-50 hover:border-emerald-200 transition-colors"
              >
                <Settings className="w-5 h-5 text-emerald-600" />
                <span className="text-sm font-medium">Settings</span>
              </Link>
            </div>
            <div className="pt-2">
              {/* POST-only Signout Form for Mobile Drawer */}
              <form action="/auth/signout" method="POST">
                <button
                  type="submit"
                  onClick={() => setIsMoreOpen(false)}
                  className="w-full p-3 rounded-xl border border-rose-200 text-rose-600 font-medium flex items-center justify-center gap-2 hover:bg-rose-50"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Persistent Bottom Bar */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1 safe-area-pb"
      >
        <div className="flex items-center justify-around">
          {mainItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/dashboard' && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex flex-col items-center justify-center py-1.5 px-2 min-h-[48px] min-w-[56px] rounded-lg transition-colors',
                  isActive
                    ? 'text-emerald-700 font-semibold'
                    : 'text-slate-500 hover:text-slate-900'
                )}
              >
                <Icon
                  className={cn(
                    'w-5 h-5 transition-transform',
                    isActive ? 'scale-110 text-emerald-600' : 'text-slate-400'
                  )}
                />
                <span className="text-[11px] mt-1 tracking-tight leading-none">
                  {item.name}
                </span>
              </Link>
            );
          })}
          <button
            onClick={() => setIsMoreOpen(!isMoreOpen)}
            className="flex flex-col items-center justify-center py-1.5 px-2 min-h-[48px] min-w-[56px] rounded-lg text-slate-500 hover:text-slate-900"
            aria-label="Open more menu"
          >
            <Menu className="w-5 h-5 text-slate-400" />
            <span className="text-[11px] mt-1 tracking-tight leading-none">More</span>
          </button>
        </div>
      </nav>
    </>
  );
}
