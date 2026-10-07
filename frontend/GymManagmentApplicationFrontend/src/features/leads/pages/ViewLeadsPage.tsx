import React, { useState } from 'react';
import {
  View, Text, ScrollView, Pressable,
  StatusBar, Platform, Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useLeads, useConvertLead } from '../api/leadQueries';
import { Lead, LeadStatus } from '../types/lead.types';
import BackButton from '../../common/components/BackButton';
import PaginationFooter from '../../common/components/PaginationFooter';
import Skeleton from '../../common/components/Skeleton';
import { T, withAlpha } from '../../../theme';

type FeatherIconName = React.ComponentProps<typeof Feather>['name'];

const STATUS_META: Record<LeadStatus, { color: string; bg: string; border: string }> = {
  new:       { color: T.sky, bg: withAlpha(T.sky, 0.12),  border: withAlpha(T.sky, 0.28) },
  contacted: { color: T.violet, bg: withAlpha(T.violet, 0.12), border: withAlpha(T.violet, 0.28) },
  qualified: { color: T.brand, bg: withAlpha(T.brand, 0.12),   border: withAlpha(T.brand, 0.28)   },
  converted: { color: T.ok, bg: withAlpha(T.ok, 0.12),   border: withAlpha(T.ok, 0.28)   },
  lost:      { color: T.err, bg: withAlpha(T.err, 0.12),   border: withAlpha(T.err, 0.28)   },
};

const SOURCE_ICONS: Record<string, FeatherIconName> = {
  instagram: 'instagram', referral: 'users', 'walk-in': 'map-pin',
  web: 'globe', event: 'calendar', other: 'help-circle',
};

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
          backgroundColor: sm.bg, borderWidth: 1, borderColor: sm.border,
          alignItems: 'center', justifyContent: 'center', marginRight: 12,
        }}>
          <Feather name={icon} size={18} color={sm.color} />
        </View>

        <View style={{ flex: 1 }}>
          <Text className="text-white text-[15px] font-bold" numberOfLines={1}>{name}</Text>
          {!!lead.email && <Text className="text-sub text-[12px]" numberOfLines={1}>{lead.email}</Text>}
          {!!lead.phone && !lead.email && <Text className="text-sub text-[12px]">{lead.phone}</Text>}
        </View>

        {/* Status badge */}
        <View style={{ backgroundColor: sm.bg, borderWidth: 1, borderColor: sm.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
          <Text style={{ color: sm.color, fontSize: 10, fontWeight: '700', textTransform: 'capitalize' }}>{lead.status}</Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Source + date */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ backgroundColor: T.bgInputActive, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: T.line }}>
            <Text style={{ color: T.textSub, fontSize: 10, fontWeight: '600', textTransform: 'capitalize' }}>{src}</Text>
          </View>
          <Text className="text-faint text-[10px]">
            {new Date(lead.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
          </Text>
        </View>

        {/* Convert CTA — only for non-converted leads */}
        {lead.status !== 'converted' && lead.status !== 'lost' && (
          <Pressable onPress={() => onConvert(lead.id)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: withAlpha(T.brand, 0.12), borderWidth: 1, borderColor: withAlpha(T.brand, 0.30), borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}>
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
    <View className="flex-1 bg-bg" style={{ paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 0 }}>
      <StatusBar barStyle="light-content" backgroundColor={T.bg} />

      {/* Header */}
      <View className="px-5 pt-5 pb-4">
        <View className="flex-row items-center justify-between mb-5">
          {onBack && <BackButton onPress={onBack} />}
          <View style={{ flex: 1 }}>
            <Text className="text-sub text-[11px] font-semibold uppercase tracking-widest mb-0.5">Pipeline</Text>
            <Text className="text-white text-[26px] font-extrabold tracking-tight">Leads</Text>
          </View>
          {onAddLead && (
            <Pressable onPress={onAddLead} className="flex-row items-center gap-2 bg-brand rounded-full px-4 py-2.5">
              <Feather name="plus" size={15} color={T.onBrand} />
              <Text className="text-black text-[13px] font-bold">Add</Text>
            </Pressable>
          )}
        </View>

        {/* Stats row */}
        {!isLoading && !isError && (
          <View className="flex-row gap-3 mb-4">
            {[
              { label: 'Total',     value: totalRecs,                                              color: T.sky },
              { label: 'Qualified', value: items.filter(l => l.status === 'qualified').length,     color: T.brand },
              { label: 'Converted', value: items.filter(l => l.status === 'converted').length,     color: T.ok },
            ].map(s => (
              <View key={s.label} className="flex-1 bg-surface border border-line rounded-2xl p-3 items-center gap-1">
                <Text style={{ color: s.color, fontSize: 18, fontWeight: '900' }}>{s.value}</Text>
                <Text className="text-sub text-[10px] font-semibold">{s.label}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {STATUS_FILTERS.map(f => {
            const active = f === filter;
            return (
              <Pressable key={f} onPress={() => { setFilter(f); setPage(1); }}
                style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
                  backgroundColor: active ? T.brand : T.bgInput,
                  borderWidth: 1, borderColor: active ? T.brand : T.line }}>
                <Text style={{ color: active ? T.onBrand : T.textSub, fontSize: 12, fontWeight: '700', textTransform: 'capitalize' }}>{f}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>
        {isLoading && <Skeleton rows={4} height={96} />}

        {isError && (
          <View className="items-center pt-16">
            <Feather name="wifi-off" size={28} color={T.err} />
            <Text className="text-white text-[16px] font-bold mt-4 mb-2">Failed to load</Text>
            <Pressable onPress={() => refetch()} className="bg-brand rounded-full px-7 py-3 mt-3">
              <Text className="text-black font-bold">Retry</Text>
            </Pressable>
          </View>
        )}

        {!isLoading && !isError && filtered.length === 0 && (
          <View className="items-center pt-16">
            <View className="w-[68px] h-[68px] rounded-full bg-surface border border-line items-center justify-center mb-4">
              <Feather name="target" size={28} color={T.textSub} />
            </View>
            <Text className="text-white text-[16px] font-bold mb-2">No leads {filter !== 'all' ? `with status "${filter}"` : 'yet'}</Text>
          </View>
        )}

        {!isLoading && !isError && filtered.map(lead => (
          <LeadCard key={lead.id} lead={lead} onConvert={handleConvert} />
        ))}

        {/* Pagination */}
        {!isLoading && !isError && <PaginationFooter page={page} totalPages={totalPages} onChange={setPage} />}
      </ScrollView>
    </View>
  );
}
