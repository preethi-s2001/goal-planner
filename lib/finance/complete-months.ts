import { Transaction } from '@/types';
import { parseDateParts } from './prediction';

export interface CompleteMonthsResult {
  completeMonths: string[]; // sorted ['YYYY-MM', ...]
  count: number;
  firstDataMonth: string | null;
  firstTxDay: number | null;
}

/**
 * A history month counts as complete only if it is before the current month AND:
 * (it is not the user's first data month OR its first transaction is on or before the 7th).
 */
export function getCompleteHistoryMonths(
  transactions: Transaction[] | { date: string }[],
  currentMonth: string
): CompleteMonthsResult {
  if (!transactions || transactions.length === 0) {
    return { completeMonths: [], count: 0, firstDataMonth: null, firstTxDay: null };
  }

  const monthFirstDay: Record<string, number> = {};
  let overallEarliestDate: string | null = null;

  for (const t of transactions) {
    if (!t.date || t.date.length < 10) continue;
    const { monthStr, day } = parseDateParts(t.date);

    if (overallEarliestDate === null || t.date < overallEarliestDate) {
      overallEarliestDate = t.date;
    }

    if (monthFirstDay[monthStr] === undefined || day < monthFirstDay[monthStr]) {
      monthFirstDay[monthStr] = day;
    }
  }

  if (!overallEarliestDate) {
    return { completeMonths: [], count: 0, firstDataMonth: null, firstTxDay: null };
  }

  const { monthStr: firstDataMonth, day: firstTxDay } = parseDateParts(overallEarliestDate);

  const monthsBeforeCurrent = Object.keys(monthFirstDay)
    .filter((m) => m < currentMonth)
    .sort();

  const completeMonths = monthsBeforeCurrent.filter((m) => {
    if (m !== firstDataMonth) {
      return true;
    }
    // For user's first data month, earliest transaction must be on or before the 7th
    return monthFirstDay[m] <= 7;
  });

  return {
    completeMonths,
    count: completeMonths.length,
    firstDataMonth,
    firstTxDay,
  };
}
