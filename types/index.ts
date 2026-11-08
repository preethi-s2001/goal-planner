export type TransactionType = 'income' | 'expense';

export type TransactionSource = 'csv' | 'manual' | 'recurring';

export interface Profile {
  id: string;
  display_name: string | null;
  currency: string;
  created_at: string;
  updated_at: string;
}

export interface CustomCategory {
  id: string;
  user_id: string;
  name: string;
  type: TransactionType;
  created_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  description: string;
  amount: number;
  type: TransactionType;
  category: string;
  source: TransactionSource;
  import_batch_id?: string | null;
  recurring_item_id?: string | null;
  recurring_month?: string | null; // YYYY-MM
  created_at: string;
}

export interface CategoryRule {
  id: string;
  user_id: string;
  keyword: string;
  category: string;
  created_at: string;
}

export interface Budget {
  id: string;
  user_id: string;
  category: string;
  monthly_limit: number;
  created_at: string;
}

export interface Goal {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  saved_amount: number;
  target_months: number;
  created_at: string;
}

export interface RecurringItem {
  id: string;
  user_id: string;
  description: string;
  amount: number;
  type: TransactionType;
  category: string;
  day_of_month: number;
  active: boolean;
  created_at: string;
}

export interface MonthlySettings {
  id: string;
  user_id: string;
  month: string; // YYYY-MM
  opening_balance: number;
  created_at: string;
}

// Fixed categories: Rent, Bills (as per brief definition)
export const FIXED_CATEGORIES = ['Rent', 'Bills'] as const;

// Default categories as defined in Project Brief
export const DEFAULT_EXPENSE_CATEGORIES = [
  'Rent',
  'Food',
  'Transport',
  'Shopping',
  'Bills',
  'Entertainment',
  'Health',
  'Others',
] as const;

export const DEFAULT_INCOME_CATEGORIES = ['Income'] as const;

export const DEFAULT_CATEGORIES = [
  ...DEFAULT_EXPENSE_CATEGORIES,
  ...DEFAULT_INCOME_CATEGORIES,
] as const;

export type CategoryName = (typeof DEFAULT_CATEGORIES)[number] | string;
