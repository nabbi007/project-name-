import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ordersApi } from '../../api/orders.api';
import { Card } from '../../components/shared/Card';
import { Badge } from '../../components/shared/Badge';
import { ErrorAlert } from '../../components/shared/Alerts';
import { EmptyState } from '../../components/shared/EmptyState';
import { CardSkeleton } from '../../components/shared/Skeleton';
import {
  formatOrderDate,
  formatOrderPrice,
  getOrderListingImage,
  getOrderListingName,
  getOrderStatusMeta,
  orderDisplayId,
} from '../../utils/orderDisplay';
import { getCropGradient } from '../../utils/listingDisplay';

const BuyerOrders: React.FC = () => {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['my-orders'],
    queryFn: () => ordersApi.getMyOrders(),
  });

  const orders = data?.data?.orders || [];

  if (isError) {
    return (
      <div className="py-8">
        <ErrorAlert>
          Failed to load your orders. 
          <button onClick={() => refetch()} className="underline ml-2 font-medium">Try again</button>
        </ErrorAlert>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="py-12">
        <EmptyState
          title="No orders yet"
          message="You haven't placed any orders yet. Visit the marketplace to find fresh produce."
          actionLabel="Browse Marketplace"
          onAction={() => window.location.href = '/marketplace'}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-end mb-6">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">My Orders</h1>
          <p className="text-sm text-surface-500 mt-1">Track and manage your purchases</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {orders.map((order) => {
          const listingName = getOrderListingName(order);
          const imageUrl = getOrderListingImage(order);
          const gradient = getCropGradient(listingName);
          const statusMeta = getOrderStatusMeta(order.status);

          return (
            <Link key={order._id} to={`/buyer/orders/${order._id}`} className="block group">
              <Card className="flex flex-col sm:flex-row gap-4 !p-5 hover:border-primary-300 transition-colors">
                <div className="w-full sm:w-24 h-32 sm:h-24 rounded-xl overflow-hidden shrink-0 border border-surface-100">
                  {imageUrl ? (
                    <img src={imageUrl} alt={listingName} className="w-full h-full object-cover" />
                  ) : (
                    <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
                      <span className="text-3xl">🌾</span>
                    </div>
                  )}
                </div>

                <div className="flex-1 flex flex-col sm:flex-row sm:justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-mono text-sm text-surface-500">{orderDisplayId(order)}</span>
                      <Badge color={statusMeta.color}>{statusMeta.label}</Badge>
                    </div>
                    <h3 className="font-semibold text-surface-900 capitalize text-lg group-hover:text-primary-700 transition-colors">
                      {listingName}
                    </h3>
                    <p className="text-sm text-surface-500 mt-1">
                      Placed {formatOrderDate(order.createdAt)}
                    </p>
                  </div>

                  <div className="sm:text-right flex flex-col justify-center">
                    <div className="font-bold text-lg text-surface-900">
                      {formatOrderPrice(order.totalPrice)}
                    </div>
                    <div className="text-sm text-surface-500 mt-1">
                      {order.quantity} units
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default BuyerOrders;
