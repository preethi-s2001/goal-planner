import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getSafeRedirectUrl } from '@/lib/auth/redirect';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  const isConfigured = Boolean(
    supabaseUrl &&
    supabaseAnonKey &&
    !supabaseUrl.includes('placeholder') &&
    supabaseAnonKey !== 'your-anon-key-here' &&
    supabaseAnonKey !== 'placeholder-anon-key'
  );

  const pathname = request.nextUrl.pathname;
  const isAuthPage = pathname === '/login' || pathname === '/signup' || pathname === '/forgot-password';
  const isProtectedRoute =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/transactions') ||
    pathname.startsWith('/analysis') ||
    pathname.startsWith('/budgets') ||
    pathname.startsWith('/goals') ||
    pathname.startsWith('/simulator') ||
    pathname.startsWith('/settings');

  const isDev = process.env.NODE_ENV === 'development';

  // Issue 3: In production with missing Supabase configuration, fail closed
  if (!isConfigured) {
    if (!isDev && isProtectedRoute) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set(
        'error',
        'Configuration error: Supabase environment variables are missing. Please configure your production environment variables.'
      );
      return NextResponse.redirect(url);
    }
    // Demo mode only permitted during local development
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    // Validate redirect target to prevent open redirect vulnerabilities
    const safeNext = getSafeRedirectUrl(pathname, '/dashboard');
    url.searchParams.set('redirectedFrom', safeNext);
    return NextResponse.redirect(url);
  }

  if (user && isAuthPage) {
    const rawRedirect = request.nextUrl.searchParams.get('redirectedFrom');
    const safeTarget = getSafeRedirectUrl(rawRedirect, '/dashboard');
    const url = request.nextUrl.clone();
    url.pathname = safeTarget;
    url.search = '';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
