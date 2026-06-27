import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ordersApi } from '../../api/orders.api';
import { AgentOrderCard } from '../../components/orders/AgentOrderCard';
import {
  Button,
  CardSkeleton,
  EmptyState,
  ErrorAlert,
  Pagination,
} from '../../components/shared';
import { useToast } from '../../components/shared/Toast';
import type { Order } from '../../api/orders.api';

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'AWAITING_COLLECTION', label: 'Awaiting pickup' },
  { value: 'READY_FOR_PICKUP', label: 'Ready' },
  { value: 'IN_TRANSIT', label: 'In transit' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
] as const;

const AgentOrders: React.FC = () => {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['agent', 'orders', status, page],
    queryFn: () =>
      ordersApi.getManagedOrders({
        status: status || undefined,
        page,
        limit: 10,
      }),
  });

  const mutation = useMutation({
    mutationFn: async ({
      orderId,
      action,
      nextStatus,
    }: {
      orderId: string;
      action: 'confirm' | 'status';
      nextStatus?: Order['status'];
    }) => {
      setActiveOrderId(orderId);
      if (action === 'confirm') return ordersApi.confirmFarmerOrder(orderId);
      return ordersApi.updateOrderStatus(orderId, { status: nextStatus! });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['agent', 'orders'] });
      addToast('Order updated', 'success');
    },
    onError: () => {
      addToast('Could not update order', 'error');
    },
    onSettled: () => setActiveOrderId(null),
  });

  const orders = data?.orders ?? [];
  const pagination = data?.pagination;
  const pendingCount = orders.filter((o) => o.status === 'PENDING').length;

  const handleConfirmFarmer = (orderId: string) => {
    mutation.mutate({ orderId, action: 'confirm' });
  };

  const handleUpdateStatus = (orderId: string, nextStatus: Order['status']) => {
    if (nextStatus === 'CANCELLED' && !window.confirm('Cancel this order and restore stock?')) return;
    mutation.mutate({ orderId, action: 'status', nextStatus });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-surface-900">Orders</h1>
        <p className="text-surface-500 mt-1 text-sm">
          Buyer orders for your farmers&apos; listings — newest first.
        </p>
      </div>

      {!isLoading && !isError && pendingCount > 0 && status !== 'PENDING' && (
        <div className="card p-4 bg-amber-50 border-amber-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-sm text-amber-900">
            <span className="font-semibold">{pendingCount}</span> order
            {pendingCount === 1 ? '' : 's'} on this page need farmer confirmation.
          </p>
          <Button size="sm" variant="secondary" onClick={() => { setStatus('PENDING'); setPage(1); }}>
            Show pending
          </Button>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {STATUS_FILTERS.map((filter) => {
          const active = status === filter.value;
          return (
            <button
              key={filter.value || 'all'}
              type="button"
              onClick={() => {
                setStatus(filter.value);
                setPage(1);
              }}
              className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                active
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white text-surface-600 border-surface-200 hover:border-primary-300'
              }`}
            >
              {filter.label}
            </button>
          );
        })}
      </div>

      {isFetching && !isLoading && (
        <p className="text-xs text-surface-400 animate-pulse">Refreshing…</p>
      )}

      {isLoading && (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      )}

      {isError && (
        <ErrorAlert>
          <p className="mb-3">Could not load orders.</p>
          <Button variant="secondary" onClick={() => refetch()}>
            Retry
          </Button>
        </ErrorAlert>
      )}

      {!isLoading && !isError && orders.length === 0 && (
        <EmptyState
          title={status ? 'No orders in this status' : 'No orders yet'}
          message={
            status
              ? 'Try another filter or check back when buyers place orders.'
              : 'When buyers order from your published listings, they will appear here.'
          }
        />
      )}

      {!isLoading && !isError && orders.length > 0 && (
        <>
          <p className="text-sm text-surface-500">
            {pagination?.total ?? orders.length} order{(pagination?.total ?? 0) === 1 ? '' : 's'} total
          </p>
          <div className="space-y-4">
            {orders.map((order) => (
              <AgentOrderCard
                key={order._id}
                order={order}
                onConfirmFarmer={handleConfirmFarmer}
                onUpdateStatus={handleUpdateStatus}
                actionPending={mutation.isPending && activeOrderId === order._id}
              />
            ))}
          </div>
          {pagination && pagination.totalPages > 1 && (
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              onPageChange={setPage}
            />
          )}
        </>
      )}
    </div>
  );
};

export default AgentOrders;
