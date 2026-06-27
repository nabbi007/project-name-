import React from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

const navItems = [
  {
    id: 'dashboard',
    to: '/agent/dashboard',
    label: 'Dashboard',
    icon: (
      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
  },
  {
    id: 'farmers',
    to: '/agent/farmers',
    label: 'Farmers',
    icon: (
      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    id: 'listings',
    to: '/agent/listings',
    label: 'Listings',
    icon: (
      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    id: 'orders',
    to: '/agent/orders',
    label: 'Orders',
    icon: (
      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
      </svg>
    ),
  },
];

const PAGE_TITLES: Record<string, string> = {
  '/agent/dashboard': 'Dashboard',
  '/agent/farmers': 'Farmers',
  '/agent/listings': 'Listings',
  '/agent/orders': 'Orders',
};

function pageTitle(pathname: string): string {
  if (pathname.includes('/create-listing')) return 'Voice listing';
  if (pathname.includes('/farmers/new') || pathname.includes('/edit')) return 'Farmer';
  if (pathname.match(/\/farmers\/[^/]+$/)) return 'Farmer profile';
  for (const [path, title] of Object.entries(PAGE_TITLES)) {
    if (pathname === path || pathname.startsWith(`${path}/`)) return title;
  }
  return 'Console';
}

function userInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

const AgentLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const crumb = pageTitle(location.pathname);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 min-h-[40px] px-3 py-2 rounded-md text-sm font-medium transition-colors ${
      isActive
        ? 'bg-surface-100 text-surface-900'
        : 'text-surface-600 hover:bg-surface-50 hover:text-surface-900'
    }`;

  return (
    <div className="agent-console min-h-screen flex">
      <aside className="shrink-0 w-60 sticky top-0 h-screen bg-white border-r border-surface-200 flex flex-col">
        <div className="px-4 py-5 border-b border-surface-200">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-primary-600 flex items-center justify-center text-white text-xs font-bold">
              AV
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-surface-900 truncate">AgroVoice</p>
              <p className="text-xs text-surface-500">Console</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.id}
              to={item.to}
              end={item.to === '/agent/dashboard'}
              className={navLinkClass}
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-surface-200">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-3 min-h-[40px] px-3 py-2 rounded-md text-sm font-medium text-surface-600 hover:bg-surface-50 hover:text-red-600 transition-colors text-left"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-surface-200 px-4 lg:px-6 py-3 flex items-center gap-4">
          <div className="flex-1 min-w-0 text-sm text-surface-500 truncate">
            <span className="text-surface-600">AgroVoice</span>
            <span className="mx-2 text-surface-300">›</span>
            <span className="text-surface-900">{crumb}</span>
          </div>

          <div className="hidden sm:flex items-center gap-4 shrink-0">
            <span className="flex items-center gap-1.5 text-xs text-surface-500">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
              Live
            </span>
            <Link to="/marketplace" className="text-xs text-surface-500 hover:text-surface-900 transition-colors">
              Back to site
            </Link>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 pl-2 border-l border-surface-200">
            <div className="w-8 h-8 rounded-full bg-surface-100 flex items-center justify-center text-xs font-semibold text-surface-700">
              {userInitials(user?.name ?? 'AG')}
            </div>
            <div className="hidden md:block min-w-0">
              <p className="text-sm font-medium text-surface-900 truncate max-w-[120px]">
                {user?.name ?? 'Agent'}
              </p>
              <p className="text-xs text-surface-500">Field agent</p>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AgentLayout;
