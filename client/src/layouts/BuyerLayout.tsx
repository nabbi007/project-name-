import React from 'react';
import { Outlet } from 'react-router-dom';

// Buyer layout — minimal header with nav
const BuyerLayout: React.FC = () => (
  <div className="min-h-screen bg-surface-50">
    <Outlet />
  </div>
);

export default BuyerLayout;
