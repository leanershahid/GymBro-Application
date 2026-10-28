import React from 'react';
import { View, Text, FlatList, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useBranches } from '../api/branchQueries';
import { Branch } from '../types/branch.types';
import { T, withAlpha, R, SP } from '../../../theme';
import { useLayout } from '../../../utils/useLayout';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import SearchBar from '../../common/components/SearchBar';
import StatusPill, { toneForStatus } from '../../common/components/StatusPill';
import Skeleton from '../../common/components/Skeleton';
import EmptyState from '../../dashboard/components/EmptyState';

import StatsStrip from '../../common/StatsStrip';

// ─── Helpers ──────────────────────────────────────────────────────
function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch { return iso; }
}

const TINTS = [
  { bg: withAlpha(T.brand, 0.08),   accent: T.brand },
  { bg: withAlpha(T.sky, 0.08),  accent: T.sky },
  { bg: withAlpha(T.violet, 0.08), accent: T.violet },
  { bg: withAlpha(T.brandGold, 0.08),  accent: T.brandGold },
];
const tint = (id: number) => TINTS[id % TINTS.length];

// ─── Branch card ──────────────────────────────────────────────────
// There is no branch detail screen yet, so the card is a grouped View rather than a
// Pressable with a no-op handler.
function BranchCard({ branch, heroH }: { branch: Branch; heroH: number }) {
  const c        = tint(branch.id);
  const hasImage = !!branch.logoUrl && branch.logoUrl !== 'string' && branch.logoUrl.startsWith('http');

  return (
    <View
      accessible
      accessibilityLabel={`${branch.name}, ${branch.status}${branch.city ? `, ${branch.city}` : ''}`}
      style={{
        marginBottom: 18,
        borderRadius: R.xl,
        overflow: 'hidden',
        shadowColor: T.shadow,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.40,
        shadowRadius: 20,
        elevation: 10,
      }}
    >
      {/* ── Hero image / colour background ── */}
      <View style={{ height: heroH, backgroundColor: hasImage ? T.onBrand : c.bg }}>
        {hasImage ? (
          <>
            <Image
              source={{ uri: branch.logoUrl }}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
              resizeMode="cover"
            />
            {/* dark scrim */}
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: withAlpha(T.black, 0.45) }} />
          </>
        ) : (
          /* fallback — initials on tinted bg */
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{
              width: 72, height: 72, borderRadius: R.xl,
              backgroundColor: withAlpha(T.text, 0.08),
              borderWidth: 1, borderColor: withAlpha(c.accent, 0.25),
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Text style={{ color: c.accent, fontSize: 28, fontWeight: '800' }}>
                {branch.name.charAt(0).toUpperCase()}
              </Text>
            </View>
          </View>
        )}

        {/* ── Top row overlay ── */}
        <View style={{
          position: 'absolute', top: 14, left: 14, right: 14,
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        }}>
          {/* Code pill */}
          <View style={{
            backgroundColor: T.overlay,
            borderWidth: 1, borderColor: withAlpha(c.accent, 0.31),
            borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6,
            flexShrink: 1, marginRight: 8,
          }}>
            <Text numberOfLines={1} style={{ color: T.text, fontSize: 11, fontWeight: '600', letterSpacing: 0.6 }}>
              {branch.code || '—'}
            </Text>
          </View>

          {/* Arrow badge (decorative) */}
          <View style={{
            width: 34, height: 34, borderRadius: 17,
            backgroundColor: withAlpha(T.text, 0.12),
            borderWidth: 1, borderColor: withAlpha(T.text, 0.80),
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Feather name="arrow-up-right" size={16} color={T.text} />
          </View>
        </View>

        {/* ── Bottom glass dock ── */}
        <View style={{
          position: 'absolute', left: 14, right: 14, bottom: 14,
          borderRadius: R.xl,
          backgroundColor: withAlpha(T.black, 0.60),
          borderWidth: 1, borderColor: withAlpha(T.text, 0.10),
        }}>
          {/* Accent hairline */}
          <View style={{ height: 2.5, backgroundColor: c.accent, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl }} />

          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 }}>
            {/* Avatar circle */}
            <View style={{
              width: 38, height: 38, borderRadius: 19,
              backgroundColor: c.bg,
              borderWidth: 1.5, borderColor: withAlpha(c.accent, 0.38),
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Text style={{ color: c.accent, fontSize: 15, fontWeight: '800' }}>
                {branch.name.charAt(0).toUpperCase()}
              </Text>
            </View>

            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: T.text, fontSize: 15, fontWeight: '800', letterSpacing: -0.2 }} numberOfLines={1}>
                {branch.name}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                <StatusPill label={branch.status} tone={toneForStatus(branch.status)} dot />
                <Text style={{ color: T.textSub, fontSize: 11 }}>·</Text>
                <Feather name="map-pin" size={11} color={T.textFaint} />
                <Text style={{ color: T.textSub, fontSize: 11, flexShrink: 1 }} numberOfLines={1}>
                  {branch.city}{branch.state ? `, ${branch.state}` : ''}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* ── Detail panel below image ── */}
      <View style={{
        backgroundColor: withAlpha(T.text, 0.04),
        borderWidth: 1, borderTopWidth: 0,
        borderColor: withAlpha(T.text, 0.08),
        borderBottomLeftRadius: R.xl, borderBottomRightRadius: R.xl,
        padding: 16,
      }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {/* Capacity */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{
              width: 28, height: 28, borderRadius: 8,
              backgroundColor: c.bg,
              borderWidth: 1, borderColor: withAlpha(c.accent, 0.19),
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Feather name="users" size={13} color={c.accent} />
            </View>
            <View>
              <Text style={{ color: T.text, fontSize: 13, fontWeight: '700' }}>{branch.capacity}</Text>
              <Text style={{ color: T.textFaint, fontSize: 11 }}>capacity</Text>
            </View>
          </View>

          {/* Phone */}
          {!!branch.phone && branch.phone !== 'string' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>
              <View style={{
                width: 28, height: 28, borderRadius: 8,
                backgroundColor: withAlpha(T.text, 0.05),
                borderWidth: 1, borderColor: withAlpha(T.text, 0.10),
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Feather name="phone" size={13} color={T.textSub} />
              </View>
              <Text style={{ color: T.textSub, fontSize: 12, flexShrink: 1 }} numberOfLines={1}>{branch.phone}</Text>
            </View>
          )}
        </View>

        {/* Email + timezone row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
          {!!branch.email && branch.email !== 'string' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, minWidth: 0, marginRight: 8 }}>
              <Feather name="mail" size={12} color={T.textFaint} />
              <Text style={{ color: T.textSub, fontSize: 12, flexShrink: 1 }} numberOfLines={1}>{branch.email}</Text>
            </View>
          )}
          <Text style={{ color: T.textFaint, fontSize: 11 }} numberOfLines={1}>
            {formatDate(branch.createdAt)}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ─── Page ─────────────────────────────────────────────────────────
interface ViewBranchesPageProps {
  onBack?: () => void;
  onAddBranch?: () => void;
}

export default function ViewBranchesPage({ onBack, onAddBranch }: ViewBranchesPageProps) {
  const [search, setSearch] = React.useState('');
  const { data: branches = [], isLoading, isError, refetch } = useBranches();
  const { width } = useLayout();
  const heroH = Math.round(Math.min(200, width * 0.5));

  const filtered = branches.filter((b) =>
    search.trim() === '' ||
    b.name.toLowerCase().includes(search.toLowerCase()) ||
    b.city.toLowerCase().includes(search.toLowerCase()) ||
    b.code.toLowerCase().includes(search.toLowerCase())
  );

  const listHeader = (
    <>
      {/* Summary strip */}
      {!isLoading && !isError && (
        <View style={{ marginBottom: 24 }}>
          <StatsStrip items={[
            { icon: 'map-pin', label: 'Total',  value: String(branches.length),                                                     accent: T.brand   },
            { icon: 'check-circle', label: 'Active', value: String(branches.filter((b) => b.status.toLowerCase() === 'active').length), accent: T.sky },
            { icon: 'eye',    label: 'Shown',  value: String(filtered.length),                                                     accent: T.violet },
          ]} />
        </View>
      )}

      {isLoading && <Skeleton rows={3} height={heroH + 80} borderRadius={R.xl} gap={18} />}

      {isError && (
        <EmptyState
          icon="wifi-off"
          tone="error"
          title="Failed to load"
          subtitle="Check your connection and try again."
          action={{ label: 'Retry', onPress: () => refetch() }}
        />
      )}
    </>
  );

  return (
    <Screen>
      <ScreenHeader
        eyebrow="Locations"
        title="All Branches"
        onBack={onBack}
        action={onAddBranch ? { label: 'Add', icon: 'plus', onPress: onAddBranch } : undefined}
      />

      {/* Search */}
      <View style={{ paddingHorizontal: SP.xl, paddingBottom: SP.lg }}>
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name, city or code…"
          label="Search branches"
        />
      </View>

      <FlatList
        data={isLoading || isError ? [] : filtered}
        keyExtractor={(b) => String(b.id)}
        renderItem={({ item }) => <BranchCard branch={item} heroH={heroH} />}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          !isLoading && !isError ? (
            <EmptyState
              icon="git-branch"
              title={search ? 'No results' : 'No branches yet'}
              subtitle={search ? `Nothing matches "${search}"` : 'Add your first branch to get started.'}
            />
          ) : null
        }
        contentContainerStyle={{ paddingHorizontal: SP.xl, paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      />
    </Screen>
  );
}
