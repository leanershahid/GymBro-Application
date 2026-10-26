import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Switch } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T } from '../../../theme';
import { useUserModules, useSetUserModules } from '../api/userModulesQueries';
import { ModuleToggle } from '../types/userModules.types';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import PrimaryButton from '../../common/components/PrimaryButton';
import LoadingState from '../../common/components/LoadingState';

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
    <Screen>
      <ScreenHeader eyebrow="Manage access" title={userName} onBack={onBack} />

      <View className="px-5 pb-4">
        <Text style={{ color: T.textSub, fontSize: 13, lineHeight: 19 }}>
          Choose which feature areas this account can see and use. This is in addition to their role — it can only
          narrow access, never grant permissions their role doesn't already allow.
        </Text>
      </View>

      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>
        {isLoading ? (
          <LoadingState label="Loading modules" />
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
                  <Text numberOfLines={1} style={{ color: T.text, fontSize: 15, fontWeight: '700' }}>{m.name}</Text>
                  {!!m.description && <Text style={{ color: T.textSub, fontSize: 12, marginTop: 2 }} numberOfLines={2}>{m.description}</Text>}
                </View>
              </View>

              <Switch
                value={draft[m.key] ?? false}
                onValueChange={() => toggle(m.key)}
                accessibilityLabel={m.name}
                trackColor={{ false: T.line, true: T.brandDim }}
                thumbColor={draft[m.key] ? T.brand : T.textFaint}
              />
            </View>
          ))
        )}

        {!isLoading && (
          <PrimaryButton
            label={isPending ? 'Saving…' : saved ? 'Saved ✓' : 'Save changes'}
            onPress={handleSave}
            loading={isPending}
            accessibilityHint="Saves the access changes for this account"
            style={{ marginTop: 8 }}
          />
        )}
      </ScrollView>
    </Screen>
  );
}
