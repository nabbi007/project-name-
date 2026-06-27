import crypto from 'crypto';

export function slugify(input: string): string {
  return input
    .toString()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

// Slug with a short random suffix to guarantee uniqueness.
export function uniqueSlug(input: string): string {
  const base = slugify(input) || 'listing';
  return `${base}-${crypto.randomBytes(3).toString('hex')}`;
}
