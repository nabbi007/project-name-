import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { listingsApi } from '../../api/listings.api';
import { AgentListingCard } from '../../components/listings/AgentListingCard';
import {
  Button,
  CardSkeleton,
  EmptyState,
  ErrorAlert,
  Pagination,
  SearchInput,
} from '../../components/shared';

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'DRAFT', label: 'Drafts' },
  { value: 'PUBLISHED', label: 'Live' },
  { value: 'PENDING_REVIEW', label: 'Pending' },
  { value: 'SOLD_OUT', label: 'Sold out' },
  { value: 'EXPIRED', label: 'Expired' },
] as const;

const ListingsList: React.FC = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['agent', 'listings', search, status, page],
    queryFn: () =>
      listingsApi.listListings({
        search: search || undefined,
        status: status || undefined,
        page,
        limit: 12,
      }),
  });

  const listings = data?.listings ?? [];
  const pagination = data?.pagination;

  const statusLabel = useMemo(
    () => STATUS_FILTERS.find((f) => f.value === status)?.label ?? 'All',
    [status]
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-surface-900">My listings</h1>
          <p className="text-surface-500 mt-1 text-sm">
            Newest first — voice-created produce listings for your farmers.
          </p>
        </div>
        <Button size="lg" onClick={() => navigate('/agent/farmers')}>
          + New listing
        </Button>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1">
          <SearchInput
            onSearch={(q) => {
              setSearch(q);
              setPage(1);
            }}
            placeholder="Search crop, title, or description…"
          />
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {STATUS_FILTERS.map((filter) => {
          const active = status === filter.value;
          return (
            <button
              key={filter.value || 'all'}
              type="button"
              onClick={() => {
                setStatus(filter.value);
                setPage(1);
              }}
              className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                active
                  ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                  : 'bg-white text-surface-600 border-surface-200 hover:border-primary-300 hover:text-primary-700'
              }`}
            >
              {filter.label}
            </button>
          );
        })}
      </div>

      {isFetching && !isLoading && (
        <p className="text-xs text-surface-400 animate-pulse">Refreshing…</p>
      )}

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      )}

      {isError && (
        <ErrorAlert>
          <p className="mb-3">Could not load listings.</p>
          <Button variant="secondary" onClick={() => refetch()}>
            Retry
          </Button>
        </ErrorAlert>
      )}

      {!isLoading && !isError && listings.length === 0 && (
        <EmptyState
          title={search || status ? 'No listings match your filters' : 'No listings yet'}
          message={
            search || status
              ? 'Try a different search or clear the status filter.'
              : 'Register a farmer and start a voice listing to see it here.'
          }
          actionLabel={search || status ? undefined : 'Go to farmers'}
          onAction={search || status ? undefined : () => navigate('/agent/farmers')}
        />
      )}

      {!isLoading && !isError && listings.length > 0 && (
        <>
          <p className="text-sm text-surface-500">
            Showing {listings.length} of {pagination?.total ?? listings.length} · {statusLabel}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {listings.map((listing) => (
              <AgentListingCard key={listing._id} listing={listing} />
            ))}
          </div>
          {pagination && pagination.totalPages > 1 && (
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              onPageChange={setPage}
              className="mt-2"
            />
          )}
        </>
      )}

      {!isLoading && !isError && listings.length > 0 && (
        <div className="card p-4 bg-primary-50/60 border-primary-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-sm text-primary-900">
            Tip: draft listings can be continued from the farmer&apos;s profile.
          </p>
          <Link to="/agent/farmers" className="text-sm font-medium text-primary-700 hover:underline shrink-0">
            Browse farmers →
          </Link>
        </div>
      )}
    </div>
  );
};

export default ListingsList;
