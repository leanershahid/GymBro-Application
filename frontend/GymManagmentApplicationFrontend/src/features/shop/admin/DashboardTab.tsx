import React, { useState } from 'react';
import { View, Text, ScrollView, RefreshControl, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, SP, R, withAlpha } from '../../../theme';
import KpiTile from '../../common/components/dashboard/KpiTile';
import Skeleton from '../../common/components/Skeleton';
import StatusPill from '../../common/components/StatusPill';
import AreaChart from '../../dashboard/components/AreaChart';
import { useApiAccess } from '../../access/context/AccessContext';
import { useShopDashboard } from '../api/adminQueries';
import { ShopDashboard } from '../api/shop.types';
import { formatCompact, formatMoney, formatPrice, ORDER_STATUS_LABEL } from '../common/format';
import { Card, ErrorView, RowCard, SmallButton, STATUS_COLOR, STATUS_TONE, Thumb } from './components/kit';
import { ShopNav } from './nav';

const dayLabel = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

export default function DashboardTab({ nav }: { nav: ShopNav }) {
  const { data, isPending, isError, error, refetch, isRefetching } = useShopDashboard();
  const { canCreate } = useApiAccess('shop');
  const [w, setW] = useState(0);

  return (
    <ScrollView
      contentContainerStyle={{ paddingHorizontal: SP.xl, paddingBottom: 60 }}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={T.brand} colors={[T.brand]} />}
    >
      <View onLayout={e => setW(e.nativeEvent.layout.width)}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.sm, marginBottom: SP.lg }}>
          {canCreate && nav.can('products') && <SmallButton label="Add product" icon="plus" variant="brand" onPress={() => nav.openProduct(null)} />}
          {nav.can('orders') && <SmallButton label="Orders" icon="shopping-cart" onPress={() => nav.goTab('orders')} />}
          {nav.can('inventory') && <SmallButton label="Stock" icon="package" onPress={() => nav.goTab('inventory')} />}
        </View>

        {isPending ? <Skeleton rows={4} height={120} />
          : isError ? <ErrorView error={error} onRetry={refetch} />
          : w > 0 && <Body d={data} w={w} nav={nav} />}
      </View>
    </ScrollView>
  );
}

function Body({ d, w, nav }: { d: ShopDashboard; w: number; nav: ShopNav }) {
  const tileW = (w - SP.sm) / 2;
  const delta = d.revenuePrevious30Days > 0 ? ((d.revenueLast30Days - d.revenuePrevious30Days) / d.revenuePrevious30Days) * 100 : null;
  const inner = w - SP.lg * 2 - 2;
  const sales = d.salesByDay;
  const maxRev = Math.max(...sales.map(s => s.revenue), 1);
  const statusData = d.ordersByStatus.filter(s => s.count > 0);
  const statusTotal = statusData.reduce((a, s) => a + s.count, 0);
  const pick = (i: number) => (sales[i] ? dayLabel(sales[i].date) : '');
  const xLabels = sales.length > 3 ? [pick(0), pick(Math.floor(sales.length / 3)), pick(Math.floor((sales.length * 2) / 3)), pick(sales.length - 1)] : sales.map(s => dayLabel(s.date));
  const topMax = d.topProducts[0]?.revenue || 1;

  return (
    <>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.sm, marginBottom: SP.lg }}>
        <KpiTile width={tileW} icon="dollar-sign" label="Revenue (30 days)" value={formatPrice(d.revenueLast30Days)}
          delta={delta === null ? undefined : { label: `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`, positive: delta >= 0 }}
          hint="vs previous 30 days" />
        <KpiTile width={tileW} icon="shopping-cart" label="Orders" value={d.ordersCount.toLocaleString('en-IN')} accent={T.sky}
          onPress={nav.can('orders') ? () => nav.goTab('orders') : undefined} />
        <KpiTile width={tileW} icon="trending-up" label="Average order" value={formatPrice(d.averageOrderValue)} accent={T.brandGold} />
        <KpiTile width={tileW} icon="users" label="Buyers" value={d.customersCount.toLocaleString('en-IN')} accent={T.violet}
          onPress={nav.can('customers') ? () => nav.goTab('customers') : undefined} />
      </View>

      <Card title="Revenue" subtitle={`Last 30 days · ${formatPrice(d.totalRevenue)} all time`}>
        {sales.length > 1 ? (
          <AreaChart
            data={sales.map(s => ({ label: dayLabel(s.date), value: s.revenue }))}
            width={inner}
            height={180}
            yLabels={[formatCompact(maxRev), formatCompact(maxRev * 0.66), formatCompact(maxRev * 0.33), '₹0']}
            xLabels={xLabels}
          />
        ) : <Text style={{ color: T.textSub, paddingVertical: SP.xl, textAlign: 'center' }}>Sales will appear here.</Text>}
      </Card>

      <Card title="Orders by status">
        {statusTotal > 0 ? (
          <>
            <View style={{ flexDirection: 'row', height: 14, borderRadius: R.pill, overflow: 'hidden', gap: 2, marginBottom: SP.md }}>
              {statusData.map(s => <View key={s.status} style={{ flex: s.count, backgroundColor: STATUS_COLOR[s.status] }} />)}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: SP.xs }}>
              {statusData.map(s => (
                <Pressable key={s.status} onPress={() => nav.goTab('orders', { status: s.status })}
                  accessibilityRole="button" accessibilityLabel={`${ORDER_STATUS_LABEL[s.status]}: ${s.count} orders`}
                  style={{ width: '50%', minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: SP.sm, paddingRight: SP.md }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: STATUS_COLOR[s.status] }} />
                  <Text numberOfLines={1} style={{ flex: 1, color: T.textSub, fontSize: 13 }}>{ORDER_STATUS_LABEL[s.status]}</Text>
                  <Text style={{ color: T.text, fontSize: 13, fontWeight: '700' }}>{s.count}</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : <Text style={{ color: T.textSub, paddingVertical: SP.lg, textAlign: 'center' }}>No orders yet.</Text>}
      </Card>

      <Card title="Daily orders" subtitle="Last 30 days">
        <DailyBars values={sales.map(s => s.orders)} labels={xLabels} />
      </Card>

      <Card title="Top products" subtitle="By revenue">
        {d.topProducts.length ? d.topProducts.slice(0, 5).map(p => (
          <View key={p.productId} style={{ flexDirection: 'row', alignItems: 'center', gap: SP.md, marginBottom: SP.md }}
            accessible accessibilityLabel={`${p.name}: ${formatPrice(p.revenue)}, ${p.unitsSold} sold`}>
            <Thumb uri={p.imageUrl} size={40} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: SP.sm }}>
                <Text numberOfLines={1} style={{ flex: 1, color: T.text, fontSize: 13, fontWeight: '600' }}>{p.name}</Text>
                <Text style={{ color: T.textSub, fontSize: 13, fontWeight: '700' }}>{formatPrice(p.revenue)}</Text>
              </View>
              <View style={{ height: 6, borderRadius: R.pill, backgroundColor: withAlpha(T.text, 0.06), marginTop: 6, overflow: 'hidden' }}>
                <View style={{ width: `${(p.revenue / topMax) * 100}%`, height: '100%', backgroundColor: T.brand, borderRadius: R.pill }} />
              </View>
              <Text style={{ color: T.textFaint, fontSize: 11, marginTop: 3 }}>{p.unitsSold} sold</Text>
            </View>
          </View>
        )) : <Text style={{ color: T.textSub, paddingVertical: SP.lg, textAlign: 'center' }}>Sales will appear here.</Text>}
      </Card>

      <Card title="Low stock" subtitle={`${d.lowStock.length} variant${d.lowStock.length === 1 ? '' : 's'} need attention`}>
        {d.lowStock.length ? (
          <>
            {d.lowStock.slice(0, 6).map(i => {
              const c = i.available === 0 ? T.err : T.brandGold;
              return (
                <View key={i.variantId} style={{ flexDirection: 'row', alignItems: 'center', gap: SP.sm, paddingVertical: 6 }}>
                  <Feather name="alert-triangle" size={15} color={c} />
                  <Text numberOfLines={1} style={{ flex: 1, color: T.text, fontSize: 13 }}>
                    {i.productName} <Text style={{ color: T.textFaint }}>· {i.variantName}</Text>
                  </Text>
                  <Text style={{ color: c, fontSize: 13, fontWeight: '800' }}>{i.available}</Text>
                </View>
              );
            })}
            {nav.can('inventory') && (
              <SmallButton label="Manage inventory" icon="arrow-right" onPress={() => nav.goTab('inventory', { lowStock: true })} style={{ alignSelf: 'flex-start', marginTop: SP.sm }} />
            )}
          </>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.sm, paddingVertical: SP.md }}>
            <Feather name="package" size={16} color={T.textSub} />
            <Text style={{ color: T.textSub, fontSize: 13 }}>Every variant is above its threshold.</Text>
          </View>
        )}
      </Card>

      <Text accessibilityRole="header" style={{ color: T.text, fontSize: 16, fontWeight: '800', marginBottom: SP.md }}>Recent orders</Text>
      {d.recentOrders.length ? d.recentOrders.map(o => (
        <RowCard key={o.id} onPress={() => nav.openOrder(o.orderNumber)} label={`Order ${o.orderNumber}, ${ORDER_STATUS_LABEL[o.status]}, ${formatMoney(o.total)}`}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.sm }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: T.text, fontSize: 14, fontWeight: '700' }}>#{o.orderNumber}</Text>
              <Text numberOfLines={1} style={{ color: T.textSub, fontSize: 12 }}>{o.customerName ?? o.customerEmail} · {dayLabel(o.placedAt)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Text style={{ color: T.text, fontSize: 14, fontWeight: '700' }}>{formatMoney(o.total)}</Text>
              <StatusPill label={ORDER_STATUS_LABEL[o.status]} tone={STATUS_TONE[o.status]} />
            </View>
          </View>
        </RowCard>
      )) : <Text style={{ color: T.textSub, textAlign: 'center', paddingVertical: SP.lg }}>No orders yet. They show up here as soon as members check out.</Text>}
    </>
  );
}

function DailyBars({ values, labels }: { values: number[]; labels: string[] }) {
  const max = Math.max(...values, 1);
  const H = 120;
  if (!values.length) return <Text style={{ color: T.textSub, textAlign: 'center' }}>No data yet.</Text>;
  return (
    <View accessible accessibilityLabel={`Daily orders, ${values.reduce((a, b) => a + b, 0)} in total, at most ${max} in a day`}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: H, gap: 2 }}>
        {values.map((v, i) => (
          <View key={i} style={{ flex: 1, height: Math.max(2, (v / max) * H), borderTopLeftRadius: 3, borderTopRightRadius: 3, backgroundColor: v ? T.brand : T.line }} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
        {labels.map((l, i) => <Text key={i} style={{ color: T.textFaint, fontSize: 11 }}>{l}</Text>)}
      </View>
    </View>
  );
}
