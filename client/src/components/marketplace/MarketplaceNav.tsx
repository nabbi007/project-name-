import React from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useCartStore } from '../../store/cartStore';
import { Button } from '../shared/Button';

interface MarketplaceNavProps {
  backLink?: { to: string; label: string };
  className?: string;
}

export const MarketplaceNav: React.FC<MarketplaceNavProps> = ({ backLink, className = '' }) => {
  const { isAuthenticated, user } = useAuthStore();
  const itemCount = useCartStore((s) => s.getItemCount());

  return (
    <nav
      className={`sticky top-0 z-30 border-b border-surface-200/60 bg-white/90 backdrop-blur-md ${className}`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2.5 group shrink-0">
            <div className="w-9 h-9 rounded-xl bg-primary-600 flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
              <span className="text-white text-sm font-bold">A</span>
            </div>
            <span className="text-lg font-semibold text-surface-900 tracking-tight hidden sm:block">
              AgroVoice
            </span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            {backLink && (
              <Link
                to={backLink.to}
                className="text-sm font-medium text-surface-500 hover:text-primary-700 transition-colors mr-1"
              >
                {backLink.label}
              </Link>
            )}

            <Link to="/marketplace" className="hidden sm:block">
              <Button variant="ghost" size="sm">
                Browse
              </Button>
            </Link>

            <Link
              to="/cart"
              className="relative p-2 text-surface-600 hover:text-primary-600 transition-colors"
              aria-label={`Cart${itemCount > 0 ? `, ${itemCount} items` : ''}`}
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              {itemCount > 0 && (
                <span className="absolute top-0 right-0 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 text-xs font-bold text-white transform translate-x-1/4 -translate-y-1/4 bg-red-600 rounded-full">
                  {itemCount > 99 ? '99+' : itemCount}
                </span>
              )}
            </Link>

            {isAuthenticated() && user?.role === 'BUYER' ? (
              <Link to="/buyer/orders">
                <Button variant="secondary" size="sm">
                  My Orders
                </Button>
              </Link>
            ) : !isAuthenticated() ? (
              <>
                <Link to="/login">
                  <Button variant="ghost" size="sm">
                    Sign In
                  </Button>
                </Link>
                <Link to="/register">
                  <Button variant="primary" size="sm">
                    Register
                  </Button>
                </Link>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </nav>
  );
};
