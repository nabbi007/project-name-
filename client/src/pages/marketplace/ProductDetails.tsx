import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { marketplaceApi, type Listing } from '../../api/marketplace.api';
import { useCartStore } from '../../store/cartStore';
import { useToast } from '../../components/shared/Toast';
import { Button } from '../../components/shared/Button';
import { Spinner } from '../../components/shared/Spinner';
import { VisionDescription } from '../../components/listings/VisionDescription';
import { MarketplaceNav } from '../../components/marketplace/MarketplaceNav';

const getImageUrl = (listing: Listing): string | null => {
  if (listing.imageUrl) {
    if (listing.imageUrl.startsWith('http')) return listing.imageUrl;
    const base = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';
    return `${base}${listing.imageUrl}`;
  }
  return null;
};

const cropGradients: Record<string, string> = {
  maize: 'from-amber-200 via-yellow-100 to-amber-50',
  cassava: 'from-orange-200 via-amber-50 to-cream-100',
  tomatoes: 'from-rose-200 via-red-50 to-cream-50',
  tomato: 'from-rose-200 via-red-50 to-cream-50',
  plantain: 'from-emerald-200 via-green-50 to-cream-50',
  default: 'from-primary-100 via-cream-50 to-white',
};

function formatLongDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function VerifiedBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-emerald-200/80 bg-white/90 text-emerald-800 shadow-sm backdrop-blur-sm ${
        compact ? 'px-2.5 py-1 text-xs font-medium' : 'px-3 py-1.5 text-sm font-medium'
      }`}
    >
      <svg className="h-3.5 w-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
        <path
          fillRule="evenodd"
          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
          clipRule="evenodd"
        />
      </svg>
      AI verified
    </span>
  );
}

function MetaChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-surface-200/80 bg-white/70 px-4 py-3 min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-wider text-surface-400">{label}</p>
      <p className="text-sm font-semibold text-surface-900 mt-0.5 truncate capitalize">{value}</p>
    </div>
  );
}

const ProductDetails: React.FC = () => {
  const { listingId } = useParams<{ listingId: string }>();
  const navigate = useNavigate();
  const { addItem } = useCartStore();
  const { addToast } = useToast();
  const [quantity, setQuantity] = useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['listing', listingId],
    queryFn: () => marketplaceApi.getListing(listingId!),
    enabled: !!listingId,
  });

  const listing = data?.data?.listing;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-cream-50 to-surface-50">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError || !listing) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-b from-cream-50 to-surface-50">
        <div className="text-center max-w-md">
          <p className="text-xs font-semibold uppercase tracking-widest text-surface-400 mb-3">404</p>
          <h1 className="text-2xl font-semibold text-surface-900 tracking-tight mb-2">Product not found</h1>
          <p className="text-surface-500 mb-6 leading-relaxed">
            This listing may no longer be available on the marketplace.
          </p>
          <Link to="/marketplace">
            <Button variant="primary">Browse marketplace</Button>
          </Link>
        </div>
      </div>
    );
  }

  const imageUrl = getImageUrl(listing);
  const gradient = cropGradients[listing.crop?.toLowerCase() ?? ''] || cropGradients.default;
  const isAvailable = listing.status === 'PUBLISHED' && listing.quantity > 0;
  const isVerified = listing.visionObservation?.status === 'COMPLETED';
  const totalPrice = (listing.pricePerUnit * quantity).toFixed(2);

  const farmerDisplay =
    typeof listing.farmer === 'object'
      ? listing.farmer.community
        ? `Farmer in ${listing.farmer.community}`
        : 'Verified local farmer'
      : listing.community
        ? `Farmer in ${listing.community}`
        : 'Verified local farmer';

  const farmerInitial =
    (typeof listing.farmer === 'object' ? listing.farmer.fullName : 'F')?.charAt(0)?.toUpperCase() ?? 'F';

  const farmerId = typeof listing.farmer === 'object' ? listing.farmer._id : listing.farmer;

  const handleAddToCart = () => {
    addItem({
      listingId: listing._id,
      quantity,
      priceSnapshot: listing.pricePerUnit,
      cropName: listing.crop,
      imageUrl: imageUrl ?? undefined,
      unit: listing.unit,
      community: listing.community,
      maxQuantity: listing.quantity,
    });
    addToast(`${quantity} ${listing.unit} of ${listing.crop} added to cart`, 'success');
  };

  const handleBuyNow = () => {
    handleAddToCart();
    navigate('/cart');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-cream-50 via-surface-50 to-white">
      <MarketplaceNav backLink={{ to: '/marketplace', label: '← Marketplace' }} />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-10 lg:gap-14 items-start">
          {/* Image */}
          <div className="relative animate-fade-in">
            <div className="absolute -inset-3 rounded-[1.75rem] bg-gradient-to-br from-primary-100/40 via-transparent to-cream-200/50 blur-2xl -z-10" />
            <div className="relative rounded-3xl overflow-hidden aspect-[4/3] ring-1 ring-black/[0.06] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.18)] bg-white">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={listing.crop}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div
                  className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}
                >
                  <span className="text-8xl opacity-80">🌾</span>
                </div>
              )}

              {isVerified && (
                <div className="absolute top-5 right-5">
                  <VerifiedBadge />
                </div>
              )}

              {!isAvailable && (
                <div className="absolute inset-0 bg-surface-900/55 backdrop-blur-[2px] flex items-center justify-center">
                  <span className="text-white text-xl font-semibold tracking-tight px-6 py-3 rounded-2xl bg-black/20 border border-white/20">
                    {listing.status === 'SOLD_OUT' ? 'Sold out' : 'No longer available'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Details */}
          <div className="space-y-8 lg:sticky lg:top-24 animate-slide-up">
            <header className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary-600/90">
                  Fresh produce
                </span>
                {isAvailable ? (
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-emerald-600/10">
                    Available now
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-800 ring-1 ring-red-600/10">
                    {listing.status === 'SOLD_OUT' ? 'Sold out' : 'Unavailable'}
                  </span>
                )}
              </div>

              <h1 className="text-4xl sm:text-[2.75rem] font-semibold text-surface-900 capitalize tracking-tight leading-tight">
                {listing.crop}
              </h1>

              <div className="flex items-end gap-3 pt-1">
                <span className="text-4xl font-semibold text-primary-700 tabular-nums tracking-tight">
                  GH₵ {listing.pricePerUnit.toFixed(2)}
                </span>
                <span className="text-sm text-surface-500 pb-1.5 font-medium">
                  per {listing.unit?.toLowerCase() ?? 'unit'}
                </span>
              </div>
            </header>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <MetaChip label="In stock" value={`${listing.quantity} ${listing.unit ?? ''}`.trim()} />
              {listing.community && <MetaChip label="Location" value={listing.community} />}
              {listing.availableDate && (
                <MetaChip label="Ready from" value={formatLongDate(listing.availableDate)} />
              )}
            </div>

            {/* Purchase */}
            <div className="rounded-2xl border border-surface-200/80 bg-white p-6 shadow-soft">
              {isAvailable ? (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-surface-600">Quantity</span>
                    <div className="inline-flex items-center rounded-full border border-surface-200 bg-surface-50 p-1">
                      <button
                        type="button"
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        className="w-9 h-9 rounded-full text-surface-600 hover:bg-white hover:text-surface-900 transition-colors disabled:opacity-40"
                        disabled={quantity <= 1}
                        aria-label="Decrease quantity"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={listing.quantity}
                        value={quantity}
                        onChange={(e) => {
                          const val = Math.max(
                            1,
                            Math.min(listing.quantity, Number(e.target.value) || 1)
                          );
                          setQuantity(val);
                        }}
                        className="w-12 text-center bg-transparent text-sm font-semibold text-surface-900 focus:outline-none tabular-nums"
                        aria-label="Quantity"
                      />
                      <button
                        type="button"
                        onClick={() => setQuantity(Math.min(listing.quantity, quantity + 1))}
                        className="w-9 h-9 rounded-full text-surface-600 hover:bg-white hover:text-surface-900 transition-colors disabled:opacity-40"
                        disabled={quantity >= listing.quantity}
                        aria-label="Increase quantity"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-primary-50 to-cream-50 px-4 py-3.5 border border-primary-100/80">
                    <span className="text-sm font-medium text-surface-700">Order total</span>
                    <span className="text-2xl font-semibold text-primary-800 tabular-nums tracking-tight">
                      GH₵ {totalPrice}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                      onClick={handleAddToCart}
                      variant="secondary"
                      className="w-full sm:flex-1 !rounded-xl !py-3.5 !text-base !font-semibold"
                      size="lg"
                    >
                      Add to cart
                    </Button>
                    <Button
                      onClick={handleBuyNow}
                      className="w-full sm:flex-1 !rounded-xl !py-3.5 !text-base !font-semibold shadow-sm hover:shadow-md transition-shadow"
                      size="lg"
                    >
                      Buy now
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-surface-600 leading-relaxed">
                  This produce is not available for order right now. Browse the marketplace for similar
                  listings.
                </p>
              )}
            </div>

            {/* Farmer */}
            <div className="rounded-2xl border border-surface-200/60 bg-cream-50/80 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-surface-400 mb-3">
                Grown by
              </p>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center ring-1 ring-primary-200/50">
                  <span className="text-primary-800 font-semibold text-lg">{farmerInitial}</span>
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-surface-900">{farmerDisplay}</p>
                  {listing.region && (
                    <p className="text-sm text-surface-500 mt-0.5">{listing.region}</p>
                  )}
                </div>
              </div>
              <Link
                to={`/farmers/${farmerId}`}
                className="inline-flex items-center gap-1 mt-4 text-sm font-medium text-primary-700 hover:text-primary-800 transition-colors"
              >
                More from this farmer
                <span aria-hidden>→</span>
              </Link>
            </div>

            {listing.description && (
              <section>
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-surface-400 mb-2">
                  About this produce
                </h2>
                <p className="text-sm text-surface-600 leading-relaxed">{listing.description}</p>
              </section>
            )}

            {listing.visionObservation?.description && (
              <section className="rounded-2xl border border-surface-200/80 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center text-primary-700">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-surface-900">Quality check</h2>
                    <p className="text-xs text-surface-500">AI visual observation · agent confirmed</p>
                  </div>
                </div>
                <VisionDescription description={listing.visionObservation.description} />
                {listing.visionObservation.flaggedIssues?.length > 0 && (
                  <div className="mt-4 space-y-1.5">
                    {listing.visionObservation.flaggedIssues.map((issue, i) => (
                      <p key={i} className="text-xs text-amber-800 bg-amber-50 rounded-lg px-3 py-2">
                        {issue}
                      </p>
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetails;
