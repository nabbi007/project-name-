import React from 'react';
import { Badge } from '../shared/Badge';
import type { Listing } from '../../api/listings.api';
import { getListingImageUrl } from '../../api/listings.api';
import { VisionDescription } from './VisionDescription';
import { getListingStatusMeta } from '../../utils/listingDisplay';

interface ListingPreviewProps {
  listing: Listing;
  farmerDisplayName?: string;
}

const cropGradients: Record<string, string> = {
  maize: 'from-yellow-400 to-amber-500',
  cassava: 'from-amber-300 to-orange-400',
  tomatoes: 'from-red-400 to-rose-500',
  tomato: 'from-red-400 to-rose-500',
  plantain: 'from-green-400 to-emerald-500',
  yam: 'from-orange-400 to-amber-600',
  yams: 'from-orange-400 to-amber-600',
  rice: 'from-lime-300 to-green-400',
  default: 'from-primary-400 to-primary-600',
};

function getCropGradient(crop?: string): string {
  const key = crop?.toLowerCase() ?? '';
  return cropGradients[key] ?? cropGradients.default;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatPrice(price?: number): string {
  if (price == null) return '—';
  return `GH₵ ${price.toFixed(2)}`;
}

function PreviewField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-surface-500 mb-1">{label}</p>
      <p className="text-sm text-surface-900">{value}</p>
    </div>
  );
}

export const ListingPreview: React.FC<ListingPreviewProps> = ({
  listing,
  farmerDisplayName,
}) => {
  const imageUrl = getListingImageUrl(listing.imageUrl);
  const gradient = getCropGradient(listing.crop);
  const community = listing.community ?? '—';
  const name = farmerDisplayName ?? listing.farmerName ?? 'Farmer';
  const status = getListingStatusMeta(listing.status);

  return (
    <div className="card overflow-hidden w-full">
      <div className="relative h-52 sm:h-56 overflow-hidden bg-surface-100">
        {imageUrl ? (
          <img src={imageUrl} alt={listing.crop ?? 'Crop'} className="w-full h-full object-cover" />
        ) : (
          <div
            className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}
          >
            <span className="text-5xl">🌾</span>
          </div>
        )}
        <div className="absolute top-3 left-3 flex flex-wrap gap-2">
          <Badge color={status.color}>{status.label}</Badge>
          {listing.visionObservation?.status === 'COMPLETED' && (
            <Badge color="green">Vision reviewed</Badge>
          )}
        </div>
      </div>

      <div className="p-5 lg:p-6 space-y-5">
        <div>
          <h3 className="text-xl font-semibold text-surface-900 capitalize">
            {listing.crop ?? 'Untitled listing'}
          </h3>
          <p className="text-sm text-surface-500 mt-1">
            {name} · {community}
          </p>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-primary-700 tabular-nums">
            {formatPrice(listing.pricePerUnit)}
          </span>
          {listing.unit && <span className="text-sm text-surface-500">/ {listing.unit}</span>}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-1 border-t border-surface-200">
          <PreviewField
            label="Quantity"
            value={`${listing.quantity ?? '—'} ${listing.unit ?? ''}`.trim()}
          />
          <PreviewField label="Available from" value={formatDate(listing.availableDate)} />
          <PreviewField
            label="Expires"
            value={listing.expiryDate ? formatDate(listing.expiryDate) : '—'}
          />
        </div>

        {listing.description && (
          <div>
            <p className="field-label">Description</p>
            <div className="field-value items-start whitespace-pre-wrap leading-relaxed">
              {listing.description}
            </div>
          </div>
        )}

        {listing.visionObservation?.description && (
          <div>
            <p className="field-label">AI visual observation</p>
            <div className="field-value items-start">
              <p className="text-xs text-surface-500 mb-3">
                Human confirmation is required before publish.
              </p>
              <VisionDescription description={listing.visionObservation.description} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ListingPreview;
