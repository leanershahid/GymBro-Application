import React, { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, R, SP, withAlpha } from '../../../theme';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import EmptyState from '../../common/components/EmptyState';
import Skeleton from '../../common/components/Skeleton';
import SearchBar from '../../common/components/SearchBar';
import SegmentedTabs from '../../common/components/SegmentedTabs';
import SmallButton from '../../common/components/SmallButton';
import { SwitchRow } from '../../common/components/FormFields';
import { apiErrorText } from '../../../api/apiError';
import { useApiAccess } from '../../access/context/AccessContext';
import { useAssets, useFacilitiesSettings, useFacilityBranches, useFacilityReportCounts, useSaveFacilitiesSettings } from '../api/facilitiesQueries';
import type { Asset, FacilitiesSettings } from '../types/facilities.types';
import { ASSET_STATUS_LABEL, backLabel } from '../utils/facilitiesFormat';
import { AssetStatusChip, Card, ListRow, SectionTitle } from '../components/FacilitiesUi';
import { AssetFormPage } from '../components/AssetForms';

interface Props {
  onBack?: () => void;
  onOpenAsset: (id: number) => void;
  /** The problem-report queue (when that module is granted). */
  onOpenReports?: () => void;
}

type Filter = 'all' | 'down' | 'InService';

/** Admin: the gym-floor equipment register by branch and zone, with a status filter. */
export default function FacilitiesPage({ onBack, onOpenAsset, onOpenReports: openReports }: Props) {
  // The queue link only for people who were granted the reports module too.
  const onOpenReports = useApiAccess('facility-reports').canView ? openReports : undefined;
  const branches = useFacilityBranches();
  const [branchId, setBranchId] = useState(0);
  const [filter, setFilter] = useState<Filter>('all');
  const [term, setTerm] = useState('');
  const [adding, setAdding] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const q = useAssets({ branchId: branchId || undefined, status: filter === 'all' ? undefined : filter, q: term.trim() || undefined });
  const counts = useFacilityReportCounts(!!onOpenReports);

  const groups = useMemo(() => {
    const map = new Map<string, Asset[]>();
    for (const a of q.data ?? []) {
      const key = `${branchId ? '' : `${a.branchName ?? 'Branch'} · `}${a.zone ?? 'Other'}`;
      map.set(key, [...(map.get(key) ?? []), a]);
    }
    return [...map.entries()];
  }, [q.data, branchId]);
  const down = (q.data ?? []).filter(a => a.status !== 'InService').length;

  if (adding) return <AssetFormPage defaultBranchId={branchId || undefined} onDone={saved => { setAdding(false); if (saved) onOpenAsset(saved.id); }} />;

  return (
    <Screen>
      <ScreenHeader eyebrow="Facilities" title="Equipment" onBack={onBack} action={{ label: 'Add', icon: 'plus', onPress: () => setAdding(true) }} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: SP.xl, paddingBottom: 110, gap: SP.lg }}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={T.brand} />}>

        {onOpenReports && (
          <Pressable onPress={onOpenReports} accessibilityRole="button"
            accessibilityLabel={`Problem reports: ${counts.data?.open ?? 0} open, ${counts.data?.urgent ?? 0} urgent`}
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', gap: SP.md, padding: SP.lg, borderRadius: R.lg, minHeight: 60,
              backgroundColor: pressed ? T.bgInputActive : (counts.data?.urgent ?? 0) > 0 ? withAlpha(T.err, 0.1) : T.bgInput,
              borderWidth: 1, borderColor: (counts.data?.urgent ?? 0) > 0 ? withAlpha(T.err, 0.35) : T.line,
            })}>
            <Feather name="alert-circle" size={20} color={(counts.data?.urgent ?? 0) > 0 ? T.err : T.brand} />
            <Text style={{ color: T.text, fontSize: 15, fontWeight: '700', flex: 1 }}>Problem reports</Text>
            {(counts.data?.urgent ?? 0) > 0 && <Badge n={counts.data!.urgent} tone={T.err} label="urgent" />}
            <Badge n={counts.data?.open ?? 0} tone={T.brandGold} label="open" />
            <Feather name="chevron-right" size={18} color={T.textFaint} />
          </Pressable>
        )}

        {(branches.data ?? []).length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SP.sm }} accessibilityRole="tablist">
            {[{ id: 0, name: 'All branches' }, ...(branches.data ?? [])].map(b => {
              const active = b.id === branchId;
              return (
                <Pressable key={b.id} onPress={() => setBranchId(b.id)} accessibilityRole="tab" accessibilityState={{ selected: active }}
                  style={{ minHeight: 40, paddingHorizontal: SP.lg, borderRadius: R.pill, justifyContent: 'center',
                    backgroundColor: active ? T.brand : T.bgInput, borderWidth: 1, borderColor: active ? T.brand : T.line }}>
                  <Text style={{ color: active ? T.onBrand : T.text, fontSize: 13, fontWeight: '700' }}>{b.name}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
        <SegmentedTabs<Filter> tabs={[{ key: 'all', label: 'All' }, { key: 'down', label: `Not working${down && filter !== 'InService' ? ` (${down})` : ''}` }, { key: 'InService', label: 'In service' }]}
          value={filter} onChange={setFilter} />
        <SearchBar value={term} onChangeText={setTerm} placeholder="Search name, type, code or serial" label="Search equipment" />

        {q.isLoading ? <Skeleton rows={4} height={64} /> : q.isError ? (
          <EmptyState icon="alert-triangle" tone="error" title="Couldn't load the register" subtitle={apiErrorText(q.error)}
            action={{ label: 'Try again', onPress: () => q.refetch() }} />
        ) : groups.length === 0 ? (
          <EmptyState icon="tool" title={term || filter !== 'all' ? 'Nothing matches' : 'No equipment yet'}
            subtitle={term || filter !== 'all' ? 'Try another filter.' : 'Add your machines and areas so members can report problems in a few taps.'}
            action={term || filter !== 'all' ? undefined : { label: 'Add equipment', onPress: () => setAdding(true) }} />
        ) : groups.map(([zone, assets]) => (
          <View key={zone}>
            <SectionTitle title={zone} right={<Text style={{ color: T.textFaint, fontSize: 12 }}>{assets.length}</Text>} />
            <View style={{ gap: SP.sm }}>
              {assets.map(a => (
                <ListRow key={a.id} title={a.name} onPress={() => onOpenAsset(a.id)}
                  tint={a.status === 'OutOfService' ? T.err : a.status === 'Limited' ? T.brandGold : undefined}
                  label={`${a.name}, ${ASSET_STATUS_LABEL[a.status]}${a.openReports ? `, ${a.openReports} open reports` : ''}`}
                  subtitle={[
                    a.assetType, a.isKeyFacility ? 'Key facility' : null,
                    a.status !== 'InService' ? `${a.statusReason ?? ASSET_STATUS_LABEL[a.status]} · ${backLabel(a.expectedBackOn)}` : null,
                    a.serviceOverdue ? 'Service overdue' : null, a.openReports ? `${a.openReports} open report${a.openReports > 1 ? 's' : ''}` : null,
                  ].filter(Boolean).join(' · ')}
                  right={<AssetStatusChip status={a.status} />} />
              ))}
            </View>
          </View>
        ))}

        <View style={{ alignSelf: 'flex-start' }}>
          <SmallButton icon="settings" label={showSettings ? 'Hide settings' : 'Reporting settings'} tone={T.textSub} onPress={() => setShowSettings(s => !s)} />
        </View>
        {showSettings && <SettingsCard />}
      </ScrollView>
    </Screen>
  );
}

function Badge({ n, tone, label }: { n: number; tone: string; label: string }) {
  return (
    <View accessibilityLabel={`${n} ${label}`} style={{ minWidth: 26, height: 24, paddingHorizontal: 8, borderRadius: 12, backgroundColor: withAlpha(tone, 0.18), alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: tone, fontSize: 12, fontWeight: '800' }}>{n}</Text>
    </View>
  );
}

function SettingsCard() {
  const s = useFacilitiesSettings();
  const save = useSaveFacilitiesSettings();
  if (!s.data) return null;
  const set = (patch: Partial<FacilitiesSettings>) => save.mutate({ ...s.data!, ...patch });
  return (
    <Card style={{ paddingBottom: 0 }}>
      <SwitchRow label="Members can report problems" value={s.data.membersCanReport} onValueChange={v => set({ membersCanReport: v })} />
      <SwitchRow label="Trainers can report problems" value={s.data.trainersCanReport} onValueChange={v => set({ trainersCanReport: v })} />
      <SwitchRow label="Notify staff about every report" value={s.data.notifyStaffOnEveryReport} onValueChange={v => set({ notifyStaffOnEveryReport: v })}
        description="Unsafe reports are always sent, as urgent." />
      <SwitchRow label="Show out-of-service machines to members" value={s.data.showOutOfServiceToMembers} onValueChange={v => set({ showOutOfServiceToMembers: v })}
        description='On the gym info screen: "Treadmill 3 · back ~Fri".' />
    </Card>
  );
}
