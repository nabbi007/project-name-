import apiClient from './api-client';
import { resolveMediaUrl } from './media';

export interface Order {
  _id: string;
  orderNumber?: string;
  buyer: string | { _id: string; name: string; phone?: string };
  listing: string | {
    _id: string;
    crop: string;
    imageUrl?: string;
    pricePerUnit: number;
    unit: string;
  };
  farmer: string | {
    _id: string;
    fullName: string;
    community: string;
    region: string;
  };
  quantity: number;
  unitPriceAtOrder: number;
  totalPrice: number;
  deliveryMethod: 'PICKUP' | 'DELIVERY';
  deliveryLocation?: string;
  paymentMethod: 'CASH_ON_DELIVERY' | 'PAY_ON_PICKUP' | 'SIMULATED_MOMO';
  paymentStatus?: string;
  notes?: string;
  status:
    | 'PENDING'
    | 'CONFIRMED'
    | 'AWAITING_COLLECTION'
    | 'READY_FOR_PICKUP'
    | 'IN_TRANSIT'
    | 'COLLECTED'
    | 'DELIVERED'
    | 'COMPLETED'
    | 'CANCELLED'
    | 'DISPUTED'
    | 'PLACED'
    | 'REJECTED';
  farmerConfirmed: boolean;
  statusHistory: Array<{ status: string; at: string; note?: string }>;
  createdAt: string;
}

export interface CreateOrderPayload {
  listingId: string;
  quantity: number;
  deliveryMethod: 'PICKUP' | 'DELIVERY';
  deliveryLocation?: string;
  paymentMethod: 'CASH_ON_DELIVERY' | 'PAY_ON_PICKUP' | 'SIMULATED_MOMO';
  notes?: string;
}

interface RawOrderItem {
  uuid?: string;
  quantity: number;
  unitPrice: number | string;
  subtotal?: number | string;
  produceListing?: {
    uuid: string;
    title?: string;
    unit?: string;
    pricePerUnit?: number | string;
    cropCategory?: { name?: string };
    farmer?: {
      uuid: string;
      fullName: string;
      displayName?: string;
      region?: string;
      community?: string;
    };
    images?: Array<{ imagePath?: string; isPrimary?: boolean }>;
  };
}

interface RawOrder {
  uuid: string;
  orderNumber?: string;
  status: string;
  paymentStatus?: string;
  paymentMethod?: string;
  deliveryMethod?: string;
  deliveryLocation?: string | null;
  totalAmount: number | string;
  notes?: string | null;
  createdAt: string;
  buyer?: { uuid?: string; name?: string; phone?: string | null };
  items?: RawOrderItem[];
  statusHistory?: Array<{
    previousStatus?: string | null;
    newStatus: string;
    notes?: string | null;
    createdAt: string;
  }>;
}

function mapOrder(raw: RawOrder): Order {
  const item = raw.items?.[0];
  const listing = item?.produceListing;
  const primaryImage = listing?.images?.find((i) => i.isPrimary) ?? listing?.images?.[0];

  const listingSummary = listing
    ? {
        _id: listing.uuid,
        crop: listing.cropCategory?.name ?? listing.title ?? '',
        imageUrl: resolveMediaUrl(primaryImage?.imagePath) ?? undefined,
        pricePerUnit: Number(listing.pricePerUnit ?? item?.unitPrice ?? 0),
        unit: listing.unit ?? '',
      }
    : '';

  const farmer = listing?.farmer
    ? {
        _id: listing.farmer.uuid,
        fullName: listing.farmer.fullName,
        community: listing.farmer.community ?? '',
        region: listing.farmer.region ?? '',
      }
    : '';

  return {
    _id: raw.uuid,
    orderNumber: raw.orderNumber,
    buyer: raw.buyer?.uuid
      ? { _id: raw.buyer.uuid, name: raw.buyer.name ?? '', phone: raw.buyer.phone ?? undefined }
      : '',
    listing: listingSummary,
    farmer,
    quantity: item?.quantity ?? 0,
    unitPriceAtOrder: Number(item?.unitPrice ?? 0),
    totalPrice: Number(raw.totalAmount),
    deliveryMethod: (raw.deliveryMethod as Order['deliveryMethod']) ?? 'PICKUP',
    deliveryLocation: raw.deliveryLocation ?? undefined,
    paymentMethod: (raw.paymentMethod as Order['paymentMethod']) ?? 'PAY_ON_PICKUP',
    paymentStatus: raw.paymentStatus,
    notes: raw.notes ?? undefined,
    status: raw.status as Order['status'],
    farmerConfirmed: ['CONFIRMED', 'AWAITING_COLLECTION', 'READY_FOR_PICKUP', 'IN_TRANSIT', 'COLLECTED', 'DELIVERED', 'COMPLETED'].includes(
      raw.status
    ),
    statusHistory: (raw.statusHistory ?? []).map((h) => ({
      status: h.newStatus,
      at: h.createdAt,
      note: h.notes ?? undefined,
    })),
    createdAt: raw.createdAt,
  };
}

export const ordersApi = {
  createOrder: async (payload: CreateOrderPayload) => {
    const { data } = await apiClient.post<{ success: boolean; data: { order: RawOrder } }>(
      '/orders',
      payload
    );
    return {
      success: data.success,
      data: { order: mapOrder(data.data.order) },
    };
  },

  getMyOrders: async (params?: { status?: string; page?: number; limit?: number }) => {
    const { data } = await apiClient.get<{
      success: boolean;
      data: RawOrder[];
      pagination: { page: number; total: number };
    }>('/orders/mine', { params });

    return {
      success: data.success,
      data: {
        orders: data.data.map(mapOrder),
        page: data.pagination.page,
        total: data.pagination.total,
      },
    };
  },

  getOrder: async (id: string) => {
    const { data } = await apiClient.get<{ success: boolean; data: { order: RawOrder } }>(
      `/orders/${id}`
    );
    return {
      success: data.success,
      data: { order: mapOrder(data.data.order) },
    };
  },

  cancelOrder: async (id: string) => {
    const { data } = await apiClient.patch<{ success: boolean; data: { order: RawOrder } }>(
      `/orders/${id}/cancel`
    );
    return {
      success: data.success,
      data: { order: mapOrder(data.data.order) },
    };
  },

  getManagedOrders: async (params?: { status?: string; page?: number; limit?: number }) => {
    const { data } = await apiClient.get<{
      success: boolean;
      data: RawOrder[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>('/orders', { params });

    return {
      orders: data.data.map(mapOrder),
      pagination: data.pagination,
    };
  },

  updateOrderStatus: async (id: string, payload: { status: Order['status']; notes?: string }) => {
    const { data } = await apiClient.patch<{ success: boolean; data: { order: RawOrder } }>(
      `/orders/${id}/status`,
      payload
    );
    return mapOrder(data.data.order);
  },

  confirmFarmerOrder: async (id: string) => {
    const { data } = await apiClient.post<{ success: boolean; data: { order: RawOrder } }>(
      `/orders/${id}/farmer-confirmation`
    );
    return mapOrder(data.data.order);
  },
};
