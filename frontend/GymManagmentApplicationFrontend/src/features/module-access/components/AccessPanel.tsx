import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Switch } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, R, withAlpha } from '../../../theme';
import { useUserModules, useSetUserModules } from '../api/userModulesQueries';
import { ModuleToggle } from '../types/userModules.types';
import PrimaryButton from '../../common/components/PrimaryButton';
import LoadingState from '../../common/components/LoadingState';

interface Props {
  userId: number;
  /** Extra content above the module list (e.g. a page-level intro). Defaults to the standard copy. */
  intro?: string;
}

type Draft = Record<string, ModuleToggle>;

function MiniSwitch({
  label, value, disabled, onChange,
}: { label: string; value: boolean; disabled?: boolean; onChange: () => void }) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingVertical: 6, opacity: disabled ? 0.4 : 1,
    }}>
      <Text style={{ color: T.textSub, fontSize: 12 }}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        accessibilityLabel={label}
        trackColor={{ false: T.line, true: T.brandDim }}
        thumbColor={value ? T.brand : T.textFaint}
        style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
      />
    </View>
  );
}

/**
 * The module access toggle list + save button — the reusable body shared by
 * ManageUserAccessPage (its own screen) and TrainerDetailPage's "Access" tab.
 * Each module has a master "enabled" switch plus Add/Edit/Delete sub-permissions,
 * which only take effect while the module itself is enabled.
 */
export default function AccessPanel({ userId, intro }: Props) {
  const { data: modules, isLoading } = useUserModules(userId);
  const { mutate: save, isPending } = useSetUserModules(userId);

  const [draft, setDraft] = useState<Draft>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (modules) {
      setDraft(Object.fromEntries(modules.map(m => [
        m.key,
        { key: m.key, isEnabled: m.isEnabled, canAdd: m.canAdd, canEdit: m.canEdit, canDelete: m.canDelete },
      ])));
    }
  }, [modules]);

  const update = (key: string, patch: Partial<ModuleToggle>) => {
    setDraft(prev => ({ ...prev, [key]: { ...prev[key], ...patch } }));
    setSaved(false);
  };

  const handleSave = () => {
    save(Object.values(draft), { onSuccess: () => setSaved(true) });
  };

  return (
    <>
      <View className="px-5 pb-4">
        <Text style={{ color: T.textSub, fontSize: 13, lineHeight: 19 }}>
          {intro ?? 'Choose which feature areas this account can see and use, and what they can add, edit or delete within each one. This is in addition to their role — it can only narrow access, never grant permissions their role doesn\'t already allow.'}
        </Text>
      </View>

      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>
        {isLoading ? (
          <LoadingState label="Loading modules" />
        ) : (
          (modules ?? []).map(m => {
            const entry = draft[m.key] ?? { key: m.key, isEnabled: false, canAdd: true, canEdit: true, canDelete: true };
            return (
              <View
                key={m.key}
                style={{
                  backgroundColor: T.bgInput, borderRadius: R.lg, padding: 16, marginBottom: 12,
                  borderWidth: 1, borderColor: entry.isEnabled ? withAlpha(T.brand, 0.25) : T.line,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
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
                    value={entry.isEnabled}
                    onValueChange={() => update(m.key, { isEnabled: !entry.isEnabled })}
                    accessibilityLabel={m.name}
                    trackColor={{ false: T.line, true: T.brandDim }}
                    thumbColor={entry.isEnabled ? T.brand : T.textFaint}
                  />
                </View>

                {/* Sub-permissions — only meaningful while the module is enabled */}
                <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: T.lineSubtle, gap: 2 }}>
                  <MiniSwitch
                    label="Can add"
                    value={entry.canAdd}
                    disabled={!entry.isEnabled}
                    onChange={() => update(m.key, { canAdd: !entry.canAdd })}
                  />
                  <MiniSwitch
                    label="Can edit"
                    value={entry.canEdit}
                    disabled={!entry.isEnabled}
                    onChange={() => update(m.key, { canEdit: !entry.canEdit })}
                  />
                  <MiniSwitch
                    label="Can delete"
                    value={entry.canDelete}
                    disabled={!entry.isEnabled}
                    onChange={() => update(m.key, { canDelete: !entry.canDelete })}
                  />
                </View>
              </View>
            );
          })
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
    </>
  );
}
