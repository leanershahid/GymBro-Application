import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, SP } from '../../../theme';
import { useLayout } from '../../../utils/useLayout';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import { useVisibleAdminActions } from '../adminActions';
import { useMembershipRequestBadge } from '../../self-service/routes';
import { useSupportBadge } from '../../support/routes';

interface Props {
  onBack?: () => void;
  onNavigate: (screen: string) => void;
  onLogout?: () => void;
}

/**
 * Full list of admin actions — reached via the Quick Access "All actions"
 * link and the bottom nav "More" tab, so every action stays reachable even
 * though only the first few get a dedicated Quick Access tile.
 */
export default function MoreActionsPage({ onBack, onNavigate, onLogout }: Props) {
  const actions = useVisibleAdminActions();
  const pendingRequests = useMembershipRequestBadge();
  // Tile badges: pending membership requests, unassigned + overdue help requests.
  const badges: Record<string, number> = { 'membership-requests': pendingRequests, support: useSupportBadge() };
  const { tileW, tileCols } = useLayout();
  const tileWidth = tileW(tileCols, 12);
  return (
    <Screen>
      <ScreenHeader eyebrow="Everything" title="All actions" onBack={onBack} />

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: SP.xl, paddingBottom: 48 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {actions.map((a) => (
            <Pressable
              key={a.screen}
              onPress={() => onNavigate(a.screen)}
              accessibilityRole="button"
              accessibilityLabel={(badges[a.screen] ?? 0) > 0 ? `${a.label}, ${badges[a.screen]} need attention` : a.label}
              style={({ pressed }) => ({
                width: tileWidth, paddingHorizontal: 8, alignItems: 'center', gap: 8, paddingVertical: 16,
                backgroundColor: pressed ? T.brandDim : T.bgInput,
                borderRadius: 18, borderWidth: 1,
                borderColor: pressed ? T.brandBorder : T.line,
              })}
            >
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: T.brandDim, borderWidth: 1, borderColor: T.brandBorder, alignItems: 'center', justifyContent: 'center' }}>
                <Feather name={a.icon} size={18} color={T.brand} />
              </View>
              {(badges[a.screen] ?? 0) > 0 && (
                <View style={{ position: 'absolute', top: 8, right: 8, minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: 11, backgroundColor: T.brandGold, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: T.onBrand, fontSize: 11, fontWeight: '800' }}>{badges[a.screen]}</Text>
                </View>
              )}
              <Text numberOfLines={2} style={{ color: T.textSub, fontSize: 11, fontWeight: '600', textAlign: 'center' }}>{a.label}</Text>
            </Pressable>
          ))}
        </View>

        {onLogout && (
          <Pressable
            onPress={onLogout}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            style={{ marginTop: 28, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, minHeight: 44 }}
          >
            <Feather name="log-out" size={16} color={T.textSub} />
            <Text style={{ color: T.textSub, fontSize: 13, fontWeight: '600' }}>Sign out</Text>
          </Pressable>
        )}
      </ScrollView>
    </Screen>
  );
}
