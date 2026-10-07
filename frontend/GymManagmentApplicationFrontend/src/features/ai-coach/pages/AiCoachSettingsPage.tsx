import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { T } from '../../../theme';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import PrimaryButton from '../../common/components/PrimaryButton';
import LoadingState from '../../common/components/LoadingState';
import { Field } from '../../trainers/components/FormFields';
import { useAiCoachSettings, useSaveAiCoachSettings } from '../api/aiCoachQueries';

interface Props { onBack?: () => void; }

function TipField({
  label, value, onChangeText,
}: { label: string; value: string; onChangeText: (v: string) => void }) {
  return <Field label={label} value={value} onChangeText={onChangeText} placeholder="Enter tip copy…" multiline />;
}

export default function AiCoachSettingsPage({ onBack }: Props) {
  const { data: settings, isLoading } = useAiCoachSettings();
  const { mutate: save, isPending } = useSaveAiCoachSettings();

  const [highTip, setHighTip] = useState('');
  const [mediumTip, setMediumTip] = useState('');
  const [lowTip, setLowTip] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (settings) {
      setHighTip(settings.highTip ?? '');
      setMediumTip(settings.mediumTip ?? '');
      setLowTip(settings.lowTip ?? '');
    }
  }, [settings]);

  const handleSave = () => {
    save(
      { highTip, mediumTip, lowTip },
      { onSuccess: () => setSaved(true), onError: () => setSaved(false) },
    );
  };

  return (
    <Screen>
      <ScreenHeader eyebrow="Coaching" title="AI Coach Settings" onBack={onBack} />

      <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
        <Text style={{ color: T.textSub, fontSize: 13, lineHeight: 19 }}>
          These are the templated tips shown to members based on their daily recovery score — there's no live AI
          behind this, just editable copy.
        </Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48, paddingTop: 12 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {isLoading ? (
          <LoadingState label="Loading settings" />
        ) : (
          <>
            <TipField label="High recovery (80%+)" value={highTip} onChangeText={(v) => { setHighTip(v); setSaved(false); }} />
            <TipField label="Moderate recovery (50-79%)" value={mediumTip} onChangeText={(v) => { setMediumTip(v); setSaved(false); }} />
            <TipField label="Low recovery (under 50%)" value={lowTip} onChangeText={(v) => { setLowTip(v); setSaved(false); }} />

            <PrimaryButton
              label={isPending ? 'Saving…' : saved ? 'Saved ✓' : 'Save changes'}
              onPress={handleSave}
              loading={isPending}
              accessibilityHint="Saves the AI Coach tip copy"
              style={{ marginTop: 8 }}
            />
          </>
        )}
      </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
