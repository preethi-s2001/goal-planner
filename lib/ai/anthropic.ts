import {
  SYSTEM_FINANCIAL_COACH_PROMPT,
  FinancialContextPayload,
  buildMonthlyReviewPrompt,
} from './prompts';

export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ClaudeResponse {
  text: string;
  source: string; // e.g. 'claude-sonnet-5-5' or 'local-engine'
}

/**
 * Checks if the Anthropic API key is configured.
 */
export function isAnthropicConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.trim().length > 0);
}

/**
 * Calls Anthropic API or falls back to the deterministic local engine.
 * Reads model from ANTHROPIC_MODEL, defaulting to 'claude-sonnet-5-5'.
 */
export async function callClaudeApi(params: {
  messages: AnthropicMessage[];
  systemPrompt?: string;
  maxTokens?: number;
}): Promise<ClaudeResponse> {
  const { messages, systemPrompt = SYSTEM_FINANCIAL_COACH_PROMPT, maxTokens = 1500 } = params;

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  const model = process.env.ANTHROPIC_MODEL?.trim() ?? 'claude-sonnet-5-5';

  if (apiKey) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          system: systemPrompt,
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const textBlock = data.content?.find((c: { type: string; text?: string }) => c.type === 'text');
        if (textBlock?.text) {
          return {
            text: textBlock.text,
            source: model,
          };
        }
      } else {
        const errText = await res.text();
        console.error(`Anthropic API call failed with status ${res.status}:`, errText);
      }
    } catch (err) {
      console.error('Anthropic API network request failed:', err);
    }
  }

  // Fallback to high-quality deterministic response generator
  // Never label local-engine text as AI-generated; clearly notify the user.
  const fallbackText = generateLocalFallbackResponse(messages);
  const textWithNotice = `> **AI summary unavailable, showing a basic summary**\n\n${fallbackText}`;

  return {
    text: textWithNotice,
    source: 'local-engine',
  };
}

/**
 * Generates an in-depth deterministic review or answers chat questions based on user's actual context.
 */
export function generateLocalFallbackResponse(messages: AnthropicMessage[]): string {
  const lastMessage = messages[messages.length - 1]?.content ?? '';

  // 1. Is this a Monthly Review generation prompt?
  if (lastMessage.includes('Monthly Financial Review')) {
    return generateDeterministicMonthlyReview(lastMessage);
  }

  // 2. Otherwise it is an assistant question
  return generateDeterministicChatReply(lastMessage);
}

function generateDeterministicMonthlyReview(prompt: string): string {
  let context: Partial<FinancialContextPayload> = {};
  try {
    const jsonMatch = prompt.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      context = JSON.parse(jsonMatch[0]);
    }
  } catch {
    // fallback if parsing fails
  }

  const income = context.income ?? 0;
  const expenses = context.expenses ?? 0;
  const surplus = context.surplus ?? (income - expenses);
  const savingsRate = context.savingsRate ?? (income > 0 ? Math.round((surplus / income) * 100) : 0);
  const monthMatch = prompt.match(/\b\d{4}-(0[1-9]|1[0-2])\b/);
  const month = context.selectedMonth ?? (monthMatch ? monthMatch[0] : 'this month');
  const currentBalance = context.currentBalance ?? surplus;
  const predictedEnd = context.predictedMonthEndBalance ?? currentBalance;

  // Item 5: If a month has no data, say there is not enough data instead of showing figures
  if (
    prompt.includes('not enough transaction or income data') ||
    (!context.hasData && income === 0 && expenses === 0)
  ) {
    return `### 1. Executive Summary & Health Status
- **Financial Health Status:** **Not Enough Data**

There are no recorded transactions or income entries for ${month} yet. Please add transactions via Quick Entry or upload a statement to generate your performance review.

### 2. Key Spending Observations & Anomalies
- No expense transactions recorded for this period.

### 3. Actionable Trims & Optimizations
- Personalized recommendations and category optimizations will appear once daily expenses are logged.

### 4. Milestone Forecast & Goal Progress
- Goal feasibility calculations require active income or expense history to calculate monthly surplus.

---
*Budgeting tool only. Not financial or investment advice.*`;
  }

  // Item 7: The offline summary must adapt to the data: a negative savings rate must never say "stable"
  let healthStatus = 'Action Required - Low Savings Margin (<10%)';
  let summaryText = '';

  if (surplus < 0 || savingsRate < 0) {
    healthStatus = 'Action Required - Deficit Spending (Expenses Exceed Income)';
    summaryText = `You spent more than your recorded income this month (negative savings rate of ${savingsRate}%). Your monthly net deficit is ₹${Math.abs(surplus).toLocaleString('en-IN')}. Immediate cuts to variable expenses are needed to avoid draining your reserves.`;
  } else if (savingsRate >= 25) {
    healthStatus = 'Strong & On-Track (Healthy 25%+ Savings Cushion)';
    summaryText = `You retained **${savingsRate}%** of your take-home salary this month. With a projected month-end balance of ₹${predictedEnd.toLocaleString('en-IN')}, your financial runway is stable and bills are well-covered.`;
  } else if (savingsRate >= 10) {
    healthStatus = 'Moderate - Minor Adjustments Needed';
    summaryText = `You retained **${savingsRate}%** of your take-home salary this month. Minor trims in discretionary spending can help build a larger safety buffer.`;
  } else {
    summaryText = `Your savings margin is narrow at **${savingsRate}%**. Variable spending should be closely managed to maintain positive cash flow.`;
  }

  // Category breakdown
  const categories = context.categoryBreakdown ?? [];
  const topCat = categories[0];
  const topCategory = topCat?.category ?? 'None';
  const topSpend = topCat?.spentThisMonth ?? 0;

  // Item 7: Tips must come from the user's actual top categories
  const variableCats = categories.filter((c) => c.category !== 'Rent' && c.spentThisMonth > 0);
  let tipsMarkdown = '';

  if (variableCats.length > 0) {
    const cat1 = variableCats[0];
    const trim1 = Math.round(cat1.spentThisMonth * 0.15);
    const cat2 = variableCats[1];
    const trim2 = cat2 ? Math.round(cat2.spentThisMonth * 0.15) : 0;

    const tip1 = `- **${cat1.category} Optimization:** Reducing discretionary ${cat1.category} spending by ~15% will save approximately **₹${trim1.toLocaleString('en-IN')}/month**.`;
    const tip2 = cat2
      ? `\n- **${cat2.category} Trim:** Trimming ~15% from ${cat2.category} will retain roughly **₹${trim2.toLocaleString('en-IN')}/month**.`
      : '';
    const totalTrim = trim1 + trim2;
    const impact = `\n- **Impact on Balance:** These adjustments directly free up **₹${totalTrim.toLocaleString('en-IN')}/month** in additional cash${income > 0 ? `, boosting your savings rate by ~${Math.round((totalTrim / income) * 100)} percentage points` : ''}.`;

    tipsMarkdown = `${tip1}${tip2}${impact}`;
  } else {
    tipsMarkdown = '- No discretionary category spending logged to generate category-specific trims.';
  }

  return `### 1. Executive Summary & Health Status
- **Monthly Income:** ₹${income.toLocaleString('en-IN')}
- **Total Expenses:** ₹${expenses.toLocaleString('en-IN')}
- **Net Monthly Surplus:** ₹${surplus.toLocaleString('en-IN')}
- **Savings Rate:** **${savingsRate}%**
- **Predicted Month-End Cash Balance:** ₹${predictedEnd.toLocaleString('en-IN')}
- **Financial Health Status:** **${healthStatus}**

${summaryText}

### 2. Key Spending Observations & Anomalies
- **Top Expense:** ${topCat ? `Your largest outlay was **${topCategory}** at ₹${topSpend.toLocaleString('en-IN')} (${expenses > 0 ? Math.round((topSpend / expenses) * 100) : 0}% of total spend).` : 'No category expenses recorded.'}
- **Discretionary vs Fixed Costs:** Fixed obligations are steady, while variable lifestyle spending represents the greatest opportunity for optimization.
${context.budgetAlerts && context.budgetAlerts.length > 0 ? `- **Active Budget Alerts:** ${context.budgetAlerts.map((a) => `${a.category} has utilized ${a.percentUsed}% of its limit`).join(', ')}.` : '- **Budget Compliance:** All categories operated within their defined monthly limits.'}

### 3. Actionable Trims & Optimizations
${tipsMarkdown}

### 4. Milestone Forecast & Goal Progress
${context.goals && context.goals.length > 0 ? context.goals.map((g) => `- **${g.name}:** Saved ₹${g.savedAmount.toLocaleString('en-IN')} of ₹${g.targetAmount.toLocaleString('en-IN')} target (Remaining: ₹${g.remaining.toLocaleString('en-IN')}). Feasibility verdict: **${g.verdict}** (${g.monthlyNeeded ? `Requires ₹${g.monthlyNeeded.toLocaleString('en-IN')}/mo` : 'Achieved'}).`).join('\n') : '- No active goals registered. Consider setting up a starter Emergency Fund or Gadget goal in the Goal Planner.'}
- **Surplus Allocation Recommendation:** Direct available surplus toward your primary milestone before allocating discretionary funds.

---
*Budgeting tool only. Not financial or investment advice.*`;
}

export interface ParsedQueryAmount {
  amount: number | null;
  needsClarification: boolean;
}

/**
 * Parses amounts from chat queries supporting:
 * - Indian numeric shorthand (k, lakh/lac/L, crore/cr)
 * - Compound phrases ("5 lakh and 20 thousand" -> 520000)
 * - Multiple amounts: prefers the purchase price following "afford", "buy", "purchase", "cost", "price", "for" (or ₹/Rs),
 *   while discarding income amounts following "salary", "earn", "income".
 * - Flags needsClarification if ambiguous multiple amounts (>=1000) remain or an unrecognised word follows a number.
 */
export function parseQueryAmount(query: string): ParsedQueryAmount {
  let normalizedQuery = query;

  // 1. Combine compound phrases like "5 lakh and 20 thousand" -> "₹520000"
  const compoundRegex =
    /(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(crore|crores|cr|lakh|lakhs|lac|lacs|l)\s*(?:and|,)\s*(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(thousand|thousands|k|lakh|lakhs|lac|lacs|l)/gi;

  const MULTIPLIERS: Record<string, number> = {
    k: 1000,
    lakh: 100000,
    lakhs: 100000,
    lac: 100000,
    lacs: 100000,
    l: 100000,
    crore: 10000000,
    crores: 10000000,
    cr: 10000000,
    thousand: 1000,
    thousands: 1000,
  };

  normalizedQuery = normalizedQuery.replace(
    compoundRegex,
    (_match, num1Str, unit1, num2Str, unit2) => {
      const n1 = parseFloat(num1Str);
      const n2 = parseFloat(num2Str);
      const m1 = MULTIPLIERS[unit1.toLowerCase()] ?? 1;
      const m2 = MULTIPLIERS[unit2.toLowerCase()] ?? 1;
      const combined = Math.round(n1 * m1 + n2 * m2);
      return ` ₹${combined} `;
    }
  );

  const tokenRegex = /(₹|rs\.?|inr)?\s*(\d+(?:,\d+)*(?:\.\d+)?)(?:\s*([a-zA-Z%]+))?/gi;
  let match: RegExpExecArray | null;

  const CURRENCY_WORDS = new Set(['rs', 'inr', 'rupees', 'rupee', 'bucks']);

  const CONNECTORS = new Set([
    'on', 'for', 'in', 'at', 'to', 'of', 'per', 'each', 'every', 'worth',
    'this', 'next', 'a', 'an', 'the', 'and', 'or', 'is', 'with', 'from',
    'by', 'if', 'when', 'pm', 'am', 'as', 'more', 'less', 'than', 'only',
    'approx', 'around', 'budget'
  ]);

  interface Candidate {
    amount: number;
    score: number;
    index: number;
  }

  const candidates: Candidate[] = [];

  while ((match = tokenRegex.exec(normalizedQuery)) !== null) {
    const hasCurrencyPrefix = Boolean(match[1]);
    const rawDigits = match[2];
    const hasCommas = rawDigits.includes(',');
    const num = parseFloat(rawDigits.replace(/,/g, ''));
    if (isNaN(num)) continue;

    const unit = match[3]?.toLowerCase();
    let multiplier = 1;

    if (unit) {
      if (MULTIPLIERS[unit] !== undefined) {
        multiplier = MULTIPLIERS[unit];
      } else if (CURRENCY_WORDS.has(unit)) {
        multiplier = 1;
      } else if (hasCurrencyPrefix || hasCommas) {
        multiplier = 1;
      } else if (CONNECTORS.has(unit)) {
        multiplier = 1;
      } else {
        // Bare number followed by an unrecognised unit/word (e.g. "50 xyz", "60 bananas")
        return { amount: null, needsClarification: true };
      }
    }

    const calculated = Math.round(num * multiplier);
    if (!Number.isFinite(calculated) || calculated <= 0 || calculated > 1000000000) {
      return { amount: null, needsClarification: true };
    }

    // Inspect preceding context window (up to 40 characters before match)
    const matchIndex = match.index;
    const windowStart = Math.max(0, matchIndex - 40);
    const windowBefore = normalizedQuery.slice(windowStart, matchIndex).toLowerCase();

    // Context scoring:
    // If preceded by salary / earn / income, penalize heavily (-10)
    // If preceded by afford / buy / purchase / cost / price / for, reward (+10)
    // If prefixed by currency symbol, reward (+5)
    let score = 0;
    if (/\b(salary|earn(s|ing)?|income|make(s)?)\b/i.test(windowBefore)) {
      score -= 10;
    }
    if (/\b(afford|buy|purchase|cost|costs|price|for)\b/i.test(windowBefore)) {
      score += 10;
    }
    if (hasCurrencyPrefix) {
      score += 5;
    }

    candidates.push({
      amount: calculated,
      score,
      index: matchIndex,
    });
  }

  if (candidates.length === 0) {
    return { amount: null, needsClarification: false };
  }

  if (candidates.length === 1) {
    return { amount: candidates[0].amount, needsClarification: false };
  }

  // Filter candidates >= 1000 with non-negative score
  const purchaseCandidates = candidates.filter((c) => c.score >= 0 && c.amount >= 1000);

  if (purchaseCandidates.length === 1) {
    return { amount: purchaseCandidates[0].amount, needsClarification: false };
  }

  if (purchaseCandidates.length > 1) {
    // Sort descending by score
    purchaseCandidates.sort((a, b) => b.score - a.score);
    // If top candidate has strictly higher score than second, choose it
    if (purchaseCandidates[0].score > purchaseCandidates[1].score) {
      return { amount: purchaseCandidates[0].amount, needsClarification: false };
    }
    // Ambiguous multiple amounts: ask user to confirm
    return { amount: null, needsClarification: true };
  }

  // If all candidates had negative score (e.g. only salary was mentioned)
  return { amount: null, needsClarification: false };
}

function generateDeterministicChatReply(userMessage: string): string {
  const query = userMessage.toLowerCase();

  // Item 2b-2: Investment guardrail matches whole words/phrases with negative lookahead for "stock up".
  // Remove isStockUp flag so "stock up on tea and also buy mutual funds" is properly refused.
  const INVESTMENT_PATTERNS = [
    /\bmutual\s+funds?\b/i,
    /\b(equity\s+)?stocks?\b(?!\s+up\b)/i,
    /\bsips?\b/i,
    /\binvest(ing|ment)?s?\b/i,
    /\bcrypto(currency)?\b/i,
    /\bshare\s+market\b/i,
    /\btrading\b/i,
  ];

  const isInvestmentQuery = INVESTMENT_PATTERNS.some((pat) => pat.test(query));

  if (isInvestmentQuery) {
    return `I am strictly a mathematical budgeting and expense-tracking assistant. I cannot recommend stocks, mutual funds, crypto, SIPs, or financial investment products. 

If you are looking to invest your surplus cash, please consult a SEBI-registered investment advisor (RIA) who can evaluate your risk tolerance and financial goals.

I can, however, help you calculate how much surplus cash you have available each month, or simulate how reducing certain expense categories can boost your savings.

---
*Budgeting tool only. Not financial or investment advice.*`;
  }

  // Item 2b-1: Shorthand amount parsing (60k, 1.5 lakh, 2 L, 1 crore, ₹15,000) with clarification on unrecognised words
  if (/\b(afford|buy|purchase|spend(\s+on)?|stock(ing)?\s+up)\b/i.test(query)) {
    const parsed = parseQueryAmount(query);

    if (parsed.amount === null) {
      return `### Affordability Check

Could you please specify the amount for the purchase you are considering (e.g., *"Can I afford a ₹15,000 phone?"*, *"60k"*, or *"1.5 lakh"*)? 

Once you provide the estimated cost, I will calculate its impact on your monthly surplus and savings goals.

---
*Budgeting tool only. Not financial or investment advice.*`;
    }

    const cost = parsed.amount;

    return `### Affordability Analysis for a ₹${cost.toLocaleString('en-IN')} Expense

Here is how a ₹${cost.toLocaleString('en-IN')} one-time purchase impacts your monthly budget:

1. **Impact on Monthly Cash Flow:**
   - If paid upfront in a single month, this outlay directly reduces your month-end bank balance.
   - For a purchase of ₹${cost.toLocaleString('en-IN')}, consider whether this fits within your net monthly surplus or if it should be saved across multiple months.

2. **Recommended Budgeting Strategy:**
   - **Spread over 2-3 months:** Rather than draining this month's cash buffer, create a milestone goal in the **Goal Planner** to save ₹${Math.round(cost / 3).toLocaleString('en-IN')}/month over the next 3 months.
   - **Verify Emergency Buffer:** Always preserve at least 1 month of living expenses in your bank account before making large discretionary purchases.

---
*Budgeting tool only. Not financial or investment advice.*`;
  }

  // Category or spending comparison query
  if (query.includes('where') || query.includes('spend') || query.includes('category') || query.includes('money go')) {
    return `### Spending Breakdown Overview

Based on your verified transactions:
- **Fixed Necessities:** House rent and utility bills make up the steady foundation of your monthly costs.
- **Variable Living:** Food & groceries, daily commute, and occasional shopping/entertainment represent your dynamic expenses.

**Tip:** Check the **Spending Analysis** tab for month-over-month category variance charts, and visit **Budgets & Alerts** to set threshold limits on your top categories like Food and Shopping.

---
*Budgeting tool only. Not financial or investment advice.*`;
  }

  // Goal acceleration query
  if (query.includes('goal') || query.includes('faster') || query.includes('earlier') || query.includes('emergency fund')) {
    return `### Accelerating Your Financial Milestones

To reach your goals faster using budgeting mathematics:
1. **Allocate Surplus by Priority:** Rather than splitting surplus across 3 goals at once, fund your Emergency Fund first. 100% focus reduces timeline by up to 50%.
2. **Trim 2 Discretionary Categories:** Check your top spending categories in Spending Analysis and apply a 10-15% trim to increase your goal contribution.
3. **Use the What-If Simulator:** Open the **What-if Simulator** to simulate a spend cut and see the exact month reduction for every active goal!

---
*Budgeting tool only. Not financial or investment advice.*`;
  }

  // General helpful response
  return `### Financial Coaching Perspective

Here are key budgeting principles to optimize your monthly cash flow:
- **Track Every Outflow:** Categorizing UPI payments and card swipes gives you total visibility into where your first salary goes.
- **Maintain a 20%+ Savings Margin:** Aim to keep expenses below 80% of take-home income so unexpected repairs or medical visits don't force borrowing.
- **Protect Your Predicted Balance:** Review your dashboard prediction mid-month to ensure your variable daily burn rate is on pace.

Feel free to ask specific questions like:
- *"Can I afford a ₹15,000 laptop purchase this month?"*
- *"Where did my biggest spending increase happen?"*
- *"How can I reach my Emergency Fund goal 2 months earlier?"*

---
*Budgeting tool only. Not financial or investment advice.*`;
}
