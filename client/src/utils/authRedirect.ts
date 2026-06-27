const ALLOWED_REDIRECT_PREFIXES = ['/cart', '/checkout', '/marketplace', '/products', '/buyer'];

export function sanitizeRedirect(path: string | null | undefined): string | null {
  if (!path || !path.startsWith('/') || path.startsWith('//')) return null;
  const allowed = ALLOWED_REDIRECT_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}?`)
  );
  return allowed ? path : null;
}

export function redirectAfterAuth(role: string, redirectParam: string | null): string {
  const safe = sanitizeRedirect(redirectParam);
  if (safe && role === 'BUYER') return safe;

  switch (role) {
    case 'ADMIN':
      return '/admin/dashboard';
    case 'FIELD_AGENT':
      return '/agent/dashboard';
    case 'BUYER':
      return '/marketplace';
    default:
      return '/';
  }
}
