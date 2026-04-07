import { useCallback } from "react";
import create from "zustand";
import { devtools } from "zustand/middleware";

export interface CartItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  variant?: string;
  maxQuantity?: number;
}

export interface CartTotals {
  itemCount: number;
  subtotal: number;
}

export interface CartState {
  items: CartItem[];
  isLoading: boolean;
  error: string | null;
  initialized: boolean;
  lastSyncedAt: string | null;

  totals: CartTotals;

  initializeCart: () => Promise<void>;
  addItem: (item: Omit<CartItem, "id"> & { id?: string }) => Promise<void>;
  updateItemQuantity: (id: string, quantity: number) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  clearCart: () => Promise<void>;

  setFromServer: (items: CartItem[]) => void;
  recomputeTotals: () => void;
}

const API_BASE = "/api/cart";

async function fetchJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init && init.headers ? init.headers : {}),
    },
    ...init,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Request failed with status undefined`);
  }

  return res.json() as Promise<T>;
}

function computeTotals(items: CartItem[]): CartTotals {
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  return { itemCount, subtotal };
}

interface CartApiResponse {
  items: CartItem[];
}

const useCartStore = create<CartState>()(
  devtools(
    (set, get) => ({
      items: [],
      isLoading: false,
      error: null,
      initialized: false,
      lastSyncedAt: null,
      totals: { itemCount: 0, subtotal: 0 },

      recomputeTotals: () => {
        const { items } = get();
        const totals = computeTotals(items);
        set({ totals }, false, "cart/recomputeTotals");
      },

      setFromServer: (items: CartItem[]) => {
        const totals = computeTotals(items);
        set(
          {
            items,
            totals,
            initialized: true,
            error: null,
            lastSyncedAt: new Date().toISOString(),
          },
          false,
          "cart/setFromServer"
        );
      },

      initializeCart: async () => {
        const state = get();
        if (state.initialized || state.isLoading) return;

        set({ isLoading: true, error: null }, false, "cart/initialize/start");
        try {
          const data = await fetchJson<CartApiResponse>(API_BASE, {
            method: "GET",
          });
          const items = data.items || [];
          const totals = computeTotals(items);
          set(
            {
              items,
              totals,
              initialized: true,
              isLoading: false,
              error: null,
              lastSyncedAt: new Date().toISOString(),
            },
            false,
            "cart/initialize/success"
          );
        } catch (err: unknown) {
          const message =
            err instanceof Error ? err.message : "Failed to load cart";
          set(
            {
              isLoading: false,
              error: message,
              initialized: true,
            },
            false,
            "cart/initialize/error"
          );
        }
      },

      addItem: async (itemInput: Omit<CartItem, "id"> & { id?: string }) => {
        const { items } = get();

        set({ isLoading: true, error: null }, false, "cart/addItem/start");

        try {
          const existing = items.find(
            (i) =>
              i.productId === itemInput.productId &&
              i.variant === itemInput.variant
          );

          let optimisticItems: CartItem[];
          if (existing) {
            optimisticItems = items.map((i) =>
              i.id === existing.id
                ? { ...i, quantity: i.quantity + itemInput.quantity }
                : i
            );
          } else {
            const newId = itemInput.id || `temp-undefined-undefined`;
            const newItem: CartItem = {
              id: newId,
              productId: itemInput.productId,
              name: itemInput.name,
              price: itemInput.price,
              quantity: itemInput.quantity,
              imageUrl: itemInput.imageUrl,
              variant: itemInput.variant,
              maxQuantity: itemInput.maxQuantity,
            };
            optimisticItems = [...items, newItem];
          }

          const optimisticTotals = computeTotals(optimisticItems);
          set(
            {
              items: optimisticItems,
              totals: optimisticTotals,
            },
            false,
            "cart/addItem/optimistic"
          );

          const data = await fetchJson<CartApiResponse>(API_BASE + "/items", {
            method: "POST",
            body: JSON.stringify(itemInput),
          });

          const syncedItems = data.items || [];
          const syncedTotals = computeTotals(syncedItems);
          set(
            {
              items: syncedItems,
              totals: syncedTotals,
              isLoading: false,
              error: null,
              lastSyncedAt: new Date().toISOString(),
            },
            false,
            "cart/addItem/success"
          );
        } catch (err: unknown) {
          const message =
            err instanceof Error ? err.message : "Failed to add item to cart";
          const { items: currentItems } = get();
          const currentTotals = computeTotals(currentItems);
          set(
            {
              isLoading: false,
              error: message,
              totals: currentTotals,
            },
            false,
            "cart/addItem/error"
          );
        }
      },

      updateItemQuantity: async (id: string, quantity: number) => {
        const { items } = get();
        const existing = items.find((i) => i.id === id);
        if (!existing) return;

        if (quantity <= 0) {
          await get().removeItem(id);
          return;
        }

        set(
          { isLoading: true, error: null },
          false,
          "cart/updateItemQuantity/start"
        );

        const optimisticItems = items.map((i) =>
          i.id === id ? { ...i, quantity } : i
        );
        const optimisticTotals = computeTotals(optimisticItems);
        set(
          {
            items: optimisticItems,
            totals: optimisticTotals,
          },
          false,
          "cart/updateItemQuantity/optimistic"
        );

        try {
          const data = await fetchJson<CartApiResponse>(
            `undefined/items/undefined`,
            {
              method: "PATCH",
              body: JSON.stringify({ quantity }),
            }
          );

          const syncedItems = data.items || [];
          const syncedTotals = computeTotals(syncedItems);
          set(
            {
              items: syncedItems,
              totals: syncedTotals,
              isLoading: false,
              error: null,
              lastSyncedAt: new Date().toISOString(),
            },
            false,
            "cart/updateItemQuantity/success"
          );
        } catch (err: unknown) {
          const message =
            err instanceof Error
              ? err.message
              : "Failed to update cart item quantity";
          const { items: currentItems } = get();
          const currentTotals = computeTotals(currentItems);
          set(
            {
              isLoading: false,
              error: message,
              totals: currentTotals,
            },
            false,
            "cart/updateItemQuantity/error"
          );
        }
      },

      removeItem: async (id: string) => {
        const { items } = get();
        const existing = items.find((i) => i.id === id);
        if (!existing) return;

        set({ isLoading: true, error: null }, false, "cart/removeItem/start");

        const optimisticItems = items.filter((i) => i.id !== id);
        const optimisticTotals = computeTotals(optimisticItems);
        set(
          {
            items: optimisticItems,
            totals: optimisticTotals,
          },
          false,
          "cart/removeItem/optimistic"
        );

        try {
          const data = await fetchJson<CartApiResponse>(
            `undefined/items/undefined`,
            {
              method: "DELETE",
            }
          );

          const syncedItems = data.items || [];
          const syncedTotals = computeTotals(syncedItems);
          set(
            {
              items: syncedItems,
              totals: syncedTotals,
              isLoading: false,
              error: null,
              lastSyncedAt: new Date().toISOString(),
            },
            false,
            "cart/removeItem/success"
          );
        } catch (err: unknown) {
          const message =
            err instanceof Error ? err.message : "Failed to remove cart item";
          const { items: currentItems } = get();
          const currentTotals = computeTotals(currentItems);
          set