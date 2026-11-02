import React from 'react';
import { View, Text, ScrollView, RefreshControl, Linking } from 'react-native';
import { T, SP } from '../../../theme';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import Skeleton from '../../common/components/Skeleton';
import StatusPill from '../../common/components/StatusPill';
import Avatar from '../../common/components/Avatar';
import { useAdminCustomer } from '../api/adminQueries';
import { formatDate, formatMoney, ORDER_STATUS_LABEL } from '../common/format';
import { Card, ErrorView, Eyebrow, InfoRow, RowCard, SmallButton, STATUS_TONE } from './components/kit';
import { ShopNav } from './nav';

export default function CustomerDetailScreen({ customerId, nav, onBack }: { customerId: number; nav: ShopNav; onBack: () => void }) {
  const { data: c, isPending, isError, error, refetch, isRefetching } = useAdminCustomer(customerId);
  const name = c ? `${c.firstName} ${c.lastName}`.trim() : 'Customer';

  return (
    <Screen>
      <ScreenHeader eyebrow="Customers" title={name} onBack={onBack} />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: SP.xl, paddingBottom: 80 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={T.brand} colors={[T.brand]} />}
      >
        {isPending ? <Skeleton rows={3} height={160} />
          : isError || !c ? <ErrorView error={error} onRetry={refetch} />
          : (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.md, marginBottom: SP.lg }}>
                <Avatar size={56} label={`${name} photo`} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text selectable numberOfLines={1} style={{ color: T.textSub, fontSize: 14 }}>{c.email}</Text>
                  {!!c.phone && <Text selectable style={{ color: T.textFaint, fontSize: 13 }}>{c.phone}</Text>}
                  <View style={{ marginTop: 4 }}><StatusPill label={c.isActive ? 'Active' : 'Inactive'} tone={c.isActive ? 'ok' : 'err'} dot /></View>
                </View>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.sm, marginBottom: SP.lg }}>
                <SmallButton label="Email" icon="mail" onPress={() => Linking.openURL(`mailto:${c.email}`)} />
                {!!c.phone && <SmallButton label="Call" icon="phone" onPress={() => Linking.openURL(`tel:${c.phone}`)} />}
              </View>

              <View style={{ flexDirection: 'row', gap: SP.sm, marginBottom: SP.lg }}>
                <Stat label="Orders" value={String(c.ordersCount)} />
                <Stat label="Lifetime spend" value={formatMoney(c.totalSpent)} />
              </View>

              <Card>
                <InfoRow label="Joined" value={formatDate(c.createdAt)} />
                <InfoRow label="Last order" value={formatDate(c.lastOrderAt) || '—'} />
                <InfoRow label="Status" value={c.status} />
                {!!c.roles.length && <InfoRow label="Roles" value={c.roles.join(', ')} />}
              </Card>

              <Card>
                <Eyebrow>Addresses</Eyebrow>
                {c.addresses.length ? c.addresses.map((a, i) => (
                  <View key={a.id} style={{ paddingVertical: SP.sm, borderTopWidth: i ? 1 : 0, borderTopColor: T.line }}>
                    <Text style={{ color: T.text, fontSize: 14, fontWeight: '700' }}>
                      {a.fullName}{a.label ? ` · ${a.label}` : ''}{a.isDefault ? <Text style={{ color: T.brand }}> · Default</Text> : null}
                    </Text>
                    <Text style={{ color: T.textSub, fontSize: 13 }}>
                      {a.line1}{a.line2 ? `, ${a.line2}` : ''}, {a.city}, {a.state} {a.postalCode}
                    </Text>
                    <Text style={{ color: T.textFaint, fontSize: 12 }}>{a.phone}</Text>
                  </View>
                )) : <Text style={{ color: T.textSub, fontSize: 13 }}>No saved addresses.</Text>}
              </Card>

              <Text accessibilityRole="header" style={{ color: T.text, fontSize: 16, fontWeight: '800', marginBottom: SP.md }}>Recent orders</Text>
              {c.recentOrders.length ? c.recentOrders.map(o => (
                <RowCard key={o.id} onPress={() => nav.openOrder(o.orderNumber)} label={`Order ${o.orderNumber}, ${ORDER_STATUS_LABEL[o.status]}, ${formatMoney(o.total)}`}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.sm }}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ color: T.text, fontSize: 14, fontWeight: '700' }}>#{o.orderNumber}</Text>
                      <Text style={{ color: T.textFaint, fontSize: 12 }}>{formatDate(o.placedAt)} · {o.itemCount} item{o.itemCount === 1 ? '' : 's'}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <Text style={{ color: T.text, fontSize: 14, fontWeight: '800' }}>{formatMoney(o.total)}</Text>
                      <StatusPill label={ORDER_STATUS_LABEL[o.status]} tone={STATUS_TONE[o.status]} />
                    </View>
                  </View>
                </RowCard>
              )) : <Text style={{ color: T.textSub, textAlign: 'center', paddingVertical: SP.lg }}>No orders yet.</Text>}
            </>
          )}
      </ScrollView>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View accessible accessibilityLabel={`${label}: ${value}`}
      style={{ flex: 1, backgroundColor: T.bgInput, borderRadius: 16, borderWidth: 1, borderColor: T.line, padding: SP.lg }}>
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: T.text, fontSize: 20, fontWeight: '800' }}>{value}</Text>
      <Text style={{ color: T.textSub, fontSize: 12, marginTop: 2 }}>{label}</Text>
    </View>
  );
}
