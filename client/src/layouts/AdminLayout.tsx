import React from 'react';
import { Outlet } from 'react-router-dom';

// Stub layout — Dev 2 will replace with real sidebar + topbar layout
const AdminLayout: React.FC = () => (
  <div className="min-h-screen bg-surface-50">
    <Outlet />
  </div>
);

export default AdminLayout;
