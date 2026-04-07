import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from './store';

export interface CartItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  variant?: string;
}

export interface CartState {
  items: CartItem[];
  subtotal: number;
  totalQuantity: number;
  isLoading: boolean;
  error: string | null;
  lastSyncedAt: string | null;
}

const initialState: CartState = {
  items: [],
  subtotal: 0,
  totalQuantity: 0,
  isLoading: false,
  error: null,
  lastSyncedAt: null,
};

interface AddItemPayload {
  productId: string;
  name: string;
  price: number;
  quantity?: number;
  imageUrl?: string;
  variant?: string;
}

interface UpdateItemQuantityPayload {
  id: string;
  quantity: number;
}

interface RemoveItemPayload {
  id: string;
}

export const fetchCart = createAsyncThunk<CartItem[], void, { state: RootState }>(
  'cart/fetchCart',
  async (_, thunkApi) => {
    try {
      const response = await fetch('/api/cart', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const message = `Failed to load cart (undefined)`;
        return thunkApi.rejectWithValue(message) as unknown as CartItem[];
      }

      const data = (await response.json()) as { items: CartItem[] };
      return data.items || [];
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'An unexpected error occurred while loading the cart';
      return thunkApi.rejectWithValue(message) as unknown as CartItem[];
    }
  }
);

export const syncCart = createAsyncThunk<CartItem[], void, { state: RootState }>(
  'cart/syncCart',
  async (_, thunkApi) => {
    const state = thunkApi.getState();
    const cartItems = state.cart.items;

    try {
      const response = await fetch('/api/cart', {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ items: cartItems }),
      });

      if (!response.ok) {
        const message = `Failed to sync cart (undefined)`;
        return thunkApi.rejectWithValue(message) as unknown as CartItem[];
      }

      const data = (await response.json()) as { items: CartItem[] };
      return data.items || [];
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'An unexpected error occurred while syncing the cart';
      return thunkApi.rejectWithValue(message) as unknown as CartItem[];
    }
  }
);

const recalculateTotals = (state: CartState): void => {
  let subtotal = 0;
  let totalQuantity = 0;

  state.items.forEach((item) => {
    subtotal += item.price * item.quantity;
    totalQuantity += item.quantity;
  });

  state.subtotal = subtotal;
  state.totalQuantity = totalQuantity;
};

const generateCartItemId = (payload: AddItemPayload): string => {
  const base = `undefined-undefined`;
  return base;
};

export const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    clearCart(state) {
      state.items = [];
      state.subtotal = 0;
      state.totalQuantity = 0;
      state.error = null;
      state.lastSyncedAt = null;
    },
    addItem(state, action: PayloadAction<AddItemPayload>) {
      const { productId, name, price, quantity = 1, imageUrl, variant } = action.payload;
      if (quantity <= 0) return;

      const id = generateCartItemId(action.payload);
      const existing = state.items.find((item) => item.id === id);

      if (existing) {
        existing.quantity += quantity;
      } else {
        state.items.push({
          id,
          productId,
          name,
          price,
          quantity,
          imageUrl,
          variant,
        });
      }

      recalculateTotals(state);
    },
    updateItemQuantity(state, action: PayloadAction<UpdateItemQuantityPayload>) {
      const { id, quantity } = action.payload;
      const item = state.items.find((i) => i.id === id);
      if (!item) return;

      if (quantity <= 0) {
        state.items = state.items.filter((i) => i.id !== id);
      } else {
        item.quantity = quantity;
      }

      recalculateTotals(state);
    },
    removeItem(state, action: PayloadAction<RemoveItemPayload>) {
      const { id } = action.payload;
      const existingLength = state.items.length;
      state.items = state.items.filter((item) => item.id !== id);

      if (state.items.length !== existingLength) {
        recalculateTotals(state);
      }
    },
    hydrateCart(state, action: PayloadAction<CartItem[]>) {
      state.items = action.payload;
      recalculateTotals(state);
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCart.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchCart.fulfilled, (state, action: PayloadAction<CartItem[]>) => {
        state.isLoading = false;
        state.items = action.payload;
        recalculateTotals(state);
        state.error = null;
        state.lastSyncedAt = new Date().toISOString();
      })
      .addCase(fetchCart.rejected, (state, action) => {
        state.isLoading = false;
        const payload = action.payload as string | undefined;
        state.error = payload || action.error.message || 'Failed to load cart';
      })
      .addCase(syncCart.pending, (state) => {
        state.error = null;
      })
      .addCase(syncCart.fulfilled, (state, action: PayloadAction<CartItem[]>) => {
        state.items = action.payload;
        recalculateTotals(state);
        state.error = null;
        state.lastSyncedAt = new Date().toISOString();
      })
      .addCase(syncCart.rejected, (state, action) => {
        const payload = action.payload as string | undefined;
        state.error = payload || action.error.message || 'Failed to sync cart';
      });
  },
});

export const { addItem, updateItemQuantity, removeItem, clearCart, hydrateCart } = cartSlice.actions;

export const selectCartItems = (state: RootState): CartItem[] => state.cart.items;
export const selectCartSubtotal = (state: RootState): number => state.cart.subtotal;
export const selectCartTotalQuantity = (state: RootState): number => state.cart.totalQuantity;
export const selectCartIsLoading = (state: RootState): boolean => state.cart.isLoading;
export const selectCartError = (state: RootState): string | null => state.cart.error;
export const selectCartLastSyncedAt = (state: RootState): string | null => state.cart.lastSyncedAt;

export default cartSlice.reducer;