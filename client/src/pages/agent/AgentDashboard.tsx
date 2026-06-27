import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { farmersApi } from '../../api/farmers.api';
import { listingsApi } from '../../api/listings.api';
import { ordersApi } from '../../api/orders.api';
import { AgentDashboardCharts } from '../../components/dashboard/AgentDashboardCharts';
import { Button, Badge, EmptyState, ErrorAlert } from '../../components/shared';
import { getListingStatusMeta, formatListingPrice } from '../../utils/listingDisplay';

const AgentDashboard: React.FC = () => {
  const navigate = useNavigate();

  const { data: farmersData, isLoading: farmersLoading } = useQuery({
    queryKey: ['farmers', 'count'],
    queryFn: () => farmersApi.listFarmers({ limit: 1 }),
  });

  const { data: listingsData, isLoading: listingsLoading, isError, refetch } = useQuery({
    queryKey: ['agent', 'listings', 'recent-live'],
    queryFn: () => listingsApi.listListings({ status: 'PUBLISHED', page: 1, limit: 50 }),
  });

  const { data: pendingOrdersData } = useQuery({
    queryKey: ['agent', 'orders', 'pending-count'],
    queryFn: () => ordersApi.getManagedOrders({ status: 'PENDING', limit: 1 }),
  });

  const recentLive = useMemo(
    () => (listingsData?.listings ?? []).slice(0, 8),
    [listingsData?.listings]
  );

  const liveCount = listingsData?.pagination.total ?? 0;
  const farmerCount = farmersData?.pagination.total ?? 0;
  const pendingOrders = pendingOrdersData?.pagination.total ?? 0;
  const loading = listingsLoading || farmersLoading;

  const kpis = [
    { label: 'Farmers', value: farmerCount },
    { label: 'Live listings', value: liveCount },
    { label: 'Pending orders', value: pendingOrders },
  ];

  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-surface-900 tracking-tight">Overview</h1>
        <p className="text-sm text-surface-500 mt-2 max-w-2xl leading-relaxed">
          Key totals for your farmers and live listings on the marketplace.
        </p>
      </div>

      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {kpis.map((k) => (
            <div key={k.label} className="card px-4 py-4">
              <p className="text-xs text-surface-500">{k.label}</p>
              <p className="text-2xl font-semibold text-surface-900 mt-1 tabular-nums">{k.value}</p>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card h-56 animate-pulse bg-surface-100" />
          <div className="card h-56 animate-pulse bg-surface-100" />
        </div>
      ) : (
        <AgentDashboardCharts
          farmerCount={farmerCount}
          liveCount={liveCount}
          pendingOrders={pendingOrders}
        />
      )}

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-surface-900">Recent live listings</h2>
          <Link to="/agent/listings" className="text-xs text-surface-500 hover:text-surface-900 transition-colors">
            View all →
          </Link>
        </div>

        {isError && (
          <ErrorAlert>
            <p className="mb-3">Could not load listings.</p>
            <Button variant="secondary" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </ErrorAlert>
        )}

        {!loading && !isError && recentLive.length === 0 && (
          <div className="card p-8">
            <EmptyState
              title="No live listings yet"
              message="Publish a listing to see it here. Drafts stay on the full listings page."
              actionLabel="View listings"
              onAction={() => navigate('/agent/listings')}
            />
          </div>
        )}

        {!loading && !isError && recentLive.length > 0 && (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 text-left text-xs text-surface-500">
                  <th className="px-4 py-3 font-medium">Crop</th>
                  <th className="px-4 py-3 font-medium hidden sm:table-cell">Farmer</th>
                  <th className="px-4 py-3 font-medium">Price</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-200">
                {recentLive.map((listing) => {
                  const status = getListingStatusMeta(listing.status);
                  return (
                    <tr key={listing._id} className="hover:bg-surface-50 transition-colors">
                      <td className="px-4 py-3 text-surface-900 capitalize">{listing.crop ?? '—'}</td>
                      <td className="px-4 py-3 text-surface-600 hidden sm:table-cell truncate max-w-[140px]">
                        {listing.farmerName ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-surface-700 tabular-nums">
                        {formatListingPrice(listing.pricePerUnit)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge color={status.color}>{status.label}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="flex flex-wrap gap-3 pt-2">
        <Button size="sm" onClick={() => navigate('/agent/farmers/new')}>
          Register farmer
        </Button>
        <Button size="sm" variant="secondary" onClick={() => navigate('/agent/farmers')}>
          Start listing
        </Button>
      </div>
    </div>
  );
};

export default AgentDashboard;
