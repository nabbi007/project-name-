import type { Order } from '../api/orders.api';

export type OrderStatus = Order['status'];

const STATUS_META: Record<
  string,
  { label: string; color: 'green' | 'yellow' | 'red' | 'blue' | 'gray' | 'purple' }
> = {
  PENDING: { label: 'Pending', color: 'blue' },
  CONFIRMED: { label: 'Confirmed', color: 'purple' },
  AWAITING_COLLECTION: { label: 'Awaiting collection', color: 'yellow' },
  READY_FOR_PICKUP: { label: 'Ready for pickup', color: 'yellow' },
  IN_TRANSIT: { label: 'In transit', color: 'blue' },
  COLLECTED: { label: 'Collected', color: 'green' },
  DELIVERED: { label: 'Delivered', color: 'green' },
  COMPLETED: { label: 'Completed', color: 'green' },
  CANCELLED: { label: 'Cancelled', color: 'gray' },
  DISPUTED: { label: 'Disputed', color: 'red' },
};

/** Matches server TRANSITIONS in orders.service.ts */
export const AGENT_NEXT_STATUSES: Partial<Record<OrderStatus, OrderStatus[]>> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['AWAITING_COLLECTION', 'READY_FOR_PICKUP', 'IN_TRANSIT', 'CANCELLED'],
  AWAITING_COLLECTION: ['COLLECTED', 'CANCELLED'],
  READY_FOR_PICKUP: ['COLLECTED', 'CANCELLED'],
  IN_TRANSIT: ['DELIVERED', 'CANCELLED'],
  COLLECTED: ['COMPLETED', 'DISPUTED'],
  DELIVERED: ['COMPLETED', 'DISPUTED'],
  DISPUTED: ['COMPLETED', 'CANCELLED'],
};

export function getOrderStatusMeta(status?: string) {
  return STATUS_META[status ?? ''] ?? { label: status?.replace(/_/g, ' ') ?? 'Unknown', color: 'gray' as const };
}

export function formatOrderPrice(amount?: number): string {
  if (amount == null || !Number.isFinite(amount)) return '—';
  return `GH₵ ${amount.toFixed(2)}`;
}

export function getOrderListingImage(order: Order): string | null {
  if (typeof order.listing === 'object' && order.listing.imageUrl) {
    return order.listing.imageUrl;
  }
  return null;
}

export function getOrderListingName(order: Order): string {
  if (typeof order.listing === 'object') return order.listing.crop || 'Produce';
  return 'Produce';
}

export function getOrderFarmerName(order: Order): string {
  if (typeof order.farmer === 'object') return order.farmer.fullName;
  return 'Farmer';
}

export function getOrderBuyerName(order: Order): string {
  if (typeof order.buyer === 'object') return order.buyer.name;
  return 'Buyer';
}

export function formatOrderDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function orderDisplayId(order: Order): string {
  return order.orderNumber ?? `#${order._id.slice(0, 8).toUpperCase()}`;
}
