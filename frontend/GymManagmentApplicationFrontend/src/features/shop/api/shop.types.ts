// Shapes of the shop API (/api/shop and /api/shop/admin), ported from the Unique Lights store.
// Every call returns the ApiResponse envelope; `data` holds these. Enums arrive as names.

export interface Paged<T> {
  items: T[];
  pageNumber: number;
  pageSize: number;
  totalRecords: number;
  totalPages: number;
}

// ── Store settings ──────────────────────────────────────────────────────

export interface ShopSettings {
  name: string;
  tagline: string | null;
  currency: string;
  /** Fraction, e.g. 0.18 for 18% GST. */
  taxRate: number;
  freeShippingThreshold: number;
  standardShipping: number;
  expressShipping: number;
  standardDeliveryDays: number;
  expressDeliveryDays: number;
  returnDays: number;
  /** Admin settings only. */
  orderPrefix?: string;
  supportEmail: string | null;
  supportPhone: string | null;
  address: string | null;
  businessHours: string | null;
}

// ── Catalog ─────────────────────────────────────────────────────────────

export interface ShopCategory {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  parentId: number | null;
  sortOrder: number;
  /** Includes sub-categories. */
  productCount: number;
  children: ShopCategory[];
  /** Admin list only. */
  isActive?: boolean;
}

export interface ShopImage {
  id: number;
  url: string;
  altText: string | null;
  sortOrder: number;
  isPrimary: boolean;
}

export interface ShopProductCard {
  id: number;
  name: string;
  slug: string;
  brand: string | null;
  shortDescription: string | null;
  price: number;
  compareAtPrice: number | null;
  discountPercent: number | null;
  primaryImageUrl: string | null;
  secondaryImageUrl: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  averageRating: number;
  reviewCount: number;
  inStock: boolean;
  isNew: boolean;
  isFeatured: boolean;
  defaultVariantId: number | null;
}

export interface ShopVariant {
  id: number;
  sku: string;
  name: string;
  flavour: string | null;
  size: string | null;
  colour: string | null;
  weight: string | null;
  price: number;
  compareAtPrice: number | null;
  stock: number;
  inStock: boolean;
  isDefault: boolean;
}

export interface ShopProductDetail extends ShopProductCard {
  sku: string;
  description: string | null;
  specifications: Record<string, string>;
  images: ShopImage[];
  variants: ShopVariant[];
  category: { id: number; name: string; slug: string } | null;
}

export type ShopSort = 'featured' | 'newest' | 'price_asc' | 'price_desc' | 'rating' | 'name';

/** GET /shop/products query. Lists are comma-separated on the wire. */
export interface ShopProductQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  brands?: string[];
  flavours?: string[];
  sizes?: string[];
  colours?: string[];
  inStock?: boolean;
  featured?: boolean;
  isNew?: boolean;
  sort?: ShopSort;
}

export interface ShopFilters {
  brands: string[];
  flavours: string[];
  sizes: string[];
  colours: string[];
  minPrice: number;
  maxPrice: number;
}

export interface ShopSuggest {
  products: ShopProductCard[];
  categories: { id: number; name: string; slug: string }[];
}

export interface ShopReview {
  id: number;
  productId: number;
  rating: number;
  title: string | null;
  comment: string | null;
  /** "First L." */
  authorName: string;
  isVerifiedPurchase: boolean;
  createdAt: string;
  isMine: boolean;
}

export interface ShopReviewSummary {
  averageRating: number;
  reviewCount: number;
  /** "1".."5" → count. */
  distribution: Record<string, number>;
}

export interface ShopWishlist {
  items: { id: number; productId: number; addedAt: string; product: ShopProductCard }[];
}

// ── Cart, coupons, addresses ────────────────────────────────────────────

export interface ShopCartItem {
  id: number;
  variantId: number;
  productId: number;
  productName: string;
  productSlug: string;
  variantName: string;
  flavour: string | null;
  size: string | null;
  colour: string | null;
  weight: string | null;
  sku: string;
  imageUrl: string | null;
  unitPrice: number;
  compareAtPrice: number | null;
  quantity: number;
  lineTotal: number;
  availableStock: number;
}

export interface ShopCart {
  id: number;
  items: ShopCartItem[];
  itemCount: number;
  subtotal: number;
}

export interface ShopCouponCheck {
  code: string;
  description: string | null;
  discountAmount: number;
}

export interface ShopAddress {
  id: number;
  label: string | null;
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
}

export type ShopAddressInput = Omit<ShopAddress, 'id'>;

// ── Orders ──────────────────────────────────────────────────────────────

export type ShopOrderStatus = 'Pending' | 'Confirmed' | 'Processing' | 'Shipped' | 'OutForDelivery' | 'Delivered' | 'Cancelled';
export type ShopDeliveryMethod = 'Standard' | 'Express';
export type ShopPaymentMethod = 'CashOnDelivery' | 'Card' | 'Upi';
export type ShopPaymentStatus = 'Pending' | 'Paid' | 'Failed' | 'Refunded';

export interface ShopQuote {
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
  couponCode: string | null;
  /** Why a coupon didn't apply; the quote still succeeds. */
  couponMessage: string | null;
  estimatedDelivery: string | null;
}

export interface ShopPlaceOrder {
  addressId: number;
  deliveryMethod: ShopDeliveryMethod;
  paymentMethod: ShopPaymentMethod;
  couponCode?: string;
  notes?: string;
}

export interface ShopOrderSummary {
  id: number;
  orderNumber: string;
  status: ShopOrderStatus;
  total: number;
  itemCount: number;
  placedAt: string;
  previewImages: string[];
  /** Admin lists only. */
  customerName: string | null;
  customerEmail: string | null;
}

export interface ShopOrderItem {
  id: number;
  productId: number;
  variantId: number;
  productName: string;
  productSlug: string;
  variantName: string;
  sku: string;
  imageUrl: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface ShopOrder {
  id: number;
  orderNumber: string;
  status: ShopOrderStatus;
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
  couponCode: string | null;
  deliveryMethod: ShopDeliveryMethod;
  notes: string | null;
  trackingNumber: string | null;
  placedAt: string;
  confirmedAt: string | null;
  processingAt: string | null;
  shippedAt: string | null;
  outForDeliveryAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  estimatedDelivery: string | null;
  shippingAddress: Omit<ShopAddress, 'id' | 'label' | 'isDefault'>;
  payment: { method: ShopPaymentMethod; status: ShopPaymentStatus; amount: number; transactionReference: string | null; paidAt: string | null } | null;
  items: ShopOrderItem[];
  timeline: { status: ShopOrderStatus; at: string | null; completed: boolean }[];
  /** Admin detail only. */
  customerId: number | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
}

// ── Admin ───────────────────────────────────────────────────────────────

export interface ShopAdminProductRow {
  id: number;
  name: string;
  slug: string;
  sku: string;
  categoryName: string | null;
  price: number;
  compareAtPrice: number | null;
  totalStock: number;
  variantCount: number;
  isActive: boolean;
  isFeatured: boolean;
  isNew: boolean;
  primaryImageUrl: string | null;
  updatedAt: string;
}

export interface ShopAdminVariant extends ShopVariant {
  isActive: boolean;
  quantityOnHand: number;
  reservedQuantity: number;
  lowStockThreshold: number;
}

export interface ShopAdminProduct {
  id: number;
  name: string;
  slug: string;
  sku: string;
  shortDescription: string | null;
  description: string | null;
  brand: string | null;
  basePrice: number;
  compareAtPrice: number | null;
  categoryId: number;
  isActive: boolean;
  isFeatured: boolean;
  isNew: boolean;
  specifications: Record<string, string>;
  images: ShopImage[];
  variants: ShopAdminVariant[];
  createdAt: string;
  updatedAt: string;
}

export interface ShopProductInput {
  name: string;
  slug?: string | null;
  sku: string;
  shortDescription?: string | null;
  description?: string | null;
  brand?: string | null;
  basePrice: number;
  compareAtPrice?: number | null;
  categoryId: number;
  isActive: boolean;
  isFeatured: boolean;
  isNew: boolean;
  specifications: Record<string, string>;
}

export interface ShopVariantInput {
  sku: string;
  name: string;
  flavour?: string | null;
  size?: string | null;
  colour?: string | null;
  weight?: string | null;
  price: number;
  compareAtPrice?: number | null;
  isDefault: boolean;
  isActive: boolean;
  /** Used only when creating a variant. */
  initialStock?: number;
  lowStockThreshold?: number;
}

export interface ShopCategoryInput {
  name: string;
  slug?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  parentId?: number | null;
  sortOrder: number;
  isActive: boolean;
}

export interface ShopInventoryRow {
  variantId: number;
  productId: number;
  productName: string;
  variantName: string;
  sku: string;
  imageUrl: string | null;
  quantityOnHand: number;
  reservedQuantity: number;
  available: number;
  lowStockThreshold: number;
  isLowStock: boolean;
}

/** Send either quantityOnHand or a non-zero adjustment, not both. */
export interface ShopInventoryUpdate {
  quantityOnHand?: number;
  adjustment?: number;
  lowStockThreshold?: number;
}

export interface ShopCustomerRow {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  isActive: boolean;
  status: string;
  roles: string[];
  ordersCount: number;
  totalSpent: number;
  createdAt: string;
  lastOrderAt: string | null;
}

export interface ShopCustomerDetail extends ShopCustomerRow {
  addresses: ShopAddress[];
  recentOrders: ShopOrderSummary[];
}

/** discountType: 0 = Percentage, 1 = Fixed amount. */
export interface ShopCoupon {
  id: number;
  code: string;
  description: string | null;
  discountType: number;
  value: number;
  minOrderAmount: number | null;
  maxDiscountAmount: number | null;
  startsAt: string | null;
  endsAt: string | null;
  usageLimit: number | null;
  usedCount: number;
  isActive: boolean;
  createdAt: string;
}

export type ShopCouponInput = Omit<ShopCoupon, 'id' | 'usedCount' | 'createdAt'>;

export interface ShopDashboard {
  totalRevenue: number;
  ordersCount: number;
  customersCount: number;
  productsCount: number;
  averageOrderValue: number;
  revenueLast30Days: number;
  revenuePrevious30Days: number;
  salesByDay: { date: string; revenue: number; orders: number }[];
  ordersByStatus: { status: ShopOrderStatus; count: number }[];
  topProducts: { productId: number; name: string; imageUrl: string | null; unitsSold: number; revenue: number }[];
  recentOrders: ShopOrderSummary[];
  lowStock: ShopInventoryRow[];
}
