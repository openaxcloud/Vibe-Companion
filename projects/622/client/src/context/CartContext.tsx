import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef
} from "react";

type CartItem = {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  variant?: string;
};

type RawCartItem = Omit<CartItem, "id"> & { id?: string };

type CartState = {
  items: CartItem[];
  isLoading: boolean;
  isSyncing: boolean;
  error: string | null;
  lastSyncedAt: string | null;
};

type CartTotals = {
  itemCount: number;
  subtotal: number;
};

type CartContextValue = {
  items: CartItem[];
  totals: CartTotals;
  isLoading: boolean;
  isSyncing: boolean;
  error: string | null;
  addItem: (item: RawCartItem, quantity?: number) => Promise<void>;
  removeItem: (productId: string, variant?: string) => Promise<void>;
  updateQuantity: (productId: string, quantity: number, variant?: string) => Promise<void>;
  clearCart: () => Promise<void>;
  refreshCart: () => Promise<void>;
  setAuthenticated: (authenticated: boolean, token?: string | null) => void;
};

type CartAction =
  | { type: "INIT_FROM_STORAGE"; payload: { items: CartItem[] } }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_SYNCING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "SET_ITEMS"; payload: CartItem[] }
  | { type: "CLEAR_CART" }
  | { type: "MERGE_ITEMS"; payload: CartItem[] }
  | { type: "SET_LAST_SYNCED"; payload: string | null };

type CartProviderProps = {
  children: React.ReactNode;
};

type BackendCartItemPayload = {
  productId: string;
  quantity: number;
  variant?: string;
};

type BackendCartResponse = {
  items: Array<{
    id: string;
    productId: string;
    name: string;
    price: number;
    quantity: number;
    imageUrl?: string;
    variant?: string;
  }>;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);

const LOCAL_STORAGE_KEY = "cart:guest";
const SYNC_DEBOUNCE_MS = 800;

const initialState: CartState = {
  items: [],
  isLoading: false,
  isSyncing: false,
  error: null,
  lastSyncedAt: null
};

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "INIT_FROM_STORAGE":
      return { ...state, items: action.payload.items || [] };
    case "SET_LOADING":
      return { ...state, isLoading: action.payload };
    case "SET_SYNCING":
      return { ...state, isSyncing: action.payload };
    case "SET_ERROR":
      return { ...state, error: action.payload };
    case "SET_ITEMS":
      return { ...state, items: action.payload };
    case "CLEAR_CART":
      return { ...state, items: [] };
    case "MERGE_ITEMS": {
      const existing = [...state.items];
      const merged = [...existing];

      action.payload.forEach((newItem) => {
        const index = merged.findIndex(
          (item) =>
            item.productId === newItem.productId &&
            (item.variant || "") === (newItem.variant || "")
        );
        if (index >= 0) {
          const existingItem = merged[index];
          merged[index] = {
            ...existingItem,
            quantity: existingItem.quantity + newItem.quantity
          };
        } else {
          merged.push(newItem);
        }
      });

      return { ...state, items: merged };
    }
    case "SET_LAST_SYNCED":
      return { ...state, lastSyncedAt: action.payload };
    default:
      return state;
  }
}

function readGuestCartFromStorage(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<CartItem>[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && item.productId && typeof item.quantity === "number")
      .map((item, index) => ({
        id: item.id ?? `guest-undefined-undefined-undefined`,
        productId: String(item.productId),
        name: String(item.name ?? ""),
        price: typeof item.price === "number" ? item.price : 0,
        quantity: item.quantity ?? 1,
        imageUrl: item.imageUrl,
        variant: item.variant
      }));
  } catch {
    return [];
  }
}

function writeGuestCartToStorage(items: CartItem[]): void {
  if (typeof window === "undefined") return;
  try {
    const minimal = items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      variant: item.variant
    }));
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(minimal));
  } catch {
    // ignore
  }
}

async function fetchJson<T>(
  input: RequestInfo,
  init?: RequestInit & { token?: string | null }
): Promise<T> {
  const { token, ...rest } = init || {};
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(rest.headers || {})
  };
  if (token) {
    headers.Authorization = `Bearer undefined`;
  }
  const response = await fetch(input, {
    ...rest,
    headers
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with status undefined`);
  }
  return (await response.json()) as T;
}

function computeTotals(items: CartItem[]): CartTotals {
  return items.reduce(
    (acc, item) => {
      acc.itemCount += item.quantity;
      acc.subtotal += item.price * item.quantity;
      return acc;
    },
    { itemCount: 0, subtotal: 0 }
  );
}

export const CartProvider: React.FC<CartProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(cartReducer, initialState);
  const authenticatedRef = useRef<boolean>(false);
  const tokenRef = useRef<string | null>(null);
  const syncTimeoutRef = useRef<number | null>(null);
  const pendingSyncRef = useRef<boolean>(false);

  const totals = useMemo(() => computeTotals(state.items), [state.items]);

  useEffect(() => {
    const items = readGuestCartFromStorage();
    dispatch({ type: "INIT_FROM_STORAGE", payload: { items } });
  }, []);

  useEffect(() => {
    if (!authenticatedRef.current) {
      writeGuestCartToStorage(state.items);
    }
  }, [state.items]);

  const scheduleSync = useCallback(() => {
    if (!authenticatedRef.current || !tokenRef.current) return;
    if (syncTimeoutRef.current) {
      window.clearTimeout(syncTimeoutRef.current);
    }
    pendingSyncRef.current = true;
    syncTimeoutRef.current = window.setTimeout(async () => {
      pendingSyncRef.current = false;
      try {
        dispatch({ type: "SET_SYNCING", payload: true });
        const payload: { items: BackendCartItemPayload[] } = {
          items: state.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            variant: item.variant
          }))
        };
        const data = await fetchJson<BackendCartResponse>("/api/cart", {
          method: "PUT",
          body: JSON.stringify(payload),
          token: tokenRef.current
        });
        const normalizedItems: CartItem[] = data.items.map((item) => ({
          id: item.id,
          productId: item.productId,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          imageUrl: item.imageUrl,
          variant: item.variant
        }));
        dispatch({ type: "SET_ITEMS", payload: normalizedItems });
        dispatch({ type: "SET_LAST_SYNCED", payload: new Date().toISOString() });
        dispatch({ type: "SET_ERROR", payload: null });
      } catch (error) {
        dispatch({
          type: "SET_ERROR",
          payload: error instanceof Error ? error.message : "Failed to sync cart"
        });
      } finally {
        dispatch({ type: "SET_SYNCING", payload: false });
      }
    }, SYNC_DEBOUNCE_MS);
  }, [state.items]);

  const hydrateFromBackend = useCallback(
    async (token: string, mergeGuest: boolean) => {
      dispatch({ type: "SET_LOADING", payload: true });
      try {
        const data = await fetchJson<BackendCartResponse>("/api/cart", {
          method: "GET",
          token
        });

        let backendItems: CartItem[] = data.items.map((item) => ({
          id