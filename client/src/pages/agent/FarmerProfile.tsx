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

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="py-3 border-b border-surface-100 last:border-0">
      <dt className="text-sm text-surface-500">{label}</dt>
      <dd className="text-base font-medium text-surface-900 mt-0.5">{value || '—'}</dd>
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

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <Link to="/agent/farmers" className="text-sm text-primary-600 hover:underline">
          ← Back to farmers
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-2">
          <h1 className="text-2xl font-bold text-surface-900">{farmer.fullName}</h1>
          <Button
            size="lg"
            onClick={() => navigate(`/agent/farmers/${farmer._id}/create-listing`)}
          >
            Start Voice Listing
          </Button>
        </div>
      </div>

      <section className="card p-6">
        <h2 className="text-lg font-semibold mb-2">Farmer details</h2>
        <dl>
          <DetailRow label="Phone" value={farmer.phone} />
          <DetailRow label="Gender" value={farmer.gender} />
          <DetailRow
            label="Preferred language"
            value={
              LANGUAGE_LABELS[farmer.preferredLanguage ?? ''] ?? farmer.preferredLanguage
            }
          />
          <DetailRow label="Region" value={farmer.region} />
          <DetailRow label="District" value={farmer.district} />
          <DetailRow label="Community" value={farmer.community} />
          <DetailRow label="Notes" value={farmer.notes} />
          <DetailRow
            label="Consent given"
            value={farmer.consentGiven ? 'Yes' : 'No'}
          />
          <DetailRow
            label="Registered"
            value={new Date(farmer.createdAt).toLocaleDateString('en-GH')}
          />
        </dl>
        <Button
          variant="secondary"
          className="mt-4"
          onClick={() => navigate(`/agent/farmers/${farmer._id}/edit`)}
        >
          Edit farmer
        </Button>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Produce listings</h2>
          {farmerListings.length > 0 && (
            <Link to="/agent/listings" className="text-sm text-primary-600 hover:underline">
              All listings →
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
          <EmptyState title="No listings yet" message="Create a voice listing to get started." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {farmerListings.map((listing) => (
              <AgentListingCard key={listing._id} listing={listing} compact />
            ))}
          </div>
        )}
      </section>

      {farmerOrders.length > 0 || ordersLoading ? (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Orders</h2>
          {ordersLoading ? (
            <CardSkeleton />
          ) : (
            <div className="space-y-3">
              {farmerOrders.map((order) => {
                const crop = getOrderListingName(order);
                const imageUrl = getOrderListingImage(order);
                const gradient = getCropGradient(crop);
                const status = getOrderStatusMeta(order.status);
                return (
                  <div key={order._id} className="card p-4 flex gap-4 items-center">
                    <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 border border-surface-100">
                      {imageUrl ? (
                        <img src={imageUrl} alt={crop} className="w-full h-full object-cover" />
                      ) : (
                        <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center text-lg`}>
                          🌾
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-xs text-surface-500">{orderDisplayId(order)}</p>
                      <p className="font-medium capitalize truncate">{crop}</p>
                      <p className="text-xs text-surface-500">{formatOrderDate(order.createdAt)}</p>
                    </div>
                    <div className="text-right shrink-0 space-y-1">
                      <Badge color={status.color}>{status.label}</Badge>
                      <p className="text-sm font-semibold">{formatOrderPrice(order.totalPrice)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
};

export default FarmerProfile;
