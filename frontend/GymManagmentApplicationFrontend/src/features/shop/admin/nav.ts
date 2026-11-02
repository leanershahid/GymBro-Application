import { ShopOrderStatus } from '../api/shop.types';

/** Filters a tab can be opened with (e.g. the dashboard's "Manage inventory" → low stock only). */
export interface TabParams {
  lowStock?: boolean;
  status?: ShopOrderStatus;
}

/** Navigation inside the shop admin: detail screens stack over the tab chips. */
export interface ShopNav {
  openProduct: (id: number | null) => void;
  openOrder: (orderNumber: string) => void;
  openCustomer: (id: number) => void;
  goTab: (key: string, params?: TabParams) => void;
  /** Whether a tab is granted. */
  can: (key: string) => boolean;
}
