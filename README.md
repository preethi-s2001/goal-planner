# Goal Planner – Personal Finance Planning for First-Salary Earners

Goal Planner is a full-stack personal finance web application built specifically for individuals in India who have recently started earning a monthly salary (e.g. ₹35,000/month). 

Unlike generic expense trackers, Goal Planner focuses on **pure budgeting mathematics** to answer 5 fundamental questions:
1. **Where is my money going?**
2. **How much money will I have at the end of this month?**
3. **Am I likely to overspend?**
4. **Can I afford a goal (e.g., a ₹60,000 bike) and how much should I save monthly?**
5. **What happens if my rent or salary changes?**

> **Hard Rule:** This application does budgeting mathematics only. It never gives investment advice, recommends financial products, or suggests where to invest.  
> **Footer Disclaimer:** *"Budgeting tool only. Not financial or investment advice."*

---

## Tech Stack

- **Framework:** [Next.js](https://nextjs.org/) (App Router, Server Components & Route Handlers)
- **Language:** [TypeScript](https://www.typescriptlang.org/) (Strict typing across domain models)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/) (Responsive, mobile-first design, min 44px tap targets)
- **Database & Auth:** [Supabase](https://supabase.com/) (PostgreSQL with Row Level Security on every table)
- **Data Visualizations:** [Recharts](https://recharts.org/)
- **Validation & CSV:** [Zod](https://zod.dev/) & [Papa Parse](https://www.papaparse.com/)
- **Testing:** [Vitest](https://vitest.dev/)
- **AI Explanations:** [Anthropic Claude API](https://docs.anthropic.com/) (server-side only)
- **Deployment:** [Vercel](https://vercel.com/)

---

## Step-by-Step Beginner Setup Guide

Follow these 5 steps to run Goal Planner locally or deploy it to Vercel.

### Step 1: Clone / Navigate to the Project

```bash
cd goal-planner
```

Ensure Node.js (v18+) is installed:
```bash
node -v
npm -v
```

Install dependencies:
```bash
npm install
```

---

### Step 2: Create a Free Supabase Project

1. Visit [supabase.com](https://supabase.com) and click **Start your project** (or sign in).
2. Click **New Project** and choose an organization.
3. Enter a project name (e.g., `goal-planner-db`), choose a strong database password, and pick a region near you (e.g., *Mumbai / ap-south-1*).
4. Wait 1–2 minutes for the database to provision.

---

### Step 3: Run the Database Schema & RLS Migration

1. In your Supabase dashboard, go to the **SQL Editor** tab on the left sidebar.
2. Click **New query**.
3. Open the file [`supabase/schema.sql`](./supabase/schema.sql) in this repository and copy all its contents.
4. Paste the SQL into the Supabase SQL Editor and click **Run**.
5. You will see `Success. No rows returned`. All 8 tables (`profiles`, `transactions`, `category_rules`, `budgets`, `goals`, `recurring_items`, `monthly_settings`, `custom_categories`) and Row Level Security policies are now created!

---

### Step 4: Configure Environment Variables

1. Copy the example environment file:
   ```bash
   cp .env.example .env.local
   ```
2. In your Supabase project dashboard, navigate to **Project Settings** (gear icon) &rarr; **API**.
3. Copy the **Project URL**, the **anon / public key**, and the **service_role key** (under Project Settings -> API).
4. `SUPABASE_SERVICE_ROLE_KEY` is kept strictly server-side (never exposed to browser with `NEXT_PUBLIC_`) and is used by `lib/supabase/admin.ts` to execute account deletion and admin cascades (`auth.admin.deleteUser`).
5. (Optional) For server-side AI summaries, add your `ANTHROPIC_API_KEY` and optional `ANTHROPIC_MODEL` (defaults to `claude-sonnet-5-5`).
6. Open `.env.local` and paste your credentials:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

# Server-only Admin Key (Required for complete account deletion)
# NEVER prefix with NEXT_PUBLIC_!
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Anthropic Claude API Configuration (Server-side routes only)
ANTHROPIC_API_KEY=your-anthropic-api-key
ANTHROPIC_MODEL=claude-sonnet-5-5

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

### Step 5: Run Locally

Start the Next.js development server:

```bash
npm run dev
```

Open your browser to:
[http://localhost:3000](http://localhost:3000)

- Click **Get Started** to sign up with your email and password.
- Test logging in, password reset, and navigating across the responsive app shell!

---

### Step 6: Run Unit Tests

Execute the unit test suite with Vitest:

```bash
npm test
```

---

## Deploying to Vercel

1. Push your repository to GitHub or GitLab.
2. Go to [vercel.com](https://vercel.com) and click **Add New...** &rarr; **Project**.
3. Import your Goal Planner repository.
4. In the **Environment Variables** section, add the variables from `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ANTHROPIC_API_KEY`
   - `NEXT_PUBLIC_APP_URL` (set to your Vercel deployment URL, e.g. `https://goal-planner.vercel.app`)
5. In your Supabase dashboard, go to **Authentication** &rarr; **URL Configuration** and add your Vercel production URL to the **Redirect URLs** list:
   - `https://goal-planner.vercel.app/auth/callback`
   - `https://goal-planner.vercel.app/**`
6. Click **Deploy**. Your app will be live with full authentication and PostgreSQL database security!

---

## Database Architecture & Row Level Security (RLS)

Every table enforces PostgreSQL Row Level Security:
- `auth.uid() = user_id` on all CRUD operations.
- User A cannot view, update, insert, or delete User B's rows.
- Sensitive financial data is never exposed.

| Table | Purpose | Primary Policy |
| :--- | :--- | :--- |
| `profiles` | User profile (name, currency) | `auth.uid() = id` |
| `transactions` | Income & expense transactions | `auth.uid() = user_id` |
| `category_rules` | Custom categorization rules | `auth.uid() = user_id` |
| `budgets` | Category monthly limits | `auth.uid() = user_id` |
| `goals` | Savings goals & progress | `auth.uid() = user_id` |
| `recurring_items` | Monthly recurring entries | `auth.uid() = user_id` |
| `monthly_settings`| Opening balances per month | `auth.uid() = user_id` |

---

## Project Phases Roadmap

- [x] **Phase 1:** Project setup, Supabase schema + RLS, authentication, protected routes, responsive navigation, README setup guide.
- [x] **Phase 2:** Transactions: daily quick entry, list, edit/delete, categorisation rules and learning, recurring items idempotency.
- [x] **Phase 3:** CSV upload with preview, cleaning, duplicate detection, undo import, sample data.
- [x] **Phase 4:** Finance logic calculation library, Dashboard, Spending Analysis, month-end prediction with full formula explanation.
- [x] **Phase 5:** Budgets & alerts with variable pace checks, Goal Planner with feasibility verdicts, What-if Simulator with before/after comparisons.
- [x] **Phase 6:** AI Monthly Financial Review & Context-Aware Assistant (Claude 3.5 Sonnet server-side integration with strict budgeting-only guardrails).
- [x] **Phase 7:** Settings (CSV export, complete portable JSON backup, data wiping, and permanent account deletion), accessibility and mobile polish, 110-test suite pass, Vercel deployment guide.
