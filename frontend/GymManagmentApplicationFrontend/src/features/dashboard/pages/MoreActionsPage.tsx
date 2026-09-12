import React from 'react';
import { View, Text, ScrollView, Pressable, StatusBar, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T } from '../../trainers/components/theme';
import BackButton from '../../common/components/BackButton';
import { ADMIN_ACTIONS } from '../adminActions';

interface Props {
  onBack?: () => void;
  onNavigate: (screen: string) => void;
}

/**
 * Full list of admin actions — reached via the Quick Access "All actions"
 * link and the bottom nav "More" tab, so every action stays reachable even
 * though only the first few get a dedicated Quick Access tile.
 */
export default function MoreActionsPage({ onBack, onNavigate }: Props) {
  return (
    <View className="flex-1 bg-bg" style={{ paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 0 }}>
      <StatusBar barStyle="light-content" backgroundColor={T.bg} />

      <View className="px-5 pt-5 pb-4">
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {onBack && <BackButton onPress={onBack} />}
          <View style={{ flex: 1 }}>
            <Text style={{ color: T.textSub, fontSize: 11, fontWeight: '600', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 2 }}>
              Everything
            </Text>
            <Text style={{ color: T.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.5 }}>All actions</Text>
          </View>
        </View>
      </View>

      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {ADMIN_ACTIONS.map((a) => (
            <Pressable
              key={a.screen}
              onPress={() => onNavigate(a.screen)}
              accessibilityRole="button"
              accessibilityLabel={a.label}
              style={({ pressed }) => ({
                width: '30%', alignItems: 'center', gap: 8, paddingVertical: 16,
                backgroundColor: pressed ? T.brandDim : T.bgInput,
                borderRadius: 18, borderWidth: 1,
                borderColor: pressed ? T.brandBorder : T.line,
              })}
            >
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: T.brandDim, borderWidth: 1, borderColor: T.brandBorder, alignItems: 'center', justifyContent: 'center' }}>
                <Feather name={a.icon} size={18} color={T.brand} />
              </View>
              <Text style={{ color: T.textSub, fontSize: 11, fontWeight: '600', textAlign: 'center' }}>{a.label}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
