import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BackHandler, View } from 'react-native';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import EmptyState from '../../dashboard/components/EmptyState';
import { SP } from '../../../theme';
import { usePageTabs } from '../../access/context/AccessContext';
import { ChipItem, ChipRow } from './components/kit';
import { ShopNav, TabParams } from './nav';
import DashboardTab from './DashboardTab';
import ProductsTab from './ProductsTab';
import ProductEditScreen from './ProductEditScreen';
import CategoriesTab from './CategoriesTab';
import InventoryTab from './InventoryTab';
import OrdersTab from './OrdersTab';
import OrderDetailScreen from './OrderDetailScreen';
import CustomersTab from './CustomersTab';
import CustomerDetailScreen from './CustomerDetailScreen';
import CouponsTab from './CouponsTab';
import SettingsTab from './SettingsTab';

type Route =
  | { kind: 'product'; id: number | null }
  | { kind: 'order'; orderNumber: string }
  | { kind: 'customer'; id: number };

const TAB_ICON: Record<string, ChipItem<string>['icon']> = {
  dashboard: 'bar-chart-2', orders: 'package', products: 'box', categories: 'folder',
  inventory: 'layers', coupons: 'tag', customers: 'users', settings: 'settings',
};

/** The admin shop (tabs Dashboard · Orders · Products · Categories · Inventory · Coupons · Customers · Settings). */
export default function ShopAdminApp({ onBack }: { onBack?: () => void }) {
  const { items, tab, setTab, has } = usePageTabs('admin.shop');
  // Detail screens stack on top of the tabs (customer → order → back to customer).
  const [stack, setStack] = useState<Route[]>([]);
  const [params, setParams] = useState<TabParams>({});
  const [paramsVersion, setParamsVersion] = useState(0);

  const push = useCallback((r: Route) => setStack(s => [...s, r]), []);
  const pop = useCallback(() => setStack(s => s.slice(0, -1)), []);

  useEffect(() => {
    if (!stack.length) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { pop(); return true; });
    return () => sub.remove();
  }, [stack.length, pop]);

  const nav: ShopNav = useMemo(() => ({
    openProduct: id => push({ kind: 'product', id }),
    openOrder: orderNumber => push({ kind: 'order', orderNumber }),
    openCustomer: id => push({ kind: 'customer', id }),
    goTab: (key, p = {}) => {
      if (!has(key)) return;
      setStack([]);
      setParams(p);
      setParamsVersion(v => v + 1);
      setTab(key);
    },
    can: has,
  }), [push, has, setTab]);

  const top = stack[stack.length - 1];
  const detail =
    top?.kind === 'product' ? <ProductEditScreen key={`p${top.id ?? 'new'}`} productId={top.id} nav={nav} onBack={pop}
      onCreated={id => setStack(s => [...s.slice(0, -1), { kind: 'product', id }])} />
    : top?.kind === 'order' ? <OrderDetailScreen key={`o${top.orderNumber}`} orderNumber={top.orderNumber} nav={nav} onBack={pop} />
    : top?.kind === 'customer' ? <CustomerDetailScreen key={`c${top.id}`} customerId={top.id} nav={nav} onBack={pop} />
    : null;

  const label = items.find(i => i.key === tab)?.label ?? 'Shop';

  return (
    <View style={{ flex: 1 }}>
    {/* The tabs stay mounted under a detail screen so their search, filters and page survive. */}
    <Screen style={top ? { display: 'none' } : undefined}>
      <ScreenHeader eyebrow="Shop" title={label} onBack={onBack} />
      {items.length === 0 ? (
        <EmptyState icon="lock" title="No shop access" subtitle="Ask an administrator to grant you the shop pages." />
      ) : (
        <>
          {items.length > 1 && (
            <View style={{ paddingLeft: SP.xl, marginBottom: SP.md }}>
              <ChipRow
                label="Shop sections"
                items={items.map(i => ({ ...i, icon: TAB_ICON[i.key] }))}
                value={tab ?? ''}
                onChange={k => { setParams({}); setTab(k); }}
              />
            </View>
          )}
          <View style={{ flex: 1 }} key={`${tab}-${paramsVersion}`}>
            {tab === 'dashboard' && <DashboardTab nav={nav} />}
            {tab === 'orders' && <OrdersTab nav={nav} initialStatus={params.status} />}
            {tab === 'products' && <ProductsTab nav={nav} />}
            {tab === 'categories' && <CategoriesTab />}
            {tab === 'inventory' && <InventoryTab nav={nav} initialLowOnly={params.lowStock} />}
            {tab === 'coupons' && <CouponsTab />}
            {tab === 'customers' && <CustomersTab nav={nav} />}
            {tab === 'settings' && <SettingsTab />}
          </View>
        </>
      )}
    </Screen>
    {detail}
    </View>
  );
}
