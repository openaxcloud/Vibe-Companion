import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from './store';

export interface CartItem {
  id: string;
  name: string;
  price: number;
  imageUrl?: string;
  quantity: number;
  maxQuantity?: number;
  variantId?: string | null;
}

export interface CartValidationIssue {
  itemId: string;
  type: 'OUT_OF_STOCK' | 'PRICE_CHANGED' | 'QUANTITY_ADJUSTED' | 'REMOVED' | 'UNKNOWN';
  message: string;
  newPrice?: number;
  newQuantity?: number;
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
  totals: CartTotals;
  isValidating: boolean;
  isCheckingOut: boolean;
  validationIssues: CartValidationIssue[];
  lastValidatedAt: string | null;
  error: string | null;
}

const CART_STORAGE_KEY = 'app_cart_state_v1';

const defaultTotals: CartTotals = {
  subtotal: 0,
  tax: 0,
  shipping: 0,
  discount: 0,
  total: 0,
  currency: 'USD',
};

const loadCartFromStorage = (): CartState | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CartState>;
    if (!parsed || !Array.isArray(parsed.items)) return null;
    return {
      items: parsed.items || [],
      totals: parsed.totals || defaultTotals,
      isValidating: false,
      isCheckingOut: false,
      validationIssues: [],
      lastValidatedAt: parsed.lastValidatedAt || null,
      error: null,
    };
  } catch {
    return null;
  }
};

const saveCartToStorage = (state: CartState): void => {
  if (typeof window === 'undefined') return;
  try {
    const dataToPersist: Partial<CartState> = {
      items: state.items,
      totals: state.totals,
      lastValidatedAt: state.lastValidatedAt,
    };
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(dataToPersist));
  } catch {
    // ignore storage errors
  }
};

const calculateTotals = (items: CartItem[]): CartTotals => {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const taxRate = 0.1;
  const tax = subtotal * taxRate;
  const shipping = subtotal > 100 ? 0 : items.length > 0 ? 9.99 : 0;
  const discount = 0;
  const total = subtotal + tax + shipping - discount;

  return {
    subtotal: parseFloat(subtotal.toFixed(2)),
    tax: parseFloat(tax.toFixed(2)),
    shipping: parseFloat(shipping.toFixed(2)),
    discount: parseFloat(discount.toFixed(2)),
    total: parseFloat(total.toFixed(2)),
    currency: 'USD',
  };
};

export interface ValidateCartResponse {
  items: {
    id: string;
    valid: boolean;
    price: number;
    quantity: number;
    maxQuantity?: number;
    removed?: boolean;
    message?: string;
    issueType?: CartValidationIssue['type'];
  }[];
}

export interface CheckoutInitResponse {
  checkoutSessionId: string;
  redirectUrl: string;
}

export const validateCart = createAsyncThunk<
  { updatedItems: CartItem[]; issues: CartValidationIssue[] },
  void,
  { state: RootState }
>('cart/validateCart', async (_, thunkAPI) => {
  const state = thunkAPI.getState();
  const items = state.cart.items;

  try {
    const response = await fetch('/api/cart/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });

    if (!response.ok) {
      throw new Error('Failed to validate cart');
    }

    const data: ValidateCartResponse = await response.json();
    const issues: CartValidationIssue[] = [];
    const updatedItems: CartItem[] = [];

    for (const originalItem of items) {
      const serverItem = data.items.find((i) => i.id === originalItem.id);
      if (!serverItem) {
        issues.push({
          itemId: originalItem.id,
          type: 'REMOVED',
          message: `undefined is no longer available and was removed from your cart.`,
        });
        continue;
      }

      if (serverItem.removed) {
        issues.push({
          itemId: originalItem.id,
          type: 'REMOVED',
          message: serverItem.message || `undefined is no longer available and was removed from your cart.`,
        });
        continue;
      }

      let updatedItem: CartItem = { ...originalItem };
      if (serverItem.price !== originalItem.price) {
        issues.push({
          itemId: originalItem.id,
          type: 'PRICE_CHANGED',
          message: `undefined price has changed.`,
          newPrice: serverItem.price,
        });
        updatedItem.price = serverItem.price;
      }

      if (serverItem.quantity !== originalItem.quantity) {
        issues.push({
          itemId: originalItem.id,
          type: 'QUANTITY_ADJUSTED',
          message: serverItem.message || `undefined quantity was adjusted due to stock limits.`,
          newQuantity: serverItem.quantity,
        });
        updatedItem.quantity = serverItem.quantity;
      }

      if (!serverItem.valid) {
        issues.push({
          itemId: originalItem.id,
          type: serverItem.issueType || 'UNKNOWN',
          message: serverItem.message || `undefined may not be available in the requested quantity.`,
        });
      }

      updatedItem.maxQuantity = serverItem.maxQuantity;
      updatedItems.push(updatedItem);
    }

    return { updatedItems, issues };
  } catch (error) {
    return thunkAPI.rejectWithValue(
      error instanceof Error ? error.message : 'Unknown error while validating cart'
    );
  }
});

export const initiateCheckout = createAsyncThunk<
  CheckoutInitResponse,
  void,
  { state: RootState }
>('cart/initiateCheckout', async (_, thunkAPI) => {
  const state = thunkAPI.getState();
  const items = state.cart.items;

  if (!items.length) {
    return thunkAPI.rejectWithValue('Cart is empty');
  }

  try {
    const response = await fetch('/api/checkout/initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });

    if (!response.ok) {
      throw new Error('Failed to initiate checkout');
    }

    const data: CheckoutInitResponse = await response.json();
    return data;
  } catch (error) {
    return thunkAPI.rejectWithValue(
      error instanceof Error ? error.message : 'Unknown error while initiating checkout'
    );
  }
});

const initialPersistedState = loadCartFromStorage();

const initialState: CartState = initialPersistedState || {
  items: [],
  totals: defaultTotals,
  isValidating: false,
  isCheckingOut: false,
  validationIssues: [],
  lastValidatedAt: null,
  error: null,
};

const findItemIndex = (items: CartItem[], id: string, variantId?: string | null): number =>
  items.findIndex(
    (item) =>
      item.id === id &&
      (item.variantId || null) === (variantId || null)
  );

export interface AddItemPayload {
  id: string;
  name: string;
  price: number;
  imageUrl?: string;
  quantity?: number;
  maxQuantity?: number;
  variantId?: string | null;
}

export interface UpdateQuantityPayload {
  id: string;
  variantId?: string | null;
  quantity: number;
}

export interface RemoveItemPayload {
  id: string;
  variantId?: string | null;
}

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    hydrateCartFromStorage(state) {
      const persisted = loadCartFromStorage();
      if (persisted) {
        state.items = persisted.items;
        state.totals = calculateTotals(persisted.items);
        state.lastValidatedAt = persisted.lastValidatedAt;
      } else {
        state.items = [];
        state.totals = calculateTotals([]);
        state.lastValidatedAt = null;
      }
      state.validationIssues = [];
      state.error = null;
      saveCartToStorage(state);
    },
    addItem(state, action: PayloadAction<AddItemPayload>) {
      const { id, name, price, imageUrl, quantity = 1, maxQuantity, variantId = null } = action.payload;
      const index = findItemIndex(state.items, id, variantId);
      const safeQuantity = Math.max(1, quantity);

      if (index >= 0) {
        const existing = state.items[index];
        const newQuantity = existing.quantity + safeQuantity;
        state.items[index] = {