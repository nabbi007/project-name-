/** Server origin without /api — used for relative upload paths. */
export function serverOrigin(): string {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  return apiUrl.replace(/\/api\/?$/, '');
}

/** Cloudinary HTTPS URLs are returned as-is; local fallback paths get the origin prefix. */
export function resolveMediaUrl(path?: string | null): string | null {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${serverOrigin()}${normalized}`;
}
