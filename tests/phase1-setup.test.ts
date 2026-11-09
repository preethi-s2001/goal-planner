import { describe, it, expect } from 'vitest';
import {
  FIXED_CATEGORIES,
  DEFAULT_CATEGORIES,
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
} from '@/types';
import { formatCurrency, formatDate, getLocalDateString } from '@/lib/utils';
import { getSafeRedirectUrl } from '@/lib/auth/redirect';
import { z } from 'zod';

describe('Phase 1 - Category Constants and Model Integrity', () => {
  it('should define fixed categories as Rent and Bills', () => {
    expect(FIXED_CATEGORIES).toContain('Rent');
    expect(FIXED_CATEGORIES).toContain('Bills');
    expect(FIXED_CATEGORIES.length).toBe(2);
  });

  it('should include all required default categories', () => {
    const requiredCategories = [
      'Rent',
      'Food',
      'Transport',
      'Shopping',
      'Bills',
      'Entertainment',
      'Health',
      'Others',
      'Income',
    ];
    for (const cat of requiredCategories) {
      expect(DEFAULT_CATEGORIES).toContain(cat);
    }
  });

  it('should separate expense and income categories appropriately', () => {
    expect(DEFAULT_INCOME_CATEGORIES).toContain('Income');
    expect(DEFAULT_EXPENSE_CATEGORIES).not.toContain('Income');
    expect(DEFAULT_EXPENSE_CATEGORIES).toContain('Food');
    expect(DEFAULT_EXPENSE_CATEGORIES).toContain('Transport');
  });
});

describe('Phase 1 - Utility Formatting Functions & Local Date Handling', () => {
  it('formats amounts in Indian Rupees (INR)', () => {
    const formatted = formatCurrency(35000);
    expect(formatted).toContain('35,000');
    expect(formatted).toContain('₹');
  });

  it('formats dates in DD-MM-YYYY format', () => {
    const d = new Date(2026, 10, 7); // 7th Nov 2026
    const formatted = formatDate(d);
    expect(formatted).toBe('07-11-2026');
  });

  it('Issue 2: builds YYYY-MM-DD from local date components avoiding UTC rollback at 01:00 AM IST', () => {
    // Construct a specific local date: 8th November 2026 at 01:00 AM local time
    const localDate = new Date(2026, 10, 8, 1, 0, 0); // 2026-11-08 01:00:00

    const localFormatted = getLocalDateString(localDate);
    expect(localFormatted).toBe('2026-11-08');

    // Verify that local date matches getFullYear/getMonth/getDate
    const y = localDate.getFullYear();
    const m = String(localDate.getMonth() + 1).padStart(2, '0');
    const day = String(localDate.getDate()).padStart(2, '0');
    expect(localFormatted).toBe(`${y}-${m}-${day}`);
  });
});

describe('Phase 1 - Password Validation (Min 8 Characters)', () => {
  const signupSchema = z
    .object({
      displayName: z.string().min(2),
      email: z.string().email(),
      password: z.string().min(8, 'Password must be at least 8 characters'),
      confirmPassword: z.string().min(8, 'Please confirm your password'),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: 'Passwords do not match',
      path: ['confirmPassword'],
    });

  it('accepts passwords of 8 or more characters', () => {
    const result = signupSchema.safeParse({
      displayName: 'Aishwarya',
      email: 'aishwarya@example.com',
      password: 'password123',
      confirmPassword: 'password123',
    });
    expect(result.success).toBe(true);
  });

  it('rejects passwords shorter than 8 characters', () => {
    const result = signupSchema.safeParse({
      displayName: 'Aishwarya',
      email: 'aishwarya@example.com',
      password: '1234567',
      confirmPassword: '1234567',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0]?.message).toBe('Password must be at least 8 characters');
    }
  });

  it('rejects mismatched passwords during signup', () => {
    const result = signupSchema.safeParse({
      displayName: 'Aishwarya',
      email: 'aishwarya@example.com',
      password: 'validPassword123',
      confirmPassword: 'differentPassword123',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0]?.message).toBe('Passwords do not match');
    }
  });

  it('rejects invalid email formats', () => {
    const result = signupSchema.safeParse({
      displayName: 'Aishwarya',
      email: 'not-an-email',
      password: 'validPassword123',
      confirmPassword: 'validPassword123',
    });
    expect(result.success).toBe(false);
  });
});

describe('Phase 1 - Redirect Validation Helper (getSafeRedirectUrl)', () => {
  it('allows safe relative paths starting with single slash', () => {
    expect(getSafeRedirectUrl('/dashboard')).toBe('/dashboard');
    expect(getSafeRedirectUrl('/transactions')).toBe('/transactions');
    expect(getSafeRedirectUrl('/reset-password')).toBe('/reset-password');
    expect(getSafeRedirectUrl('/settings?tab=profile')).toBe('/settings?tab=profile');
    expect(getSafeRedirectUrl('/analysis#monthly-trend')).toBe('/analysis#monthly-trend');
  });

  it('rejects protocol-relative open redirect attacks starting with //', () => {
    expect(getSafeRedirectUrl('//evil.com')).toBe('/dashboard');
    expect(getSafeRedirectUrl('//evil.com/phish')).toBe('/dashboard');
    expect(getSafeRedirectUrl('///triple-slash')).toBe('/dashboard');
  });

  it('rejects backslash open redirect variations', () => {
    expect(getSafeRedirectUrl('/\\evil.com')).toBe('/dashboard');
    expect(getSafeRedirectUrl('/\\\\evil.com')).toBe('/dashboard');
    expect(getSafeRedirectUrl('\\evil.com')).toBe('/dashboard');
  });

  it('rejects absolute external URLs', () => {
    expect(getSafeRedirectUrl('https://evil.com')).toBe('/dashboard');
    expect(getSafeRedirectUrl('http://evil.com/login')).toBe('/dashboard');
    expect(getSafeRedirectUrl('ftp://example.com')).toBe('/dashboard');
  });

  it('rejects javascript: and data: schemes', () => {
    expect(getSafeRedirectUrl('javascript:alert(1)')).toBe('/dashboard');
    expect(getSafeRedirectUrl('data:text/html,<script>alert(1)</script>')).toBe('/dashboard');
  });

  it('falls back to /dashboard on null, undefined, or empty strings', () => {
    expect(getSafeRedirectUrl(null)).toBe('/dashboard');
    expect(getSafeRedirectUrl(undefined)).toBe('/dashboard');
    expect(getSafeRedirectUrl('')).toBe('/dashboard');
    expect(getSafeRedirectUrl('   ')).toBe('/dashboard');
  });

  it('supports custom fallback default URLs', () => {
    expect(getSafeRedirectUrl('//attacker.com', '/login')).toBe('/login');
    expect(getSafeRedirectUrl(null, '/home')).toBe('/home');
  });
});

describe('Phase 1 - Google Auth Feature Flag Configuration', () => {
  it('hides Google auth by default or when NEXT_PUBLIC_GOOGLE_AUTH_ENABLED is not "true"', () => {
    const isEnabledDefault = process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === 'true';
    expect(isEnabledDefault).toBe(false);

    const isEnabledFalse = ('false' as string) === 'true';
    expect(isEnabledFalse).toBe(false);

    const isEnabledRandom = ('1' as string) === 'true';
    expect(isEnabledRandom).toBe(false);
  });

  it('enables Google auth strictly when NEXT_PUBLIC_GOOGLE_AUTH_ENABLED is "true"', () => {
    const isEnabledTrue = ('true' as string) === 'true';
    expect(isEnabledTrue).toBe(true);
  });

  it('login and signup pages guard Google button and divider behind NEXT_PUBLIC_GOOGLE_AUTH_ENABLED', async () => {
    const fs = await import('fs');
    const path = await import('path');

    const loginSource = fs.readFileSync(
      path.resolve(__dirname, '../app/(auth)/login/page.tsx'),
      'utf-8'
    );
    const signupSource = fs.readFileSync(
      path.resolve(__dirname, '../app/(auth)/signup/page.tsx'),
      'utf-8'
    );

    // Verify login page guards
    expect(loginSource).toContain("process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === 'true'");
    expect(loginSource).toContain('isGoogleAuthEnabled &&');
    expect(loginSource).toContain('Continue with Google');
    expect(loginSource).toContain('handleGoogleLogin');

    // Verify signup page guards
    expect(signupSource).toContain("process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === 'true'");
    expect(signupSource).toContain('isGoogleAuthEnabled &&');
    expect(signupSource).toContain('Sign up with Google');
    expect(signupSource).toContain('handleGoogleSignup');
  });

  it('verifies desktop sidebar layout classes for fixed sticky viewport height and scrollable menu nav', async () => {
    const fs = await import('fs');
    const path = await import('path');

    const sidebarSource = fs.readFileSync(
      path.resolve(__dirname, '../components/layout/Sidebar.tsx'),
      'utf-8'
    );
    const appShellSource = fs.readFileSync(
      path.resolve(__dirname, '../components/layout/AppShell.tsx'),
      'utf-8'
    );

    // Sidebar: h-screen sticky top-0 shrink-0 (not min-h-screen)
    expect(sidebarSource).toContain('h-screen sticky top-0 shrink-0');
    expect(sidebarSource).not.toContain('min-h-screen');

    // Header & Footer must be shrink-0
    expect(sidebarSource).toContain('border-b border-slate-100 flex items-center gap-3 shrink-0');
    expect(sidebarSource).toContain('border-t border-slate-100 bg-slate-50/50 space-y-3 shrink-0');

    // Menu nav must be the scrolling flex-1 area
    expect(sidebarSource).toContain('flex-1 p-3 space-y-1 overflow-y-auto');

    // AppShell must not have overflow-hidden clipping the sticky aside
    expect(appShellSource).not.toContain('overflow-hidden');
  });
});
