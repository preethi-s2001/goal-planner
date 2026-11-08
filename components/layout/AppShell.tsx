'use client';

import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { BottomNav } from './BottomNav';
import { ShieldCheck, Info } from 'lucide-react';

interface AppShellProps {
  children: ReactNode;
  userEmail?: string | null;
  displayName?: string | null;
  isConfigured?: boolean;
}

export function AppShell({
  children,
  userEmail,
  displayName,
  isConfigured = true,
}: AppShellProps) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Desktop Sidebar */}
      <Sidebar userEmail={userEmail} displayName={displayName} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar displayName={displayName} userEmail={userEmail} />

        {/* Supabase Setup Notification Banner if credentials are not configured */}
        {!isConfigured && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 text-xs text-amber-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span>
                <strong>Supabase credentials not yet configured.</strong> Connect your Supabase project in{' '}
                <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-[11px]">.env.local</code> to enable live database storage and authentication.
              </span>
            </div>
            <a
              href="https://supabase.com/dashboard"
              target="_blank"
              rel="noreferrer"
              className="text-amber-900 underline font-semibold flex-shrink-0"
            >
              Supabase Dashboard &rarr;
            </a>
          </div>
        )}

        {/* Main Child View */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-24 md:pb-12 max-w-7xl w-full mx-auto">
          {children}
        </main>

        {/* Footer Disclaimer (Mandatory Hard Rule) */}
        <footer className="border-t border-slate-200 bg-white py-4 px-6 text-center text-xs text-slate-500 mb-14 md:mb-0">
          <div className="flex items-center justify-center gap-1.5 font-medium text-slate-600">
            <ShieldCheck className="w-4 h-4 text-emerald-600 inline" />
            <span>Budgeting tool only. Not financial or investment advice.</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            Goal Planner is engineered for salary planning, budget mathematics, and savings milestones.
          </p>
        </footer>

        {/* Mobile Persistent Bottom Nav */}
        <BottomNav />
      </div>
    </div>
  );
}
