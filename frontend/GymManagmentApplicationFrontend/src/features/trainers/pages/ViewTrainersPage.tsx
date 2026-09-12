import React, { useState } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput,
  StatusBar, Platform, ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTrainers } from '../api/trainerQueries';
import { TrainerSummary } from '../types/trainer.types';
import { T } from '../components/theme';
import StatsStrip from '../../common/StatsStrip';
import Skeleton from '../../common/components/Skeleton';
import ManageUserAccessPage from '../../module-access/pages/ManageUserAccessPage';

type FeatherIconName = React.ComponentProps<typeof Feather>['name'];

const TINTS = [
  { bg: 'rgba(34,211,238,0.08)',  accent: '#22D3EE' },
  { bg: 'rgba(126,211,33,0.08)',   accent: '#7ED321' },
  { bg: 'rgba(167,139,250,0.08)', accent: '#A78BFA' },
  { bg: 'rgba(250,204,21,0.08)',  accent: '#FACC15' },
];
const tint = (id: number) => TINTS[id % TINTS.length];

// ─── Status badge ─────────────────────────────────────────────────
function AvailabilityBadge({ isAvailable }: { isAvailable: boolean }) {
  const color  = isAvailable ? T.brand : T.err;
  const bg     = isAvailable ? 'rgba(126,211,33,0.15)' : 'rgba(255,77,77,0.15)';
  const border = isAvailable ? 'rgba(126,211,33,0.30)' : 'rgba(255,77,77,0.30)';
  return (
    <View style={{ backgroundColor: bg, borderWidth: 1, borderColor: border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: color }} />
        <Text style={{ color, fontSize: 11, fontWeight: '700' }}>{isAvailable ? 'Available' : 'Unavailable'}</Text>
      </View>
    </View>
  );
}

// ─── Trainer card ─────────────────────────────────────────────────
function TrainerCard({ trainer, onPress }: { trainer: TrainerSummary; onPress: () => void }) {
  const c        = tint(trainer.id);
  const initials = trainer.displayName
    .split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';
  const designation = trainer.employment?.designation ?? '';
  const department  = trainer.employment?.department  ?? '';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        marginBottom: 14,
        borderRadius: 24,
        overflow: 'hidden',
        opacity: pressed ? 0.92 : 1,
        backgroundColor: 'rgba(34,197,94,0.06)',
        borderWidth: 1,
        borderColor: 'rgba(34,197,94,0.18)',
        shadowColor: '#22c55e',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.18,
        shadowRadius: 18,
        elevation: 8,
      })}
    >
      {/* Accent top strip */}
      <View style={{ height: 3, backgroundColor: c.accent, borderTopLeftRadius: 24, borderTopRightRadius: 24 }} />

      <View style={{ padding: 16 }}>
        {/* Top row — avatar + name + badge */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
          <View style={{
            width: 52, height: 52, borderRadius: 26,
            backgroundColor: c.bg,
            borderWidth: 1.5, borderColor: c.accent + '60',
            alignItems: 'center', justifyContent: 'center',
            marginRight: 14,
          }}>
            <Text style={{ color: c.accent, fontSize: 20, fontWeight: '800' }}>{initials}</Text>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={{ color: T.text, fontSize: 16, fontWeight: '800', letterSpacing: -0.3 }} numberOfLines={1}>
              {trainer.displayName}
            </Text>
            {(designation || department) ? (
              <Text style={{ color: T.textSub, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                {designation}{department ? ` · ${department}` : ''}
              </Text>
            ) : (
              <Text style={{ color: T.textFaint, fontSize: 12, marginTop: 2 }}>No designation</Text>
            )}
          </View>

          <AvailabilityBadge isAvailable={trainer.isAvailable} />
        </View>

        {/* Code pill + experience */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <View style={{
            backgroundColor: c.bg, borderWidth: 1, borderColor: c.accent + '40',
            borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4,
          }}>
            <Text style={{ color: c.accent, fontSize: 11, fontWeight: '700', letterSpacing: 0.4 }}>
              {trainer.trainerCode || 'N/A'}
            </Text>
          </View>

          {trainer.experienceYears !== null && trainer.experienceYears !== undefined && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Feather name="award" size={12} color={T.textFaint} />
              <Text style={{ color: T.textSub, fontSize: 12 }}>
                {trainer.experienceYears}yr{trainer.experienceYears !== 1 ? 's' : ''} exp
              </Text>
            </View>
          )}

          {trainer.rating !== null && trainer.rating !== undefined && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Feather name="star" size={12} color="#FACC15" />
              <Text style={{ color: T.textSub, fontSize: 12 }}>{trainer.rating.toFixed(1)}</Text>
            </View>
          )}
        </View>

        {/* Divider */}
        <View style={{ height: 1, backgroundColor: 'rgba(34,197,94,0.12)', marginBottom: 12 }} />

        {/* Specializations */}
        {!!trainer.specializations?.length && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {trainer.specializations.slice(0, 3).map((s) => (
              <View key={s} style={{
                backgroundColor: 'rgba(255,255,255,0.05)',
                borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
                borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3,
              }}>
                <Text style={{ color: T.textSub, fontSize: 11 }}>{s}</Text>
              </View>
            ))}
            {trainer.specializations.length > 3 && (
              <View style={{
                backgroundColor: 'rgba(255,255,255,0.05)',
                borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
                borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3,
              }}>
                <Text style={{ color: T.textFaint, fontSize: 11 }}>+{trainer.specializations.length - 3}</Text>
              </View>
            )}
          </View>
        )}

        {/* Contact row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
            <Feather name="mail" size={12} color={T.textFaint} />
            <Text style={{ color: T.textSub, fontSize: 12 }} numberOfLines={1}>{trainer.email}</Text>
          </View>
          {!!trainer.phone && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Feather name="phone" size={12} color={T.textFaint} />
              <Text style={{ color: T.textSub, fontSize: 12 }}>{trainer.phone}</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

// ─── Pagination controls ──────────────────────────────────────────
function PaginationBar({
  page, totalPages, onPrev, onNext,
}: { page: number; totalPages: number; onPrev: () => void; onNext: () => void }) {
  if (totalPages <= 1) return null;
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 16, marginTop: 8, marginBottom: 32,
    }}>
      <Pressable
        onPress={onPrev}
        disabled={page <= 1}
        style={{
          flexDirection: 'row', alignItems: 'center', gap: 6,
          paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999,
          backgroundColor: page <= 1 ? 'rgba(255,255,255,0.04)' : 'rgba(34,197,94,0.10)',
          borderWidth: 1,
          borderColor: page <= 1 ? 'rgba(255,255,255,0.08)' : 'rgba(34,197,94,0.25)',
          opacity: page <= 1 ? 0.4 : 1,
        }}
      >
        <Feather name="chevron-left" size={16} color={page <= 1 ? T.textFaint : T.brand} />
        <Text style={{ color: page <= 1 ? T.textFaint : T.brand, fontSize: 13, fontWeight: '600' }}>Prev</Text>
      </Pressable>

      <View style={{
        paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999,
        backgroundColor: 'rgba(34,197,94,0.08)',
        borderWidth: 1, borderColor: 'rgba(34,197,94,0.18)',
      }}>
        <Text style={{ color: T.brand, fontSize: 13, fontWeight: '700' }}>{page} / {totalPages}</Text>
      </View>

      <Pressable
        onPress={onNext}
        disabled={page >= totalPages}
        style={{
          flexDirection: 'row', alignItems: 'center', gap: 6,
          paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999,
          backgroundColor: page >= totalPages ? 'rgba(255,255,255,0.04)' : 'rgba(34,197,94,0.10)',
          borderWidth: 1,
          borderColor: page >= totalPages ? 'rgba(255,255,255,0.08)' : 'rgba(34,197,94,0.25)',
          opacity: page >= totalPages ? 0.4 : 1,
        }}
      >
        <Text style={{ color: page >= totalPages ? T.textFaint : T.brand, fontSize: 13, fontWeight: '600' }}>Next</Text>
        <Feather name="chevron-right" size={16} color={page >= totalPages ? T.textFaint : T.brand} />
      </Pressable>
    </View>
  );
}

// ─── Page ─────────────────────────────────────────────────────────
interface ViewTrainersPageProps {
  onBack?: () => void;
  onAddTrainer?: () => void;
}

const PAGE_SIZE = 20;

export default function ViewTrainersPage({ onBack, onAddTrainer }: ViewTrainersPageProps) {
  const [search, setSearch]   = useState('');
  const [page, setPage]       = useState(1);
  const [manageAccessFor, setManageAccessFor] = useState<TrainerSummary | null>(null);

  const { data: paged, isLoading, isError, isFetching, refetch } = useTrainers(page, PAGE_SIZE);

  if (manageAccessFor) {
    return (
      <ManageUserAccessPage
        userId={manageAccessFor.userId}
        userName={manageAccessFor.displayName}
        onBack={() => setManageAccessFor(null)}
      />
    );
  }

  const items        = paged?.items        ?? [];
  const totalRecords = paged?.totalRecords ?? 0;
  const totalPages   = paged?.totalPages   ?? 1;

  const filtered = items.filter((t) =>
    search.trim() === '' ||
    t.displayName.toLowerCase().includes(search.toLowerCase()) ||
    t.trainerCode?.toLowerCase().includes(search.toLowerCase()) ||
    t.email?.toLowerCase().includes(search.toLowerCase())
  );

  const handlePrev = () => { if (page > 1) { setPage((p) => p - 1); } };
  const handleNext = () => { if (page < totalPages) { setPage((p) => p + 1); } };

  return (
    <View style={{
      flex: 1,
      backgroundColor: T.bg,
      paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 0,
    }}>
      <StatusBar barStyle="light-content" backgroundColor={T.bg} />

      {/* ── Header ── */}
      <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
          {onBack && (
            <Pressable
              onPress={onBack}
              hitSlop={12}
              style={{
                width: 42, height: 42, borderRadius: 21,
                backgroundColor: 'rgba(34,197,94,0.10)',
                borderWidth: 1, borderColor: 'rgba(34,197,94,0.22)',
                alignItems: 'center', justifyContent: 'center',
                marginRight: 14,
              }}
            >
              <Feather name="arrow-left" size={20} color={T.text} />
            </Pressable>
          )}

          <View style={{ flex: 1 }}>
            <Text style={{ color: T.textSub, fontSize: 11, fontWeight: '600', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 3 }}>
              Staff
            </Text>
            <Text style={{ color: T.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.5 }}>
              All Trainers
            </Text>
          </View>

          {/* Fetching spinner */}
          {isFetching && !isLoading && (
            <ActivityIndicator size="small" color={T.brand} style={{ marginRight: 12 }} />
          )}

          {onAddTrainer && (
            <Pressable
              onPress={onAddTrainer}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 8,
                backgroundColor: T.brand, borderRadius: 999,
                paddingHorizontal: 16, paddingVertical: 10,
                shadowColor: T.brand,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.4, shadowRadius: 10, elevation: 8,
              }}
            >
              <Feather name="plus" size={16} color={T.onBrand} />
              <Text style={{ color: T.onBrand, fontSize: 13, fontWeight: '700' }}>Add</Text>
            </Pressable>
          )}
        </View>

        {/* Search */}
        <View style={{
          flexDirection: 'row', alignItems: 'center',
          backgroundColor: 'rgba(34,197,94,0.06)',
          borderWidth: 1, borderColor: 'rgba(34,197,94,0.18)',
          borderRadius: 16, paddingHorizontal: 14, height: 48,
        }}>
          <Feather name="search" size={16} color={T.textFaint} style={{ marginRight: 10 }} />
          <TextInput
            style={{ flex: 1, color: T.text, fontSize: 14 }}
            placeholder="Search by name, code or email…"
            placeholderTextColor={T.textFaint}
            value={search}
            onChangeText={(v) => { setSearch(v); setPage(1); }}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')} hitSlop={8}>
              <Feather name="x" size={16} color={T.textFaint} />
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Summary strip */}
        {!isLoading && !isError && (
          <View style={{ marginBottom: 20 }}>
            <StatsStrip items={[
              { icon: 'award',        label: 'Total',     value: String(totalRecords),                                                                  accent: '#22D3EE' },
              { icon: 'check-circle', label: 'Available', value: String(items.filter((t) => t.isAvailable).length),                                     accent: T.brand   },
              { icon: 'eye',          label: 'This page', value: String(filtered.length),                                                               accent: '#A78BFA' },
            ]} />
          </View>
        )}

        {/* Loading */}
        {isLoading && <Skeleton rows={3} height={165} borderRadius={24} />}

        {/* Error */}
        {isError && (
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <View style={{
              width: 68, height: 68, borderRadius: 34,
              backgroundColor: 'rgba(239,68,68,0.10)',
              borderWidth: 1, borderColor: 'rgba(239,68,68,0.20)',
              alignItems: 'center', justifyContent: 'center', marginBottom: 16,
            }}>
              <Feather name="wifi-off" size={30} color={T.err} />
            </View>
            <Text style={{ color: T.text, fontSize: 17, fontWeight: '700', marginBottom: 8 }}>Failed to load</Text>
            <Text style={{ color: T.textSub, fontSize: 13, textAlign: 'center', marginBottom: 24 }}>
              Check your connection and try again.
            </Text>
            <Pressable
              onPress={() => refetch()}
              style={{ backgroundColor: T.brand, borderRadius: 999, paddingHorizontal: 28, paddingVertical: 14 }}
            >
              <Text style={{ color: T.onBrand, fontSize: 15, fontWeight: '700' }}>Retry</Text>
            </Pressable>
          </View>
        )}

        {/* Empty */}
        {!isLoading && !isError && filtered.length === 0 && (
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <View style={{
              width: 68, height: 68, borderRadius: 34,
              backgroundColor: 'rgba(255,255,255,0.06)',
              borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
              alignItems: 'center', justifyContent: 'center', marginBottom: 16,
            }}>
              <Feather name="award" size={30} color={T.textSub} />
            </View>
            <Text style={{ color: T.text, fontSize: 17, fontWeight: '700', marginBottom: 8 }}>
              {search ? 'No results' : 'No trainers yet'}
            </Text>
            <Text style={{ color: T.textSub, fontSize: 13, textAlign: 'center' }}>
              {search ? `Nothing matches "${search}"` : 'Onboard your first trainer to get started.'}
            </Text>
          </View>
        )}

        {/* Cards */}
        {!isLoading && !isError && filtered.map((trainer) => (
          <TrainerCard key={trainer.id} trainer={trainer} onPress={() => setManageAccessFor(trainer)} />
        ))}

        {/* Pagination */}
        {!isLoading && !isError && (
          <PaginationBar
            page={page}
            totalPages={totalPages}
            onPrev={handlePrev}
            onNext={handleNext}
          />
        )}
      </ScrollView>
    </View>
  );
}
