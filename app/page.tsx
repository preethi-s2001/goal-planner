import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import {
  IndianRupee,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
  Calendar,
  Lock,
  Trash2,
  HelpCircle,
  Clock,
  Sparkles,
  TrendingUp,
} from 'lucide-react';

export default async function LandingPage() {
  // Logged-in visitors who open "/" are sent to the dashboard
  if (isSupabaseConfigured()) {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        redirect('/dashboard');
      }
    } catch {
      // If error or unauthenticated, render the landing page
    }
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col justify-between selection:bg-accent-100 selection:text-accent-900">
      {/* 1. Slim Top Bar */}
      <header className="border-b border-surface-border bg-surface/90 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="h-9 w-9 rounded-xl bg-ink flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition-transform">
              <IndianRupee className="w-4 h-4 stroke-[2.5] text-accent" />
            </div>
            <div>
              <span className="font-serif text-xl font-bold text-ink tracking-tight leading-none block">
                Goal Planner
              </span>
              <span className="text-[10px] text-slate-500 font-medium tracking-wide">
                First-Salary Finance
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#how-it-works" className="hover:text-ink transition-colors">
              How it works
            </a>
            <a href="#features" className="hover:text-ink transition-colors">
              Features
            </a>
            <a href="#trust" className="hover:text-ink transition-colors">
              Our Principles
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-slate-700 hover:text-ink px-3 py-2 rounded-xl transition-colors"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="text-sm font-medium text-white bg-accent hover:bg-accent-600 px-4 py-2 rounded-xl shadow-xs active:scale-[0.98] transition-all"
            >
              Start planning
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {/* 2. Hero Section: Split Layout */}
        <section className="py-12 sm:py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            {/* Left Column: Big Serif Headline & Intro */}
            <div className="lg:col-span-7 space-y-6 text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-50 border border-accent-200 text-accent-800 text-xs font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                <span>Calm editorial personal finance</span>
              </div>

              <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl text-ink font-normal tracking-tight leading-[1.12]">
                Know your month-end balance before it arrives.
              </h1>

              <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl">
                Built specifically for people on their first salary in India. Transparent budgeting
                mathematics that track unpaid commitments, predict your actual closing balance, and
                test what you can truly afford without confusing jargon.
              </p>

              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <Link
                  href="/signup"
                  className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-accent hover:bg-accent-600 text-white font-medium text-base shadow-xs active:scale-[0.98] transition-all"
                >
                  <span>Start planning</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <a
                  href="#how-it-works"
                  className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-white hover:bg-surface border border-surface-border text-slate-700 font-medium text-base transition-colors"
                >
                  <span>See how it works</span>
                </a>
              </div>

              <div className="pt-4 flex flex-wrap items-center gap-y-2 gap-x-6 text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-accent" />
                  Explainable math
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-accent" />
                  100% private with RLS
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-accent" />
                  Zero investment pitching
                </span>
              </div>
            </div>

            {/* Right Column: Layered Card Illustration (HTML/CSS/SVG) */}
            <div className="lg:col-span-5 relative">
              <div className="text-right mb-2">
                <span className="inline-block px-2.5 py-0.5 rounded-md bg-surface-subtle border border-surface-border text-[11px] font-medium text-slate-500">
                  Example with sample numbers
                </span>
              </div>

              <div className="relative space-y-4">
                {/* Layer 1: Mini Month-End Forecast Card */}
                <div className="bg-white rounded-2xl border border-surface-border p-5 shadow-xs transition-transform hover:-translate-y-0.5">
                  <div className="flex items-center justify-between pb-3 border-b border-surface-border/60">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-ink-50 text-ink flex items-center justify-center">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-ink">Predicted Month-End</p>
                        <p className="text-[10px] text-slate-400">Day 15 of 31 • Example</p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>On track</span>
                    </span>
                  </div>

                  <div className="mt-4 flex items-baseline justify-between">
                    <div>
                      <span className="text-[11px] uppercase tracking-wider text-slate-500 font-medium">
                        Forecasted Closing Balance
                      </span>
                      <p className="font-serif text-3xl font-bold text-ink tabular-nums mt-0.5">
                        ₹21,766
                      </p>
                    </div>
                    <span className="text-xs text-accent font-medium tabular-nums">
                      +₹9,766 net
                    </span>
                  </div>

                  <div className="mt-3 pt-3 border-t border-surface-border/60 grid grid-cols-2 gap-2 text-[11px]">
                    <div className="bg-surface-subtle/70 p-2 rounded-xl">
                      <span className="text-slate-500 block">Current Balance</span>
                      <span className="font-semibold text-slate-800 tabular-nums">₹28,752</span>
                    </div>
                    <div className="bg-surface-subtle/70 p-2 rounded-xl">
                      <span className="text-slate-500 block">Unpaid Bills & Burn</span>
                      <span className="font-semibold text-slate-800 tabular-nums">−₹6,986</span>
                    </div>
                  </div>
                </div>

                {/* Layer 2: Budget Progress Bar Card */}
                <div className="bg-white rounded-2xl border border-surface-border p-4 shadow-xs">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-semibold text-slate-800">Food & Dining Budget</span>
                    <span className="text-slate-500 tabular-nums font-medium">
                      ₹4,200 of ₹7,000
                    </span>
                  </div>
                  <div className="w-full bg-surface-subtle rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-ink h-full rounded-full transition-all"
                      style={{ width: '60%' }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                    <span className="inline-flex items-center gap-1 text-amber-700">
                      <Clock className="w-3 h-3 text-amber-600" />
                      <span>Normal daily pace</span>
                    </span>
                    <span className="tabular-nums">16 days left</span>
                  </div>
                </div>

                {/* Layer 3: Goal Progress Ring Card */}
                <div className="bg-white rounded-2xl border border-surface-border p-4 shadow-xs flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">
                      Target Goal (Example)
                    </span>
                    <p className="text-sm font-semibold text-ink">₹60,000 Bike Fund</p>
                    <div className="inline-flex items-center gap-1 text-xs text-accent font-medium">
                      <Sparkles className="w-3 h-3 text-accent" />
                      <span>Comfortable • 2 months to goal</span>
                    </div>
                  </div>

                  {/* SVG Progress Ring */}
                  <div className="relative w-14 h-14 flex items-center justify-center">
                    <svg className="w-14 h-14 transform -rotate-90" viewBox="0 0 36 36">
                      <path
                        className="text-surface-subtle"
                        strokeWidth="3.5"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                      <path
                        className="text-accent"
                        strokeDasharray="60, 100"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                    </svg>
                    <span className="absolute text-[11px] font-bold text-ink tabular-nums">
                      60%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Five Questions, Answered: Numbered Editorial List */}
        <section id="features" className="py-16 sm:py-24 bg-white border-y border-surface-border">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mb-12">
              <span className="text-xs uppercase tracking-wider text-accent font-semibold">
                Editorial Approach
              </span>
              <h2 className="font-serif text-3xl sm:text-4xl text-ink font-normal mt-1 tracking-tight">
                Five questions, answered.
              </h2>
              <p className="text-slate-600 mt-3 text-sm sm:text-base leading-relaxed">
                When you receive your first salary, conventional apps throw stock picks and credit
                scores at you. We answer the five fundamental questions you actually have every
                single month.
              </p>
            </div>

            <div className="divide-y divide-surface-border">
              {/* Question 01 */}
              <div className="py-7 grid grid-cols-1 md:grid-cols-12 gap-4 items-baseline">
                <div className="md:col-span-2">
                  <span className="font-serif text-2xl sm:text-3xl font-light text-accent tabular-nums">
                    01
                  </span>
                </div>
                <div className="md:col-span-4">
                  <h3 className="font-serif text-lg sm:text-xl font-semibold text-ink">
                    Where is my money going?
                  </h3>
                </div>
                <div className="md:col-span-6">
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Automatic keyword rules classify UPI, Swiggy, Uber, rent, and recharges into
                    clear categories without tedious manual tagging.
                  </p>
                </div>
              </div>

              {/* Question 02 */}
              <div className="py-7 grid grid-cols-1 md:grid-cols-12 gap-4 items-baseline">
                <div className="md:col-span-2">
                  <span className="font-serif text-2xl sm:text-3xl font-light text-accent tabular-nums">
                    02
                  </span>
                </div>
                <div className="md:col-span-4">
                  <h3 className="font-serif text-lg sm:text-xl font-semibold text-ink">
                    How much will I have at month-end?
                  </h3>
                </div>
                <div className="md:col-span-6">
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Our formula-driven prediction deducts unpaid fixed commitments (Rent, Bills) and
                    projects your daily variable burn rate.
                  </p>
                </div>
              </div>

              {/* Question 03 */}
              <div className="py-7 grid grid-cols-1 md:grid-cols-12 gap-4 items-baseline">
                <div className="md:col-span-2">
                  <span className="font-serif text-2xl sm:text-3xl font-light text-accent tabular-nums">
                    03
                  </span>
                </div>
                <div className="md:col-span-4">
                  <h3 className="font-serif text-lg sm:text-xl font-semibold text-ink">
                    Am I about to overspend?
                  </h3>
                </div>
                <div className="md:col-span-6">
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Mid-month pace warnings flag categories running too hot before you hit the limit,
                    giving you time to course-correct.
                  </p>
                </div>
              </div>

              {/* Question 04 */}
              <div className="py-7 grid grid-cols-1 md:grid-cols-12 gap-4 items-baseline">
                <div className="md:col-span-2">
                  <span className="font-serif text-2xl sm:text-3xl font-light text-accent tabular-nums">
                    04
                  </span>
                </div>
                <div className="md:col-span-4">
                  <h3 className="font-serif text-lg sm:text-xl font-semibold text-ink">
                    Can I afford my goal?
                  </h3>
                </div>
                <div className="md:col-span-6">
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Realistic feasibility verdicts check whether a ₹60,000 bike or laptop fits your
                    actual complete-month surplus.
                  </p>
                </div>
              </div>

              {/* Question 05 */}
              <div className="py-7 grid grid-cols-1 md:grid-cols-12 gap-4 items-baseline">
                <div className="md:col-span-2">
                  <span className="font-serif text-2xl sm:text-3xl font-light text-accent tabular-nums">
                    05
                  </span>
                </div>
                <div className="md:col-span-4">
                  <h3 className="font-serif text-lg sm:text-xl font-semibold text-ink">
                    What if my rent or salary changes?
                  </h3>
                </div>
                <div className="md:col-span-6">
                  <p className="text-sm text-slate-600 leading-relaxed">
                    The What-if Simulator lets you test salary increments, new flats, or rent
                    changes without touching your actual recorded transactions.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 4. How It Works: Horizontal 3-Step Timeline */}
        <section id="how-it-works" className="py-16 sm:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs uppercase tracking-wider text-accent font-semibold">
              Simple Workflow
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl text-ink font-normal mt-1 tracking-tight">
              How it works
            </h2>
            <p className="text-slate-600 mt-2 text-sm sm:text-base">
              From your first salary credit to clear month-end peace of mind in three steady steps.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Step 1 */}
            <div className="bg-white rounded-2xl border border-surface-border p-6 shadow-xs relative">
              <div className="w-10 h-10 rounded-xl bg-ink text-white font-serif font-bold text-base flex items-center justify-center mb-4">
                01
              </div>
              <h3 className="font-serif text-xl font-semibold text-ink">Add your data</h3>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                Import your bank statement CSV with one click or record daily expenses quickly. No
                netbanking credentials or bank logins required.
              </p>
            </div>

            {/* Step 2 */}
            <div className="bg-white rounded-2xl border border-surface-border p-6 shadow-xs relative">
              <div className="w-10 h-10 rounded-xl bg-accent text-white font-serif font-bold text-base flex items-center justify-center mb-4">
                02
              </div>
              <h3 className="font-serif text-xl font-semibold text-ink">
                See your forecast and alerts
              </h3>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                Review your predicted closing balance, upcoming unpaid fixed bills, and mid-month
                burn pace warnings immediately.
              </p>
            </div>

            {/* Step 3 */}
            <div className="bg-white rounded-2xl border border-surface-border p-6 shadow-xs relative">
              <div className="w-10 h-10 rounded-xl bg-ink text-white font-serif font-bold text-base flex items-center justify-center mb-4">
                03
              </div>
              <h3 className="font-serif text-xl font-semibold text-ink">
                Plan goals and test what-ifs
              </h3>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                Judge goal feasibility from real surplus data, and model future salary hikes or rent
                revisions in a risk-free simulator.
              </p>
            </div>
          </div>
        </section>

        {/* 5. Built to Be Trusted Band (Indigo Background) */}
        <section id="trust" className="py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <div className="bg-ink text-white rounded-3xl p-8 sm:p-12 lg:p-16">
            <div className="max-w-2xl mb-12">
              <span className="text-xs uppercase tracking-wider text-accent font-semibold">
                Privacy & Principles
              </span>
              <h2 className="font-serif text-3xl sm:text-4xl text-white font-normal mt-1 tracking-tight">
                Built to be trusted.
              </h2>
              <p className="text-ink-200 mt-3 text-sm sm:text-base leading-relaxed">
                Budgeting software holds your most private financial reality. Here is our ethical
                commitment to every user.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              <div className="space-y-3">
                <div className="w-9 h-9 rounded-xl bg-ink-800 text-accent flex items-center justify-center">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <h4 className="font-serif text-lg font-medium text-white">
                  Explainable calculations
                </h4>
                <p className="text-xs text-ink-200 leading-relaxed">
                  Every forecast, rate, and feasibility score reveals the exact arithmetic behind
                  it. No hidden black boxes.
                </p>
              </div>

              <div className="space-y-3">
                <div className="w-9 h-9 rounded-xl bg-ink-800 text-accent flex items-center justify-center">
                  <Lock className="w-5 h-5" />
                </div>
                <h4 className="font-serif text-lg font-medium text-white">
                  Your data is private to you
                </h4>
                <p className="text-xs text-ink-200 leading-relaxed">
                  Row Level Security guarantees you alone can access your records. We never sell
                  telemetry or monetize your entries.
                </p>
              </div>

              <div className="space-y-3">
                <div className="w-9 h-9 rounded-xl bg-ink-800 text-accent flex items-center justify-center">
                  <Trash2 className="w-5 h-5" />
                </div>
                <h4 className="font-serif text-lg font-medium text-white">
                  Delete everything any time
                </h4>
                <p className="text-xs text-ink-200 leading-relaxed">
                  You can purge your entire transaction history or completely delete your account
                  with a single verified action.
                </p>
              </div>

              <div className="space-y-3">
                <div className="w-9 h-9 rounded-xl bg-ink-800 text-accent flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h4 className="font-serif text-lg font-medium text-white">
                  Budgeting tool only
                </h4>
                <p className="text-xs text-ink-200 leading-relaxed">
                  We are not financial advisors. We never recommend stocks, mutual funds, loans, or
                  credit products.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 6. Final Call-to-Action Band */}
        <section className="py-16 sm:py-20 max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="font-serif text-3xl sm:text-4xl text-ink font-normal tracking-tight">
            Take control of your first salary today.
          </h2>
          <p className="text-slate-600 mt-3 text-base max-w-lg mx-auto">
            No credit cards pushed, no ads, no unsolicited advice. Just clear, honest budgeting
            mathematics.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/signup"
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 rounded-2xl bg-accent hover:bg-accent-600 text-white font-medium text-base shadow-xs active:scale-[0.98] transition-all"
            >
              <span>Start planning for free</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/login"
              className="w-full sm:w-auto flex items-center justify-center px-8 py-3.5 rounded-2xl bg-white hover:bg-surface border border-surface-border text-slate-700 font-medium text-base transition-colors"
            >
              <span>Log in to your account</span>
            </Link>
          </div>
        </section>
      </main>

      {/* Mandatory Disclaimer Footer */}
      <footer className="border-t border-surface-border bg-white py-8 px-4 sm:px-6 lg:px-8 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto space-y-3">
          <div className="flex items-center justify-center gap-1.5 font-medium text-slate-700">
            <ShieldCheck className="w-4 h-4 text-accent inline" />
            <span>Budgeting tool only. Not financial or investment advice.</span>
          </div>
          <p className="text-[11px] text-slate-400 max-w-2xl mx-auto">
            Goal Planner provides mathematical calculations, pacing alerts, and what-if simulations
            for personal budgeting. It never provides investment advice, portfolio recommendations,
            or regulated financial services.
          </p>
        </div>
      </footer>
    </div>
  );
}
