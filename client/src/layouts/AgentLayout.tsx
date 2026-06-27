import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

const navItems = [
  { id: 'dashboard', to: '/agent/dashboard', label: 'Dashboard' },
  { id: 'farmers', to: '/agent/farmers', label: 'Farmers' },
  { id: 'listings', to: '/agent/listings', label: 'Listings' },
  { id: 'orders', to: '/agent/orders', label: 'Orders' },
];

const AgentLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center min-h-[48px] px-4 py-3 rounded-lg text-base font-medium transition-colors ${
      isActive
        ? 'bg-primary-600 text-white'
        : 'text-surface-700 hover:bg-surface-100'
    }`;

  return (
    <div className="min-h-screen bg-surface-50 flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          aria-label="Close menu"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-72 bg-white border-r border-surface-200 flex flex-col transform transition-transform duration-200 ease-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="px-4 py-5 border-b border-surface-200">
          <p className="text-lg font-bold text-primary-700">AgroVoice</p>
          <p className="text-sm text-surface-500">Field Agent</p>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.id}
              to={item.to}
              end={item.to === '/agent/dashboard'}
              className={navLinkClass}
              onClick={() => setSidebarOpen(false)}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-surface-200">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full min-h-[48px] px-4 py-3 rounded-lg text-base font-medium text-red-600 hover:bg-red-50 transition-colors text-left"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 bg-white border-b border-surface-200 px-4 py-3 flex items-center gap-4">
          <button
            type="button"
            className="lg:hidden min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-surface-300 text-surface-700"
            aria-label="Open menu"
            onClick={() => setSidebarOpen(true)}
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-surface-500 truncate">Signed in as</p>
            <p className="font-medium text-surface-900 truncate">{user?.name ?? 'Agent'}</p>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AgentLayout;
