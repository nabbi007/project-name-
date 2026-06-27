import React from 'react';
import { Link } from 'react-router-dom';
import type { Listing } from '../../api/listings.api';
import { Badge } from '../shared/Badge';
import {
  formatListingPrice,
  formatRelativeTime,
  getCropGradient,
  getListingStatusMeta,
  getListingThumbnail,
} from '../../utils/listingDisplay';

interface AgentListingCardProps {
  listing: Listing;
  compact?: boolean;
}

export const AgentListingCard: React.FC<AgentListingCardProps> = ({ listing, compact = false }) => {
  const imageUrl = getListingThumbnail(listing);
  const gradient = getCropGradient(listing.crop);
  const status = getListingStatusMeta(listing.status);
  const createdLabel = formatRelativeTime(listing.createdAt ?? listing.publishedAt);

  return (
    <article className="card group overflow-hidden hover:shadow-md hover:border-primary-200 transition-all duration-200 flex flex-col h-full">
      <div className={`relative overflow-hidden ${compact ? 'h-36' : 'h-44'}`}>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={listing.crop ?? 'Produce'}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div
            className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}
          >
            <span className="text-4xl opacity-90">🌾</span>
          </div>
        )}

        <div className="absolute top-2 left-2">
          <Badge color={status.color}>{status.label}</Badge>
        </div>

        {createdLabel && (
          <div className="absolute top-2 right-2">
            <span className="text-[11px] font-medium px-2 py-1 rounded-full bg-black/50 text-white backdrop-blur-sm">
              {createdLabel}
            </span>
          </div>
        )}

        {listing.status === 'SOLD_OUT' && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="text-white font-semibold">Sold out</span>
          </div>
        )}
      </div>

      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-semibold text-surface-900 capitalize line-clamp-1 group-hover:text-primary-700 transition-colors">
          {listing.crop ?? listing.description?.slice(0, 40) ?? 'Untitled listing'}
        </h3>

        {listing.farmerName && (
          <p className="text-sm text-surface-500 mt-0.5 truncate">{listing.farmerName}</p>
        )}

        <div className="mt-3 flex items-baseline gap-1.5">
          <span className="text-lg font-bold text-primary-700">
            {formatListingPrice(listing.pricePerUnit)}
          </span>
          {listing.unit && (
            <span className="text-xs text-surface-500">/ {listing.unit.toLowerCase()}</span>
          )}
        </div>

        <div className="mt-2 text-xs text-surface-500 space-y-1">
          {listing.quantity != null && listing.unit && (
            <p>
              {listing.quantity} {listing.unit.toLowerCase()} listed
            </p>
          )}
          {(listing.community || listing.region) && (
            <p className="truncate">{[listing.community, listing.region].filter(Boolean).join(', ')}</p>
          )}
        </div>

        <div className="mt-auto pt-4 flex flex-wrap gap-2">
          {listing.farmer && (
            <Link
              to={`/agent/farmers/${listing.farmer}`}
              className="text-sm font-medium text-primary-600 hover:text-primary-800 hover:underline"
            >
              View farmer
            </Link>
          )}
          {listing.status === 'DRAFT' && listing.farmer && (
            <>
              <span className="text-surface-300">·</span>
              <Link
                to={`/agent/farmers/${listing.farmer}/create-listing`}
                className="text-sm font-medium text-amber-700 hover:underline"
              >
                Continue draft
              </Link>
            </>
          )}
        </div>
      </div>
    </article>
  );
};

export default AgentListingCard;
