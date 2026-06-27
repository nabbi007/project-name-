import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { marketplaceApi } from '../../api/marketplace.api';
import { ListingCard } from '../../components/marketplace/ListingCard';
import { Button } from '../../components/shared/Button';
import { Spinner } from '../../components/shared/Spinner';
import { EmptyState } from '../../components/shared/EmptyState';

const PublicFarmerProfile: React.FC = () => {
  const { farmerId } = useParams<{ farmerId: string }>();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['public-farmer', farmerId],
    queryFn: () => marketplaceApi.getFarmerProfile(farmerId!),
    enabled: !!farmerId,
  });

  const farmer = data?.data?.farmer;
  const farmerListings = data?.data?.listings ?? [];

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError || !farmer) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <EmptyState
          title="Farmer not found"
          message="This farmer profile is not available."
          actionLabel="Browse Marketplace"
          onAction={() => { window.location.href = '/marketplace'; }}
        />
      </div>
    );
  }

  // Derive display name — NO phone, NO exact location
  const displayName = farmer?.fullName
    ? `Farmer ${farmer.fullName.split(' ')[0]}`
    : `Farmer in ${farmer?.community || 'Ghana'}`;

  return (
    <div className="min-h-screen bg-surface-50">
      {/* Nav */}
      <nav className="bg-white border-b border-surface-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center">
                <span className="text-white text-sm font-bold">A</span>
              </div>
              <span className="text-lg font-bold text-surface-900">AgroVoice</span>
            </Link>
            <Link to="/marketplace">
              <Button variant="ghost" size="sm">← Back to Marketplace</Button>
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ─── Farmer Header ────────────────────────────── */}
        <div className="card p-6 md:p-8 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
              <span className="text-2xl text-primary-700 font-bold">
                {(farmer?.fullName || 'F')[0].toUpperCase()}
              </span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-surface-900">{displayName}</h1>
              <div className="flex items-center gap-3 mt-1 text-sm text-surface-500">
                {farmer?.community && (
                  <span className="flex items-center gap-1">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {farmer.community}
                  </span>
                )}
                {farmer?.region && (
                  <>
                    <span>•</span>
                    <span>{farmer.region}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          {/* Privacy notice — explicitly NO phone number rendered */}
        </div>

        {/* ─── Farmer's Listings ─────────────────────────── */}
        <div>
          <h2 className="text-xl font-bold text-surface-900 mb-4">
            Available Produce ({farmerListings.length})
          </h2>

          {farmerListings.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {farmerListings.map((listing) => (
                <ListingCard key={listing._id} listing={listing} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No listings available"
              message="This farmer doesn't have any published produce at the moment."
              actionLabel="Browse Marketplace"
              onAction={() => window.location.href = '/marketplace'}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default PublicFarmerProfile;
