import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

export interface CartItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  variantId?: string | null;
  variantName?: string | null;
  maxQuantity?: number | null;
}

export interface CartTotals {
  subtotal: number;
  tax: number;
  shipping: number;
  discount: number;
  total: number;
  currency: string;
}

export interface CartState {
  items: CartItem[];
  totals: CartTotals | null;
  isLoading: boolean;
  isSyncing: boolean;
  error: string | null;
  lastSyncedAt: string | null;
  optimisticIdCounter: number;
}

export interface CartStore extends CartState {
  initializeCart: () => Promise<void>;
  refreshCart: () => Promise<void>;
  addItem: (input: {
    productId: string;
    name: string;
    price: number;
    quantity?: number;
    imageUrl?: string;
    variantId?: string | null;
    variantName?: string | null;
    maxQuantity?: number | null;
  }) => Promise<void>;
  updateItemQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  setError: (error: string | null) => void;
  getItemCount: () => number;
  getItemByProduct: (productId: string, variantId?: string | null) => CartItem | undefined;
  getTotals: () => CartTotals;
}

const DEFAULT_CURRENCY = "USD";

const initialTotals: CartTotals = {
  subtotal: 0,
  tax: 0,
  shipping: 0,
  discount: 0,
  total: 0,
  currency: DEFAULT_CURRENCY,
};

async function apiFetch<T = unknown>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(input, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!res.ok) {
    let message = `Request failed with status undefined`;
    try {
      const data = await res.json();
      if (data && typeof data.message === "string") {
        message = data.message;
      }
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  if (res.status === 204) return undefined as T;

  return (await res.json()) as T;
}

interface BackendCartItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  variantId?: string | null;
  variantName?: string | null;
  maxQuantity?: number | null;
}

interface BackendCartResponse {
  items: BackendCartItem[];
  totals: CartTotals;
  lastSyncedAt?: string;
}

function mapBackendCartToState(response: BackendCartResponse | null): {
  items: CartItem[];
  totals: CartTotals;
  lastSyncedAt: string | null;
} {
  if (!response) {
    return {
      items: [],
      totals: initialTotals,
      lastSyncedAt: null,
    };
  }

  const items: CartItem[] = response.items.map((item) => ({
    id: item.id,
    productId: item.productId,
    name: item.name,
    price: item.price,
    quantity: item.quantity,
    imageUrl: item.imageUrl,
    variantId: item.variantId ?? null,
    variantName: item.variantName ?? null,
    maxQuantity: item.maxQuantity ?? null,
  }));

  const totals: CartTotals = {
    subtotal: response.totals?.subtotal ?? 0,
    tax: response.totals?.tax ?? 0,
    shipping: response.totals?.shipping ?? 0,
    discount: response.totals?.discount ?? 0,
    total: response.totals?.total ?? 0,
    currency: response.totals?.currency ?? DEFAULT_CURRENCY,
  };

  return {
    items,
    totals,
    lastSyncedAt: response.lastSyncedAt ?? new Date().toISOString(),
  };
}

function recalcTotalsFromItems(items: CartItem[], currency = DEFAULT_CURRENCY): CartTotals {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const taxRate = 0.0;
  const shippingFlat = 0.0;
  const discount = 0.0;
  const tax = subtotal * taxRate;
  const shipping = items.length > 0 ? shippingFlat : 0;
  const total = subtotal + tax + shipping - discount;

  return {
    subtotal,
    tax,
    shipping,
    discount,
    total,
    currency,
  };
}

export const useCartStore = create<CartStore>()(
  devtools(
    persist(
      immer((set, get) => ({
        items: [],
        totals: initialTotals,
        isLoading: false,
        isSyncing: false,
        error: null,
        lastSyncedAt: null,
        optimisticIdCounter: 0,

        initializeCart: async () => {
          const currentState = get();
          if (currentState.items.length > 0 && currentState.lastSyncedAt) {
            return;
          }
          set((state) => {
            state.isLoading = true;
            state.error = null;
          });
          try {
            const response = await apiFetch<BackendCartResponse | null>("/api/cart");
            const { items, totals, lastSyncedAt } = mapBackendCartToState(response);
            set((state) => {
              state.items = items;
              state.totals = totals;
              state.lastSyncedAt = lastSyncedAt;
              state.error = null;
            });
          } catch (err) {
            set((state) => {
              state.error = err instanceof Error ? err.message : "Failed to load cart";
            });
          } finally {
            set((state) => {
              state.isLoading = false;
            });
          }
        },

        refreshCart: async () => {
          set((state) => {
            state.isSyncing = true;
          });
          try {
            const response = await apiFetch<BackendCartResponse | null>("/api/cart");
            const { items, totals, lastSyncedAt } = mapBackendCartToState(response);
            set((state) => {
              state.items = items;
              state.totals = totals;
              state.lastSyncedAt = lastSyncedAt;
              state.error = null;
            });
          } catch (err) {
            set((state) => {
              state.error = err instanceof Error ? err.message : "Failed to refresh cart";
            });
          } finally {
            set((state) => {
              state.isSyncing = false;
            });
          }
        },

        addItem: async (input) => {
          const {
            productId,
            name,
            price,
            quantity = 1,
            imageUrl,
            variantId = null,
            variantName = null,
            maxQuantity = null,
          } = input;

          if (quantity <= 0) {
            return;
          }

          const prevState = get();

          const existingIndex = prevState.items.findIndex(
            (item) =>
              item.productId === productId &&
              (item.variantId ?? null) === (variantId ?? null)
          );

          let optimisticItemId: string | null = null;

          set((state) => {
            state.error = null;
            state.isSyncing = true;
            if (existingIndex >= 0) {
              const existing = state.items[existingIndex];
              const newQty = existing.quantity + quantity;
              if (existing.maxQuantity != null) {
                existing.quantity = Math.min(newQty, existing.maxQuantity);
              } else {
                existing.quantity = newQty;
              }
            } else {
              const newId = `optimistic-undefined`;
              optimisticItemId = newId;
              state.optimisticIdCounter += 1;
              state.items.push({
                id: newId,
                productId,
                name,
                price,
                quantity,
                imageUrl,
                variantId,
                variantName,
                maxQuantity,
              });
            }
            state.totals = recalcTotalsFromItems(state.items, state.totals.currency);
          });

          try {
            const response = await apiFetch<BackendCartResponse>("/api/cart/items", {
              method: "POST",
              body: JSON.stringify({
                productId,
                quantity,
                variantId,
              }),
            });
            const { items, totals, lastSyncedAt } = mapBackendCartToState(response);
            set((state) => {
              state.items = items;
              state.totals = totals;
              state.lastSyncedAt = lastSyncedAt;
              state.error = null;
            });
          } catch (err) {
            set((state) => {