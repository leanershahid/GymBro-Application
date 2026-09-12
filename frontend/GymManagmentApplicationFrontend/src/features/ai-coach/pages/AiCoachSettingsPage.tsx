import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, StatusBar, Platform, ActivityIndicator } from 'react-native';
import { T } from '../../trainers/components/theme';
import BackButton from '../../common/components/BackButton';
import { useAiCoachSettings, useSaveAiCoachSettings } from '../api/aiCoachQueries';

interface Props { onBack?: () => void; }

function TipField({
  label, value, onChangeText,
}: { label: string; value: string; onChangeText: (v: string) => void }) {
  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={{ color: T.textSub, fontSize: 12, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.6 }}>
        {label}
      </Text>
      <TextInput
        style={{
          color: T.text, fontSize: 14, backgroundColor: T.bgInput, borderRadius: 16,
          borderWidth: 1, borderColor: T.line, paddingHorizontal: 14, paddingVertical: 12,
          minHeight: 90, textAlignVertical: 'top',
        }}
        placeholder="Enter tip copy…"
        placeholderTextColor={T.textFaint}
        value={value}
        onChangeText={onChangeText}
        multiline
      />
    </View>
  );
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
    <View style={{ flex: 1, backgroundColor: T.bg, paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 0 }}>
      <StatusBar barStyle="light-content" backgroundColor={T.bg} />

      <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
          {onBack && <BackButton onPress={onBack} />}
          <View style={{ flex: 1 }}>
            <Text style={{ color: T.textSub, fontSize: 11, fontWeight: '600', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 2 }}>
              Coaching
            </Text>
            <Text style={{ color: T.text, fontSize: 24, fontWeight: '800', letterSpacing: -0.5 }}>AI Coach Settings</Text>
          </View>
        </View>
        <Text style={{ color: T.textSub, fontSize: 13, lineHeight: 19 }}>
          These are the templated tips shown to members based on their daily recovery score — there's no live AI
          behind this, just editable copy.
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48, paddingTop: 12 }} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <ActivityIndicator size="large" color={T.brand} style={{ marginTop: 40 }} />
        ) : (
          <>
            <TipField label="High recovery (80%+)" value={highTip} onChangeText={(v) => { setHighTip(v); setSaved(false); }} />
            <TipField label="Moderate recovery (50-79%)" value={mediumTip} onChangeText={(v) => { setMediumTip(v); setSaved(false); }} />
            <TipField label="Low recovery (under 50%)" value={lowTip} onChangeText={(v) => { setLowTip(v); setSaved(false); }} />

            <Pressable
              onPress={handleSave}
              disabled={isPending}
              accessibilityRole="button"
              accessibilityLabel="Save AI Coach settings"
              style={{
                backgroundColor: T.brand, borderRadius: 999, paddingVertical: 15, alignItems: 'center',
                marginTop: 8, opacity: isPending ? 0.6 : 1,
              }}
            >
              <Text style={{ color: T.onBrand, fontSize: 15, fontWeight: '800' }}>
                {isPending ? 'Saving…' : saved ? 'Saved ✓' : 'Save changes'}
              </Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}
