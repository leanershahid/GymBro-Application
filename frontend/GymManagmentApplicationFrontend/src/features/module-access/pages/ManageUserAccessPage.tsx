import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, Switch, StatusBar, Platform, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T } from '../../trainers/components/theme';
import { useUserModules, useSetUserModules } from '../api/userModulesQueries';
import { ModuleToggle } from '../types/userModules.types';
import BackButton from '../../common/components/BackButton';

interface Props {
  userId: number;
  userName: string;
  onBack: () => void;
}

export default function ManageUserAccessPage({ userId, userName, onBack }: Props) {
  const { data: modules, isLoading } = useUserModules(userId);
  const { mutate: save, isPending } = useSetUserModules(userId);

  const [draft, setDraft] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (modules) {
      setDraft(Object.fromEntries(modules.map(m => [m.key, m.isEnabled])));
    }
  }, [modules]);

  const toggle = (key: string) => {
    setDraft(prev => ({ ...prev, [key]: !prev[key] }));
    setSaved(false);
  };

  const handleSave = () => {
    const payload: ModuleToggle[] = Object.entries(draft).map(([key, isEnabled]) => ({ key, isEnabled }));
    save(payload, { onSuccess: () => setSaved(true) });
  };

  return (
    <View className="flex-1 bg-bg" style={{ paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 0 }}>
      <StatusBar barStyle="light-content" backgroundColor={T.bg} />

      <View className="px-5 pt-5 pb-4">
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
          <BackButton onPress={onBack} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: T.textSub, fontSize: 11, fontWeight: '600', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 2 }}>
              Manage access
            </Text>
            <Text style={{ color: T.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.5 }} numberOfLines={1}>
              {userName}
            </Text>
          </View>
        </View>
        <Text style={{ color: T.textSub, fontSize: 13, lineHeight: 19 }}>
          Choose which feature areas this account can see and use. This is in addition to their role — it can only
          narrow access, never grant permissions their role doesn't already allow.
        </Text>
      </View>

      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>
        {isLoading ? (
          <ActivityIndicator size="large" color={T.brand} style={{ marginTop: 40 }} />
        ) : (
          (modules ?? []).map(m => (
            <View
              key={m.key}
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                backgroundColor: T.bgInput, borderRadius: 18, padding: 16, marginBottom: 12,
                borderWidth: 1, borderColor: T.line,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 12 }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: T.brandDim, borderWidth: 1, borderColor: T.brandBorder, alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                  <Feather name={(m.icon as any) ?? 'grid'} size={18} color={T.brand} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: T.text, fontSize: 15, fontWeight: '700' }}>{m.name}</Text>
                  {!!m.description && <Text style={{ color: T.textSub, fontSize: 12, marginTop: 2 }} numberOfLines={2}>{m.description}</Text>}
                </View>
              </View>

              <Switch
                value={draft[m.key] ?? false}
                onValueChange={() => toggle(m.key)}
                trackColor={{ false: T.line, true: T.brandDim }}
                thumbColor={draft[m.key] ? T.brand : T.textFaint}
              />
            </View>
          ))
        )}

        {!isLoading && (
          <Pressable
            onPress={handleSave}
            disabled={isPending}
            accessibilityRole="button"
            accessibilityLabel="Save access changes"
            style={{ backgroundColor: T.brand, borderRadius: 999, paddingVertical: 15, alignItems: 'center', marginTop: 8, opacity: isPending ? 0.6 : 1 }}
          >
            <Text style={{ color: T.onBrand, fontSize: 15, fontWeight: '800' }}>
              {isPending ? 'Saving…' : saved ? 'Saved ✓' : 'Save changes'}
            </Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}
