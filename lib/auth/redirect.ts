/**
 * Validates a redirect target to prevent open redirect vulnerabilities.
 * Only accepts relative paths that start with '/' and not '//' or '/\'.
 * Otherwise falls back to defaultUrl (default: '/dashboard').
 */
export function getSafeRedirectUrl(
  target: string | null | undefined,
  defaultUrl: string = '/dashboard'
): string {
  if (!target || typeof target !== 'string') {
    return defaultUrl;
  }

  const trimmed = target.trim();

  // Must start with exactly one '/' and not '//' or '/\'
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.startsWith('/\\')) {
    return defaultUrl;
  }

  try {
    const parsed = new URL(trimmed, 'http://localhost');
    if (parsed.origin !== 'http://localhost') {
      return defaultUrl;
    }
    const resolved = parsed.pathname + parsed.search + parsed.hash;
    if (!resolved.startsWith('/') || resolved.startsWith('//') || resolved.startsWith('/\\')) {
      return defaultUrl;
    }
    return resolved;
  } catch {
    return defaultUrl;
  }
}
