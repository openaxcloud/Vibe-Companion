import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

export type CartItem = {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  variantId?: string;
  maxQuantity?: number;
};

export type CartSummary = {
  itemCount: number;
  totalQuantity: number;
  subtotal: number;
};

export type CartSyncStatus = "idle" | "syncing" | "error";

export interface CartState {
  items: Record<string, CartItem>;
  lastSyncedAt: number | null;
  syncStatus: CartSyncStatus;
  syncError: string | null;
  isHydrated: boolean;

  // Derived selectors
  getSummary: () => CartSummary;
  getItemById: (id: string) => CartItem | undefined;
  hasItem: (id: string) => boolean;

  // Optimistic actions
  addItemOptimistic: (
    item: Omit<CartItem, "quantity"> & { quantity?: number }
  ) => Promise<void>;
  updateItemQuantityOptimistic: (id: string, quantity: number) => Promise<void>;
  removeItemOptimistic: (id: string) => Promise<void>;
  clearCartOptimistic: () => Promise<void>;

  // Internal / low-level actions
  setItems: (items: CartItem[] | Record<string, CartItem>) => void;
  setSyncStatus: (status: CartSyncStatus, error?: string | null) => void;
  markHydrated: () => void;
}

type CartAPIResponse = {
  items: CartItem[];
  updatedAt: number;
};

const API_BASE =
  (typeof window !== "undefined" && (window as any).__API_BASE__) ||
  "/api";

async function fetchWithError<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  if (!res.ok) {
    let message = `Request failed with status undefined`;
    try {
      const data = await res.json();
      if (data && typeof data.message === "string") {
        message = data.message;
      }
    } catch {
      // ignore json parse error
    }
    const err = new Error(message);
    (err as any).status = res.status;
    throw err;
  }
  return res.json() as Promise<T>;
}

function computeSummary(items: Record<string, CartItem>): CartSummary {
  let itemCount = 0;
  let totalQuantity = 0;
  let subtotal = 0;

  for (const item of Object.values(items)) {
    itemCount += 1;
    totalQuantity += item.quantity;
    subtotal += item.price * item.quantity;
  }

  return {
    itemCount,
    totalQuantity,
    subtotal,
  };
}

async function syncCartWithBackend(
  get: () => CartState,
  set: (fn: (state: CartState) => Partial<CartState> | void) => void
): Promise<void> {
  const state = get();
  const itemsArray = Object.values(state.items);

  set((s) => ({
    ...s,
    syncStatus: "syncing",
    syncError: null,
  }));

  try {
    const payload = {
      items: itemsArray.map((i) => ({
        id: i.id,
        productId: i.productId,
        name: i.name,
        price: i.price,
        quantity: i.quantity,
        imageUrl: i.imageUrl,
        variantId: i.variantId,
      })),
    };

    const result = await fetchWithError<CartAPIResponse>(`undefined/cart`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      credentials: "include",
    });

    const nextItems: Record<string, CartItem> = {};
    for (const item of result.items) {
      nextItems[item.id] = item;
    }

    set((s) => ({
      ...s,
      items: nextItems,
      lastSyncedAt: result.updatedAt,
      syncStatus: "idle",
      syncError: null,
    }));
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to sync cart with server";
    set((s) => ({
      ...s,
      syncStatus: "error",
      syncError: message,
    }));
  }
}

export const useCartStore = create<CartState>()(
  devtools(
    persist(
      (set, get) => ({
        items: {},
        lastSyncedAt: null,
        syncStatus: "idle",
        syncError: null,
        isHydrated: false,

        getSummary: () => {
          const state = get();
          return computeSummary(state.items);
        },

        getItemById: (id: string) => {
          return get().items[id];
        },

        hasItem: (id: string) => {
          return Boolean(get().items[id]);
        },

        setItems: (items: CartItem[] | Record<string, CartItem>) => {
          let record: Record<string, CartItem> = {};
          if (Array.isArray(items)) {
            for (const item of items) {
              record[item.id] = item;
            }
          } else {
            record = { ...items };
          }
          set((state) => ({
            ...state,
            items: record,
          }));
        },

        setSyncStatus: (status: CartSyncStatus, error?: string | null) => {
          set((state) => ({
            ...state,
            syncStatus: status,
            syncError: error ?? null,
          }));
        },

        markHydrated: () => {
          set((state) => ({
            ...state,
            isHydrated: true,
          }));
        },

        addItemOptimistic: async (
          item: Omit<CartItem, "quantity"> & { quantity?: number }
        ) => {
          const current = get();
          const defaultQuantity = item.quantity ?? 1;
          const existing = current.items[item.id];

          const nextItems: Record<string, CartItem> = { ...current.items };
          if (existing) {
            nextItems[item.id] = {
              ...existing,
              quantity: existing.quantity + defaultQuantity,
            };
          } else {
            nextItems[item.id] = {
              ...item,
              quantity: defaultQuantity,
            };
          }

          set((state) => ({
            ...state,
            items: nextItems,
          }));

          await syncCartWithBackend(get, set);
        },

        updateItemQuantityOptimistic: async (id: string, quantity: number) => {
          const current = get();
          const existing = current.items[id];
          if (!existing) {
            return;
          }

          const nextItems: Record<string, CartItem> = { ...current.items };
          if (quantity <= 0) {
            delete nextItems[id];
          } else {
            const maxQuantity =
              typeof existing.maxQuantity === "number"
                ? Math.max(1, existing.maxQuantity)
                : undefined;

            const clampedQuantity =
              typeof maxQuantity === "number"
                ? Math.min(maxQuantity, quantity)
                : quantity;

            nextItems[id] = {
              ...existing,
              quantity: clampedQuantity,
            };
          }

          set((state) => ({
            ...state,
            items: nextItems,
          }));

          await syncCartWithBackend(get, set);
        },

        removeItemOptimistic: async (id: string) => {
          const current = get();
          if (!current.items[id]) {
            return;
          }

          const nextItems: Record<string, CartItem> = { ...current.items };
          delete nextItems[id];

          set((state) => ({
            ...state,
            items: nextItems,
          }));

          await syncCartWithBackend(get, set);
        },

        clearCartOptimistic: async () => {
          const current = get();
          if (Object.keys(current.items).length === 0) {
            return;
          }

          set((state) => ({
            ...state,
            items: {},
          }));

          try {
            set((s) => ({
              ...s,
              syncStatus: "syncing",
              syncError: null,
            }));

            await fetchWithError<CartAPIResponse>(`undefined/cart`, {
              method: "DELETE",
              credentials: "include",
            });

            set((s) => ({
              ...s,
              lastSyncedAt: Date.now(),
              syncStatus: "idle",
              syncError: null,
            }));
          } catch (error: unknown) {
            const message =
              error instanceof Error
                ? error.message
                : "Failed to clear cart on server";
            set((s) => ({
              ...s,
              syncStatus: "error",
              syncError: message,
            }));
          }
        },
      }),
      {
        name: "cart-store",
        partialize: (state) => ({
          items: state.items,
          lastSyncedAt: state.lastSyncedAt,
        }),
        onRehydrateStorage: () => (state) => {
          if (!state) return;
          state.markHydrated();
        },
      }
    ),
    {
      name: "CartStore",
    }
  )
);