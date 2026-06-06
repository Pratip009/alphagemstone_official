// ─── Auth ─────────────────────────────────────────────────────────────────────
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

// ─── Product ──────────────────────────────────────────────────────────────────
export interface Product {
  _id: string;
  name: string;
  category: { _id: string; name: string; slug: string } | string;
  subcategory?: { _id: string; name: string; slug: string } | string;
  price: number;
  shape: string;
  size: number;
  color: string;
  clarity: string;
  certification?: string;
  images: string[];
  stock: number;
  isActive: boolean;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Cart ─────────────────────────────────────────────────────────────────────
export interface CartItem {
  product: Product;
  quantity: number;
  price: number;
}

export interface Cart {
  _id: string;
  user: string;
  items: CartItem[];
  updatedAt: string;
}

export interface CartTotals {
  subtotal: number;
  tax: number;
  shippingCost: number;
  total: number;
}

// ─── Order ────────────────────────────────────────────────────────────────────
export interface OrderItem {
  product: string | Product;
  name: string;
  price: number;
  quantity: number;
  image?: string;
}

export interface ShippingAddress {
  fullName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
}

export type OrderStatus =
  | 'pending' | 'paid' | 'processing'
  | 'shipped' | 'delivered' | 'cancelled' | 'refunded';

export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';

export interface Order {
  _id: string;
  user: string | AuthUser;
  items: OrderItem[];
  shippingAddress: ShippingAddress;
  subtotal: number;
  shippingCost: number;
  tax: number;
  totalAmount: number;
  status: OrderStatus;
  paymentMethod: 'paypal' | 'cod';
  paymentStatus: PaymentStatus;
  paypalOrderId?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Category ─────────────────────────────────────────────────────────────────
export interface Category {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  isActive: boolean;
}

export interface Subcategory {
  _id: string;
  name: string;
  slug: string;
  category: Category | string;
  isActive: boolean;
}

// ─── API Responses ────────────────────────────────────────────────────────────
export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  message: string;
  errors?: Record<string, string[]>;
}

export interface PaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  facets?: FilterFacets;
}

// ─── Filter Facets ────────────────────────────────────────────────────────────
export interface FacetItem {
  _id: string;
  count: number;
}

export interface FilterFacets {
  shapes: FacetItem[];
  colors: FacetItem[];
  clarities: FacetItem[];
  certifications: FacetItem[];
  priceRange: Array<{ min: number; max: number }>;
  sizeRange: Array<{ min: number; max: number }>;
  totalCount: Array<{ count: number }>;
}

// ─── Bulk Upload ──────────────────────────────────────────────────────────────
export interface BulkUploadResult {
  message: string;
  inserted: number;
  failed: number;
  errors: Array<{ row: number; error: string; data?: Record<string, unknown> }>;
}
