import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, BackHandler, StyleSheet } from 'react-native';
import { T, SP } from '../../../theme';
import { useLayout } from '../../../utils/useLayout';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import SegmentedTabs from '../../common/components/SegmentedTabs';
import EmptyState from '../../common/components/EmptyState';
import { usePageTabs } from '../../access/context/AccessContext';
import { useCart, useStoreSettings, useWishlist } from '../api/storeQueries';
import { parseShopPath, shopPath, ShopNav, ShopNavContext, ShopRoute, shopRouteToPath } from './shopNav';
import type { OpenRequest } from '../../access/types/access.types';
import { pathKey, syncStack } from '../../../navigation/paths';
import { PathChange, useOpenRequest, useReportPath } from '../../../navigation/useAreaRoute';
import HomeTab from './HomeTab';
import CartTab, { WishlistTab } from './CartTab';
import ListingScreen from './ListingScreen';
import ProductDetailScreen from './ProductDetailScreen';
import CheckoutScreen from './CheckoutScreen';
import AddressesScreen from './AddressesScreen';
import { OrderConfirmedScreen, OrderDetailScreen, OrdersTab } from './OrderScreens';

let seq = 0;
const TITLES: Record<string, string> = { store: 'Shop', cart: 'Your cart', wishlist: 'Wishlist', orders: 'Your orders' };

function Pushed({ route }: { route: ShopRoute }) {
  switch (route.id) {
    case 'listing': return <ListingScreen route={route} />;
    case 'product': return <ProductDetailScreen slug={route.slug} />;
    case 'checkout': return <CheckoutScreen />;
    case 'confirmed': return <OrderConfirmedScreen orderNumber={route.orderNumber} />;
    case 'order': return <OrderDetailScreen orderNumber={route.orderNumber} />;
    case 'addresses': return <AddressesScreen />;
  }
}

/**
 * The member shop: tabs Shop · Cart · Wishlist · Orders (from the access list), with product,
 * listing, checkout and order screens pushed over them. Pushed screens stack on top of the tabs
 * (which stay mounted), so going back keeps scroll position and state.
 */
interface Props {
  /** Path the shell asks for (tab / pushed screen), from a URL or Back/Forward. */
  open?: OpenRequest;
  /** Reports the tab and top pushed screen, for history and the URL (/member/shop/...). */
  onPathChange?: PathChange;
}

type Entry = { key: number; route: ShopRoute };
const entryKey = (e: Entry) => pathKey(shopRouteToPath(e.route));

export default function ShopStoreApp({ open, onPathChange }: Props = {}) {
  const { hPad } = useLayout();
  const [initial] = useState(() => parseShopPath(open?.path ?? []));
  const { items: tabs, tab, setTab } = usePageTabs('member.shop', initial.tab);
  const [stack, setStack] = useState<Entry[]>(() => (initial.route ? [{ key: ++seq, route: initial.route }] : []));
  useOpenRequest(open, path => {
    const p = parseShopPath(path);
    setTab(p.tab);
    setStack(s => syncStack(s, p.route && { key: ++seq, route: p.route }, entryKey));
  });
  const replacing = useRef(false);
  useReportPath(shopPath(tab, tabs[0]?.key ?? null, stack[stack.length - 1]?.route), onPathChange, () => {
    const r = replacing.current; replacing.current = false; return r;
  });
  const store = useStoreSettings();
  const cart = useCart();
  const wishlist = useWishlist();

  const nav = useMemo<ShopNav>(() => {
    return {
      push: route => setStack(s => [...s, { key: ++seq, route }]),
      replace: route => { replacing.current = true; setStack(s => [...s.slice(0, -1), { key: ++seq, route }]); },
      pop: () => setStack(s => s.slice(0, -1)),
      home: t => { setStack([]); if (t) setTab(t); },
      setTab: t => { setStack([]); setTab(t); },
    };
  }, [setTab]);

  // Android back closes the top screen first.
  useEffect(() => {
    if (!stack.length) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { nav.pop(); return true; });
    return () => sub.remove();
  }, [stack.length, nav]);

  const count = (key: string) => key === 'cart' ? cart.data?.itemCount ?? 0 : key === 'wishlist' ? wishlist.data?.items.length ?? 0 : 0;
  const tabItems = tabs.map(t => ({ key: t.key, label: count(t.key) ? `${t.label} · ${count(t.key)}` : t.label }));

  return (
    <ShopNavContext.Provider value={nav}>
      <View style={{ flex: 1, backgroundColor: T.bg }}>
        <Screen>
          <View style={{ flex: 1 }} accessibilityElementsHidden={stack.length > 0} importantForAccessibility={stack.length ? 'no-hide-descendants' : 'auto'}>
          <ScreenHeader
            eyebrow={store.data?.name ?? 'Gym shop'}
            title={TITLES[tab ?? 'store'] ?? 'Shop'}
            action={tab === 'orders' ? { label: 'Addresses', icon: 'map-pin', onPress: () => nav.push({ id: 'addresses' }) } : undefined}
          />
          {tabs.length > 1 && (
            <SegmentedTabs tabs={tabItems} value={tab ?? ''} onChange={setTab} style={{ marginHorizontal: hPad, marginBottom: SP.lg }} />
          )}
          <View style={{ flex: 1 }}>
            {!tab && <EmptyState icon="lock" title="The shop isn’t available on your plan" />}
            {tab === 'store' && <HomeTab hPad={hPad} />}
            {tab === 'cart' && <CartTab hPad={hPad} />}
            {tab === 'wishlist' && <WishlistTab hPad={hPad} />}
            {tab === 'orders' && <OrdersTab hPad={hPad} />}
          </View>
          </View>
        </Screen>

        {stack.map((s, i) => (
          <View
            key={s.key}
            style={[StyleSheet.absoluteFill, { backgroundColor: T.bg }]}
            pointerEvents={i === stack.length - 1 ? 'auto' : 'none'}
            accessibilityElementsHidden={i !== stack.length - 1}
            importantForAccessibility={i === stack.length - 1 ? 'auto' : 'no-hide-descendants'}
          >
            <Pushed route={s.route} />
          </View>
        ))}
      </View>
    </ShopNavContext.Provider>
  );
}
