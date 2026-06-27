import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useCartStore } from '../store/cartStore';

const BuyerLayout: React.FC = () => {
  const { logout } = useAuthStore();
  const { items } = useCartStore();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  const navItems = [
    { label: 'Marketplace', path: '/marketplace' },
    { label: 'My Orders', path: '/buyer/orders' },
    { label: 'Profile', path: '/buyer/profile' },
  ];

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      {/* Top Navigation */}
      <nav className="bg-white border-b border-surface-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-8">
              <Link to="/" className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center">
                  <span className="text-white text-sm font-bold">A</span>
                </div>
                <span className="text-lg font-bold text-surface-900 hidden sm:block">AgroVoice</span>
              </Link>

              <div className="hidden md:flex items-center gap-1">
                {navItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      location.pathname.startsWith(item.path) && item.path !== '/marketplace' || 
                      (item.path === '/marketplace' && location.pathname === '/marketplace')
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-surface-600 hover:bg-surface-100 hover:text-surface-900'
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Link to="/cart" className="relative p-2 text-surface-600 hover:text-primary-600 transition-colors">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                {items.length > 0 && (
                  <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/4 -translate-y-1/4 bg-red-600 rounded-full">
                    {items.length}
                  </span>
                )}
              </Link>
              
              <div className="hidden md:block border-l border-surface-200 h-6 mx-2"></div>
              
              <button
                onClick={handleLogout}
                className="hidden md:block text-sm font-medium text-surface-600 hover:text-red-600 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Bar */}
        <div className="md:hidden border-t border-surface-200 flex justify-around p-2 bg-white">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`px-3 py-2 rounded-md text-sm font-medium ${
                location.pathname.startsWith(item.path) && item.path !== '/marketplace' || 
                (item.path === '/marketplace' && location.pathname === '/marketplace')
                  ? 'text-primary-700'
                  : 'text-surface-600'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <Outlet />
      </main>
    </div>
  );
};

export default BuyerLayout;
