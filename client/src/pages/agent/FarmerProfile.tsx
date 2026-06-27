import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { farmersApi } from '../../api/farmers.api';
import { listingsApi } from '../../api/listings.api';
import { ordersApi } from '../../api/orders.api';
import { AgentListingCard } from '../../components/listings/AgentListingCard';
import { Badge, Button, EmptyState, Spinner, CardSkeleton } from '../../components/shared';
import {
  formatOrderDate,
  formatOrderPrice,
  getOrderListingImage,
  getOrderListingName,
  getOrderStatusMeta,
  orderDisplayId,
} from '../../utils/orderDisplay';
import { getCropGradient } from '../../utils/listingDisplay';

const LANGUAGE_LABELS: Record<string, string> = {
  en: 'English',
  tw: 'Twi',
  ga: 'Ga',
  ee: 'Ewe',
};

function farmerInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function formatLocation(farmer: {
  community?: string | null;
  district?: string | null;
  region?: string | null;
}): string {
  return [farmer.community, farmer.district, farmer.region].filter(Boolean).join(', ') || 'Location not set';
}

function DetailField({ label, value }: { label: string; value?: string | null }) {
  const display = value?.trim();
  return (
    <div>
      <p className="field-label">{label}</p>
      <div className={`field-value ${display ? '' : 'field-value-empty'}`}>
        {display || '—'}
      </div>
    </div>
  );
}

const FarmerProfile: React.FC = () => {
  const { farmerId } = useParams<{ farmerId: string }>();
  const navigate = useNavigate();

  const { data: farmer, isLoading, isError } = useQuery({
    queryKey: ['farmer', farmerId],
    queryFn: () => farmersApi.getFarmer(farmerId!),
    enabled: Boolean(farmerId),
  });

  const { data: listingsData, isLoading: listingsLoading } = useQuery({
    queryKey: ['agent', 'listings', 'farmer', farmerId],
    queryFn: () => listingsApi.listListings({ limit: 50 }),
    enabled: Boolean(farmerId),
  });

  const farmerListings = (listingsData?.listings ?? [])
    .filter((l) => l.farmer === farmerId)
    .slice(0, 6);

  const liveListings = farmerListings.filter((l) => l.status === 'PUBLISHED').length;

  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ['agent', 'orders', 'farmer', farmerId],
    queryFn: () => ordersApi.getManagedOrders({ limit: 50 }),
    enabled: Boolean(farmerId),
  });

  const farmerOrders = (ordersData?.orders ?? []).filter(
    (o) => typeof o.farmer === 'object' && o.farmer._id === farmerId
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError || !farmer) {
    return (
      <EmptyState
        title="Farmer not found"
        actionLabel="Back to farmers"
        onAction={() => navigate('/agent/farmers')}
      />
    );
  }

  const registeredDate = new Date(farmer.createdAt).toLocaleDateString('en-GH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <Link
          to="/agent/farmers"
          className="text-xs text-surface-500 hover:text-surface-900 transition-colors"
        >
          ← Back to farmers
        </Link>

        <div className="mt-4 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
          <div className="flex items-start gap-4 min-w-0">
            <div className="w-14 h-14 rounded-xl bg-primary-600 text-white flex items-center justify-center text-lg font-semibold shrink-0">
              {farmerInitials(farmer.fullName)}
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold text-surface-900 tracking-tight truncate">
                {farmer.fullName}
              </h1>
              <p className="text-sm text-surface-500 mt-1">{formatLocation(farmer)}</p>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {farmer.phone && (
                  <span className="text-xs text-surface-600 bg-surface-100 px-2.5 py-1 rounded-full">
                    {farmer.phone}
                  </span>
                )}
                <Badge color={farmer.consentGiven ? 'green' : 'yellow'}>
                  {farmer.consentGiven ? 'Consent on file' : 'Consent pending'}
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 shrink-0">
            <Button
              onClick={() => navigate(`/agent/farmers/${farmer._id}/create-listing`)}
            >
              Start voice listing
            </Button>
            <Button
              variant="secondary"
              onClick={() => navigate(`/agent/farmers/${farmer._id}/edit`)}
            >
              Edit farmer
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: 'Listings', value: farmerListings.length },
          { label: 'Live', value: liveListings },
          { label: 'Orders', value: farmerOrders.length },
        ].map((k) => (
          <div key={k.label} className="card px-4 py-4">
            <p className="text-xs text-surface-500">{k.label}</p>
            <p className="text-2xl font-semibold text-surface-900 mt-1 tabular-nums">{k.value}</p>
          </div>
        ))}
      </div>

      <section className="card p-5 lg:p-6 space-y-5">
        <div>
          <h2 className="text-sm font-semibold text-surface-900">Farmer details</h2>
          <p className="text-xs text-surface-500 mt-1">Contact, location, and registration info.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <DetailField label="Phone" value={farmer.phone} />
          <DetailField label="Gender" value={farmer.gender} />
          <DetailField
            label="Preferred language"
            value={LANGUAGE_LABELS[farmer.preferredLanguage ?? ''] ?? farmer.preferredLanguage}
          />
          <DetailField label="Region" value={farmer.region} />
          <DetailField label="District" value={farmer.district} />
          <DetailField label="Community" value={farmer.community} />
          <DetailField label="Registered" value={registeredDate} />
          <DetailField label="Consent given" value={farmer.consentGiven ? 'Yes' : 'No'} />
        </div>

        {farmer.notes?.trim() && (
          <DetailField label="Notes" value={farmer.notes} />
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-surface-900">Produce listings</h2>
            <p className="text-xs text-surface-500 mt-0.5">Voice-created listings for this farmer.</p>
          </div>
          {farmerListings.length > 0 && (
            <Link
              to="/agent/listings"
              className="text-xs text-surface-500 hover:text-surface-900 transition-colors"
            >
              View all →
            </Link>
          )}
        </div>

        {listingsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : farmerListings.length === 0 ? (
          <div className="card p-8">
            <EmptyState
              title="No listings yet"
              message="Start a voice listing to publish this farmer's produce."
              actionLabel="Start voice listing"
              onAction={() => navigate(`/agent/farmers/${farmer._id}/create-listing`)}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {farmerListings.map((listing) => (
              <AgentListingCard key={listing._id} listing={listing} compact />
            ))}
          </div>
        )}
      </section>

      {(farmerOrders.length > 0 || ordersLoading) && (
        <section className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-surface-900">Orders</h2>
            <p className="text-xs text-surface-500 mt-0.5">Buyer orders linked to this farmer.</p>
          </div>

          {ordersLoading ? (
            <CardSkeleton />
          ) : (
            <div className="card overflow-hidden divide-y divide-surface-200">
              {farmerOrders.map((order) => {
                const crop = getOrderListingName(order);
                const imageUrl = getOrderListingImage(order);
                const gradient = getCropGradient(crop);
                const status = getOrderStatusMeta(order.status);
                return (
                  <div key={order._id} className="p-4 flex gap-4 items-center hover:bg-surface-50 transition-colors">
                    <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 border border-surface-200">
                      {imageUrl ? (
                        <img src={imageUrl} alt={crop} className="w-full h-full object-cover" />
                      ) : (
                        <div
                          className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center text-base`}
                        >
                          🌾
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-xs text-surface-500">{orderDisplayId(order)}</p>
                      <p className="font-medium capitalize truncate text-surface-900">{crop}</p>
                      <p className="text-xs text-surface-500">{formatOrderDate(order.createdAt)}</p>
                    </div>
                    <div className="text-right shrink-0 space-y-1">
                      <Badge color={status.color}>{status.label}</Badge>
                      <p className="text-sm font-semibold tabular-nums">{formatOrderPrice(order.totalPrice)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
};

export default FarmerProfile;
