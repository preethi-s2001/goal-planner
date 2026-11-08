import Papa from 'papaparse';
import { categorizeDescription } from '@/lib/finance/categorizer';
import { CategoryRule, Transaction } from '@/types';

export interface RawCsvRow {
  [key: string]: any;
}

export interface CleanedCsvRow {
  tempId: string;
  date: string; // YYYY-MM-DD
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  isDuplicate: boolean;
}

export interface CsvSkippedRow {
  rowIndex: number;
  reason: string;
  raw: RawCsvRow;
}

export interface CsvProcessingResult {
  success: boolean;
  error?: string;
  missingColumns?: string[];
  validRows: CleanedCsvRow[];
  skippedRows: CsvSkippedRow[];
  duplicateCount: number;
  existingDuplicateCount: number;
  summary: {
    totalRows: number;
    validCount: number;
    skippedCount: number;
    internalDuplicateCount: number;
    existingDuplicateCount: number;
  };
}

/**
 * Normalizes header names to match standard fields:
 * - date
 * - description
 * - amount
 * - type
 */
export function normalizeHeaderKey(rawHeader: string): string {
  const h = rawHeader.trim().toLowerCase().replace(/[^a-z0-9]/g, '');

  if (['date', 'txndate', 'transactiondate', 'valuedate', 'postingdate'].includes(h)) {
    return 'date';
  }
  if (['description', 'narration', 'particulars', 'remarks', 'desc', 'details'].includes(h)) {
    return 'description';
  }
  if (['amount', 'txnamount', 'transactionamount', 'netamount'].includes(h)) {
    return 'amount';
  }
  if (['type', 'txntype', 'crdr', 'drcr', 'transactiontype'].includes(h)) {
    return 'type';
  }
  return rawHeader.trim();
}

/**
 * Parses diverse date formats, treating day-first as default:
 * Accepts DD-MM-YYYY, DD/MM/YYYY, YYYY-MM-DD, YYYY/MM/DD, DD.MM.YYYY
 */
export function parseDateToIso(dateStr: string): string | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const trimmed = dateStr.trim();

  // 1. Check YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10);
    const day = parseInt(ymdMatch[3], 10);
    if (isValidDate(year, month, day)) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // 2. Check DD-MM-YYYY or DD/MM/YYYY (Day-first is default per brief)
  const dmyMatch = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10);
    const year = parseInt(dmyMatch[3], 10);
    if (isValidDate(year, month, day)) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  return null;
}

export function isValidDate(year: number, month: number, day: number): boolean {
  if (year < 1990 || year > 2099) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  const daysInMonth = new Date(year, month, 0).getDate();
  return day <= daysInMonth;
}

/**
 * Parses string or numeric amounts:
 * - Must be finite, > 0, and <= 9,999,999.99
 * - Rejects amounts with trailing/leading garbage like "12abc"
 * - Accepts only digits, one decimal point, commas, rupee symbol, minus, or parentheses.
 */
export function parseAmount(rawAmount: any): number | null {
  if (rawAmount === null || rawAmount === undefined) return null;
  if (typeof rawAmount === 'number') {
    if (!Number.isFinite(rawAmount) || isNaN(rawAmount) || rawAmount <= 0 || rawAmount > 9999999.99) {
      return null;
    }
    return Math.round(rawAmount * 100) / 100;
  }

  const str = String(rawAmount).trim();
  if (!str) return null;

  // Reject characters that are not digits, comma, dot, minus, paren, rupee, dollar, or whitespace
  if (!/^[-₹$,\d.()\s]+$/.test(str)) {
    return null;
  }

  // Parenthetical format e.g. (1,250.50)
  const parenMatch = str.match(/^\s*\(\s*[-₹$]?\s*([\d,]+(?:\.\d+)?)\s*\)\s*$/);
  // Standard format e.g. ₹35,000 or -500 or 1,250.50
  const stdMatch = str.match(/^\s*[-₹$]?\s*([\d,]+(?:\.\d+)?)\s*$/);

  const matchedNumber = parenMatch ? parenMatch[1] : (stdMatch ? stdMatch[1] : null);
  if (!matchedNumber) {
    return null;
  }

  const cleaned = matchedNumber.replace(/,/g, '');
  const val = parseFloat(cleaned);

  if (!Number.isFinite(val) || isNaN(val) || val <= 0 || val > 9999999.99) {
    return null;
  }

  return Math.round(val * 100) / 100;
}

/**
 * Normalizes transaction type string to 'income' | 'expense'
 */
export function normalizeType(rawType: any): 'income' | 'expense' | null {
  if (!rawType) return null;
  const str = String(rawType).trim().toLowerCase();

  if (['income', 'cr', 'credit', 'deposit', 'c'].includes(str)) {
    return 'income';
  }
  if (['expense', 'dr', 'debit', 'withdrawal', 'd', 'spend', 'payment'].includes(str)) {
    return 'expense';
  }
  return null;
}

/**
 * Extracts min and max ISO dates from raw CSV content
 */
export function extractCsvDateRange(csvContent: string): { minDate: string | null; maxDate: string | null } {
  const parseResult = Papa.parse<RawCsvRow>(csvContent, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (header) => normalizeHeaderKey(header),
  });

  if (!parseResult.data) return { minDate: null, maxDate: null };

  let minDate: string | null = null;
  let maxDate: string | null = null;

  for (const row of parseResult.data) {
    if (row.date) {
      const iso = parseDateToIso(String(row.date));
      if (iso) {
        if (!minDate || iso < minDate) minDate = iso;
        if (!maxDate || iso > maxDate) maxDate = iso;
      }
    }
  }

  return { minDate, maxDate };
}

/**
 * Cleans, validates, deduplicates by counts, and categorizes raw CSV rows.
 */
export function cleanAndValidateCsv(
  csvContent: string,
  existingTransactions: Transaction[] = [],
  userRules: CategoryRule[] = []
): CsvProcessingResult {
  if (!csvContent || !csvContent.trim()) {
    return {
      success: false,
      error: 'The CSV file is empty. Please upload a file containing transaction data.',
      validRows: [],
      skippedRows: [],
      duplicateCount: 0,
      existingDuplicateCount: 0,
      summary: {
        totalRows: 0,
        validCount: 0,
        skippedCount: 0,
        internalDuplicateCount: 0,
        existingDuplicateCount: 0,
      },
    };
  }

  // Parse CSV with Papa Parse
  const parseResult = Papa.parse<RawCsvRow>(csvContent, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (header) => normalizeHeaderKey(header),
  });

  if (parseResult.errors.length > 0 && (!parseResult.data || parseResult.data.length === 0)) {
    return {
      success: false,
      error: `Could not read CSV file: ${parseResult.errors[0]?.message || 'Invalid format'}`,
      validRows: [],
      skippedRows: [],
      duplicateCount: 0,
      existingDuplicateCount: 0,
      summary: {
        totalRows: 0,
        validCount: 0,
        skippedCount: 0,
        internalDuplicateCount: 0,
        existingDuplicateCount: 0,
      },
    };
  }

  const rawRows = parseResult.data;
  if (!rawRows || rawRows.length === 0) {
    return {
      success: false,
      error: 'No transaction rows found in the CSV file.',
      validRows: [],
      skippedRows: [],
      duplicateCount: 0,
      existingDuplicateCount: 0,
      summary: {
        totalRows: 0,
        validCount: 0,
        skippedCount: 0,
        internalDuplicateCount: 0,
        existingDuplicateCount: 0,
      },
    };
  }

  // Validate required columns
  const firstRow = rawRows[0] || {};
  const presentHeaders = Object.keys(firstRow);
  const requiredColumns = ['date', 'description', 'amount', 'type'];
  const missingColumns = requiredColumns.filter((col) => !presentHeaders.includes(col));

  if (missingColumns.length > 0) {
    const readableMissing = missingColumns
      .map((c) => c.charAt(0).toUpperCase() + c.slice(1))
      .join(', ');
    return {
      success: false,
      error: `Missing required column(s): ${readableMissing}. Expected columns: Date, Description, Amount, Type.`,
      missingColumns,
      validRows: [],
      skippedRows: [],
      duplicateCount: 0,
      existingDuplicateCount: 0,
      summary: {
        totalRows: rawRows.length,
        validCount: 0,
        skippedCount: rawRows.length,
        internalDuplicateCount: 0,
        existingDuplicateCount: 0,
      },
    };
  }

  // Duplicate handling: compare by counts, not presence.
  // Count occurrences of each fingerprint in saved data.
  const savedCounts = new Map<string, number>();
  for (const t of existingTransactions) {
    const fp = `${t.date}|${t.description.trim().toLowerCase()}|${Number(t.amount).toFixed(2)}|${t.type}`;
    savedCounts.set(fp, (savedCounts.get(fp) || 0) + 1);
  }

  const csvSeenCounts = new Map<string, number>();
  const validRows: CleanedCsvRow[] = [];
  const skippedRows: CsvSkippedRow[] = [];
  let duplicateCount = 0;

  rawRows.forEach((row, index) => {
    const rowNum = index + 2; // +1 for 0-index, +1 for header line

    // 1. Check blank row
    const rawDesc = row.description;
    const rawDate = row.date;
    const rawAmount = row.amount;
    const rawType = row.type;

    if (!rawDesc && !rawDate && !rawAmount && !rawType) {
      skippedRows.push({ rowIndex: rowNum, reason: 'Blank row', raw: row });
      return;
    }

    // 2. Validate Description (max 500 characters)
    const description = typeof rawDesc === 'string' ? rawDesc.trim() : String(rawDesc || '').trim();
    if (!description) {
      skippedRows.push({ rowIndex: rowNum, reason: 'Missing description', raw: row });
      return;
    }
    if (description.length > 500) {
      skippedRows.push({
        rowIndex: rowNum,
        reason: 'Description exceeds maximum length of 500 characters',
        raw: row,
      });
      return;
    }

    // 3. Validate Date
    const isoDate = parseDateToIso(String(rawDate || ''));
    if (!isoDate) {
      skippedRows.push({
        rowIndex: rowNum,
        reason: `Invalid date "${rawDate}". Expected DD-MM-YYYY or YYYY-MM-DD.`,
        raw: row,
      });
      return;
    }

    // 4. Validate Amount (positive, finite, <= 9,999,999.99, no trailing garbage)
    const amount = parseAmount(rawAmount);
    if (amount === null) {
      skippedRows.push({
        rowIndex: rowNum,
        reason: `Invalid amount "${rawAmount}". Must be positive, finite, and up to ₹99,99,999.99 without trailing letters.`,
        raw: row,
      });
      return;
    }

    // 5. Validate Type
    const type = normalizeType(rawType);
    if (!type) {
      skippedRows.push({
        rowIndex: rowNum,
        reason: `Invalid transaction type "${rawType}". Expected Income or Expense.`,
        raw: row,
      });
      return;
    }

    // 6. Duplicate check by counts:
    // Two identical rows in the same CSV are legitimate;
    // a row is a duplicate against saved data only if saved data already contains at least that many identical rows.
    const fingerprint = `${isoDate}|${description.toLowerCase()}|${amount.toFixed(2)}|${type}`;
    const currentCsvCount = (csvSeenCounts.get(fingerprint) || 0) + 1;
    csvSeenCounts.set(fingerprint, currentCsvCount);

    const savedCount = savedCounts.get(fingerprint) || 0;
    const isDuplicate = currentCsvCount <= savedCount;

    if (isDuplicate) {
      duplicateCount++;
    }

    // 7. Type-aware auto-categorization
    const category = categorizeDescription(description, userRules, type);

    validRows.push({
      tempId: `csv-row-${index}-${Math.random().toString(36).substring(2, 7)}`,
      date: isoDate,
      description,
      amount,
      type,
      category,
      isDuplicate,
    });
  });

  // Limit check: max 2000 valid rows per file
  if (validRows.length > 2000) {
    return {
      success: false,
      error: `File contains ${validRows.length} valid transactions, which exceeds the maximum limit of 2,000. Please split your file into smaller batches.`,
      validRows: [],
      skippedRows: [],
      duplicateCount: 0,
      existingDuplicateCount: 0,
      summary: {
        totalRows: rawRows.length,
        validCount: 0,
        skippedCount: rawRows.length,
        internalDuplicateCount: 0,
        existingDuplicateCount: 0,
      },
    };
  }

  return {
    success: validRows.length > 0,
    error: validRows.length === 0 ? 'No valid transaction rows could be parsed from this CSV.' : undefined,
    validRows,
    skippedRows,
    duplicateCount,
    existingDuplicateCount: duplicateCount,
    summary: {
      totalRows: rawRows.length,
      validCount: validRows.length,
      skippedCount: skippedRows.length,
      internalDuplicateCount: 0,
      existingDuplicateCount: duplicateCount,
    },
  };
}
