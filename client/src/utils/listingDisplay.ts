import { getListingImageUrl, type Listing } from '../api/listings.api';

export type ListingStatusKey =
  | 'DRAFT'
  | 'PROCESSING'
  | 'PENDING_REVIEW'
  | 'PUBLISHED'
  | 'RESERVED'
  | 'SOLD_OUT'
  | 'EXPIRED'
  | 'REJECTED';

const STATUS_META: Record<
  string,
  { label: string; color: 'green' | 'yellow' | 'red' | 'blue' | 'gray' | 'purple' }
> = {
  DRAFT: { label: 'Draft', color: 'yellow' },
  PROCESSING: { label: 'Processing', color: 'blue' },
  PENDING_REVIEW: { label: 'Pending review', color: 'purple' },
  PUBLISHED: { label: 'Live', color: 'green' },
  RESERVED: { label: 'Reserved', color: 'blue' },
  SOLD_OUT: { label: 'Sold out', color: 'red' },
  EXPIRED: { label: 'Expired', color: 'gray' },
  REJECTED: { label: 'Rejected', color: 'red' },
};

export function getListingStatusMeta(status?: string) {
  return STATUS_META[status ?? ''] ?? { label: status ?? 'Unknown', color: 'gray' as const };
}

const CROP_GRADIENTS: Record<string, string> = {
  maize: 'from-yellow-400 to-amber-500',
  cassava: 'from-amber-300 to-orange-400',
  tomato: 'from-red-400 to-rose-500',
  tomatoes: 'from-red-400 to-rose-500',
  plantain: 'from-green-400 to-emerald-500',
  yam: 'from-orange-400 to-amber-600',
  yams: 'from-orange-400 to-amber-600',
  rice: 'from-lime-300 to-green-400',
};

export function getCropGradient(crop?: string): string {
  const key = crop?.toLowerCase().split(/\s+/)[0] ?? '';
  return CROP_GRADIENTS[key] ?? 'from-primary-400 to-primary-600';
}

export function formatListingPrice(price?: number): string {
  if (price == null || !Number.isFinite(price)) return '—';
  return `GH₵ ${price.toFixed(2)}`;
}

export function formatRelativeTime(iso?: string): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';

  const diffMs = Date.now() - then;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-GH', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function getListingThumbnail(listing: Listing): string | null {
  return getListingImageUrl(listing.imageUrl);
}
