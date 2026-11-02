import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, SP, R } from '../../../theme';
import { useLayout } from '../../../utils/useLayout';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import Skeleton from '../../common/components/Skeleton';
import EmptyState from '../../dashboard/components/EmptyState';
import { useToast } from '../../common/components/Toast';
import { apiErrorText } from '../../../api/apiError';
import { ShopAddress } from '../api/shop.types';
import { useAddresses, useDeleteAddress, useSetDefaultAddress } from '../api/storeQueries';
import { useShopNav } from './shopNav';
import AddressSheet from './AddressForm';
import { ConfirmSheet, card } from './ui';

export const addressLines = (a: Pick<ShopAddress, 'line1' | 'line2' | 'city' | 'state' | 'postalCode'>) =>
  `${a.line1}${a.line2 ? `, ${a.line2}` : ''}, ${a.city}, ${a.state} ${a.postalCode}`;

export function AddressTitle({ a }: { a: ShopAddress }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
      <Text style={{ color: T.text, fontSize: 15, fontWeight: '700' }}>{a.fullName}</Text>
      {a.label ? (
        <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: R.pill, backgroundColor: T.bgInputActive }}>
          <Text style={{ color: T.textSub, fontSize: 11, fontWeight: '600' }}>{a.label}</Text>
        </View>
      ) : null}
      {a.isDefault && <Text style={{ color: T.brand, fontSize: 11, fontWeight: '800' }}>DEFAULT</Text>}
    </View>
  );
}

function LinkButton({ label, icon, onPress, danger, a11y }: { label: string; icon: React.ComponentProps<typeof Feather>['name']; onPress: () => void; danger?: boolean; a11y: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={a11y} style={({ pressed }) => ({ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: SP.sm, borderRadius: R.md, backgroundColor: pressed ? T.bgInputActive : 'transparent' })}>
      <Feather name={icon} size={15} color={danger ? T.err : T.brand} />
      <Text style={{ color: danger ? T.err : T.brand, fontSize: 13, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

export default function AddressesScreen() {
  const nav = useShopNav();
  const { hPad } = useLayout();
  const toast = useToast();
  const list = useAddresses();
  const makeDefault = useSetDefaultAddress();
  const remove = useDeleteAddress();
  const [editing, setEditing] = useState<ShopAddress | null | undefined>(undefined); // undefined = closed, null = new
  const [deleting, setDeleting] = useState<ShopAddress | null>(null);
  const fail = (e: unknown) => toast.show({ type: 'error', message: apiErrorText(e) });

  const items = list.data ?? [];
  return (
    <Screen>
      <ScreenHeader eyebrow="Shop" title="Addresses" onBack={nav.pop} action={{ label: 'Add', icon: 'plus', onPress: () => setEditing(null) }} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: hPad, paddingBottom: 60, gap: SP.md }}>
        {list.isPending && <Skeleton rows={2} height={120} borderRadius={R.lg} />}
        {list.isError && <EmptyState icon="alert-circle" tone="error" title="Couldn’t load your addresses" subtitle={apiErrorText(list.error)} action={{ label: 'Retry', onPress: () => list.refetch() }} />}
        {list.data && !items.length && (
          <EmptyState icon="map-pin" title="No saved addresses" subtitle="Add one now and checkout takes seconds." action={{ label: 'Add an address', onPress: () => setEditing(null) }} />
        )}
        {items.map(a => (
          <View key={a.id} style={[card, { padding: SP.lg, gap: 6, borderColor: a.isDefault ? T.brandBorder : T.line }]}>
            <AddressTitle a={a} />
            <Text style={{ color: T.textSub, fontSize: 13, lineHeight: 19 }}>{addressLines(a)}</Text>
            <Text style={{ color: T.textFaint, fontSize: 13 }}>{a.phone}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginLeft: -SP.sm, marginTop: 2 }}>
              <LinkButton label="Edit" icon="edit-2" a11y={`Edit address for ${a.fullName}`} onPress={() => setEditing(a)} />
              {!a.isDefault && (
                <LinkButton label="Make default" icon="star" a11y={`Make ${a.label ?? a.fullName} the default address`} onPress={() =>
                  makeDefault.mutate(a.id, { onSuccess: () => toast.show({ message: 'Default address updated' }), onError: fail })} />
              )}
              <LinkButton label="Delete" icon="trash-2" danger a11y={`Delete address for ${a.fullName}`} onPress={() => setDeleting(a)} />
            </View>
          </View>
        ))}
      </ScrollView>

      <AddressSheet
        visible={editing !== undefined}
        address={editing ?? null}
        defaultChecked={!items.length}
        onClose={() => setEditing(undefined)}
        onSaved={() => toast.show({ message: editing ? 'Address updated' : 'Address saved' })}
      />
      <ConfirmSheet
        visible={!!deleting}
        title="Delete this address?"
        message={deleting ? `${deleting.fullName}, ${addressLines(deleting)} will be removed. Past orders keep their delivery address.` : ''}
        confirmLabel="Delete address"
        loading={remove.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting.id, {
          onSuccess: () => { setDeleting(null); toast.show({ message: 'Address deleted' }); },
          onError: e => { setDeleting(null); fail(e); },
        })}
      />
    </Screen>
  );
}
