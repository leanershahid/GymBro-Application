import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getSession } from '../../../api/session';
import * as api from './storeApi';
import {
  Paged, ShopAddressInput, ShopCart, ShopCartItem, ShopDeliveryMethod, ShopPlaceOrder, ShopProductCard,
  ShopProductQuery, ShopWishlist,
} from './shop.types';

// Local keys, scoped by user so a sign-out/sign-in never shows the previous member's cart.
const uid = () => getSession()?.userId ?? 0;
export const shopKeys = {
  all: () => ['shop-store', uid()] as const,
  store: () => ['shop-store', uid(), 'store'] as const,
  categories: () => ['shop-store', uid(), 'categories'] as const,
  category: (slug: string) => ['shop-store', uid(), 'category', slug] as const,
  products: (q: ShopProductQuery) => ['shop-store', uid(), 'products', q] as const,
  filters: (category?: string) => ['shop-store', uid(), 'filters', category ?? ''] as const,
  suggest: (q: string) => ['shop-store', uid(), 'suggest', q] as const,
  product: (slug: string) => ['shop-store', uid(), 'product', slug] as const,
  related: (slug: string) => ['shop-store', uid(), 'related', slug] as const,
  reviews: (productId: number) => ['shop-store', uid(), 'reviews', productId] as const,
  reviewSummary: (productId: number) => ['shop-store', uid(), 'review-summary', productId] as const,
  wishlist: () => ['shop-store', uid(), 'wishlist'] as const,
  cart: () => ['shop-store', uid(), 'cart'] as const,
  quote: (method: ShopDeliveryMethod, coupon: string | null, cartSig: string) => ['shop-store', uid(), 'quote', method, coupon ?? '', cartSig] as const,
  orders: () => ['shop-store', uid(), 'orders'] as const,
  order: (orderNumber: string) => ['shop-store', uid(), 'order', orderNumber] as const,
  addresses: () => ['shop-store', uid(), 'addresses'] as const,
};
const K = shopKeys;

// ── Catalog ─────────────────────────────────────────────────────────────

export const useStoreSettings = () => useQuery({ queryKey: K.store(), queryFn: api.fetchStore, staleTime: 10 * 60_000 });
export const useCategories = () => useQuery({ queryKey: K.categories(), queryFn: api.fetchCategories, staleTime: 5 * 60_000 });
export const useCategory = (slug?: string) =>
  useQuery({ queryKey: K.category(slug ?? ''), queryFn: () => api.fetchCategory(slug!), enabled: !!slug, staleTime: 5 * 60_000 });

/** One page of products (rails on the home screen). */
export const useProducts = (q: ShopProductQuery) =>
  useQuery({ queryKey: K.products(q), queryFn: () => api.fetchProducts(q), staleTime: 60_000 });

/** A listing with "Load more". */
export const useProductPages = (q: Omit<ShopProductQuery, 'page'>) =>
  useInfiniteQuery({
    queryKey: [...K.products(q), 'pages'],
    queryFn: ({ pageParam }) => api.fetchProducts({ ...q, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last: Paged<ShopProductCard>) => (last.pageNumber < last.totalPages ? last.pageNumber + 1 : undefined),
    staleTime: 60_000,
  });

export const useFilters = (category?: string) =>
  useQuery({ queryKey: K.filters(category), queryFn: () => api.fetchFilters(category), staleTime: 5 * 60_000 });

export const useSuggest = (q: string) =>
  useQuery({ queryKey: K.suggest(q), queryFn: () => api.fetchSuggest(q), enabled: q.trim().length >= 2, staleTime: 60_000 });

export const useProduct = (slug: string) => useQuery({ queryKey: K.product(slug), queryFn: () => api.fetchProduct(slug) });
export const useRelated = (slug: string) => useQuery({ queryKey: K.related(slug), queryFn: () => api.fetchRelated(slug), staleTime: 5 * 60_000 });

// ── Reviews ─────────────────────────────────────────────────────────────

export const useReviews = (productId: number | undefined) =>
  useInfiniteQuery({
    queryKey: K.reviews(productId ?? 0),
    queryFn: ({ pageParam }) => api.fetchReviews(productId!, pageParam),
    initialPageParam: 1,
    getNextPageParam: last => (last.pageNumber < last.totalPages ? last.pageNumber + 1 : undefined),
    enabled: !!productId,
  });

export const useReviewSummary = (productId: number | undefined) =>
  useQuery({ queryKey: K.reviewSummary(productId ?? 0), queryFn: () => api.fetchReviewSummary(productId!), enabled: !!productId });

function useInvalidateReviews() {
  const qc = useQueryClient();
  return (productId: number) => Promise.all([
    qc.invalidateQueries({ queryKey: K.reviews(productId) }),
    qc.invalidateQueries({ queryKey: K.reviewSummary(productId) }),
    // Card ratings in lists and the product header.
    qc.invalidateQueries({ queryKey: ['shop-store', uid(), 'product'] }),
    qc.invalidateQueries({ queryKey: ['shop-store', uid(), 'products'] }),
  ]);
}

export const usePostReview = () => {
  const invalidate = useInvalidateReviews();
  return useMutation({ mutationFn: api.postReview, onSuccess: (_r, v) => invalidate(v.productId) });
};

export const useDeleteReview = () => {
  const invalidate = useInvalidateReviews();
  return useMutation({
    mutationFn: ({ id }: { id: number; productId: number }) => api.deleteReview(id),
    onSuccess: (_r, v) => invalidate(v.productId),
  });
};

// ── Wishlist (optimistic) ───────────────────────────────────────────────

export const useWishlist = () => useQuery({ queryKey: K.wishlist(), queryFn: api.fetchWishlist });

export const useToggleWishlist = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ product, saved }: { product: ShopProductCard; saved: boolean }) =>
      saved ? api.removeFromWishlist(product.id) : api.addToWishlist(product.id),
    onMutate: async ({ product, saved }) => {
      await qc.cancelQueries({ queryKey: K.wishlist() });
      const prev = qc.getQueryData<ShopWishlist>(K.wishlist());
      const items = prev?.items ?? [];
      qc.setQueryData<ShopWishlist>(K.wishlist(), {
        items: saved
          ? items.filter(i => i.productId !== product.id)
          : [{ id: -product.id, productId: product.id, addedAt: new Date().toISOString(), product }, ...items],
      });
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(K.wishlist(), ctx.prev); },
    onSettled: () => qc.invalidateQueries({ queryKey: K.wishlist() }),
  });
};

// ── Cart ────────────────────────────────────────────────────────────────

export const useCart = () => useQuery({ queryKey: K.cart(), queryFn: api.fetchCart });

const isCart = (c: unknown): c is ShopCart => !!c && typeof c === 'object' && Array.isArray((c as ShopCart).items);

function recalc(items: ShopCartItem[], base: ShopCart): ShopCart {
  return {
    ...base,
    items,
    itemCount: items.reduce((n, i) => n + i.quantity, 0),
    subtotal: Math.round(items.reduce((n, i) => n + i.lineTotal, 0) * 100) / 100,
  };
}

/** Puts the server's cart in the cache when it returned one, otherwise refetches. */
function useCartSettled() {
  const qc = useQueryClient();
  return (cart: unknown) => {
    if (isCart(cart)) qc.setQueryData(K.cart(), cart);
    return qc.invalidateQueries({ queryKey: K.cart() });
  };
}

export const useAddToCart = () => {
  const settle = useCartSettled();
  return useMutation({
    mutationFn: ({ variantId, quantity }: { variantId: number; quantity: number }) => api.addCartItem(variantId, quantity),
    onSuccess: settle,
  });
};

export const useUpdateCartItem = () => {
  const qc = useQueryClient();
  const settle = useCartSettled();
  return useMutation({
    mutationFn: ({ itemId, quantity }: { itemId: number; quantity: number }) => api.updateCartItem(itemId, quantity),
    onMutate: async ({ itemId, quantity }) => {
      await qc.cancelQueries({ queryKey: K.cart() });
      const prev = qc.getQueryData<ShopCart>(K.cart());
      if (prev) {
        qc.setQueryData(K.cart(), recalc(
          prev.items.map(i => (i.id === itemId ? { ...i, quantity, lineTotal: Math.round(i.unitPrice * quantity * 100) / 100 } : i)),
          prev,
        ));
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(K.cart(), ctx.prev); },
    onSuccess: settle,
  });
};

export const useRemoveCartItem = () => {
  const qc = useQueryClient();
  const settle = useCartSettled();
  return useMutation({
    mutationFn: (itemId: number) => api.removeCartItem(itemId),
    onMutate: async itemId => {
      await qc.cancelQueries({ queryKey: K.cart() });
      const prev = qc.getQueryData<ShopCart>(K.cart());
      if (prev) qc.setQueryData(K.cart(), recalc(prev.items.filter(i => i.id !== itemId), prev));
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(K.cart(), ctx.prev); },
    onSuccess: settle,
  });
};

export const useClearCart = () => {
  const settle = useCartSettled();
  return useMutation({ mutationFn: api.clearCart, onSuccess: settle });
};

// ── Checkout ────────────────────────────────────────────────────────────

export const useValidateCoupon = () =>
  useMutation({ mutationFn: ({ code, subtotal }: { code: string; subtotal: number }) => api.validateCoupon(code, subtotal) });

/** The server's price for the current cart; `cartSig` changes whenever the cart does. */
export const useQuote = (method: ShopDeliveryMethod, coupon: string | null, cartSig: string, enabled: boolean) =>
  useQuery({ queryKey: K.quote(method, coupon, cartSig), queryFn: () => api.fetchQuote(method, coupon), enabled });

export const usePlaceOrder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ShopPlaceOrder) => api.placeOrder(body),
    onSuccess: order => {
      qc.setQueryData(K.order(order.orderNumber), order);
      return Promise.all([
        qc.invalidateQueries({ queryKey: K.cart() }),
        qc.invalidateQueries({ queryKey: K.orders() }),
        // Stock levels changed.
        qc.invalidateQueries({ queryKey: ['shop-store', uid(), 'product'] }),
        qc.invalidateQueries({ queryKey: ['shop-store', uid(), 'products'] }),
      ]);
    },
  });
};

// ── Orders ──────────────────────────────────────────────────────────────

export const useOrders = () =>
  useInfiniteQuery({
    queryKey: K.orders(),
    queryFn: ({ pageParam }) => api.fetchOrders(pageParam),
    initialPageParam: 1,
    getNextPageParam: last => (last.pageNumber < last.totalPages ? last.pageNumber + 1 : undefined),
  });

export const useOrder = (orderNumber: string) => useQuery({ queryKey: K.order(orderNumber), queryFn: () => api.fetchOrder(orderNumber) });

export const useCancelOrder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderNumber: string) => api.cancelOrder(orderNumber),
    onSuccess: (order, orderNumber) => {
      if (order && typeof order === 'object' && 'orderNumber' in order) qc.setQueryData(K.order(orderNumber), order);
      return Promise.all([
        qc.invalidateQueries({ queryKey: K.order(orderNumber) }),
        qc.invalidateQueries({ queryKey: K.orders() }),
      ]);
    },
  });
};

// ── Addresses ───────────────────────────────────────────────────────────

export const useAddresses = () => useQuery({ queryKey: K.addresses(), queryFn: api.fetchAddresses });

function useInvalidateAddresses() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: K.addresses() });
}

export const useSaveAddress = () => {
  const invalidate = useInvalidateAddresses();
  return useMutation({
    mutationFn: ({ id, body }: { id?: number; body: ShopAddressInput }) => (id ? api.updateAddress(id, body) : api.createAddress(body)),
    onSuccess: invalidate,
  });
};

export const useDeleteAddress = () => {
  const invalidate = useInvalidateAddresses();
  return useMutation({ mutationFn: (id: number) => api.deleteAddress(id), onSuccess: invalidate });
};

export const useSetDefaultAddress = () => {
  const invalidate = useInvalidateAddresses();
  return useMutation({ mutationFn: (id: number) => api.setDefaultAddress(id), onSuccess: invalidate });
};
