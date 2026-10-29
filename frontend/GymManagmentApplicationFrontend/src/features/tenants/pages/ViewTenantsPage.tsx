import React from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTenants } from '../api/tenantQueries';
import { Tenant } from '../types/tenant.types';
import { T, withAlpha, R, SP } from '../../../theme';
import StatsStrip from '../../common/StatsStrip';
import Skeleton from '../../common/components/Skeleton';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import SearchBar from '../../common/components/SearchBar';
import StatusPill, { PillTone, toneForStatus } from '../../common/components/StatusPill';
import EmptyState from '../../dashboard/components/EmptyState';

const TINTS = [
  { bg: withAlpha(T.violet, 0.08), accent: T.violet },
  { bg: withAlpha(T.sky, 0.08),  accent: T.sky },
  { bg: withAlpha(T.brand, 0.08),   accent: T.brand },
  { bg: withAlpha(T.brandGold, 0.08),  accent: T.brandGold },
];
const tint = (id: number) => TINTS[id % TINTS.length];

// ─── Plan → pill tone ─────────────────────────────────────────────
const PLAN_TONE: Record<string, PillTone> = {
  starter: 'brand', pro: 'violet', enterprise: 'warn', whitelabel: 'info',
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return iso; }
}

// ─── Tenant card ──────────────────────────────────────────────────
// There is no tenant detail screen yet, so the card is a grouped View rather than a
// Pressable with a no-op handler. Editing is an explicit action button.
function TenantCard({ tenant, onEdit }: { tenant: Tenant; onEdit?: () => void }) {
  const c        = tint(tenant.id);
  const initials = tenant.name.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');

  return (
    <View
      accessible
      accessibilityLabel={`${tenant.name}, ${tenant.status}, ${tenant.plan} plan`}
      style={{
        marginBottom: 14,
        borderRadius: R.xl,
        overflow: 'hidden',
        backgroundColor: withAlpha(T.ok, 0.06),
        borderWidth: 1,
        borderColor: withAlpha(T.ok, 0.18),
        shadowColor: T.ok,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.18,
        shadowRadius: 18,
        elevation: 8,
      }}
    >
      {/* Accent top strip */}
      <View style={{ height: 3, backgroundColor: c.accent, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl }} />

      <View style={{ padding: 16 }}>
        {/* Top row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
          {/* Avatar */}
          <View style={{
            width: 52, height: 52, borderRadius: 16,
            backgroundColor: c.bg,
            borderWidth: 1.5, borderColor: withAlpha(c.accent, 0.38),
            alignItems: 'center', justifyContent: 'center',
            marginRight: 14,
          }}>
            <Text style={{ color: c.accent, fontSize: 20, fontWeight: '800' }}>{initials}</Text>
          </View>

          <View style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
            <Text style={{ color: T.text, fontSize: 16, fontWeight: '800', letterSpacing: -0.3 }} numberOfLines={1}>
              {tenant.name}
            </Text>
            <Text style={{ color: T.textSub, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
              /{tenant.slug}
            </Text>
          </View>

          <StatusPill label={tenant.status} tone={toneForStatus(tenant.status)} dot />
        </View>

        {/* Plan + primary colour pill */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <StatusPill label={tenant.plan} tone={PLAN_TONE[tenant.plan.toLowerCase()] ?? 'neutral'} />
          {!!tenant.primaryColor && tenant.primaryColor !== 'string' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{
                width: 14, height: 14, borderRadius: 4,
                backgroundColor: tenant.primaryColor,
                borderWidth: 1, borderColor: withAlpha(T.text, 0.20),
              }} />
              <Text style={{ color: T.textFaint, fontSize: 11 }} numberOfLines={1}>{tenant.primaryColor}</Text>
            </View>
          )}
        </View>

        {/* Divider */}
        <View style={{ height: 1, backgroundColor: withAlpha(T.ok, 0.12), marginBottom: 12 }} />

        {/* Details row */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {!!tenant.timezone && tenant.timezone !== 'string' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 }}>
              <Feather name="clock" size={12} color={T.textFaint} />
              <Text style={{ color: T.textSub, fontSize: 12, flexShrink: 1 }} numberOfLines={1}>{tenant.timezone}</Text>
            </View>
          )}
          {!!tenant.currency && tenant.currency !== 'string' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Feather name="dollar-sign" size={12} color={T.textFaint} />
              <Text style={{ color: T.textSub, fontSize: 12 }} numberOfLines={1}>{tenant.currency}</Text>
            </View>
          )}
          {!!tenant.locale && tenant.locale !== 'string' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Feather name="globe" size={12} color={T.textFaint} />
              <Text style={{ color: T.textSub, fontSize: 12 }} numberOfLines={1}>{tenant.locale}</Text>
            </View>
          )}
        </View>

        {/* Custom domain + trial date */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
          {!!tenant.customDomain && tenant.customDomain !== 'string' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1, minWidth: 0, marginRight: 8 }}>
              <Feather name="link" size={12} color={T.textFaint} />
              <Text style={{ color: T.textSub, fontSize: 12, flexShrink: 1 }} numberOfLines={1}>{tenant.customDomain}</Text>
            </View>
          )}
          {!!tenant.trialEndsAt && (
            <Text style={{ color: T.textFaint, fontSize: 11 }} numberOfLines={1}>
              Trial ends {formatDate(tenant.trialEndsAt)}
            </Text>
          )}
        </View>

        {onEdit && (
          <View style={{ flexDirection: 'row', marginTop: 14 }}>
            <Pressable
              onPress={onEdit}
              accessibilityRole="button"
              accessibilityLabel={`Edit ${tenant.name}`}
              hitSlop={6}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', gap: 5,
                paddingHorizontal: 10, paddingVertical: 6, borderRadius: R.pill,
                backgroundColor: pressed ? withAlpha(T.sky, 0.18) : withAlpha(T.sky, 0.10),
                borderWidth: 1, borderColor: withAlpha(T.sky, 0.28),
              })}
            >
              <Feather name="edit-2" size={12} color={T.sky} />
              <Text style={{ color: T.sky, fontSize: 11, fontWeight: '700' }}>Edit</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Page ─────────────────────────────────────────────────────────
interface ViewTenantsPageProps {
  onBack?: () => void;
  onAddTenant?: () => void;
  /** When provided, each tenant card shows an "Edit" action. */
  onEditTenant?: (id: number) => void;
}

// GET /tenants is not paginated server-side (TenantController.GetAll takes no page params),
// so the list stays a single client-filtered list.
export default function ViewTenantsPage({ onBack, onAddTenant, onEditTenant }: ViewTenantsPageProps) {
  const [search, setSearch] = React.useState('');
  const { data: tenants = [], isLoading, isError, refetch } = useTenants();

  const filtered = tenants.filter((t) =>
    search.trim() === '' ||
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.slug.toLowerCase().includes(search.toLowerCase()) ||
    t.plan.toLowerCase().includes(search.toLowerCase())
  );

  const listHeader = (
    <>
      {/* Summary strip */}
      {!isLoading && !isError && (
        <View style={{ marginBottom: 24 }}>
          <StatsStrip items={[
            { icon: 'briefcase',    label: 'Total',  value: String(tenants.length),                                                        accent: T.violet },
            { icon: 'check-circle', label: 'Active', value: String(tenants.filter((t) => t.status.toLowerCase() === 'active').length),      accent: T.brand   },
            { icon: 'clock',        label: 'Trial',  value: String(tenants.filter((t) => t.status.toLowerCase() === 'trial').length),       accent: T.brandGold },
          ]} />
        </View>
      )}

      {isLoading && <Skeleton rows={3} height={180} borderRadius={R.xl} />}

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
        eyebrow="Organisations"
        title="All Tenants"
        onBack={onBack}
        action={onAddTenant ? { label: 'Add', icon: 'plus', onPress: onAddTenant } : undefined}
      />

      {/* Search */}
      <View style={{ paddingHorizontal: SP.xl, paddingBottom: SP.lg }}>
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name, slug or plan…"
          label="Search tenants"
        />
      </View>

      <FlatList
        data={isLoading || isError ? [] : filtered}
        keyExtractor={(t) => String(t.id)}
        renderItem={({ item }) => (
          <TenantCard tenant={item} onEdit={onEditTenant ? () => onEditTenant(item.id) : undefined} />
        )}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          !isLoading && !isError ? (
            <EmptyState
              icon="briefcase"
              title={search ? 'No results' : 'No tenants yet'}
              subtitle={search ? `Nothing matches "${search}"` : 'Register your first organisation to get started.'}
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
