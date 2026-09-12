import React from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput,
  StatusBar, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTenants } from '../api/tenantQueries';
import { Tenant } from '../types/tenant.types';
import { T } from '../../trainers/components/theme';
import StatsStrip from '../../common/StatsStrip';
import Skeleton from '../../common/components/Skeleton';

const TINTS = [
  { bg: 'rgba(167,139,250,0.08)', accent: '#A78BFA' },
  { bg: 'rgba(34,211,238,0.08)',  accent: '#22D3EE' },
  { bg: 'rgba(126,211,33,0.08)',   accent: '#7ED321' },
  { bg: 'rgba(250,204,21,0.08)',  accent: '#FACC15' },
];
const tint = (id: number) => TINTS[id % TINTS.length];

// ─── Hook is now in tenantQueries.ts ──────────────────────────────

// ─── Plan badge ───────────────────────────────────────────────────
function PlanBadge({ plan }: { plan: string }) {
  const colors: Record<string, { color: string; bg: string; border: string }> = {
    starter:    { color: '#7ED321', bg: 'rgba(126,211,33,0.12)',   border: 'rgba(126,211,33,0.28)'   },
    basic:      { color: '#22D3EE', bg: 'rgba(34,211,238,0.12)',  border: 'rgba(34,211,238,0.28)'  },
    pro:        { color: '#A78BFA', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.28)' },
    enterprise: { color: '#FACC15', bg: 'rgba(250,204,21,0.12)',  border: 'rgba(250,204,21,0.28)'  },
  };
  const c = colors[plan.toLowerCase()] ?? { color: T.textSub, bg: 'rgba(255,255,255,0.08)', border: 'rgba(255,255,255,0.14)' };
  return (
    <View style={{ backgroundColor: c.bg, borderWidth: 1, borderColor: c.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
      <Text style={{ color: c.color, fontSize: 11, fontWeight: '700' }}>{plan}</Text>
    </View>
  );
}

// ─── Status badge ─────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const lower  = status.toLowerCase();
  const active = lower === 'active';
  const trial  = lower === 'trial';
  const color  = active ? T.brand : trial ? '#FACC15' : T.textSub;
  const bg     = active ? 'rgba(126,211,33,0.15)' : trial ? 'rgba(250,204,21,0.15)' : 'rgba(255,255,255,0.08)';
  const border = active ? 'rgba(126,211,33,0.30)' : trial ? 'rgba(250,204,21,0.30)' : 'rgba(255,255,255,0.14)';
  return (
    <View style={{ backgroundColor: bg, borderWidth: 1, borderColor: border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: color }} />
        <Text style={{ color, fontSize: 11, fontWeight: '700' }}>{status}</Text>
      </View>
    </View>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return iso; }
}

// ─── Tenant card ──────────────────────────────────────────────────
function TenantCard({ tenant, onPress }: { tenant: Tenant; onPress: () => void }) {
  const c        = tint(tenant.id);
  const initials = tenant.name.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');

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
        {/* Top row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
          {/* Avatar */}
          <View style={{
            width: 52, height: 52, borderRadius: 16,
            backgroundColor: c.bg,
            borderWidth: 1.5, borderColor: c.accent + '60',
            alignItems: 'center', justifyContent: 'center',
            marginRight: 14,
          }}>
            <Text style={{ color: c.accent, fontSize: 20, fontWeight: '800' }}>{initials}</Text>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={{ color: T.text, fontSize: 16, fontWeight: '800', letterSpacing: -0.3 }} numberOfLines={1}>
              {tenant.name}
            </Text>
            <Text style={{ color: T.textSub, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
              /{tenant.slug}
            </Text>
          </View>

          <StatusBadge status={tenant.status} />
        </View>

        {/* Plan + primary colour pill */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <PlanBadge plan={tenant.plan} />
          {!!tenant.primaryColor && tenant.primaryColor !== 'string' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{
                width: 14, height: 14, borderRadius: 4,
                backgroundColor: tenant.primaryColor,
                borderWidth: 1, borderColor: 'rgba(255,255,255,0.20)',
              }} />
              <Text style={{ color: T.textFaint, fontSize: 11 }}>{tenant.primaryColor}</Text>
            </View>
          )}
        </View>

        {/* Divider */}
        <View style={{ height: 1, backgroundColor: 'rgba(34,197,94,0.12)', marginBottom: 12 }} />

        {/* Details row */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {!!tenant.timezone && tenant.timezone !== 'string' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Feather name="clock" size={12} color={T.textFaint} />
              <Text style={{ color: T.textSub, fontSize: 12 }}>{tenant.timezone}</Text>
            </View>
          )}
          {!!tenant.currency && tenant.currency !== 'string' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Feather name="dollar-sign" size={12} color={T.textFaint} />
              <Text style={{ color: T.textSub, fontSize: 12 }}>{tenant.currency}</Text>
            </View>
          )}
          {!!tenant.locale && tenant.locale !== 'string' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Feather name="globe" size={12} color={T.textFaint} />
              <Text style={{ color: T.textSub, fontSize: 12 }}>{tenant.locale}</Text>
            </View>
          )}
        </View>

        {/* Custom domain + trial date */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
          {!!tenant.customDomain && tenant.customDomain !== 'string' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 }}>
              <Feather name="link" size={12} color={T.textFaint} />
              <Text style={{ color: T.textSub, fontSize: 12 }} numberOfLines={1}>{tenant.customDomain}</Text>
            </View>
          )}
          <Text style={{ color: T.textFaint, fontSize: 11 }}>
            Trial ends {formatDate(tenant.trialEndsAt)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

// ─── Page ─────────────────────────────────────────────────────────
interface ViewTenantsPageProps {
  onBack?: () => void;
  onAddTenant?: () => void;
}

export default function ViewTenantsPage({ onBack, onAddTenant }: ViewTenantsPageProps) {
  const [search, setSearch] = React.useState('');
  const { data: tenants = [], isLoading, isError, refetch } = useTenants();

  const filtered = tenants.filter((t) =>
    search.trim() === '' ||
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.slug.toLowerCase().includes(search.toLowerCase()) ||
    t.plan.toLowerCase().includes(search.toLowerCase())
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
              Organisations
            </Text>
            <Text style={{ color: T.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.5 }}>
              All Tenants
            </Text>
          </View>

          {onAddTenant && (
            <Pressable
              onPress={onAddTenant}
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
            placeholder="Search by name, slug or plan…"
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
              { icon: 'briefcase',    label: 'Total',  value: String(tenants.length),                                                        accent: '#A78BFA' },
              { icon: 'check-circle', label: 'Active', value: String(tenants.filter((t) => t.status.toLowerCase() === 'active').length),      accent: T.brand   },
              { icon: 'clock',        label: 'Trial',  value: String(tenants.filter((t) => t.status.toLowerCase() === 'trial').length),       accent: '#FACC15' },
            ]} />
          </View>
        )}

        {isLoading && <Skeleton rows={3} height={180} borderRadius={24} />}

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
              <Feather name="briefcase" size={30} color={T.textSub} />
            </View>
            <Text style={{ color: T.text, fontSize: 17, fontWeight: '700', marginBottom: 8 }}>
              {search ? 'No results' : 'No tenants yet'}
            </Text>
            <Text style={{ color: T.textSub, fontSize: 13, textAlign: 'center' }}>
              {search ? `Nothing matches "${search}"` : 'Register your first organisation to get started.'}
            </Text>
          </View>
        )}

        {!isLoading && !isError && filtered.map((tenant) => (
          <TenantCard key={tenant.id} tenant={tenant} onPress={() => {}} />
        ))}
      </ScrollView>
    </View>
  );
}
