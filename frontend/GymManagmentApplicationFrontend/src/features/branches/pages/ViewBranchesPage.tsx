import React, { useRef } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput,
  StatusBar, Platform, Animated, Image, ImageBackground,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useBranches } from '../api/branchQueries';
import { Branch } from '../types/branch.types';
import { T } from '../../trainers/components/theme';

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
  { bg: 'rgba(126,211,33,0.08)',   accent: '#7ED321' },
  { bg: 'rgba(34,211,238,0.08)',  accent: '#22D3EE' },
  { bg: 'rgba(167,139,250,0.08)', accent: '#A78BFA' },
  { bg: 'rgba(250,204,21,0.08)',  accent: '#FACC15' },
];
const tint = (id: number) => TINTS[id % TINTS.length];

// ─── Status badge ─────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const lower   = status.toLowerCase();
  const active  = lower === 'active';
  const color   = active ? T.brand : lower === 'trial' ? '#FACC15' : T.textSub;
  const bg      = active ? 'rgba(126,211,33,0.15)' : lower === 'trial' ? 'rgba(250,204,21,0.15)' : 'rgba(255,255,255,0.08)';
  const border  = active ? 'rgba(126,211,33,0.30)' : lower === 'trial' ? 'rgba(250,204,21,0.30)' : 'rgba(255,255,255,0.14)';
  return (
    <View style={{ backgroundColor: bg, borderWidth: 1, borderColor: border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: color }} />
        <Text style={{ color, fontSize: 11, fontWeight: '700' }}>{status}</Text>
      </View>
    </View>
  );
}

// ─── Branch card ──────────────────────────────────────────────────
function BranchCard({ branch, index, onPress }: { branch: Branch; index: number; onPress: () => void }) {
  const c        = tint(branch.id);
  const hasImage = !!branch.logoUrl && branch.logoUrl !== 'string' && branch.logoUrl.startsWith('http');

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        marginBottom: 18,
        borderRadius: 26,
        overflow: 'hidden',
        opacity: pressed ? 0.92 : 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.40,
        shadowRadius: 20,
        elevation: 10,
      })}
    >
      {/* ── Hero image / colour background ── */}
      <View style={{ height: 200, backgroundColor: hasImage ? '#000' : c.bg }}>
        {hasImage ? (
          <>
            <Image
              source={{ uri: branch.logoUrl }}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
              resizeMode="cover"
            />
            {/* dark scrim */}
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' }} />
          </>
        ) : (
          /* fallback — initials on tinted bg */
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{
              width: 72, height: 72, borderRadius: 22,
              backgroundColor: 'rgba(255,255,255,0.08)',
              borderWidth: 1, borderColor: c.accent + '40',
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
            backgroundColor: 'rgba(0,0,0,0.55)',
            borderWidth: 1, borderColor: c.accent + '50',
            borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6,
          }}>
            <Text style={{ color: T.text, fontSize: 11, fontWeight: '600', letterSpacing: 0.6 }}>
              {branch.code || 'N/A'}
            </Text>
          </View>

          {/* Arrow button */}
          <View style={{
            width: 34, height: 34, borderRadius: 17,
            backgroundColor: 'rgba(255,255,255,0.12)',
            borderWidth: 1, borderColor: 'rgba(255,255,255,0.80)',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Feather name="arrow-up-right" size={16} color={T.text} />
          </View>
        </View>

        {/* ── Bottom glass dock ── */}
        <View style={{
          position: 'absolute', left: 14, right: 14, bottom: 14,
          borderRadius: 20,
          backgroundColor: 'rgba(0,0,0,0.60)',
          borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
        }}>
          {/* Accent hairline */}
          <View style={{ height: 2.5, backgroundColor: c.accent, borderTopLeftRadius: 20, borderTopRightRadius: 20 }} />

          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 }}>
            {/* Avatar circle */}
            <View style={{
              width: 38, height: 38, borderRadius: 19,
              backgroundColor: c.bg,
              borderWidth: 1.5, borderColor: c.accent + '60',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Text style={{ color: c.accent, fontSize: 15, fontWeight: '800' }}>
                {branch.name.charAt(0).toUpperCase()}
              </Text>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={{ color: T.text, fontSize: 15, fontWeight: '800', letterSpacing: -0.2 }} numberOfLines={1}>
                {branch.name}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                <StatusBadge status={branch.status} />
                <Text style={{ color: T.textSub, fontSize: 11 }}>·</Text>
                <Feather name="map-pin" size={11} color={T.textFaint} />
                <Text style={{ color: T.textSub, fontSize: 11 }} numberOfLines={1}>
                  {branch.city}{branch.state ? `, ${branch.state}` : ''}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* ── Detail panel below image ── */}
      <View style={{
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderWidth: 1, borderTopWidth: 0,
        borderColor: 'rgba(255,255,255,0.08)',
        borderBottomLeftRadius: 26, borderBottomRightRadius: 26,
        padding: 16,
      }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {/* Capacity */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{
              width: 28, height: 28, borderRadius: 8,
              backgroundColor: c.bg,
              borderWidth: 1, borderColor: c.accent + '30',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Feather name="users" size={13} color={c.accent} />
            </View>
            <View>
              <Text style={{ color: T.text, fontSize: 13, fontWeight: '700' }}>{branch.capacity}</Text>
              <Text style={{ color: T.textFaint, fontSize: 10 }}>capacity</Text>
            </View>
          </View>

          {/* Phone */}
          {!!branch.phone && branch.phone !== 'string' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{
                width: 28, height: 28, borderRadius: 8,
                backgroundColor: 'rgba(255,255,255,0.05)',
                borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Feather name="phone" size={13} color={T.textSub} />
              </View>
              <Text style={{ color: T.textSub, fontSize: 12 }}>{branch.phone}</Text>
            </View>
          )}
        </View>

        {/* Email + timezone row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
          {!!branch.email && branch.email !== 'string' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
              <Feather name="mail" size={12} color={T.textFaint} />
              <Text style={{ color: T.textSub, fontSize: 12 }} numberOfLines={1}>{branch.email}</Text>
            </View>
          )}
          <Text style={{ color: T.textFaint, fontSize: 11 }}>
            {formatDate(branch.createdAt)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────
function Skeleton() {
  const opacity = useRef(new Animated.Value(0.3)).current;
  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.8, duration: 750, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 750, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <>
      {[0, 1, 2].map((k) => (
        <Animated.View key={k} style={{
          marginBottom: 18, borderRadius: 26, overflow: 'hidden',
          opacity,
        }}>
          <View style={{ height: 200, backgroundColor: T.bgInputActive }} />
          <View style={{
            backgroundColor: T.bgInput,
            borderWidth: 1, borderTopWidth: 0, borderColor: T.line,
            borderBottomLeftRadius: 26, borderBottomRightRadius: 26,
            padding: 16, gap: 8,
          }}>
            <View style={{ width: '60%', height: 14, borderRadius: 6, backgroundColor: T.bgInputActive }} />
            <View style={{ width: '40%', height: 12, borderRadius: 6, backgroundColor: T.bgInputActive }} />
          </View>
        </Animated.View>
      ))}
    </>
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

  const filtered = branches.filter((b) =>
    search.trim() === '' ||
    b.name.toLowerCase().includes(search.toLowerCase()) ||
    b.city.toLowerCase().includes(search.toLowerCase()) ||
    b.code.toLowerCase().includes(search.toLowerCase())
  );

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
                backgroundColor: 'rgba(255,255,255,0.07)',
                borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
                alignItems: 'center', justifyContent: 'center',
                marginRight: 14,
              }}
            >
              <Feather name="arrow-left" size={20} color={T.text} />
            </Pressable>
          )}

          <View style={{ flex: 1 }}>
            <Text style={{ color: T.textSub, fontSize: 11, fontWeight: '600', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 3 }}>
              Locations
            </Text>
            <Text style={{ color: T.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.5 }}>
              All Branches
            </Text>
          </View>

          {onAddBranch && (
            <Pressable
              onPress={onAddBranch}
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
          backgroundColor: 'rgba(255,255,255,0.05)',
          borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
          borderRadius: 16, paddingHorizontal: 14, height: 48,
        }}>
          <Feather name="search" size={16} color={T.textFaint} style={{ marginRight: 10 }} />
          <TextInput
            style={{ flex: 1, color: T.text, fontSize: 14 }}
            placeholder="Search by name, city or code…"
            placeholderTextColor={T.textFaint}
            value={search}
            onChangeText={setSearch}
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
              { icon: 'map-pin', label: 'Total',  value: String(branches.length),                                                     accent: T.brand   },
              { icon: 'check-circle', label: 'Active', value: String(branches.filter((b) => b.status.toLowerCase() === 'active').length), accent: '#22D3EE' },
              { icon: 'eye',    label: 'Shown',  value: String(filtered.length),                                                     accent: '#A78BFA' },
            ]} />
          </View>
        )}

        {/* States */}
        {isLoading && <Skeleton />}

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

        {!isLoading && !isError && filtered.length === 0 && (
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <View style={{
              width: 68, height: 68, borderRadius: 34,
              backgroundColor: 'rgba(255,255,255,0.06)',
              borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
              alignItems: 'center', justifyContent: 'center', marginBottom: 16,
            }}>
              <Feather name="git-branch" size={30} color={T.textSub} />
            </View>
            <Text style={{ color: T.text, fontSize: 17, fontWeight: '700', marginBottom: 8 }}>
              {search ? 'No results' : 'No branches yet'}
            </Text>
            <Text style={{ color: T.textSub, fontSize: 13, textAlign: 'center' }}>
              {search ? `Nothing matches "${search}"` : 'Add your first branch to get started.'}
            </Text>
          </View>
        )}

        {!isLoading && !isError && filtered.map((branch, i) => (
          <BranchCard key={branch.id} branch={branch} index={i} onPress={() => {}} />
        ))}
      </ScrollView>
    </View>
  );
}
