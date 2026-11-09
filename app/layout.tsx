import type { Metadata } from 'next';
import { Fraunces, DM_Sans } from 'next/font/google';
import { ToastProvider } from '@/components/ui/Toast';
import './globals.css';

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Goal Planner – Calm Editorial Personal Finance for First-Salary Earners',
  description:
    'Plan your salary, predict month-end balance, track budgets, and achieve savings goals without confusing jargon.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${fraunces.variable} ${dmSans.variable} h-full`}>
      <body className="h-full min-h-screen bg-surface text-slate-600 font-sans antialiased selection:bg-accent-100 selection:text-accent-900">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
