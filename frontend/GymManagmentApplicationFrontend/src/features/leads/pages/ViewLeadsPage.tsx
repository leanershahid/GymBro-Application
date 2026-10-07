import React, { useState } from 'react';
import { View, Text, ScrollView, FlatList, Pressable, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useLeads, useConvertLead } from '../api/leadQueries';
import { Lead, LeadStatus } from '../types/lead.types';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import PaginationFooter from '../../common/components/PaginationFooter';
import Skeleton from '../../common/components/Skeleton';
import StatusPill, { PillTone } from '../../common/components/StatusPill';
import EmptyState from '../../dashboard/components/EmptyState';
import StatsStrip from '../../common/StatsStrip';
import { T, withAlpha, SP } from '../../../theme';

type FeatherIconName = React.ComponentProps<typeof Feather>['name'];

const STATUS_META: Record<LeadStatus, { color: string; tone: PillTone }> = {
  new:       { color: T.sky,    tone: 'info'   },
  contacted: { color: T.violet, tone: 'violet' },
  qualified: { color: T.brand,  tone: 'brand'  },
  converted: { color: T.ok,     tone: 'ok'     },
  lost:      { color: T.err,    tone: 'err'    },
};

const SOURCE_ICONS: Record<string, FeatherIconName> = {
  instagram: 'instagram', referral: 'users', 'walk-in': 'map-pin',
  web: 'globe', event: 'calendar', other: 'help-circle',
};

const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

function LeadCard({ lead, onConvert }: { lead: Lead; onConvert: (id: number) => void }) {
  const sm   = STATUS_META[lead.status] ?? STATUS_META.new;
  const name = [lead.firstName, lead.lastName].filter(Boolean).join(' ') || 'Unknown';
  const src  = lead.source ?? 'other';
  const icon = SOURCE_ICONS[src] ?? 'help-circle';

  return (
    <View style={{
      backgroundColor: T.bgInput, borderRadius: 18, padding: 14,
      marginBottom: 10, borderWidth: 1, borderColor: T.bgInputActive,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
        {/* Source icon */}
        <View style={{
          width: 44, height: 44, borderRadius: 14,
          backgroundColor: withAlpha(sm.color, 0.12), borderWidth: 1, borderColor: withAlpha(sm.color, 0.28),
          alignItems: 'center', justifyContent: 'center', marginRight: 12,
        }}>
          <Feather name={icon} size={18} color={sm.color} />
        </View>

        <View style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
          <Text className="text-white text-[15px] font-bold" numberOfLines={1}>{name}</Text>
          {!!lead.email && <Text className="text-sub text-[12px]" numberOfLines={1}>{lead.email}</Text>}
          {!!lead.phone && !lead.email && <Text className="text-sub text-[12px]" numberOfLines={1}>{lead.phone}</Text>}
        </View>

        {/* Status badge */}
        <StatusPill label={capitalize(lead.status)} tone={sm.tone} />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Source + date */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>
          <View style={{ backgroundColor: T.bgInputActive, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: T.line }}>
            <Text style={{ color: T.textSub, fontSize: 11, fontWeight: '600' }} numberOfLines={1}>{capitalize(src)}</Text>
          </View>
          <Text className="text-faint text-[11px]" numberOfLines={1}>
            {new Date(lead.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
          </Text>
        </View>

        {/* Convert CTA — only for non-converted leads */}
        {lead.status !== 'converted' && lead.status !== 'lost' && (
          <Pressable
            onPress={() => onConvert(lead.id)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Convert ${name} to member`}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32, backgroundColor: withAlpha(T.brand, 0.12), borderWidth: 1, borderColor: withAlpha(T.brand, 0.30), borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}>
            <Feather name="user-check" size={13} color={T.brand} />
            <Text style={{ color: T.brand, fontSize: 11, fontWeight: '700' }}>Convert</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const STATUS_FILTERS: (LeadStatus | 'all')[] = ['all', 'new', 'contacted', 'qualified', 'converted', 'lost'];

interface Props { onBack?: () => void; onAddLead?: () => void; }

export default function ViewLeadsPage({ onBack, onAddLead }: Props) {
  const [page, setPage]         = useState(1);
  const [filter, setFilter]     = useState<LeadStatus | 'all'>('all');

  const { data: paged, isLoading, isError, refetch } = useLeads(page, 20);
  const { mutate: convert } = useConvertLead();

  const items      = paged?.items ?? [];
  const totalPages = paged?.totalPages ?? 1;
  const totalRecs  = paged?.totalRecords ?? 0;

  const filtered = filter === 'all' ? items : items.filter(l => l.status === filter);

  const handleConvert = (id: number) => {
    Alert.alert('Convert Lead', 'Convert this lead into a full member?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Convert', style: 'destructive', onPress: () =>
        convert(id, {
          onSuccess: () => Alert.alert('Success 🎉', 'Lead converted to member.'),
          onError:   () => Alert.alert('Error', 'Failed to convert lead.'),
        })
      },
    ]);
  };

  return (
    <Screen>
      <ScreenHeader
        eyebrow="Pipeline"
        title="Leads"
        onBack={onBack}
        action={onAddLead ? { label: 'Add', icon: 'plus', onPress: onAddLead } : undefined}
      />

      <View style={{ paddingHorizontal: SP.xl, paddingBottom: SP.lg }}>
        {/* Stats row */}
        {!isLoading && !isError && (
          <View style={{ marginBottom: SP.lg }}>
            <StatsStrip items={[
              { icon: 'target',       label: 'Total',     value: String(totalRecs),                                          accent: T.sky },
              { icon: 'star',         label: 'Qualified', value: String(items.filter(l => l.status === 'qualified').length), accent: T.brand },
              { icon: 'user-check',   label: 'Converted', value: String(items.filter(l => l.status === 'converted').length), accent: T.ok },
            ]} />
          </View>
        )}

        {/* Filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {STATUS_FILTERS.map(f => {
            const active = f === filter;
            const label = f === 'all' ? 'All' : capitalize(f);
            return (
              <Pressable key={f} onPress={() => { setFilter(f); setPage(1); }}
                hitSlop={{ top: 6, bottom: 6 }}
                accessibilityRole="button"
                accessibilityLabel={`Filter: ${label}`}
                accessibilityState={{ selected: active }}
                style={{ minHeight: 36, justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
                  backgroundColor: active ? T.brand : T.bgInput,
                  borderWidth: 1, borderColor: active ? T.brand : T.line }}>
                <Text style={{ color: active ? T.onBrand : T.textSub, fontSize: 12, fontWeight: '700' }}>{label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={isLoading || isError ? [] : filtered}
        keyExtractor={(l) => String(l.id)}
        renderItem={({ item }) => <LeadCard lead={item} onConvert={handleConvert} />}
        ListHeaderComponent={
          isLoading ? <Skeleton rows={4} height={96} /> :
          isError ? (
            <EmptyState
              icon="wifi-off"
              tone="error"
              title="Failed to load"
              subtitle="Check your connection and try again."
              action={{ label: 'Retry', onPress: () => refetch() }}
            />
          ) : null
        }
        ListEmptyComponent={
          !isLoading && !isError
            ? <EmptyState icon="target" title={`No leads ${filter !== 'all' ? `with status "${filter}"` : 'yet'}`} />
            : null
        }
        ListFooterComponent={
          !isLoading && !isError
            ? <PaginationFooter page={page} totalPages={totalPages} onChange={setPage} />
            : null
        }
        contentContainerStyle={{ paddingHorizontal: SP.xl, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      />
    </Screen>
  );
}
