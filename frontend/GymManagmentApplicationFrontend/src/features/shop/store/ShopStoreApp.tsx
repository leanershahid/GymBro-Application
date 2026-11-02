import React, { useEffect, useMemo, useState } from 'react';
import { View, BackHandler, StyleSheet } from 'react-native';
import { T, SP } from '../../../theme';
import { useLayout } from '../../../utils/useLayout';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import SegmentedTabs from '../../common/components/SegmentedTabs';
import EmptyState from '../../dashboard/components/EmptyState';
import { usePageTabs } from '../../access/context/AccessContext';
import { useCart, useStoreSettings, useWishlist } from '../api/storeQueries';
import { ShopNav, ShopNavContext, ShopRoute } from './shopNav';
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
export default function ShopStoreApp() {
  const { hPad } = useLayout();
  const { items: tabs, tab, setTab } = usePageTabs('member.shop');
  const [stack, setStack] = useState<{ key: number; route: ShopRoute }[]>([]);
  const store = useStoreSettings();
  const cart = useCart();
  const wishlist = useWishlist();

  const nav = useMemo<ShopNav>(() => {
    return {
      push: route => setStack(s => [...s, { key: ++seq, route }]),
      replace: route => setStack(s => [...s.slice(0, -1), { key: ++seq, route }]),
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
