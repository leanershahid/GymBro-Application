import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  shopAdminApi, ProductListQuery, InventoryQuery, OrderListQuery, CustomerListQuery,
} from './adminApi';
import {
  ShopAdminProduct, ShopCategoryInput, ShopCouponInput, ShopInventoryUpdate, ShopOrder, ShopOrderStatus,
  ShopProductInput, ShopSettings, ShopVariantInput,
} from './shop.types';
import { PickedFile } from '../../../api/upload';

// Every admin shop key lives under ['shop-admin'], so one invalidation refreshes lists, stock and the dashboard.
export const shopAdminKeys = {
  all: ['shop-admin'] as const,
  dashboard: () => [...shopAdminKeys.all, 'dashboard'] as const,
  products: (q: ProductListQuery) => [...shopAdminKeys.all, 'products', q] as const,
  product: (id: number) => [...shopAdminKeys.all, 'product', id] as const,
  categories: () => [...shopAdminKeys.all, 'categories'] as const,
  inventory: (q: InventoryQuery) => [...shopAdminKeys.all, 'inventory', q] as const,
  orders: (q: OrderListQuery) => [...shopAdminKeys.all, 'orders', q] as const,
  order: (n: string) => [...shopAdminKeys.all, 'order', n] as const,
  customers: (q: CustomerListQuery) => [...shopAdminKeys.all, 'customers', q] as const,
  customer: (id: number) => [...shopAdminKeys.all, 'customer', id] as const,
  coupons: () => [...shopAdminKeys.all, 'coupons'] as const,
  settings: () => [...shopAdminKeys.all, 'settings'] as const,
};

function useInvalidateAll() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: shopAdminKeys.all });
}

// ── Reads ──

export const useShopDashboard = () => useQuery({ queryKey: shopAdminKeys.dashboard(), queryFn: shopAdminApi.dashboard });

export const useAdminProducts = (q: ProductListQuery) =>
  useQuery({ queryKey: shopAdminKeys.products(q), queryFn: () => shopAdminApi.products(q), placeholderData: keepPreviousData });

export const useAdminProduct = (id: number | null) =>
  useQuery({ queryKey: shopAdminKeys.product(id ?? 0), queryFn: () => shopAdminApi.product(id!), enabled: !!id });

export const useAdminCategories = () => useQuery({ queryKey: shopAdminKeys.categories(), queryFn: shopAdminApi.categories });

export const useAdminInventory = (q: InventoryQuery) =>
  useQuery({ queryKey: shopAdminKeys.inventory(q), queryFn: () => shopAdminApi.inventory(q), placeholderData: keepPreviousData });

export const useAdminOrders = (q: OrderListQuery) =>
  useQuery({ queryKey: shopAdminKeys.orders(q), queryFn: () => shopAdminApi.orders(q), placeholderData: keepPreviousData });

export const useAdminOrder = (orderNumber: string) =>
  useQuery({ queryKey: shopAdminKeys.order(orderNumber), queryFn: () => shopAdminApi.order(orderNumber), enabled: !!orderNumber });

export const useAdminCustomers = (q: CustomerListQuery) =>
  useQuery({ queryKey: shopAdminKeys.customers(q), queryFn: () => shopAdminApi.customers(q), placeholderData: keepPreviousData });

export const useAdminCustomer = (id: number) =>
  useQuery({ queryKey: shopAdminKeys.customer(id), queryFn: () => shopAdminApi.customer(id), enabled: id > 0 });

export const useAdminCoupons = () => useQuery({ queryKey: shopAdminKeys.coupons(), queryFn: shopAdminApi.coupons });

export const useShopSettings = () => useQuery({ queryKey: shopAdminKeys.settings(), queryFn: shopAdminApi.settings });

// ── Products ──

/** Product/variant/image calls all return the full admin product: seed the detail cache, refresh the rest. */
function useProductMutation<V>(fn: (v: V) => Promise<ShopAdminProduct>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: p => {
      qc.setQueryData(shopAdminKeys.product(p.id), p);
      qc.invalidateQueries({ queryKey: shopAdminKeys.all, predicate: q => q.queryKey[1] !== 'product' });
    },
  });
}

export const useSaveProduct = () =>
  useProductMutation(({ id, body }: { id?: number; body: ShopProductInput }) =>
    id ? shopAdminApi.updateProduct(id, body) : shopAdminApi.createProduct(body));

export const useDeleteProduct = () => {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: (id: number) => shopAdminApi.deleteProduct(id), onSuccess: invalidate });
};

export const useSaveVariant = (productId: number) =>
  useProductMutation(({ variantId, body }: { variantId?: number; body: ShopVariantInput }) =>
    variantId ? shopAdminApi.updateVariant(productId, variantId, body) : shopAdminApi.addVariant(productId, body));

export const useDeleteVariant = (productId: number) =>
  useProductMutation((variantId: number) => shopAdminApi.deleteVariant(productId, variantId));

export const useUploadProductImage = (productId: number) =>
  useProductMutation(({ file, altText, isPrimary }: { file: PickedFile; altText: string; isPrimary: boolean }) =>
    shopAdminApi.uploadImage(productId, file, altText, isPrimary));

export const useUpdateProductImage = (productId: number) =>
  useProductMutation(({ imageId, body }: { imageId: number; body: { altText: string | null; sortOrder: number; isPrimary: boolean } }) =>
    shopAdminApi.updateImage(productId, imageId, body));

export const useDeleteProductImage = (productId: number) =>
  useProductMutation((imageId: number) => shopAdminApi.deleteImage(productId, imageId));

// ── Categories, stock, orders, coupons, settings ──

export const useSaveCategory = () => {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, body }: { id?: number; body: ShopCategoryInput }) =>
      id ? shopAdminApi.updateCategory(id, body) : shopAdminApi.createCategory(body),
    onSuccess: invalidate,
  });
};

export const useDeleteCategory = () => {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: (id: number) => shopAdminApi.deleteCategory(id), onSuccess: invalidate });
};

export const useUpdateInventory = () => {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ variantId, body }: { variantId: number; body: ShopInventoryUpdate }) => shopAdminApi.updateInventory(variantId, body),
    onSuccess: invalidate,
  });
};

export const useSetOrderStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderNumber, status, trackingNumber }: { orderNumber: string; status: ShopOrderStatus; trackingNumber?: string | null }) =>
      shopAdminApi.setOrderStatus(orderNumber, { status, trackingNumber }),
    onSuccess: (order: ShopOrder) => {
      qc.setQueryData(shopAdminKeys.order(order.orderNumber), order);
      qc.invalidateQueries({ queryKey: shopAdminKeys.all, predicate: q => q.queryKey[1] !== 'order' });
    },
  });
};

export const useSaveCoupon = () => {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, body }: { id?: number; body: ShopCouponInput }) =>
      id ? shopAdminApi.updateCoupon(id, body) : shopAdminApi.createCoupon(body),
    onSuccess: invalidate,
  });
};

export const useDeleteCoupon = () => {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: (id: number) => shopAdminApi.deleteCoupon(id), onSuccess: invalidate });
};

export const useSaveShopSettings = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ShopSettings) => shopAdminApi.saveSettings(body),
    onSuccess: s => qc.setQueryData(shopAdminKeys.settings(), s),
  });
};
