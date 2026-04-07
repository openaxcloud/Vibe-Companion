import create from "zustand";
import { persist } from "zustand/middleware";

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  variantId?: string;
  metadata?: Record<string, unknown>;
}

export interface CartState {
  items: CartItem[];
  isCheckingOut: boolean;
  lastSyncAt: string | null;
  error: string | null;
  addItem: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  removeItem: (id: string, variantId?: string) => void;
  updateQuantity: (id: string, quantity: number, variantId?: string) => void;
  clearCart: () => void;
  getItemCount: () => number;
  getSubtotal: () => number;
  getItemTotal: (id: string, variantId?: string) => number;
  checkout: () => Promise<void>;
  restoreFromServer: () => Promise<void>;
  setError: (error: string | null) => void;
}

type CartStore = CartState;

const LOCAL_STORAGE_KEY = "app_cart_v1";

const findItemIndex = (
  items: CartItem[],
  id: string,
  variantId?: string
): number => {
  return items.findIndex(
    (item) =>
      item.id === id &&
      ((variantId === undefined && item.variantId === undefined) ||
        item.variantId === variantId)
  );
};

const calculateSubtotal = (items: CartItem[]): number => {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
};

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      isCheckingOut: false,
      lastSyncAt: null,
      error: null,

      addItem: (item, quantity = 1) => {
        if (quantity <= 0) return;

        set((state) => {
          const items = [...state.items];
          const index = findItemIndex(items, item.id, item.variantId);

          if (index === -1) {
            items.push({
              ...item,
              quantity
            });
          } else {
            const existing = items[index];
            items[index] = {
              ...existing,
              quantity: existing.quantity + quantity
            };
          }

          return {
            ...state,
            items,
            error: null
          };
        });
      },

      removeItem: (id, variantId) => {
        set((state) => {
          const items = state.items.filter(
            (item) =>
              !(
                item.id === id &&
                ((variantId === undefined && item.variantId === undefined) ||
                  item.variantId === variantId)
              )
          );
          return {
            ...state,
            items,
            error: null
          };
        });
      },

      updateQuantity: (id, quantity, variantId) => {
        if (quantity < 0) return;

        set((state) => {
          const items = [...state.items];
          const index = findItemIndex(items, id, variantId);

          if (index === -1) {
            return state;
          }

          if (quantity === 0) {
            items.splice(index, 1);
          } else {
            items[index] = {
              ...items[index],
              quantity
            };
          }

          return {
            ...state,
            items,
            error: null
          };
        });
      },

      clearCart: () => {
        set((state) => ({
          ...state,
          items: [],
          error: null
        }));
      },

      getItemCount: () => {
        return get().items.reduce((count, item) => count + item.quantity, 0);
      },

      getSubtotal: () => {
        return calculateSubtotal(get().items);
      },

      getItemTotal: (id, variantId) => {
        const item = get().items.find(
          (i) =>
            i.id === id &&
            ((variantId === undefined && i.variantId === undefined) ||
              i.variantId === variantId)
        );
        if (!item) return 0;
        return item.price * item.quantity;
      },

      setError: (error) => {
        set((state) => ({
          ...state,
          error
        }));
      },

      checkout: async () => {
        const state = get();
        if (state.isCheckingOut || state.items.length === 0) {
          return;
        }

        set((s) => ({
          ...s,
          isCheckingOut: true,
          error: null
        }));

        try {
          const response = await fetch("/api/cart/checkout", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              items: state.items,
              subtotal: calculateSubtotal(state.items)
            }),
            credentials: "include"
          });

          if (!response.ok) {
            const errorBody = await response.json().catch(() => null);
            const message =
              (errorBody && (errorBody.message as string)) ||
              "Checkout failed. Please try again.";
            throw new Error(message);
          }

          set((s) => ({
            ...s,
            items: [],
            isCheckingOut: false,
            lastSyncAt: new Date().toISOString(),
            error: null
          }));
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Checkout failed.";
          set((s) => ({
            ...s,
            isCheckingOut: false,
            error: message
          }));
        }
      },

      restoreFromServer: async () => {
        try {
          const response = await fetch("/api/cart", {
            method: "GET",
            headers: {
              "Content-Type": "application/json"
            },
            credentials: "include"
          });

          if (!response.ok) {
            return;
          }

          const data = (await response.json()) as {
            items?: CartItem[];
          };

          if (Array.isArray(data.items)) {
            set((state) => ({
              ...state,
              items: data.items ?? [],
              lastSyncAt: new Date().toISOString(),
              error: null
            }));
          }
        } catch {
          // Ignore restore errors; user can continue with local cart
        }
      }
    }),
    {
      name: LOCAL_STORAGE_KEY,
      getStorage: () => localStorage,
      partialize: (state) => ({
        items: state.items,
        lastSyncAt: state.lastSyncAt
      })
    }
  )
);

export default useCartStore;