// Units a produce listing may be sold in. Extracted/entered units must match
// one of these (case-insensitive).
export const SUPPORTED_UNITS = [
  'KG',
  'BAG',
  'SACK',
  'BASKET',
  'CRATE',
  'BOX',
  'BUNCH',
  'BUNDLE',
  'PIECE',
  'TUBER',
  'BOWL',
  'OLONKA',
] as const;

export type SupportedUnit = (typeof SUPPORTED_UNITS)[number];

export function normaliseUnit(value: unknown): SupportedUnit | null {
  if (typeof value !== 'string') return null;
  const upper = value.trim().toUpperCase();
  return (SUPPORTED_UNITS as readonly string[]).includes(upper)
    ? (upper as SupportedUnit)
    : null;
}
