import { ReactNode } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const configured = isSupabaseConfigured();
  const isDev = process.env.NODE_ENV === 'development';

  // Issue 3: Fail closed. In production with missing env vars, redirect to /login with clear config error
  if (!configured && !isDev) {
    redirect(
      '/login?error=' +
        encodeURIComponent(
          'Configuration error: Supabase environment variables are missing. Please configure your production environment variables.'
        )
    );
  }

  let userEmail: string | null = null;
  let displayName: string | null = null;
  let shouldRedirectToLogin = false;

  if (configured) {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        shouldRedirectToLogin = true;
      } else {
        userEmail = user.email || null;
        displayName =
          user.user_metadata?.display_name ||
          user.user_metadata?.full_name ||
          (user.email ? user.email.split('@')[0] : null);
      }
    } catch {
      shouldRedirectToLogin = true;
    }

    // Issue 2: redirect() moved OUTSIDE the try/catch block so Next.js NEXT_REDIRECT is not swallowed
    if (shouldRedirectToLogin) {
      redirect('/login');
    }
  } else {
    // Demo shell mode is ONLY permitted in development
    userEmail = 'demo@example.com';
    displayName = 'First Salary Explorer';
  }

  return (
    <AppShell
      userEmail={userEmail}
      displayName={displayName}
      isConfigured={configured}
    >
      {children}
    </AppShell>
  );
}
