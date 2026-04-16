export const PRODUCT_CATEGORIES = [
  'Electronics',
  'Clothing',
  'Books',
  'Home & Kitchen',
  'Sports',
  'Beauty',
  'Toys',
  'Automotive',
];

export const ORDER_STATUSES = [
  'Pending',
  'Processing',
  'Shipped',
  'Delivered',
  'Cancelled',
  'Refunded',
];

export const USER_ROLES = [
  'user',
  'admin',
];

// API Endpoints
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Other constants like pagination limits, default values, etc.
export const PRODUCTS_PER_PAGE = 12;
export const DEFAULT_PRICE_RANGE = [0, 1000];
