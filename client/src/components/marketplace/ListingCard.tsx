import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '../shared/Badge';
import type { Listing } from '../../api/marketplace.api';

interface ListingCardProps {
  listing: Listing;
}

const cropGradients: Record<string, string> = {
  maize: 'from-yellow-400 to-amber-500',
  cassava: 'from-amber-300 to-orange-400',
  tomatoes: 'from-red-400 to-rose-500',
  plantain: 'from-green-400 to-emerald-500',
  yam: 'from-orange-400 to-amber-600',
  rice: 'from-lime-300 to-green-400',
  default: 'from-primary-400 to-primary-600',
};

const getCropGradient = (crop: string) => {
  const key = crop?.toLowerCase();
  return cropGradients[key] || cropGradients.default;
};

const getImageUrl = (listing: Listing): string | null => {
  if (listing.imageUrl) {
    if (listing.imageUrl.startsWith('http')) return listing.imageUrl;
    const base = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';
    return `${base}${listing.imageUrl}`;
  }
  return null;
};

const getFarmerCommunity = (listing: Listing): string => {
  if (typeof listing.farmer === 'object' && listing.farmer?.community) {
    return listing.farmer.community;
  }
  return listing.community || '';
};

export const ListingCard: React.FC<ListingCardProps> = ({ listing }) => {
  const navigate = useNavigate();
  const imageUrl = getImageUrl(listing);
  const gradient = getCropGradient(listing.crop);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  const formatPrice = (price: number) => {
    return `GH₵ ${price.toFixed(2)}`;
  };

  return (
    <div
      onClick={() => navigate(`/products/${listing._id}`)}
      className="card group cursor-pointer hover:shadow-md hover:border-primary-200 transition-all duration-300 overflow-hidden"
    >
      {/* Image */}
      <div className="relative h-44 overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={listing.crop}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
            <span className="text-4xl">🌾</span>
          </div>
        )}

        {/* AI-Verified badge */}
        {listing.visionObservation?.status === 'COMPLETED' && (
          <div className="absolute top-2 right-2">
            <Badge color="green">
              <span className="flex items-center gap-1">
                <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                AI-Verified
              </span>
            </Badge>
          </div>
        )}

        {/* Status overlay for non-published */}
        {listing.status === 'SOLD_OUT' && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="text-white font-bold text-lg">Sold Out</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-surface-900 group-hover:text-primary-700 transition-colors capitalize">
          {listing.crop}
        </h3>

        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-lg font-bold text-primary-700">{formatPrice(listing.pricePerUnit)}</span>
          <span className="text-xs text-surface-500">/ {listing.unit}</span>
        </div>

        <div className="mt-2 flex items-center gap-3 text-xs text-surface-500">
          <span className="flex items-center gap-1">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {getFarmerCommunity(listing)}
          </span>
          <span>•</span>
          <span>{listing.quantity} {listing.unit} available</span>
        </div>

        {listing.availableDate && (
          <div className="mt-2 text-xs text-surface-400">
            Available from {formatDate(listing.availableDate)}
          </div>
        )}
      </div>
    </div>
  );
};
