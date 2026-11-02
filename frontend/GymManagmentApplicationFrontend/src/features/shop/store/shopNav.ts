import { createContext, useContext } from 'react';

/** Screens pushed over the tabs (Shop · Cart · Wishlist · Orders). */
export type ShopRoute =
  | { id: 'listing'; category?: string; search?: string; featured?: boolean; isNew?: boolean; title?: string }
  | { id: 'product'; slug: string }
  | { id: 'checkout' }
  | { id: 'confirmed'; orderNumber: string }
  | { id: 'order'; orderNumber: string }
  | { id: 'addresses' };

export interface ShopNav {
  push: (r: ShopRoute) => void;
  /** Replaces the top screen (e.g. checkout → confirmation). */
  replace: (r: ShopRoute) => void;
  pop: () => void;
  /** Closes every pushed screen and shows a tab. */
  home: (tab?: string) => void;
  setTab: (tab: string) => void;
}

export const ShopNavContext = createContext<ShopNav | null>(null);

export function useShopNav(): ShopNav {
  const nav = useContext(ShopNavContext);
  if (!nav) throw new Error('useShopNav must be used inside ShopStoreApp');
  return nav;
}
