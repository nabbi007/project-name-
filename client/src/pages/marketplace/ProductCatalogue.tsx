import React, { useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { marketplaceApi, type ListingFilters } from '../../api/marketplace.api';
import { ListingCard } from '../../components/marketplace/ListingCard';
import { SearchInput } from '../../components/shared/SearchInput';
import { Button } from '../../components/shared/Button';
import { Input } from '../../components/shared/Input';
import { Select } from '../../components/shared/Select';
import { Pagination } from '../../components/shared/Pagination';
import { CardSkeleton } from '../../components/shared/Skeleton';
import { EmptyState } from '../../components/shared/EmptyState';
import { ErrorAlert } from '../../components/shared/Alerts';
import { Drawer } from '../../components/shared/Drawer';
import { useAuthStore } from '../../store/authStore';
import { useCartStore } from '../../store/cartStore';

const regions = [
  { value: '', label: 'All Regions' },
  { value: 'Greater Accra', label: 'Greater Accra' },
  { value: 'Ashanti', label: 'Ashanti' },
  { value: 'Eastern', label: 'Eastern' },
  { value: 'Western', label: 'Western' },
  { value: 'Central', label: 'Central' },
  { value: 'Northern', label: 'Northern' },
  { value: 'Volta', label: 'Volta' },
  { value: 'Bono', label: 'Bono' },
  { value: 'Upper East', label: 'Upper East' },
  { value: 'Upper West', label: 'Upper West' },
];

const ProductCatalogue: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated } = useAuthStore();
  const { items } = useCartStore();
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  // Read filters from URL
  const filters: ListingFilters = {
    crop: searchParams.get('crop') || undefined,
    region: searchParams.get('region') || undefined,
    community: searchParams.get('community') || undefined,
    minPrice: searchParams.get('minPrice') ? Number(searchParams.get('minPrice')) : undefined,
    maxPrice: searchParams.get('maxPrice') ? Number(searchParams.get('maxPrice')) : undefined,
    page: searchParams.get('page') ? Number(searchParams.get('page')) : 1,
  };

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['listings', 'catalogue', filters],
    queryFn: () => marketplaceApi.listPublishedListings(filters),
  });

  const listings = data?.data?.listings || [];
  const total = data?.data?.total || 0;
  const currentPage = data?.data?.page || 1;
  const totalPages = Math.ceil(total / 20);

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const newParams = new URLSearchParams(searchParams);
      if (value) {
        newParams.set(key, value);
      } else {
        newParams.delete(key);
      }
      newParams.delete('page'); // Reset page on filter change
      setSearchParams(newParams);
    },
    [searchParams, setSearchParams]
  );

  const handlePageChange = (page: number) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('page', String(page));
    setSearchParams(newParams);
  };

  const clearFilters = () => {
    setSearchParams({});
  };

  const hasActiveFilters = filters.crop || filters.region || filters.community || filters.minPrice || filters.maxPrice;

  // Filter sidebar content (shared between desktop sidebar and mobile drawer)
  const FilterContent = () => (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-surface-700 mb-2">Region</h3>
        <Select
          options={regions}
          value={filters.region || ''}
          onChange={(e) => updateFilter('region', e.target.value)}
        />
      </div>

      <div>
        <h3 className="text-sm font-semibold text-surface-700 mb-2">Community</h3>
        <Input
          placeholder="e.g. Kumasi"
          value={filters.community || ''}
          onChange={(e) => updateFilter('community', e.target.value)}
        />
      </div>

      <div>
        <h3 className="text-sm font-semibold text-surface-700 mb-2">Price Range (GH₵)</h3>
        <div className="flex gap-2">
          <Input
            type="number"
            placeholder="Min"
            value={filters.minPrice ?? ''}
            onChange={(e) => updateFilter('minPrice', e.target.value)}
          />
          <Input
            type="number"
            placeholder="Max"
            value={filters.maxPrice ?? ''}
            onChange={(e) => updateFilter('maxPrice', e.target.value)}
          />
        </div>
      </div>

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters} className="w-full">
          Clear All Filters
        </Button>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-surface-50">
      {/* ─── Navigation ──────────────────────────────────── */}
      <nav className="bg-white border-b border-surface-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center">
                <span className="text-white text-sm font-bold">A</span>
              </div>
              <span className="text-lg font-bold text-surface-900">AgroVoice</span>
            </Link>
            <div className="flex items-center gap-3">
              <Link to="/cart" className="relative p-2 text-surface-600 hover:text-primary-600 transition-colors mr-2">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                {items.length > 0 && (
                  <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/4 -translate-y-1/4 bg-red-600 rounded-full">
                    {items.length}
                  </span>
                )}
              </Link>
              {isAuthenticated() ? (
                <Link to="/buyer/orders">
                  <Button variant="secondary" size="sm">My Orders</Button>
                </Link>
              ) : (
                <>
                  <Link to="/login">
                    <Button variant="ghost" size="sm">Sign In</Button>
                  </Link>
                  <Link to="/register">
                    <Button variant="primary" size="sm">Register</Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ─── Header + Search ────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-surface-900">Marketplace</h1>
            <p className="text-sm text-surface-500">{total} produce listings available</p>
          </div>
          <div className="flex gap-3 items-center">
            <SearchInput
              value={filters.crop || ''}
              onSearch={(q) => updateFilter('crop', q)}
              placeholder="Search crops..."
              className="w-full sm:w-64"
            />
            {/* Mobile filter toggle */}
            <button
              onClick={() => setMobileFilterOpen(true)}
              className="lg:hidden btn-base btn-secondary !px-3"
              aria-label="Open filters"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex gap-8">
          {/* ─── Desktop Filter Sidebar ───────────────────── */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <div className="card p-5 sticky top-24">
              <h2 className="font-semibold text-surface-900 mb-4">Filters</h2>
              <FilterContent />
            </div>
          </aside>

          {/* ─── Mobile Filter Drawer ────────────────────── */}
          <Drawer isOpen={mobileFilterOpen} onClose={() => setMobileFilterOpen(false)} title="Filters" side="left">
            <FilterContent />
          </Drawer>

          {/* ─── Listings Grid ───────────────────────────── */}
          <main className="flex-1 min-w-0">
            {isError && (
              <ErrorAlert className="mb-6">
                Failed to load listings.
                <button onClick={() => refetch()} className="underline ml-1 font-medium">Try again</button>
              </ErrorAlert>
            )}

            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {Array.from({ length: 9 }).map((_, i) => <CardSkeleton key={i} />)}
              </div>
            ) : listings.length > 0 ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                  {listings.map((listing) => (
                    <ListingCard key={listing._id} listing={listing} />
                  ))}
                </div>
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={handlePageChange}
                  className="mt-8"
                />
              </>
            ) : (
              <EmptyState
                title="No produce matches your filters"
                message="Try adjusting your search or clearing filters to see more listings."
                actionLabel="Clear Filters"
                onAction={clearFilters}
              />
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

export default ProductCatalogue;
