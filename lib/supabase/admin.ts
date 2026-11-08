import { createClient } from '@supabase/supabase-js';

/**
 * Server-only Supabase client initialized with the SERVICE_ROLE_KEY.
 * Bypasses RLS to perform administrative actions such as complete user deletion.
 * NEVER expose this or import it in client-side code!
 */
export function createAdminClient() {
  if (typeof window !== 'undefined') {
    throw new Error('createAdminClient can only be called in server environments');
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (
    !supabaseUrl ||
    !serviceRoleKey ||
    serviceRoleKey === 'your-service-role-key-here' ||
    serviceRoleKey.includes('placeholder')
  ) {
    throw new Error(
      'Missing or invalid SUPABASE_SERVICE_ROLE_KEY. Account deletion requires a valid service role key configured in environment variables.'
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
