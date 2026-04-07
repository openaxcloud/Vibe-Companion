import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  variantId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ServerCartResponse {
  items: CartItem[];
}

export interface CartState {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  isSyncing: boolean;
  lastSyncedAt: number | null;
  error: string | null;

  // Derived selectors
  getItemCount: () => number;
  getSubtotal: () => number;
  getItemById: (id: string) => CartItem | undefined;

  // Local actions
  addItemLocal: (item: Omit<CartItem, "quantity"> & { quantity?: number }) => void;
  updateItemQuantityLocal: (id: string, quantity: number) => void;
  removeItemLocal: (id: string) => void;
  clearCartLocal: () => void;

  // Server sync actions
  syncFromServer: (fetchCart: () => Promise<ServerCartResponse>) => Promise<void>;
  pushLocalChanges: (
    updateServerCart: (items: CartItem[]) => Promise<ServerCartResponse>
  ) => Promise<void>;

  // Combined high-level actions (server-first with local fallback)
  addItem: (
    item: Omit<CartItem, "quantity"> & { quantity?: number },
    updateServerCart?: (items: CartItem[]) => Promise<ServerCartResponse>
  ) => Promise<void>;
  updateItemQuantity: (
    id: string,
    quantity: number,
    updateServerCart?: (items: CartItem[]) => Promise<ServerCartResponse>
  ) => Promise<void>;
  removeItem: (
    id: string,
    updateServerCart?: (items: CartItem[]) => Promise<ServerCartResponse>
  ) => Promise<void>;
  clearCart: (
    updateServerCart?: (items: CartItem[]) => Promise<ServerCartResponse>
  ) => Promise<void>;

  setError: (error: string | null) => void;
}

const calculateItemCount = (items: CartItem[]): number =>
  items.reduce((count, item) => count + item.quantity, 0);

const calculateSubtotal = (items: CartItem[]): number =>
  items.reduce((sum, item) => sum + item.price * item.quantity, 0);

const findMatchingItemIndex = (items: CartItem[], item: Omit<CartItem, "quantity">): number => {
  return items.findIndex(existing => {
    const sameProduct = existing.productId === item.productId;
    const sameVariant = (existing.variantId ?? null) === (item.variantId ?? null);
    const sameMetadata =
      JSON.stringify(existing.metadata ?? {}) === JSON.stringify(item.metadata ?? {});
    return sameProduct && sameVariant && sameMetadata;
  });
};

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      itemCount: 0,
      subtotal: 0,
      isSyncing: false,
      lastSyncedAt: null,
      error: null,

      getItemCount: () => get().itemCount,
      getSubtotal: () => get().subtotal,
      getItemById: (id: string) => get().items.find(item => item.id === id),

      addItemLocal: (item) => {
        set(state => {
          const quantityToAdd = item.quantity && item.quantity > 0 ? item.quantity : 1;
          const itemsCopy = [...state.items];

          const index = findMatchingItemIndex(itemsCopy, item as CartItem);
          if (index !== -1) {
            itemsCopy[index] = {
              ...itemsCopy[index],
              quantity: itemsCopy[index].quantity + quantityToAdd,
            };
          } else {
            const newItem: CartItem = {
              ...item,
              id: item.id ?? crypto.randomUUID(),
              quantity: quantityToAdd,
            };
            itemsCopy.push(newItem);
          }

          return {
            items: itemsCopy,
            itemCount: calculateItemCount(itemsCopy),
            subtotal: calculateSubtotal(itemsCopy),
            error: null,
          };
        });
      },

      updateItemQuantityLocal: (id, quantity) => {
        if (quantity <= 0) {
          set(state => {
            const items = state.items.filter(item => item.id !== id);
            return {
              items,
              itemCount: calculateItemCount(items),
              subtotal: calculateSubtotal(items),
              error: null,
            };
          });
          return;
        }

        set(state => {
          const items = state.items.map(item =>
            item.id === id ? { ...item, quantity } : item
          );
          return {
            items,
            itemCount: calculateItemCount(items),
            subtotal: calculateSubtotal(items),
            error: null,
          };
        });
      },

      removeItemLocal: (id) => {
        set(state => {
          const items = state.items.filter(item => item.id !== id);
          return {
            items,
            itemCount: calculateItemCount(items),
            subtotal: calculateSubtotal(items),
            error: null,
          };
        });
      },

      clearCartLocal: () => {
        set({
          items: [],
          itemCount: 0,
          subtotal: 0,
          error: null,
        });
      },

      syncFromServer: async (fetchCart) => {
        set({ isSyncing: true, error: null });
        try {
          const serverCart = await fetchCart();
          const items = serverCart.items ?? [];
          set({
            items,
            itemCount: calculateItemCount(items),
            subtotal: calculateSubtotal(items),
            isSyncing: false,
            lastSyncedAt: Date.now(),
            error: null,
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Failed to sync cart from server";
          set({ isSyncing: false, error: message });
        }
      },

      pushLocalChanges: async (updateServerCart) => {
        set({ isSyncing: true, error: null });
        try {
          const currentItems = get().items;
          const serverCart = await updateServerCart(currentItems);
          const items = serverCart.items ?? [];
          set({
            items,
            itemCount: calculateItemCount(items),
            subtotal: calculateSubtotal(items),
            isSyncing: false,
            lastSyncedAt: Date.now(),
            error: null,
          });
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Failed to push cart changes to server";
          set({ isSyncing: false, error: message });
        }
      },

      addItem: async (item, updateServerCart) => {
        // Optimistic local update
        get().addItemLocal(item);

        if (!updateServerCart) return;

        try {
          await get().pushLocalChanges(updateServerCart);
        } catch {
          // error already stored in state by pushLocalChanges
        }
      },

      updateItemQuantity: async (id, quantity, updateServerCart) => {
        // Optimistic local update
        get().updateItemQuantityLocal(id, quantity);

        if (!updateServerCart) return;

        try {
          await get().pushLocalChanges(updateServerCart);
        } catch {
          // error already stored in state by pushLocalChanges
        }
      },

      removeItem: async (id, updateServerCart) => {
        // Optimistic local update
        get().removeItemLocal(id);

        if (!updateServerCart) return;

        try {
          await get().pushLocalChanges(updateServerCart);
        } catch {
          // error already stored in state by pushLocalChanges
        }
      },

      clearCart: async (updateServerCart) => {
        // Optimistic local update
        get().clearCartLocal();

        if (!updateServerCart) return;

        try {
          await get().pushLocalChanges(updateServerCart);
        } catch {
          // error already stored in state by pushLocalChanges
        }
      },

      setError: (error) => set({ error }),
    }),
    {
      name: "cart-store",
      partialize: (state) => ({
        items: state.items,
        itemCount: state.itemCount,
        subtotal: state.subtotal,
        lastSyncedAt: state.lastSyncedAt,
      }),
      version: 1,
    }
  )
);