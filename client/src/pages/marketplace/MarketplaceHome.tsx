import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { marketplaceApi } from '../../api/marketplace.api';
import { ListingCard } from '../../components/marketplace/ListingCard';
import { MarketplaceNav } from '../../components/marketplace/MarketplaceNav';
import { SearchInput } from '../../components/shared/SearchInput';
import { Button } from '../../components/shared/Button';
import { CardSkeleton } from '../../components/shared/Skeleton';
import { useAuthStore } from '../../store/authStore';

const cropCategories = [
  { name: 'Maize', emoji: '🌽', filter: 'maize' },
  { name: 'Cassava', emoji: '🥔', filter: 'cassava' },
  { name: 'Tomatoes', emoji: '🍅', filter: 'tomatoes' },
  { name: 'Plantain', emoji: '🍌', filter: 'plantain' },
  { name: 'Yam', emoji: '🍠', filter: 'yam' },
  { name: 'Rice', emoji: '🌾', filter: 'rice' },
];

const howItWorks = [
  {
    step: '1',
    title: 'Farmer Speaks',
    description: 'Field agents record farmers describing their produce in their local language.',
    icon: '🎙️',
  },
  {
    step: '2',
    title: 'AI Listens',
    description: 'Our AI transcribes, extracts details, and verifies produce quality through images.',
    icon: '🤖',
  },
  {
    step: '3',
    title: 'Buyers Discover',
    description: 'Fresh produce appears on the marketplace, ready for you to order directly.',
    icon: '🛒',
  },
];

const MarketplaceHome: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();

  // Recently added listings
  const { data: recentData, isLoading: recentLoading } = useQuery({
    queryKey: ['listings', 'recent'],
    queryFn: () => marketplaceApi.listPublishedListings({ page: 1 }),
  });

  const recentListings = recentData?.data?.listings?.slice(0, 6) || [];

  const handleSearch = (query: string) => {
    if (query.trim()) {
      navigate(`/marketplace?crop=${encodeURIComponent(query)}`);
    }
  };

  return (
    <div className="min-h-screen bg-surface-50">
      <MarketplaceNav />

      {/* ─── Hero Section ───────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary-700 via-primary-600 to-primary-800">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 -left-10 w-72 h-72 bg-accent-400 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-primary-300 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-28">
          <div className="max-w-2xl">
            <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight text-balance">
              Fresh produce,{' '}
              <span className="text-accent-300">straight from Ghana's farms</span>
            </h1>
            <p className="mt-4 text-lg text-primary-100 max-w-lg">
              Discover AI-verified produce from local farmers. Voice-powered, transparent, and direct — no middlemen.
            </p>
            <div className="mt-8 max-w-md">
              <SearchInput
                onSearch={handleSearch}
                placeholder="Search for maize, cassava, tomatoes..."
                className="[&_input]:bg-white/95 [&_input]:border-0 [&_input]:shadow-lg [&_input]:py-3"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ─── Crop Categories ────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 relative z-10">
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
          {cropCategories.map((cat) => (
            <Link
              key={cat.filter}
              to={`/marketplace?crop=${cat.filter}`}
              className="flex-shrink-0 flex items-center gap-2 bg-white rounded-full px-5 py-2.5 shadow-soft border border-surface-200
                         hover:border-primary-300 hover:shadow-md transition-all duration-200 group"
            >
              <span className="text-xl">{cat.emoji}</span>
              <span className="text-sm font-medium text-surface-700 group-hover:text-primary-700">{cat.name}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* ─── Recently Added ─────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-surface-900">Recently Added</h2>
            <p className="text-sm text-surface-500 mt-1">Fresh listings from local farmers</p>
          </div>
          <Link to="/marketplace">
            <Button variant="ghost" size="sm">View All →</Button>
          </Link>
        </div>

        {recentLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        ) : recentListings.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {recentListings.map((listing) => (
              <ListingCard key={listing._id} listing={listing} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <span className="text-5xl mb-4 block">🌱</span>
            <h3 className="text-lg font-semibold text-surface-700">No listings yet</h3>
            <p className="text-surface-500 mt-1">Check back soon — farmers are adding produce daily.</p>
          </div>
        )}
      </section>

      {/* ─── How AgroVoice Works ────────────────────────────── */}
      <section className="bg-white border-y border-surface-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold text-surface-900">How AgroVoice Works</h2>
            <p className="text-surface-500 mt-2">Voice-first technology connecting farmers directly to buyers</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {howItWorks.map((item) => (
              <div key={item.step} className="text-center group">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-50 text-3xl mb-4
                                group-hover:bg-primary-100 group-hover:scale-110 transition-all duration-300">
                  {item.icon}
                </div>
                <h3 className="text-lg font-semibold text-surface-900">{item.title}</h3>
                <p className="text-sm text-surface-500 mt-2 max-w-xs mx-auto">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA for Buyers ─────────────────────────────────── */}
      {!isAuthenticated() && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-2xl p-8 md:p-12 text-center shadow-glow">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">Ready to start ordering?</h2>
            <p className="text-primary-100 max-w-lg mx-auto mb-6">
              Register for free and get access to fresh, AI-verified produce from farmers across Ghana.
            </p>
            <Link to="/register">
              <Button
                variant="secondary"
                size="lg"
                className="!bg-white !text-primary-700 hover:!bg-primary-50 !shadow-lg"
              >
                Register to Start Ordering
              </Button>
            </Link>
          </div>
        </section>
      )}

      {/* ─── Footer ──────────────────────────────────────────── */}
      <footer className="bg-surface-900 text-surface-400 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm">
          <p>© {new Date().getFullYear()} AgroVoice — Connecting farmers and buyers across Ghana</p>
        </div>
      </footer>
    </div>
  );
};

export default MarketplaceHome;
