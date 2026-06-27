import React from 'react';
import type { DashboardStats } from '../../api/admin.api';
import {
  ChartLegend,
  DonutChart,
  HorizontalBarChart,
  type ChartSegment,
} from './AgentDashboardCharts';

interface AdminDashboardChartsProps {
  stats: DashboardStats;
}

export const AdminDashboardCharts: React.FC<AdminDashboardChartsProps> = ({ stats }) => {
  const {
    totalFarmers,
    totalAgents,
    publishedListings,
    pendingListings,
    totalOrders,
    completedOrders,
    failedAiRequests,
  } = stats;

  const totalListings = publishedListings + pendingListings;

  const listingSegments: ChartSegment[] = [
    { label: 'Live', value: publishedListings, color: '#22c55e' },
    { label: 'Pending', value: pendingListings, color: '#eab308' },
  ];

  const otherOrders = Math.max(0, totalOrders - completedOrders);

  const orderSegments: ChartSegment[] = [
    { label: 'Completed', value: completedOrders, color: '#22c55e' },
    { label: 'In progress', value: otherOrders, color: '#a8a29e' },
  ];

  const platformBars = [
    { label: 'Farmers', value: totalFarmers, color: '#3b82f6' },
    { label: 'Agents', value: totalAgents, color: '#1b5e20' },
    { label: 'Live listings', value: publishedListings, color: '#22c55e' },
    { label: 'Pending listings', value: pendingListings, color: '#eab308' },
    { label: 'Total orders', value: totalOrders, color: '#737373' },
    { label: 'Completed orders', value: completedOrders, color: '#16a34a' },
    { label: 'Failed AI requests', value: failedAiRequests, color: '#ef4444' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-surface-900">Listings</h2>
          <p className="text-xs text-surface-500 mt-0.5 mb-4">Live vs pending review</p>
          <div className="flex items-center gap-5">
            <DonutChart
              segments={listingSegments}
              centerLabel={String(totalListings)}
              centerSub="total"
            />
            <ChartLegend segments={listingSegments} />
          </div>
        </div>

        <div className="card p-5">
          <h2 className="text-sm font-semibold text-surface-900">Orders</h2>
          <p className="text-xs text-surface-500 mt-0.5 mb-4">Completed vs in progress</p>
          <div className="flex items-center gap-5">
            <DonutChart
              segments={orderSegments}
              centerLabel={String(totalOrders)}
              centerSub="total"
            />
            <ChartLegend segments={orderSegments} />
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-semibold text-surface-900">Platform activity</h2>
        <p className="text-xs text-surface-500 mt-0.5 mb-4">Relative scale across all metrics</p>
        <HorizontalBarChart items={platformBars} />
      </div>
    </div>
  );
};

export default AdminDashboardCharts;
