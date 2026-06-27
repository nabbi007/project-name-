import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { marketplaceApi, type Listing } from '../../api/marketplace.api';
import { useCartStore } from '../../store/cartStore';
import { useToast } from '../../components/shared/Toast';
import { Button } from '../../components/shared/Button';
import { Badge } from '../../components/shared/Badge';
import { Card } from '../../components/shared/Card';
import { Spinner } from '../../components/shared/Spinner';

const getImageUrl = (listing: Listing): string | null => {
  if (listing.imageUrl) {
    if (listing.imageUrl.startsWith('http')) return listing.imageUrl;
    const base = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';
    return `${base}${listing.imageUrl}`;
  }
  return null;
};

const cropGradients: Record<string, string> = {
  maize: 'from-yellow-400 to-amber-500',
  cassava: 'from-amber-300 to-orange-400',
  tomatoes: 'from-red-400 to-rose-500',
  plantain: 'from-green-400 to-emerald-500',
  default: 'from-primary-400 to-primary-600',
};

const ProductDetails: React.FC = () => {
  const { listingId } = useParams<{ listingId: string }>();
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
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError || !listing) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-surface-900 mb-2">Product Not Found</h1>
          <p className="text-surface-500 mb-4">This listing may no longer be available.</p>
          <Link to="/marketplace">
            <Button variant="primary">Browse Marketplace</Button>
          </Link>
        </div>
      </div>
    );
  }

  const imageUrl = getImageUrl(listing);
  const gradient = cropGradients[listing.crop?.toLowerCase()] || cropGradients.default;
  const isAvailable = listing.status === 'PUBLISHED' && listing.quantity > 0;
  const totalPrice = (listing.pricePerUnit * quantity).toFixed(2);

  const farmerDisplay = typeof listing.farmer === 'object'
    ? `Farmer in ${listing.farmer.community}`
    : `Farmer in ${listing.community}`;

  const farmerId = typeof listing.farmer === 'object' ? listing.farmer._id : listing.farmer;

  const handleAddToCart = () => {
    addItem({
      listingId: listing._id,
      quantity,
      priceSnapshot: listing.pricePerUnit,
      cropName: listing.crop,
      imageUrl: listing.imageUrl,
      unit: listing.unit,
      community: listing.community,
      maxQuantity: listing.quantity,
    });
    addToast(`${quantity} ${listing.unit} of ${listing.crop} added to cart`, 'success');
  };

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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* ─── Image ──────────────────────────────────── */}
          <div className="relative rounded-2xl overflow-hidden aspect-[4/3] shadow-soft">
            {imageUrl ? (
              <img src={imageUrl} alt={listing.crop} className="w-full h-full object-cover" />
            ) : (
              <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
                <span className="text-8xl">🌾</span>
              </div>
            )}

            {listing.visionObservation?.status === 'COMPLETED' && (
              <div className="absolute top-4 right-4">
                <Badge color="green">
                  <span className="flex items-center gap-1 text-sm">
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    AI-Verified
                  </span>
                </Badge>
              </div>
            )}

            {!isAvailable && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <span className="text-white text-2xl font-bold">
                  {listing.status === 'SOLD_OUT' ? 'Sold Out' : 'No Longer Available'}
                </span>
              </div>
            )}
          </div>

          {/* ─── Details ────────────────────────────────── */}
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-surface-900 capitalize">{listing.crop}</h1>
              <div className="flex items-center gap-2 mt-2">
                <Badge color={isAvailable ? 'green' : 'red'}>
                  {isAvailable ? 'Available' : listing.status === 'SOLD_OUT' ? 'Sold Out' : 'Unavailable'}
                </Badge>
                {listing.visionObservation?.status === 'COMPLETED' && (
                  <Badge color="blue">AI-Verified</Badge>
                )}
              </div>
            </div>

            {/* Price */}
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-primary-700">GH₵ {listing.pricePerUnit.toFixed(2)}</span>
              <span className="text-surface-500">per {listing.unit}</span>
            </div>

            {/* Quantity & Stock */}
            <Card className="!p-4">
              <div className="flex items-center justify-between text-sm mb-4">
                <span className="text-surface-600">Available stock</span>
                <span className="font-semibold text-surface-900">{listing.quantity} {listing.unit}</span>
              </div>

              {isAvailable && (
                <>
                  <div className="flex items-center gap-4 mb-4">
                    <label className="text-sm font-medium text-surface-700">Quantity:</label>
                    <div className="flex items-center border border-surface-300 rounded-lg overflow-hidden">
                      <button
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        className="px-3 py-2 text-surface-600 hover:bg-surface-100 transition-colors"
                        disabled={quantity <= 1}
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={listing.quantity}
                        value={quantity}
                        onChange={(e) => {
                          const val = Math.max(1, Math.min(listing.quantity, Number(e.target.value) || 1));
                          setQuantity(val);
                        }}
                        className="w-16 text-center border-x border-surface-300 py-2 text-sm font-medium focus:outline-none"
                      />
                      <button
                        onClick={() => setQuantity(Math.min(listing.quantity, quantity + 1))}
                        className="px-3 py-2 text-surface-600 hover:bg-surface-100 transition-colors"
                        disabled={quantity >= listing.quantity}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-primary-50 rounded-lg mb-4">
                    <span className="text-sm font-medium text-primary-800">Total Price</span>
                    <span className="text-xl font-bold text-primary-700">GH₵ {totalPrice}</span>
                  </div>

                  <Button onClick={handleAddToCart} className="w-full" size="lg">
                    Add to Cart
                  </Button>
                </>
              )}
            </Card>

            {/* Farmer Info — privacy enforced */}
            <Card className="!p-4">
              <h3 className="font-semibold text-surface-900 mb-3">Farmer Information</h3>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                  <span className="text-primary-700 font-semibold text-sm">
                    {(typeof listing.farmer === 'object' ? listing.farmer.fullName : 'F')[0]}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-surface-900">{farmerDisplay}</p>
                  <p className="text-xs text-surface-500">{listing.region}</p>
                </div>
              </div>
              <Link
                to={`/farmers/${farmerId}`}
                className="block mt-3 text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                View farmer's other listings →
              </Link>
            </Card>

            {/* Availability */}
            {listing.availableDate && (
              <div className="text-sm text-surface-600">
                <span className="font-medium">Available from: </span>
                {new Date(listing.availableDate).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </div>
            )}

            {/* Description */}
            {listing.description && (
              <div>
                <h3 className="font-semibold text-surface-900 mb-2">Description</h3>
                <p className="text-sm text-surface-600 leading-relaxed">{listing.description}</p>
              </div>
            )}

            {/* AI Visual Observation */}
            {listing.visionObservation?.description && (
              <Card className="!p-4 !border-blue-200 !bg-blue-50/50">
                <h3 className="font-semibold text-surface-900 mb-2 flex items-center gap-2">
                  <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  AI Visual Observation
                </h3>
                <p className="text-sm text-surface-700 mb-2">{listing.visionObservation.description}</p>
                <p className="text-xs text-surface-500 italic">
                  AI visual observation. Human confirmation is required.
                </p>

                {listing.visionObservation.flaggedIssues?.length > 0 && (
                  <div className="mt-3">
                    {listing.visionObservation.flaggedIssues.map((issue, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-amber-700 mt-1">
                        <span>⚠</span>
                        <span>{issue}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetails;
