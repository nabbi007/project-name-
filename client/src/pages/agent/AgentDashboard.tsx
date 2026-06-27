import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { farmersApi } from '../../api/farmers.api';
import { listingsApi } from '../../api/listings.api';
import { AgentListingCard } from '../../components/listings/AgentListingCard';
import {
  Button,
  CardSkeleton,
  EmptyState,
  ErrorAlert,
} from '../../components/shared';

function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: number | string;
  hint?: string;
  accent?: 'green' | 'amber' | 'blue' | 'default';
}) {
  const accentClass = {
    green: 'border-green-200 bg-green-50/80',
    amber: 'border-amber-200 bg-amber-50/80',
    blue: 'border-blue-200 bg-blue-50/80',
    default: 'border-surface-200 bg-white',
  }[accent ?? 'default'];

  return (
    <div className={`card p-5 border ${accentClass}`}>
      <p className="text-sm font-medium text-surface-500">{label}</p>
      <p className="text-3xl font-bold text-surface-900 mt-1 tabular-nums">{value}</p>
      {hint && <p className="text-xs text-surface-500 mt-2">{hint}</p>}
    </div>
  );
}

const AgentDashboard: React.FC = () => {
  const navigate = useNavigate();

  const { data: farmersData, isLoading: farmersLoading } = useQuery({
    queryKey: ['farmers', 'count'],
    queryFn: () => farmersApi.listFarmers({ limit: 1 }),
  });

  const { data: listingsData, isLoading: listingsLoading, isError, refetch } = useQuery({
    queryKey: ['agent', 'listings', 'recent'],
    queryFn: () => listingsApi.listListings({ page: 1, limit: 12 }),
  });

  const { data: liveData } = useQuery({
    queryKey: ['agent', 'listings', 'live-count'],
    queryFn: () => listingsApi.listListings({ status: 'PUBLISHED', limit: 1 }),
  });

  const { data: draftData } = useQuery({
    queryKey: ['agent', 'listings', 'draft-count'],
    queryFn: () => listingsApi.listListings({ status: 'DRAFT', limit: 1 }),
  });

  const recentListings = listingsData?.listings ?? [];
  const totalListings = listingsData?.pagination.total ?? 0;
  const liveCount = liveData?.pagination.total ?? 0;
  const draftCount = draftData?.pagination.total ?? 0;
  const farmerCount = farmersData?.pagination.total ?? 0;

  const loading = listingsLoading || farmersLoading;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-surface-900">Dashboard</h1>
          <p className="text-surface-500 mt-1">Your farmers, listings, and recent activity.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => navigate('/agent/farmers/new')}>
            Register farmer
          </Button>
          <Button onClick={() => navigate('/agent/farmers')}>Start listing</Button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card p-5 h-28 animate-pulse bg-surface-100" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Farmers" value={farmerCount} hint="Registered on your account" accent="blue" />
          <StatCard label="All listings" value={totalListings} hint="Including drafts" />
          <StatCard label="Live on marketplace" value={liveCount} hint="Published & visible" accent="green" />
          <StatCard label="Drafts" value={draftCount} hint="Need photo or publish" accent="amber" />
        </div>
      )}

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-surface-900">Recent listings</h2>
            <p className="text-sm text-surface-500 mt-0.5">Latest voice-created listings, newest first</p>
          </div>
          <Link
            to="/agent/listings"
            className="text-sm font-medium text-primary-600 hover:text-primary-800 hover:underline shrink-0"
          >
            View all →
          </Link>
        </div>

        {isError && (
          <ErrorAlert>
            <p className="mb-3">Could not load recent listings.</p>
            <Button variant="secondary" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </ErrorAlert>
        )}

        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 3 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        )}

        {!loading && !isError && recentListings.length === 0 && (
          <EmptyState
            title="No listings yet"
            message="Create your first voice listing from a farmer profile."
            actionLabel="Go to farmers"
            onAction={() => navigate('/agent/farmers')}
          />
        )}

        {!loading && !isError && recentListings.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {recentListings.slice(0, 6).map((listing) => (
              <AgentListingCard key={listing._id} listing={listing} compact />
            ))}
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          to="/agent/farmers"
          className="card p-5 hover:border-primary-300 hover:shadow-md transition-all group"
        >
          <span className="text-2xl">👨‍🌾</span>
          <h3 className="font-semibold text-surface-900 mt-2 group-hover:text-primary-700">Farmers</h3>
          <p className="text-sm text-surface-500 mt-1">Register farmers and manage profiles.</p>
        </Link>
        <Link
          to="/agent/listings"
          className="card p-5 hover:border-primary-300 hover:shadow-md transition-all group"
        >
          <span className="text-2xl">📋</span>
          <h3 className="font-semibold text-surface-900 mt-2 group-hover:text-primary-700">Listings</h3>
          <p className="text-sm text-surface-500 mt-1">Review drafts and live marketplace items.</p>
        </Link>
        <Link
          to="/agent/orders"
          className="card p-5 hover:border-primary-300 hover:shadow-md transition-all group"
        >
          <span className="text-2xl">📦</span>
          <h3 className="font-semibold text-surface-900 mt-2 group-hover:text-primary-700">Orders</h3>
          <p className="text-sm text-surface-500 mt-1">Track buyer orders for your listings.</p>
        </Link>
      </section>
    </div>
  );
};

export default AgentDashboard;
