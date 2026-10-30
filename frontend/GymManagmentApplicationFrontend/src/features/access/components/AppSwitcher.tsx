import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, withAlpha } from '../../../theme';
import { useAccess } from '../context/AccessContext';
import { AccessApp } from '../types/access.types';

const APP_INFO: Record<AccessApp, { label: string; icon: React.ComponentProps<typeof Feather>['name'] }> = {
  admin:   { label: 'Admin app',   icon: 'grid' },
  trainer: { label: 'Trainer app', icon: 'award' },
  member:  { label: 'Member app',  icon: 'user' },
};

/**
 * "Switch app" — shown only to people granted modules in more than one app (any role can be given
 * any module). Lists the other apps; the one they signed in to is always among them.
 */
export default function AppSwitcher() {
  const { app, apps, switchApp } = useAccess();
  const others = apps.filter(a => a !== app);
  if (others.length === 0) return null;

  return (
    <View style={{ gap: 8, marginTop: 12 }}>
      <Text style={{ color: T.textSub, fontSize: 12, fontWeight: '600' }}>Switch app</Text>
      {others.map(a => (
        <Pressable
          key={a}
          onPress={() => switchApp(a)}
          accessibilityRole="button"
          accessibilityLabel={`Open the ${APP_INFO[a].label}`}
          style={({ pressed }) => ({
            minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14,
            borderRadius: 14, borderWidth: 1, borderColor: withAlpha(T.brand, 0.3),
            backgroundColor: pressed ? withAlpha(T.brand, 0.14) : withAlpha(T.brand, 0.06),
          })}
        >
          <Feather name={APP_INFO[a].icon} size={18} color={T.brand} />
          <Text style={{ flex: 1, color: T.text, fontSize: 15, fontWeight: '700' }}>Open {APP_INFO[a].label}</Text>
          <Feather name="repeat" size={16} color={T.brand} />
        </Pressable>
      ))}
    </View>
  );
}
