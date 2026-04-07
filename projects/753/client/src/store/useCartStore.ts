import { create } from "zustand";
import { devtools } from "zustand/middleware";

export interface CartItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  maxQuantity?: number;
}

export interface CartTotals {
  itemCount: number;
  subtotal: number;
}

interface CartState {
  items: CartItem[];
  loading: boolean;
  error: string | null;
  initialized: boolean;
  totals: CartTotals;
  fetchCart: () => Promise<void>;
  addItem: (
    productId: string,
    quantity?: number,
    options?: { name?: string; price?: number; imageUrl?: string; maxQuantity?: number }
  ) => Promise<void>;
  updateItemQuantity: (cartItemId: string, quantity: number) => Promise<void>;
  removeItem: (cartItemId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  setItemLocally: (item: CartItem) => void;
  setItemsLocally: (items: CartItem[]) => void;
}

const API_BASE = "/api/cart";

const calculateTotals = (items: CartItem[]): CartTotals => {
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  return { itemCount, subtotal };
};

export const useCartStore = create<CartState>()(
  devtools(
    (set, get) => ({
      items: [],
      loading: false,
      error: null,
      initialized: false,
      totals: { itemCount: 0, subtotal: 0 },

      fetchCart: async () => {
        const { initialized, loading } = get();
        if (initialized || loading) return;

        set({ loading: true, error: null });

        try {
          const res = await fetch(API_BASE, {
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
            },
          });

          if (!res.ok) {
            throw new Error("Failed to fetch cart");
          }

          const data: { items: CartItem[] } = await res.json();
          const totals = calculateTotals(data.items);
          set({ items: data.items, totals, initialized: true, loading: false, error: null });
        } catch (error: any) {
          set({ loading: false, error: error?.message ?? "Failed to fetch cart" });
        }
      },

      addItem: async (
        productId: string,
        quantity: number = 1,
        options?: { name?: string; price?: number; imageUrl?: string; maxQuantity?: number }
      ) => {
        set({ loading: true, error: null });

        try {
          const res = await fetch(API_BASE + "/items", {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              productId,
              quantity,
              ...options,
            }),
          });

          if (!res.ok) {
            throw new Error("Failed to add item to cart");
          }

          const data: { items: CartItem[] } = await res.json();
          const totals = calculateTotals(data.items);
          set({ items: data.items, totals, initialized: true, loading: false, error: null });
        } catch (error: any) {
          set({ loading: false, error: error?.message ?? "Failed to add item to cart" });
        }
      },

      updateItemQuantity: async (cartItemId: string, quantity: number) => {
        if (quantity <= 0) {
          await get().removeItem(cartItemId);
          return;
        }

        set({ loading: true, error: null });

        try {
          const res = await fetch(`undefined/items/undefined`, {
            method: "PATCH",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ quantity }),
          });

          if (!res.ok) {
            throw new Error("Failed to update cart item");
          }

          const data: { items: CartItem[] } = await res.json();
          const totals = calculateTotals(data.items);
          set({ items: data.items, totals, initialized: true, loading: false, error: null });
        } catch (error: any) {
          set({ loading: false, error: error?.message ?? "Failed to update cart item" });
        }
      },

      removeItem: async (cartItemId: string) => {
        set({ loading: true, error: null });

        try {
          const res = await fetch(`undefined/items/undefined`, {
            method: "DELETE",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
            },
          });

          if (!res.ok) {
            throw new Error("Failed to remove cart item");
          }

          const data: { items: CartItem[] } = await res.json();
          const totals = calculateTotals(data.items);
          set({ items: data.items, totals, initialized: true, loading: false, error: null });
        } catch (error: any) {
          set({ loading: false, error: error?.message ?? "Failed to remove cart item" });
        }
      },

      clearCart: async () => {
        set({ loading: true, error: null });

        try {
          const res = await fetch(API_BASE, {
            method: "DELETE",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
            },
          });

          if (!res.ok) {
            throw new Error("Failed to clear cart");
          }

          set({ items: [], totals: { itemCount: 0, subtotal: 0 }, loading: false, error: null });
        } catch (error: any) {
          set({ loading: false, error: error?.message ?? "Failed to clear cart" });
        }
      },

      setItemLocally: (item: CartItem) => {
        const items = get().items;
        const existingIndex = items.findIndex((i) => i.id === item.id);

        let newItems: CartItem[];
        if (existingIndex >= 0) {
          newItems = [...items];
          newItems[existingIndex] = item;
        } else {
          newItems = [...items, item];
        }

        const totals = calculateTotals(newItems);
        set({ items: newItems, totals });
      },

      setItemsLocally: (items: CartItem[]) => {
        const totals = calculateTotals(items);
        set({ items, totals });
      },
    }),
    {
      name: "cart-store",
    }
  )
);