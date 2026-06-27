import apiClient from './api-client';

// ─── Types ───────────────────────────────────────────────────
export interface Order {
  _id: string;
  buyer: string | { _id: string; name: string; phone: string };
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
  notes?: string;
  status: 'PLACED' | 'CONFIRMED' | 'AWAITING_COLLECTION' | 'COLLECTED' | 'CANCELLED' | 'REJECTED';
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

// ─── API Functions ───────────────────────────────────────────
export const ordersApi = {
  createOrder: async (payload: CreateOrderPayload) => {
    const { data } = await apiClient.post<{ success: boolean; data: { order: Order } }>('/orders', payload);
    return data;
  },

  getMyOrders: async () => {
    const { data } = await apiClient.get<{ success: boolean; data: { orders: Order[] } }>('/orders/mine');
    return data;
  },

  getOrder: async (id: string) => {
    const { data } = await apiClient.get<{ success: boolean; data: { order: Order } }>(`/orders/${id}`);
    return data;
  },

  cancelOrder: async (id: string) => {
    const { data } = await apiClient.patch<{ success: boolean; data: { order: Order } }>(`/orders/${id}/cancel`);
    return data;
  },
};
