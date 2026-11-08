import type { Metadata } from 'next';
import { ToastProvider } from '@/components/ui/Toast';
import './globals.css';

export const metadata: Metadata = {
  title: 'Goal Planner – Personal Finance Planning for First-Salary Earners',
  description:
    'Plan your salary, predict month-end balance, track budgets, and achieve savings goals without confusing jargon.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full min-h-screen bg-slate-50 text-slate-900 antialiased selection:bg-emerald-100 selection:text-emerald-900">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
