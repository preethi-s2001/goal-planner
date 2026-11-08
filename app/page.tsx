import Link from 'next/link';
import {
  IndianRupee,
  ShieldCheck,
  TrendingUp,
  Target,
  Sliders,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Calendar,
  WalletCards,
} from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between selection:bg-emerald-100 selection:text-emerald-900">
      {/* Top Navbar */}
      <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
              <IndianRupee className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <span className="font-extrabold text-xl text-slate-900 tracking-tight leading-none block">
                Goal Planner
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                For First-Salary Earners in India
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-semibold text-slate-600 hover:text-slate-900 px-3 py-2 rounded-lg transition-colors"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded-lg shadow-sm shadow-emerald-600/20 active:scale-[0.98] transition-all"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="py-12 sm:py-20 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-100/80 border border-emerald-200 text-emerald-800 text-xs font-semibold mb-6">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>Built exclusively for India&apos;s new earners</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight leading-[1.15]">
            Got your first salary? <br className="hidden sm:inline" />
            <span className="text-emerald-700">Know exactly where it goes.</span>
          </h1>

          <p className="mt-5 text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Not just an expense tracker. Goal Planner provides pure budgeting mathematics to predict your month-end balance, warn you before you overspend, and calculate realistic timelines for goals like a ₹60,000 bike.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/signup"
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-base shadow-lg shadow-emerald-600/25 active:scale-[0.98] transition-all"
            >
              <span>Start Planning Now</span>
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/dashboard"
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-semibold text-base transition-colors"
            >
              <span>Explore Dashboard</span>
            </Link>
          </div>

          {/* Example User Spotlight Card */}
          <div className="mt-14 max-w-3xl mx-auto bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-7 shadow-sm text-left">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600">
                  Example First-Salary Blueprint
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                  Monthly Salary: ₹35,000
                </h3>
              </div>
              <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-100">
                Surplus: ₹12,000/mo
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[11px] text-slate-500 font-medium">Rent</span>
                <p className="text-sm font-bold text-slate-900 mt-0.5">₹8,000</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[11px] text-slate-500 font-medium">Food</span>
                <p className="text-sm font-bold text-slate-900 mt-0.5">₹5,000</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[11px] text-slate-500 font-medium">Transport</span>
                <p className="text-sm font-bold text-slate-900 mt-0.5">₹3,000</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[11px] text-slate-500 font-medium">Shopping</span>
                <p className="text-sm font-bold text-slate-900 mt-0.5">₹4,000</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 col-span-2 sm:col-span-1">
                <span className="text-[11px] text-slate-500 font-medium">Other & Bills</span>
                <p className="text-sm font-bold text-slate-900 mt-0.5">₹3,000</p>
              </div>
            </div>

            <p className="text-xs text-slate-500 mt-4 leading-relaxed">
              At this pace, saving for a <strong>₹60,000 bike</strong> takes just <strong>5 months</strong> of disciplined surplus saving!
            </p>
          </div>
        </section>

        {/* 5 Core Answers Section */}
        <section className="py-14 bg-white border-y border-slate-200/80">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                Answers to your 5 most urgent money questions
              </h2>
              <p className="text-sm sm:text-base text-slate-600 mt-2">
                Designed specifically around common anxiety points when handling a regular monthly salary.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-lg">
                  1
                </div>
                <h3 className="font-bold text-base text-slate-900">
                  Where is my money actually going?
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Automatic keyword rules sort Swiggy, Uber, recharge, and groceries into intuitive categories without tedious tagging.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-lg">
                  2
                </div>
                <h3 className="font-bold text-base text-slate-900">
                  What will I have at the end of the month?
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Formula-driven predictions account for unpaid fixed commitments (Rent, Bills) and your daily variable burn rate.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-lg">
                  3
                </div>
                <h3 className="font-bold text-base text-slate-900">
                  Am I likely to overspend?
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Smart mid-month pace warnings alert you if current daily spend will overshoot your category limit before day 30.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-lg">
                  4
                </div>
                <h3 className="font-bold text-base text-slate-900">
                  Can I afford a goal (e.g. ₹60,000 bike)?
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Realistic verdict checks tell you if your goal is &quot;Comfortable&quot;, &quot;Tight but possible&quot;, or &quot;Not realistic&quot; based on your real surplus.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3 md:col-span-2">
                <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-lg">
                  5
                </div>
                <h3 className="font-bold text-base text-slate-900">
                  What happens if my rent or salary changes?
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  The What-if Simulator lets you model hikes, job switches, or rent increases without touching your real recorded financial data.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Mandatory Disclaimer Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 px-4 sm:px-6 lg:px-8 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto space-y-2">
          <div className="flex items-center justify-center gap-1.5 font-medium text-slate-700">
            <ShieldCheck className="w-4 h-4 text-emerald-600 inline" />
            <span>Budgeting tool only. Not financial or investment advice.</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Goal Planner does budgeting mathematics only. It never gives investment advice or suggests financial products.
          </p>
        </div>
      </footer>
    </div>
  );
}
