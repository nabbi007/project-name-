import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../api/admin.api';
import { AdminDashboardCharts } from '../../components/dashboard/AdminDashboardCharts';
import { Button, ErrorAlert } from '../../components/shared';

const AdminDashboard: React.FC = () => {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: adminApi.getDashboardStats,
  });

  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-surface-900 tracking-tight">Overview</h1>
        <p className="text-sm text-surface-500 mt-2 max-w-2xl leading-relaxed">
          Platform-wide totals for farmers, agents, listings, orders, and AI health.
        </p>
      </div>

      {isLoading && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card h-56 animate-pulse bg-surface-100" />
            <div className="card h-56 animate-pulse bg-surface-100" />
          </div>
          <div className="card h-72 animate-pulse bg-surface-100" />
        </div>
      )}

      {isError && (
        <ErrorAlert>
          <p className="mb-3">Could not load dashboard statistics.</p>
          <Button variant="secondary" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </ErrorAlert>
      )}

      {!isLoading && !isError && data && <AdminDashboardCharts stats={data} />}
    </div>
  );
};

export default AdminDashboard;
