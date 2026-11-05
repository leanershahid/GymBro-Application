import axiosInstance from '../../../api/axios';
import { ApiResponse } from '../../../api/types';
import { unwrap } from '../../../api/http';
import {
  Paged, ShopSettings, ShopCategory, ShopProductCard, ShopProductDetail, ShopProductQuery, ShopFilters, ShopSuggest,
  ShopReview, ShopReviewSummary, ShopWishlist, ShopCart, ShopCouponCheck, ShopQuote, ShopDeliveryMethod,
  ShopPlaceOrder, ShopOrder, ShopOrderSummary, ShopAddress, ShopAddressInput,
} from './shop.types';

// The member side of the shop (/api/shop). Every call returns the ApiResponse envelope; these
// return its `data`, or throw the envelope's message so React Query surfaces it as an error.

/** Drops empty values and joins lists, so the query string only carries what was asked for. */
function params(q: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(q)) {
    if (v === undefined || v === null || v === '' || v === false) continue;
    if (Array.isArray(v)) { if (v.length) out[k] = v.join(','); continue; }
    out[k] = String(v);
  }
  return out;
}

const get = async <T,>(url: string, query?: Record<string, unknown>) =>
  unwrap((await axiosInstance.get<ApiResponse<T>>(url, query ? { params: params(query) } : undefined)).data);
const post = async <T,>(url: string, body: unknown = {}) => unwrap((await axiosInstance.post<ApiResponse<T>>(url, body)).data);
const put = async <T,>(url: string, body: unknown) => unwrap((await axiosInstance.put<ApiResponse<T>>(url, body)).data);
const patch = async <T,>(url: string, body: unknown = {}) => unwrap((await axiosInstance.patch<ApiResponse<T>>(url, body)).data);
const del = async <T,>(url: string) => unwrap((await axiosInstance.delete<ApiResponse<T>>(url)).data);

// ── Store and catalog ─────────────────────────────────────────────────────

export const fetchStore = () => get<ShopSettings>('/shop/store');
export const fetchCategories = () => get<ShopCategory[]>('/shop/categories');
export const fetchCategory = (slug: string) => get<ShopCategory>(`/shop/categories/${encodeURIComponent(slug)}`);

export const fetchProducts = (q: ShopProductQuery) => get<Paged<ShopProductCard>>('/shop/products', { ...q });
export const fetchFilters = (category?: string) => get<ShopFilters>('/shop/products/filters', { category });
export const fetchSuggest = (q: string) => get<ShopSuggest>('/shop/products/suggest', { q });
export const fetchProduct = (slug: string) => get<ShopProductDetail>(`/shop/products/${encodeURIComponent(slug)}`);
export const fetchRelated = (slug: string) => get<ShopProductCard[]>(`/shop/products/${encodeURIComponent(slug)}/related`);

// ── Reviews ───────────────────────────────────────────────────────────────

export const fetchReviews = (productId: number, page: number, pageSize = 5) =>
  get<Paged<ShopReview>>(`/shop/reviews/product/${productId}`, { page, pageSize });
export const fetchReviewSummary = (productId: number) => get<ShopReviewSummary>(`/shop/reviews/product/${productId}/summary`);
export interface ReviewInput { productId: number; rating: number; title: string; comment: string }
export const postReview = (body: ReviewInput) => post<ShopReview>('/shop/reviews', body);
export const deleteReview = (id: number) => del<unknown>(`/shop/reviews/${id}`);

// ── Wishlist ──────────────────────────────────────────────────────────────

export const fetchWishlist = () => get<ShopWishlist>('/shop/wishlist');
export const addToWishlist = (productId: number) => post<unknown>('/shop/wishlist', { productId });
export const removeFromWishlist = (productId: number) => del<unknown>(`/shop/wishlist/${productId}`);

// ── Cart ──────────────────────────────────────────────────────────────────

export const fetchCart = () => get<ShopCart>('/shop/cart');
export const clearCart = () => del<ShopCart | null>('/shop/cart');
export const addCartItem = (variantId: number, quantity: number) => post<ShopCart>('/shop/cart/items', { variantId, quantity });
export const updateCartItem = (itemId: number, quantity: number) => patch<ShopCart>(`/shop/cart/items/${itemId}`, { quantity });
export const removeCartItem = (itemId: number) => del<ShopCart>(`/shop/cart/items/${itemId}`);

// ── Checkout and orders ───────────────────────────────────────────────────

export const validateCoupon = (code: string, subtotal: number) => post<ShopCouponCheck>('/shop/coupons/validate', { code, subtotal });
export const fetchQuote = (deliveryMethod: ShopDeliveryMethod, couponCode?: string | null) =>
  post<ShopQuote>('/shop/orders/quote', couponCode ? { deliveryMethod, couponCode } : { deliveryMethod });
export const placeOrder = (body: ShopPlaceOrder) => post<ShopOrder>('/shop/orders', body);
export const fetchOrders = (page: number, pageSize = 10) => get<Paged<ShopOrderSummary>>('/shop/orders', { page, pageSize });
export const fetchOrder = (orderNumber: string) => get<ShopOrder>(`/shop/orders/${encodeURIComponent(orderNumber)}`);
export const cancelOrder = (orderNumber: string) => post<ShopOrder>(`/shop/orders/${encodeURIComponent(orderNumber)}/cancel`);

// ── Addresses ─────────────────────────────────────────────────────────────

export const fetchAddresses = () => get<ShopAddress[]>('/shop/addresses');
export const createAddress = (body: ShopAddressInput) => post<ShopAddress>('/shop/addresses', body);
export const updateAddress = (id: number, body: ShopAddressInput) => put<ShopAddress>(`/shop/addresses/${id}`, body);
export const deleteAddress = (id: number) => del<unknown>(`/shop/addresses/${id}`);
export const setDefaultAddress = (id: number) => patch<unknown>(`/shop/addresses/${id}/default`);
