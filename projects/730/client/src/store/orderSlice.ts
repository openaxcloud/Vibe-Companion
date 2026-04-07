import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '../store';

export type OrderStatus =
  | 'pending'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export interface OrderItem {
  id: string;
  productId: string;
  name: string;
  sku?: string;
  quantity: number;
  price: number;
  imageUrl?: string | null;
}

export interface OrderAddress {
  fullName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
  phone?: string;
}

export interface OrderSummary {
  id: string;
  userId: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  total: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderDetails extends OrderSummary {
  items: OrderItem[];
  shippingAddress: OrderAddress;
  billingAddress?: OrderAddress;
  shippingMethod?: string;
  notes?: string;
}

export interface AdminOrderFilters {
  status?: OrderStatus | 'all';
  paymentStatus?: PaymentStatus | 'all';
  query?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  pageSize?: number;
}

export interface AdminOrderDashboard {
  orders: OrderSummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  stats: {
    totalRevenue: number;
    totalOrders: number;
    pendingOrders: number;
    processingOrders: number;
    shippedOrders: number;
    deliveredOrders: number;
    cancelledOrders: number;
    refundedOrders: number;
  };
}

export interface OrderState {
  orders: OrderSummary[];
  selectedOrder: OrderDetails | null;
  loadingOrders: boolean;
  loadingSelectedOrder: boolean;
  updatingOrderStatus: boolean;
  adminDashboard: AdminOrderDashboard | null;
  loadingAdminDashboard: boolean;
  error: string | null;
  adminFilters: AdminOrderFilters;
}

const initialState: OrderState = {
  orders: [],
  selectedOrder: null,
  loadingOrders: false,
  loadingSelectedOrder: false,
  updatingOrderStatus: false,
  adminDashboard: null,
  loadingAdminDashboard: false,
  error: null,
  adminFilters: {
    status: 'all',
    paymentStatus: 'all',
    query: '',
    page: 1,
    pageSize: 20,
  },
};

interface FetchUserOrdersArgs {
  userId?: string;
}

interface FetchOrderDetailsArgs {
  orderId: string;
}

interface FetchAdminOrdersArgs extends AdminOrderFilters {}

interface UpdateOrderStatusArgs {
  orderId: string;
  status: OrderStatus;
}

const API_BASE_URL = '/api';

export const fetchUserOrders = createAsyncThunk<
  OrderSummary[],
  FetchUserOrdersArgs | void,
  { state: RootState }
>('orders/fetchUserOrders', async (_args, { signal }) => {
  const response = await fetch(`undefined/orders`, {
    method: 'GET',
    signal,
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    const message =
      errorBody?.message || `Failed to fetch orders: undefined`;
    throw new Error(message);
  }

  const data = (await response.json()) as OrderSummary[];
  return data;
});

export const fetchOrderDetails = createAsyncThunk<
  OrderDetails,
  FetchOrderDetailsArgs,
  { state: RootState }
>('orders/fetchOrderDetails', async ({ orderId }, { signal }) => {
  const response = await fetch(`undefined/orders/undefined`, {
    method: 'GET',
    signal,
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    const message =
      errorBody?.message ||
      `Failed to fetch order details: undefined`;
    throw new Error(message);
  }

  const data = (await response.json()) as OrderDetails;
  return data;
});

export const fetchAdminOrders = createAsyncThunk<
  AdminOrderDashboard,
  FetchAdminOrdersArgs | void,
  { state: RootState }
>('orders/fetchAdminOrders', async (args, { getState, signal }) => {
  const state = getState();
  const currentFilters = state.orders.adminFilters;

  const filters: AdminOrderFilters = {
    ...currentFilters,
    ...(args || {}),
  };

  const params = new URLSearchParams();
  if (filters.status && filters.status !== 'all') {
    params.append('status', filters.status);
  }
  if (filters.paymentStatus && filters.paymentStatus !== 'all') {
    params.append('paymentStatus', filters.paymentStatus);
  }
  if (filters.query) {
    params.append('query', filters.query);
  }
  if (filters.fromDate) {
    params.append('fromDate', filters.fromDate);
  }
  if (filters.toDate) {
    params.append('toDate', filters.toDate);
  }
  if (filters.page) {
    params.append('page', String(filters.page));
  }
  if (filters.pageSize) {
    params.append('pageSize', String(filters.pageSize));
  }

  const queryString = params.toString();
  const url = `undefined/admin/ordersundefined` : ''}`;

  const response = await fetch(url, {
    method: 'GET',
    signal,
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    const message =
      errorBody?.message ||
      `Failed to fetch admin orders: undefined`;
    throw new Error(message);
  }

  const data = (await response.json()) as AdminOrderDashboard;
  return data;
});

export const updateOrderStatus = createAsyncThunk<
  OrderDetails,
  UpdateOrderStatusArgs,
  { state: RootState }
>('orders/updateOrderStatus', async ({ orderId, status }, { signal }) => {
  const response = await fetch(`undefined/admin/orders/undefined/status`, {
    method: 'PATCH',
    signal,
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ status }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    const message =
      errorBody?.message ||
      `Failed to update order status: undefined`;
    throw new Error(message);
  }

  const data = (await response.json()) as OrderDetails;
  return data;
});

const orderSlice = createSlice({
  name: 'orders',
  initialState,
  reducers: {
    clearSelectedOrder(state) {
      state.selectedOrder = null;
      state.loadingSelectedOrder = false;
      state.error = null;
    },
    setAdminFilters(state, action: PayloadAction<Partial<AdminOrderFilters>>) {
      state.adminFilters = {
        ...state.adminFilters,
        ...action.payload,
      };
    },
    resetAdminFilters(state) {
      state.adminFilters = initialState.adminFilters;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUserOrders.pending, (state) => {
        state.loadingOrders = true;
        state.error = null;
      })
      .addCase(fetchUserOrders.fulfilled, (state, action) => {
        state.loadingOrders = false;
        state.orders = action.payload;
      })
      .addCase(fetchUserOrders.rejected, (state, action) => {
        state.loadingOrders = false;
        state.error = action.error.message || 'Unable to fetch orders.';
      });

    builder
      .addCase(fetchOrderDetails.pending, (state) => {
        state.loadingSelectedOrder = true;
        state.error = null;
      })
      .addCase(fetchOrderDetails.fulfilled, (state, action) => {
        state.loadingSelectedOrder = false;
        state.selectedOrder = action.payload;
        const index = state.orders.findIndex(
          (order) => order.id === action.payload.id
        );
        if (index !== -1) {
          state.orders[index] = {
            id: action.payload.id,
            userId: action.payload.userId,
            status: action.payload.status,
            paymentStatus: action.payload.paymentStatus,
            total: action.payload.total,
            currency: action.payload.currency,
            createdAt: action.payload.createdAt,
            updatedAt: action.payload.updatedAt,
          };
        } else {
          state.orders.push({
            id: action.payload.id,
            userId: action.payload.userId,
            status: action.payload.status,
            paymentStatus: action.payload.paymentStatus,
            total: action.payload.total,
            currency: action.payload.currency,
            created