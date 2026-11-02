// Admin side of the shop (/shop/admin). Every call unwraps the ApiResponse envelope and throws
// when the server answers success: false, so screens only deal with data or an error.
import { Platform } from 'react-native';
import axiosInstance from '../../../api/axios';
import { ApiResponse } from '../../../api/types';
import { PickedFile } from '../../../api/upload';
import {
  Paged, ShopSettings, ShopCategory, ShopCategoryInput, ShopAdminProductRow, ShopAdminProduct, ShopProductInput,
  ShopVariantInput, ShopInventoryRow, ShopInventoryUpdate, ShopOrderSummary, ShopOrder, ShopOrderStatus,
  ShopCustomerRow, ShopCustomerDetail, ShopCoupon, ShopCouponInput, ShopDashboard,
} from './shop.types';

const BASE = '/shop/admin';

/** Drops empty values so they never reach the query string as "undefined". */
function clean(params: Record<string, unknown>): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    out[k] = v as string | number | boolean;
  }
  return out;
}

function unwrap<T>(res: ApiResponse<T>): T {
  if (!res.success) {
    const err = new Error(res.errors?.length ? `${res.message}\n\n• ${res.errors.join('\n• ')}` : res.message || 'Request failed.');
    throw err;
  }
  return res.data as T;
}

const get = async <T>(url: string, params: Record<string, unknown> = {}) =>
  unwrap((await axiosInstance.get<ApiResponse<T>>(BASE + url, { params: clean(params) })).data);
const post = async <T>(url: string, body?: unknown) => unwrap((await axiosInstance.post<ApiResponse<T>>(BASE + url, body)).data);
const put = async <T>(url: string, body?: unknown) => unwrap((await axiosInstance.put<ApiResponse<T>>(BASE + url, body)).data);
const patch = async <T>(url: string, body?: unknown) => unwrap((await axiosInstance.patch<ApiResponse<T>>(BASE + url, body)).data);
const del = async <T>(url: string) => unwrap((await axiosInstance.delete<ApiResponse<T>>(BASE + url)).data);

/** Same file part as api/upload.ts (Blob on web, { uri, name, type } on native), plus room for extra fields. */
async function imageForm(file: PickedFile): Promise<FormData> {
  const type = file.mimeType || (/\.png$/i.test(file.uri) ? 'image/png' : /\.webp$/i.test(file.uri) ? 'image/webp' : 'image/jpeg');
  const name = file.fileName || `image.${type.split('/')[1] ?? 'jpg'}`;
  const form = new FormData();
  if (Platform.OS === 'web') {
    const blob = await (await fetch(file.uri)).blob();
    form.append('file', new File([blob], name, { type: blob.type || type }));
  } else {
    form.append('file', { uri: file.uri, name, type } as unknown as Blob);
  }
  return form;
}

export type ProductStatusFilter = 'all' | 'active' | 'inactive';

export interface ProductListQuery { page: number; pageSize: number; search?: string; categoryId?: number; status?: ProductStatusFilter }
export interface InventoryQuery { page: number; pageSize: number; search?: string; lowStockOnly?: boolean }
export interface OrderListQuery { page: number; pageSize: number; search?: string; status?: ShopOrderStatus }
export interface CustomerListQuery { page: number; pageSize: number; search?: string }

export const shopAdminApi = {
  dashboard: () => get<ShopDashboard>('/dashboard'),

  products: (q: ProductListQuery) => get<Paged<ShopAdminProductRow>>('/products', { ...q }),
  product: (id: number) => get<ShopAdminProduct>(`/products/${id}`),
  createProduct: (body: ShopProductInput) => post<ShopAdminProduct>('/products', body),
  updateProduct: (id: number, body: ShopProductInput) => put<ShopAdminProduct>(`/products/${id}`, body),
  deleteProduct: (id: number) => del<unknown>(`/products/${id}`),

  addVariant: (id: number, body: ShopVariantInput) => post<ShopAdminProduct>(`/products/${id}/variants`, body),
  updateVariant: (id: number, variantId: number, body: ShopVariantInput) => put<ShopAdminProduct>(`/products/${id}/variants/${variantId}`, body),
  deleteVariant: (id: number, variantId: number) => del<ShopAdminProduct>(`/products/${id}/variants/${variantId}`),

  /** Multipart: `file`, `altText`, `isPrimary`. */
  uploadImage: async (id: number, file: PickedFile, altText: string, isPrimary: boolean) => {
    const form = await imageForm(file);
    form.append('altText', altText);
    form.append('isPrimary', String(isPrimary));
    const { data } = await axiosInstance.post<ApiResponse<ShopAdminProduct>>(`${BASE}/products/${id}/images`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return unwrap(data);
  },
  addImageUrl: (id: number, body: { url: string; altText: string | null; isPrimary: boolean }) =>
    post<ShopAdminProduct>(`/products/${id}/images/url`, body),
  updateImage: (id: number, imageId: number, body: { altText: string | null; sortOrder: number; isPrimary: boolean }) =>
    patch<ShopAdminProduct>(`/products/${id}/images/${imageId}`, body),
  deleteImage: (id: number, imageId: number) => del<ShopAdminProduct>(`/products/${id}/images/${imageId}`),

  categories: () => get<ShopCategory[]>('/categories'),
  createCategory: (body: ShopCategoryInput) => post<ShopCategory>('/categories', body),
  updateCategory: (id: number, body: ShopCategoryInput) => put<ShopCategory>(`/categories/${id}`, body),
  deleteCategory: (id: number) => del<unknown>(`/categories/${id}`),

  inventory: (q: InventoryQuery) => get<Paged<ShopInventoryRow>>('/inventory', { ...q, lowStockOnly: q.lowStockOnly || undefined }),
  updateInventory: (variantId: number, body: ShopInventoryUpdate) => patch<ShopInventoryRow>(`/inventory/${variantId}`, body),

  orders: (q: OrderListQuery) => get<Paged<ShopOrderSummary>>('/orders', { ...q }),
  order: (orderNumber: string) => get<ShopOrder>(`/orders/${encodeURIComponent(orderNumber)}`),
  setOrderStatus: (orderNumber: string, body: { status: ShopOrderStatus; trackingNumber?: string | null }) =>
    patch<ShopOrder>(`/orders/${encodeURIComponent(orderNumber)}/status`, body),

  customers: (q: CustomerListQuery) => get<Paged<ShopCustomerRow>>('/customers', { ...q }),
  customer: (id: number) => get<ShopCustomerDetail>(`/customers/${id}`),

  coupons: () => get<ShopCoupon[]>('/coupons'),
  createCoupon: (body: ShopCouponInput) => post<ShopCoupon>('/coupons', body),
  updateCoupon: (id: number, body: ShopCouponInput) => put<ShopCoupon>(`/coupons/${id}`, body),
  deleteCoupon: (id: number) => del<unknown>(`/coupons/${id}`),

  settings: () => get<ShopSettings>('/settings'),
  saveSettings: (body: ShopSettings) => put<ShopSettings>('/settings', body),
};
