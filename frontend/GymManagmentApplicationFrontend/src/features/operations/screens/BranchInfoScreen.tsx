import React, { useState } from 'react';
import { ScrollView, View, Text, Linking, Platform, Pressable, RefreshControl } from 'react-native';
import { T, SP, R, withAlpha } from '../../../theme';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import EmptyState from '../../common/components/EmptyState';
import Skeleton from '../../common/components/Skeleton';
import { showAlert } from '../../common/components/dialogs';
import { apiErrorText } from '../../../api/apiError';
import { useBranchDirectory, useBranchInfo } from '../api/operationsQueries';
import type { BranchInfo } from '../types/operations.types';
import { Card, HoursList, LinkRow, OpenStatusBadge, RichText, SectionTitle } from '../components/OperationsUi';
import ServiceStatusBanner from '../components/ServiceStatusBanner';
import { OutOfServiceList } from '../../facilities/routes';

interface Props {
  /** Branch to show; defaults to the member's own branch. */
  branchId?: number;
  onBack?: () => void;
  /** Facilities: shows a "Report a problem" link under the out-of-service list. */
  onReportProblem?: () => void;
}

/** Opens the platform maps app where possible (Apple Maps on iOS), otherwise Google Maps in the browser. */
function mapsUrlFor(b: BranchInfo): string | null {
  if (Platform.OS === 'ios' && (b.lat != null || b.fullAddress)) {
    const q = encodeURIComponent(b.fullAddress ? `${b.name}, ${b.fullAddress}` : b.name);
    return b.lat != null && b.lng != null ? `https://maps.apple.com/?q=${q}&ll=${b.lat},${b.lng}` : `https://maps.apple.com/?q=${q}`;
  }
  return b.mapsUrl;
}

async function open(url: string, what: string) {
  try {
    await Linking.openURL(url);
  } catch {
    showAlert(`Couldn't open ${what}`, url);
  }
}

/** Member branch info: status, hours for the week, service notices, address/maps, call, amenities, accessibility. */
export default function BranchInfoScreen({ branchId, onBack, onReportProblem }: Props) {
  const [selected, setSelected] = useState<number | undefined>(branchId);
  const q = useBranchInfo(selected);
  const directory = useBranchDirectory();
  const b = q.data;
  const others = (directory.data ?? []).length > 1 ? directory.data! : [];

  return (
    <Screen>
      <ScreenHeader eyebrow="Gym info" title={b?.name ?? 'Your gym'} onBack={onBack} />
      {q.isLoading ? (
        <View style={{ paddingHorizontal: SP.xl }} accessibilityLabel="Loading gym info"><Skeleton rows={4} height={110} /></View>
      ) : q.isError || !b ? (
        <EmptyState icon="map-pin" tone="error" title="Couldn't load gym info" subtitle={apiErrorText(q.error)}
          action={{ label: 'Try again', onPress: () => q.refetch() }} />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: SP.xl, paddingBottom: 110, gap: SP.xxl }}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={T.brand} />}
        >
          {others.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SP.sm }}>
              {others.map(o => {
                const active = o.id === b.id;
                return (
                  <Pressable key={o.id} onPress={() => setSelected(o.id)} accessibilityRole="tab" accessibilityState={{ selected: active }}
                    accessibilityLabel={`${o.name}${o.isMine ? ', your branch' : ''}. ${o.today.label}`}
                    style={{
                      minHeight: 44, paddingHorizontal: SP.lg, borderRadius: R.pill, justifyContent: 'center',
                      backgroundColor: active ? T.brand : T.bgInput, borderWidth: 1, borderColor: active ? T.brand : T.line,
                    }}>
                    <Text style={{ color: active ? T.onBrand : T.text, fontSize: 14, fontWeight: '700' }}>{o.name}{o.isMine ? ' ★' : ''}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          {/* Today */}
          <Card>
            {b.hours.hasHours
              ? <OpenStatusBadge status={b.hours.today} />
              : <Text style={{ color: T.textSub, fontSize: 14 }}>Opening hours haven't been added yet.</Text>}
            {b.hours.today.note && <Text style={{ color: T.brandGold, fontSize: 13, marginTop: SP.sm }}>{b.hours.today.note}</Text>}
            {b.statuses.length > 0 && <View style={{ marginTop: SP.lg }}><ServiceStatusBanner statuses={b.statuses} expanded /></View>}
          </Card>
          <OutOfServiceList branchId={b.id} onReportProblem={onReportProblem} />

          {b.hours.hasHours && (
            <View>
              <SectionTitle title="Opening hours" />
              <Card style={{ paddingHorizontal: SP.xs, paddingVertical: SP.xs }}><HoursList days={b.hours.days} /></Card>
              <Text style={{ color: T.textFaint, fontSize: 12, marginTop: SP.sm }}>Times are local to the gym ({b.hours.timezone}).</Text>
            </View>
          )}

          <View>
            <SectionTitle title="Contact" />
            <Card style={{ paddingVertical: SP.sm }}>
              <LinkRow icon="map-pin" label="Address" value={b.fullAddress ?? 'Not added yet'}
                onPress={mapsUrlFor(b) ? () => open(mapsUrlFor(b)!, 'maps') : undefined} hint="Opens directions in maps" />
              {b.phone && (
                <>
                  <View style={{ height: 1, backgroundColor: T.line }} />
                  <LinkRow icon="phone" label="Phone" value={b.phone} onPress={() => open(`tel:${b.phone!.replace(/[^\d+]/g, '')}`, 'the phone app')} hint="Calls the gym" />
                </>
              )}
              {b.email && (
                <>
                  <View style={{ height: 1, backgroundColor: T.line }} />
                  <LinkRow icon="mail" label="Email" value={b.email} onPress={() => open(`mailto:${b.email}`, 'email')} hint="Writes an email to the gym" />
                </>
              )}
            </Card>
          </View>

          {b.amenities && (
            <View>
              <SectionTitle title="Amenities" />
              <Card><RichText text={b.amenities} /></Card>
            </View>
          )}
          {b.accessibility && (
            <View>
              <SectionTitle title="Accessibility" />
              <Card tint={T.sky} style={{ borderColor: withAlpha(T.sky, 0.25) }}><RichText text={b.accessibility} /></Card>
            </View>
          )}
        </ScrollView>
      )}
    </Screen>
  );
}
