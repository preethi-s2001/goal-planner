import { describe, it, expect } from 'vitest';
import {
  cleanAndValidateCsv,
  parseDateToIso,
  parseAmount,
  normalizeType,
  normalizeHeaderKey,
  isValidDate,
  extractCsvDateRange,
} from '@/lib/csv/cleaner';
import type { Transaction, CategoryRule } from '@/types';
import * as fs from 'fs';
import * as path from 'path';

// ─── normalizeHeaderKey ───────────────────────────────────────────────────────
describe('normalizeHeaderKey', () => {
  it('maps standard headers to canonical keys', () => {
    expect(normalizeHeaderKey('Date')).toBe('date');
    expect(normalizeHeaderKey('Description')).toBe('description');
    expect(normalizeHeaderKey('Amount')).toBe('amount');
    expect(normalizeHeaderKey('Type')).toBe('type');
  });

  it('maps alternative header names', () => {
    expect(normalizeHeaderKey('Narration')).toBe('description');
    expect(normalizeHeaderKey('Particulars')).toBe('description');
    expect(normalizeHeaderKey('Txn Date')).toBe('date');
    expect(normalizeHeaderKey('CR/DR')).toBe('type');
    expect(normalizeHeaderKey('DR CR')).toBe('type');
    expect(normalizeHeaderKey('Txn Amount')).toBe('amount');
  });

  it('preserves unknown headers as-is (trimmed)', () => {
    expect(normalizeHeaderKey('  Balance  ')).toBe('Balance');
  });
});

// ─── parseDateToIso & isValidDate ─────────────────────────────────────────────
describe('parseDateToIso & isValidDate', () => {
  it('parses DD-MM-YYYY', () => {
    expect(parseDateToIso('07-11-2026')).toBe('2026-11-07');
  });

  it('parses DD/MM/YYYY', () => {
    expect(parseDateToIso('01/06/2024')).toBe('2024-06-01');
  });

  it('parses DD.MM.YYYY', () => {
    expect(parseDateToIso('15.03.2025')).toBe('2025-03-15');
  });

  it('parses YYYY-MM-DD', () => {
    expect(parseDateToIso('2026-11-07')).toBe('2026-11-07');
  });

  it('parses YYYY/MM/DD', () => {
    expect(parseDateToIso('2024/01/31')).toBe('2024-01-31');
  });

  it('returns null for invalid date string', () => {
    expect(parseDateToIso('not-a-date')).toBeNull();
    expect(parseDateToIso('')).toBeNull();
  });

  it('returns null for out-of-range date (month 13)', () => {
    expect(parseDateToIso('07-13-2026')).toBeNull();
    expect(parseDateToIso('2026-13-07')).toBeNull();
  });

  it('Issue 2: returns null for impossible dates like Feb 31 or Feb 30', () => {
    expect(parseDateToIso('31-02-2026')).toBeNull();
    expect(parseDateToIso('2026-02-31')).toBeNull();
    expect(parseDateToIso('30-02-2024')).toBeNull();
    expect(isValidDate(2026, 2, 31)).toBe(false);
    expect(isValidDate(2026, 2, 28)).toBe(true);
  });
});

// ─── parseAmount (Issue 2) ────────────────────────────────────────────────────
describe('parseAmount', () => {
  it('parses plain numbers', () => {
    expect(parseAmount('1000')).toBe(1000);
    expect(parseAmount(1000)).toBe(1000);
  });

  it('parses numbers with commas', () => {
    expect(parseAmount('35,000')).toBe(35000);
    expect(parseAmount('1,250.50')).toBe(1250.5);
  });

  it('parses numbers with rupee symbol', () => {
    expect(parseAmount('₹5,000')).toBe(5000);
    expect(parseAmount('$500')).toBe(500);
  });

  it('parses numbers with negative sign (returns positive)', () => {
    expect(parseAmount('-500')).toBe(500);
  });

  it('parses parenthetical negatives', () => {
    expect(parseAmount('(750.00)')).toBe(750);
  });

  it('Issue 2: accepts numbers up to 9,999,999.99', () => {
    expect(parseAmount('9,999,999.99')).toBe(9999999.99);
    expect(parseAmount(9999999.99)).toBe(9999999.99);
  });

  it('Issue 2: rejects amounts exceeding 9,999,999.99', () => {
    expect(parseAmount('10,000,000')).toBeNull();
    expect(parseAmount('10000000.01')).toBeNull();
    expect(parseAmount(10000000)).toBeNull();
  });

  it('Issue 2: rejects amounts with trailing garbage like "12abc"', () => {
    expect(parseAmount('12abc')).toBeNull();
    expect(parseAmount('35,000xyz')).toBeNull();
    expect(parseAmount('abc12')).toBeNull();
    expect(parseAmount('12.34.56')).toBeNull();
  });

  it('returns null for zero', () => {
    expect(parseAmount('0')).toBeNull();
    expect(parseAmount(0)).toBeNull();
  });

  it('returns null for text', () => {
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('')).toBeNull();
  });

  it('returns null for null/undefined', () => {
    expect(parseAmount(null)).toBeNull();
    expect(parseAmount(undefined)).toBeNull();
  });
});

// ─── normalizeType ────────────────────────────────────────────────────────────
describe('normalizeType', () => {
  it('maps income variants', () => {
    expect(normalizeType('Income')).toBe('income');
    expect(normalizeType('CR')).toBe('income');
    expect(normalizeType('credit')).toBe('income');
    expect(normalizeType('deposit')).toBe('income');
    expect(normalizeType('C')).toBe('income');
  });

  it('maps expense variants', () => {
    expect(normalizeType('Expense')).toBe('expense');
    expect(normalizeType('DR')).toBe('expense');
    expect(normalizeType('debit')).toBe('expense');
    expect(normalizeType('withdrawal')).toBe('expense');
    expect(normalizeType('payment')).toBe('expense');
  });

  it('returns null for unrecognized', () => {
    expect(normalizeType('UNKNOWN')).toBeNull();
    expect(normalizeType('')).toBeNull();
    expect(normalizeType(null)).toBeNull();
  });
});

// ─── extractCsvDateRange (Issue 4) ────────────────────────────────────────────
describe('extractCsvDateRange', () => {
  it('extracts correct min and max dates from CSV content', () => {
    const csv = `Date,Description,Amount,Type
15-11-2026,Swiggy,300,Expense
01-11-2026,Salary,35000,Income
28-11-2026,Netflix,199,Expense
`;
    const range = extractCsvDateRange(csv);
    expect(range.minDate).toBe('2026-11-01');
    expect(range.maxDate).toBe('2026-11-28');
  });
});

// ─── cleanAndValidateCsv (Issues 2, 3, 5, 6) ─────────────────────────────────
describe('cleanAndValidateCsv', () => {
  const basicCsv = `Date,Description,Amount,Type
07-11-2026,Salary Credit,35000,Income
08-11-2026,Swiggy Order,350,Expense
09-11-2026,Uber Ride,200,Expense
`;

  it('parses a valid CSV with standard headers', () => {
    const result = cleanAndValidateCsv(basicCsv);
    expect(result.success).toBe(true);
    expect(result.validRows).toHaveLength(3);
    expect(result.skippedRows).toHaveLength(0);
    expect(result.summary.validCount).toBe(3);
  });

  it('auto-categorizes rows correctly', () => {
    const result = cleanAndValidateCsv(basicCsv);
    const salary = result.validRows.find((r) => r.description === 'Salary Credit');
    const swiggy = result.validRows.find((r) => r.description === 'Swiggy Order');
    const uber = result.validRows.find((r) => r.description === 'Uber Ride');
    expect(salary?.category).toBe('Income');
    expect(swiggy?.category).toBe('Food');
    expect(uber?.category).toBe('Transport');
  });

  it('Issue 5: Type-aware categorization in CSV import', () => {
    const csv = `Date,Description,Amount,Type
01-11-2026,Maid salary payment,4000,Expense
01-11-2026,Salary credit November,35000,Income
02-11-2026,Consulting payout,15000,Income
`;
    const result = cleanAndValidateCsv(csv);
    const maidRow = result.validRows.find((r) => r.description.includes('Maid'));
    const salaryRow = result.validRows.find((r) => r.description.includes('Salary credit'));
    const consultRow = result.validRows.find((r) => r.description.includes('Consulting'));

    // Expense can NEVER be 'Income'
    expect(maidRow?.category).not.toBe('Income');
    expect(maidRow?.category).toBe('Others');
    // Income row gets 'Income'
    expect(salaryRow?.category).toBe('Income');
    expect(consultRow?.category).toBe('Income');
  });

  it('Issue 2: skips rows with description exceeding 500 characters', () => {
    const longDesc = 'A'.repeat(501);
    const csv = `Date,Description,Amount,Type
07-11-2026,${longDesc},350,Expense
08-11-2026,Normal spend,200,Expense
`;
    const result = cleanAndValidateCsv(csv);
    expect(result.validRows).toHaveLength(1);
    expect(result.skippedRows).toHaveLength(1);
    expect(result.skippedRows[0].reason).toMatch(/exceeds maximum length of 500/i);
  });

  it('Issue 2: skips rows with amount containing trailing garbage', () => {
    const csv = `Date,Description,Amount,Type
07-11-2026,Bad Amount Row,12abc,Expense
08-11-2026,Good Row,500,Expense
`;
    const result = cleanAndValidateCsv(csv);
    expect(result.validRows).toHaveLength(1);
    expect(result.skippedRows[0].reason).toMatch(/Invalid amount/i);
  });

  it('Issue 2: rejects files exceeding maximum 2,000 valid rows', () => {
    const header = 'Date,Description,Amount,Type\n';
    const lines = [];
    for (let i = 0; i < 2005; i++) {
      lines.push(`07-11-2026,Item ${i},100,Expense`);
    }
    const largeCsv = header + lines.join('\n');
    const result = cleanAndValidateCsv(largeCsv);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/exceeds the maximum limit of 2,000/i);
    expect(result.validRows).toHaveLength(0);
  });

  it('Issue 3: Duplicate handling by counts — two identical rows in same CSV are BOTH valid', () => {
    // Two identical chai purchases on the same day are legitimate
    const csv = `Date,Description,Amount,Type
07-11-2026,Chai at Tea Point,20,Expense
07-11-2026,Chai at Tea Point,20,Expense
`;
    // DB has 0 identical rows
    const result = cleanAndValidateCsv(csv, []);
    expect(result.validRows).toHaveLength(2);
    expect(result.skippedRows).toHaveLength(0);
    // Neither is marked duplicate against DB
    expect(result.validRows[0].isDuplicate).toBe(false);
    expect(result.validRows[1].isDuplicate).toBe(false);
    expect(result.duplicateCount).toBe(0);
  });

  it('Issue 3: Duplicate handling by counts against saved data', () => {
    const existing: Transaction[] = [
      {
        id: '1',
        user_id: 'u1',
        date: '2026-11-07',
        description: 'Swiggy',
        amount: 350,
        type: 'expense',
        category: 'Food',
        source: 'manual',
        created_at: new Date().toISOString(),
      },
    ];

    // CSV has TWO identical rows for Swiggy 350
    const csv = `Date,Description,Amount,Type
07-11-2026,Swiggy,350,Expense
07-11-2026,Swiggy,350,Expense
`;
    const result = cleanAndValidateCsv(csv, existing);
    // Both rows are in validRows (shown in preview, not skipped!)
    expect(result.validRows).toHaveLength(2);
    // Row 1 is a duplicate against saved data (saved has 1)
    expect(result.validRows[0].isDuplicate).toBe(true);
    // Row 2 is NOT a duplicate (saved only had 1, so the second instance is new!)
    expect(result.validRows[1].isDuplicate).toBe(false);
    expect(result.duplicateCount).toBe(1);
  });

  it('Issue 1: Non-partial unique index specification in schema and migration', () => {
    const schemaPath = path.resolve(__dirname, '../supabase/schema.sql');
    const migrationPath = path.resolve(__dirname, '../supabase/migrations/20261107_recurring_idempotency.sql');

    const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
    const migrationContent = fs.readFileSync(migrationPath, 'utf-8');

    // Schema must NOT have partial WHERE on the unique index
    expect(schemaContent).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_recurring_unique\s+ON public\.transactions\s*\(recurring_item_id,\s*recurring_month\);/i
    );
    expect(schemaContent).not.toMatch(
      /idx_transactions_recurring_unique[\s\S]*?WHERE recurring_item_id IS NOT NULL/i
    );

    // Migration must drop old index and create non-partial index
    expect(migrationContent).toMatch(/DROP INDEX IF EXISTS (?:public\.)?idx_transactions_recurring_unique;/i);
    expect(migrationContent).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_recurring_unique\s+ON public\.transactions\s*\(recurring_item_id,\s*recurring_month\);/i
    );
  });
});
