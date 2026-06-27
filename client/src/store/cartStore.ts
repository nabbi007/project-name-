import { create } from 'zustand';

export interface CartItem {
  listingId: string;
  quantity: number;
  priceSnapshot: number;
  cropName: string;
  imageUrl?: string;
  unit: string;
  community: string;
  maxQuantity: number;
}

interface CartState {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (listingId: string) => void;
  updateQuantity: (listingId: string, quantity: number) => void;
  clearCart: () => void;
  getTotal: () => number;
  getItemCount: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],

  addItem: (item: CartItem) => {
    set((state) => {
      const existing = state.items.find((i) => i.listingId === item.listingId);
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.listingId === item.listingId
              ? { ...i, quantity: Math.min(i.quantity + item.quantity, item.maxQuantity) }
              : i
          ),
        };
      }
      return { items: [...state.items, item] };
    });
  },

  removeItem: (listingId: string) => {
    set((state) => ({
      items: state.items.filter((i) => i.listingId !== listingId),
    }));
  },

  updateQuantity: (listingId: string, quantity: number) => {
    set((state) => ({
      items: state.items.map((i) =>
        i.listingId === listingId ? { ...i, quantity: Math.max(1, quantity) } : i
      ),
    }));
  },

  clearCart: () => set({ items: [] }),

  getTotal: () => {
    return get().items.reduce((sum, item) => sum + item.priceSnapshot * item.quantity, 0);
  },

  getItemCount: () => {
    return get().items.reduce((count, item) => count + item.quantity, 0);
  },
}));
