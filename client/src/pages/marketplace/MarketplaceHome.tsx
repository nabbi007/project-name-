import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { marketplaceApi } from '../../api/marketplace.api';
import { ListingCard } from '../../components/marketplace/ListingCard';
import { SearchInput } from '../../components/shared/SearchInput';
import { Button } from '../../components/shared/Button';
import { CardSkeleton } from '../../components/shared/Skeleton';
import { useAuthStore } from '../../store/authStore';
import { useCartStore } from '../../store/cartStore';

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
  const { items } = useCartStore();

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
      {/* ─── Navigation Bar ─────────────────────────────────── */}
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
              <Link to="/marketplace">
                <Button variant="ghost" size="sm">Browse All</Button>
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
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-16 relative z-10 pb-16">
        <div className="flex gap-4 overflow-x-auto pb-6 scrollbar-hide snap-x">
          {cropCategories.map((cat, idx) => (
            <Link
              key={cat.filter}
              to={`/marketplace?crop=${cat.filter}`}
              className="snap-start flex-shrink-0 relative group rounded-2xl p-6 w-40 overflow-hidden transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl bg-white border border-surface-100 shadow-soft animate-fade-in-up"
              style={{ animationDelay: `${0.1 * idx}s` }}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${cat.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300`}></div>
              <div className="flex flex-col items-center gap-3 relative z-10">
                <span className="text-4xl group-hover:scale-125 transition-transform duration-300 drop-shadow-sm">{cat.emoji}</span>
                <span className="font-bold text-surface-800 group-hover:text-primary-700 transition-colors">{cat.name}</span>
              </div>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        ) : recentListings.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {recentListings.map((listing) => (
              <div key={listing._id} className="transition-all duration-300 hover:-translate-y-1 hover:shadow-xl rounded-2xl">
                <ListingCard listing={listing} />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-24 bg-white rounded-3xl border border-surface-200 shadow-sm">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary-50 mb-6">
              <span className="text-4xl">🌱</span>
            </div>
            <h3 className="text-xl font-bold text-surface-900">No listings yet</h3>
            <p className="text-surface-500 mt-2 max-w-sm mx-auto">Check back soon — our farmers are busy harvesting and adding produce daily.</p>
          </div>
        )}

        <div className="mt-8 text-center sm:hidden">
          <Link to="/marketplace">
            <Button variant="secondary" className="w-full group">
              View All <span className="inline-block transition-transform group-hover:translate-x-1 ml-1">→</span>
            </Button>
          </Link>
        </div>
      </section>

      {/* ─── How AgroVoice Works ────────────────────────────── */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-surface-900 -skew-y-2 origin-top-left z-0"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">The AgroVoice Process</h2>
            <p className="text-surface-400 mt-4 text-lg max-w-2xl mx-auto">Voice-first technology connecting rural farmers directly to modern markets</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
            {howItWorks.map((item, idxx) => (
              <div key={item.step} className="relative group">
                <div className="absolute inset-0 bg-gradient-to-b from-surface-800 to-surface-900 rounded-3xl transform transition-transform group-hover:scale-105 group-hover:rotate-1 duration-300 border border-surface-700"></div>
                <div className="relative p-8 text-center">
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 text-4xl mb-6 shadow-lg shadow-primary-500/30 group-hover:-translate-y-2 transition-transform duration-300">
                    {item.icon}
                  </div>
                  <div className="absolute top-6 right-6 text-6xl font-black text-surface-800/50 pointer-events-none transition-colors group-hover:text-primary-900/50">
                    {item.step}
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">{item.title}</h3>
                  <p className="text-surface-400 leading-relaxed">{item.description}</p>
                </div>
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
      <footer className="bg-white border-t border-surface-200 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
              <span className="text-white text-xs font-bold">A</span>
            </div>
            <span className="text-lg font-bold text-surface-900">AgroVoice</span>
          </div>
          <p className="text-surface-500 text-sm font-medium">© {new Date().getFullYear()} AgroVoice. Building the future of agriculture.</p>
        </div>
      </footer>
    </div>
  );
};

export default MarketplaceHome;

