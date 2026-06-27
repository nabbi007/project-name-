import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ordersApi } from '../../api/orders.api';
import { Card } from '../../components/shared/Card';
import { Badge } from '../../components/shared/Badge';
import { ErrorAlert } from '../../components/shared/Alerts';
import { EmptyState } from '../../components/shared/EmptyState';
import { CardSkeleton } from '../../components/shared/Skeleton';

const getStatusColor = (status: string): "green" | "yellow" | "red" | "blue" | "gray" | "purple" => {
  switch (status) {
    case 'PLACED': return 'blue';
    case 'CONFIRMED': return 'purple';
    case 'AWAITING_COLLECTION': return 'yellow';
    case 'COLLECTED': return 'green';
    case 'CANCELLED': return 'gray';
    case 'REJECTED': return 'red';
    default: return 'gray';
  }
};

const BuyerOrders: React.FC = () => {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['my-orders'],
    queryFn: () => ordersApi.getMyOrders(),
  });

  const orders = data?.data?.orders || [];

  const formatPrice = (price: number) => `GH₵ ${price.toFixed(2)}`;
  
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
  };

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
          const listingName = typeof order.listing === 'object' ? order.listing.crop : 'Produce';
          
          return (
            <Link key={order._id} to={`/buyer/orders/${order._id}`} className="block group">
              <Card className="flex flex-col sm:flex-row justify-between gap-4 !p-5 hover:border-primary-300 transition-colors">
                
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-mono text-sm text-surface-500">#{order._id.slice(-6).toUpperCase()}</span>
                    <Badge color={getStatusColor(order.status)}>
                      {order.status.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  <h3 className="font-semibold text-surface-900 capitalize text-lg group-hover:text-primary-700 transition-colors">
                    {listingName}
                  </h3>
                  <p className="text-sm text-surface-500 mt-1">
                    Placed on {formatDate(order.createdAt)}
                  </p>
                </div>

                <div className="sm:text-right flex flex-col justify-between">
                  <div className="font-bold text-lg text-surface-900">
                    {formatPrice(order.totalPrice)}
                  </div>
                  <div className="text-sm text-surface-500 mt-1 sm:mt-0">
                    {order.quantity} units
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
