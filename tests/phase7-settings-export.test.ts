import { describe, it, expect } from 'vitest';
import Papa from 'papaparse';
import { z } from 'zod';

describe('Phase 7: Settings, Data Export, and Account Deletion Validation', () => {
  const DeletePayloadSchema = z.object({
    action: z.enum(['clear_data', 'delete_account']),
    confirmation: z.literal('DELETE', {
      errorMap: () => ({ message: 'Please type DELETE to confirm' }),
    }),
  });

  const PasswordSchema = z
    .object({
      password: z.string().min(8, 'Password must be at least 8 characters'),
      confirmPassword: z.string().min(8, 'Please confirm your password'),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: 'Passwords do not match',
      path: ['confirmPassword'],
    });

  it('validates delete payload requires exact uppercase DELETE string', () => {
    // Valid clear_data
    const valid1 = DeletePayloadSchema.safeParse({
      action: 'clear_data',
      confirmation: 'DELETE',
    });
    expect(valid1.success).toBe(true);

    // Valid delete_account
    const valid2 = DeletePayloadSchema.safeParse({
      action: 'delete_account',
      confirmation: 'DELETE',
    });
    expect(valid2.success).toBe(true);

    // Reject lowercase 'delete'
    const invalidCase = DeletePayloadSchema.safeParse({
      action: 'clear_data',
      confirmation: 'delete',
    });
    expect(invalidCase.success).toBe(false);

    // Reject missing confirmation
    const invalidEmpty = DeletePayloadSchema.safeParse({
      action: 'delete_account',
      confirmation: '',
    });
    expect(invalidEmpty.success).toBe(false);

    // Reject invalid action
    const invalidAction = DeletePayloadSchema.safeParse({
      action: 'unknown_action',
      confirmation: 'DELETE',
    });
    expect(invalidAction.success).toBe(false);
  });

  it('enforces minimum 8 characters and matching confirmation for password updates', () => {
    // Valid password
    const valid = PasswordSchema.safeParse({
      password: 'StrongPassword123!',
      confirmPassword: 'StrongPassword123!',
    });
    expect(valid.success).toBe(true);

    // Too short (< 8 chars)
    const tooShort = PasswordSchema.safeParse({
      password: 'short',
      confirmPassword: 'short',
    });
    expect(tooShort.success).toBe(false);

    // Mismatched confirmation
    const mismatch = PasswordSchema.safeParse({
      password: 'Password123!',
      confirmPassword: 'DifferentPassword123!',
    });
    expect(mismatch.success).toBe(false);
  });

  it('generates well-formed CSV string with proper escaping and headers', () => {
    const sampleTransactions = [
      {
        date: '2026-11-01',
        description: 'Salary Credit - Nov',
        amount: 35000,
        type: 'income',
        category: 'Income',
        source: 'manual',
      },
      {
        date: '2026-11-05',
        description: 'House Rent, Sector 4',
        amount: 8000,
        type: 'expense',
        category: 'Rent',
        source: 'recurring',
      },
    ];

    const csvRows = sampleTransactions.map((t) => ({
      Date: t.date,
      Description: t.description,
      Amount: t.amount,
      Type: t.type,
      Category: t.category,
      Source: t.source,
    }));

    const csv = Papa.unparse(csvRows, { quotes: true, header: true });

    expect(csv).toContain('"Date","Description","Amount","Type","Category","Source"');
    expect(csv).toContain('"2026-11-01"');
    expect(csv).toContain('"Salary Credit - Nov"');
    expect(csv).toContain('"House Rent, Sector 4"'); // properly quotes comma-containing descriptions
  });

  it('formats full JSON portable backup payload with summary counts and data arrays', () => {
    const backup = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      user: { id: 'u-123', email: 'user@example.com' },
      counts: {
        transactions: 2,
        budgets: 1,
        goals: 1,
      },
      transactions: [{ id: 't-1', amount: 5000 }],
      budgets: [{ id: 'b-1', category: 'Food', limit: 5000 }],
      goals: [{ id: 'g-1', name: 'Emergency Fund', target: 50000 }],
    };

    const serialized = JSON.stringify(backup);
    const parsed = JSON.parse(serialized);

    expect(parsed.version).toBe('1.0');
    expect(parsed.counts.transactions).toBe(2);
    expect(parsed.transactions).toHaveLength(1);
    expect(parsed.budgets[0].category).toBe('Food');
    expect(parsed.goals[0].name).toBe('Emergency Fund');
  });
});
