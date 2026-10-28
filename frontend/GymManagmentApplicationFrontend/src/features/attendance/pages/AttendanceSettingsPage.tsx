import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { T, SP } from '../../../theme';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import PrimaryButton from '../../common/components/PrimaryButton';
import LoadingState from '../../common/components/LoadingState';
import EmptyState from '../../dashboard/components/EmptyState';
import SectionHeader from '../../dashboard/components/Sectionheader';
import { Field, SwitchRow } from '../../trainers/components/FormFields';
import { useAttendanceSettings, useUpdateAttendanceSettings } from '../api/attendanceQueries';
import BranchLocationEditor from '../components/BranchLocationEditor';

interface Props { onBack?: () => void; onOpenLog?: () => void }

/** Admin: how members can record attendance — biometric devices and per-branch location check-in. */
export default function AttendanceSettingsPage({ onBack, onOpenLog }: Props) {
  const { data, isLoading, isError, refetch } = useAttendanceSettings();
  const update = useUpdateAttendanceSettings();

  const [faceEnabled, setFace] = useState(true);
  const [fingerprintEnabled, setFingerprint] = useState(true);
  const [defaultRadius, setDefaultRadius] = useState('');
  const [maxAccuracy, setMaxAccuracy] = useState('');
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    setFace(data.settings.faceEnabled);
    setFingerprint(data.settings.fingerprintEnabled);
    setDefaultRadius(String(data.settings.defaultRadiusM));
    setMaxAccuracy(String(data.settings.maxAccuracyM));
  }, [data]);

  const radiusNum = Number(defaultRadius);
  const accuracyNum = Number(maxAccuracy);
  const radiusError = !Number.isInteger(radiusNum) || radiusNum < 20 || radiusNum > 5000 ? 'Between 20 and 5000' : undefined;
  const accuracyError = !Number.isInteger(accuracyNum) || accuracyNum < 10 || accuracyNum > 1000 ? 'Between 10 and 1000' : undefined;

  const saveGym = () => {
    setSaved(null);
    update.mutate(
      { faceEnabled, fingerprintEnabled, defaultRadiusM: radiusNum, maxAccuracyM: accuracyNum },
      {
        onSuccess: (res) => setSaved(res.success ? 'Saved.' : res.message || 'Could not save.'),
        onError: (e: any) => setSaved(e?.response?.data?.message ?? 'Could not save. Check your connection.'),
      },
    );
  };

  return (
    <Screen>
      <ScreenHeader
        eyebrow="Settings"
        title="Attendance"
        onBack={onBack}
        action={onOpenLog ? { label: 'Log', icon: 'list', onPress: onOpenLog } : undefined}
      />
      {isLoading ? (
        <LoadingState label="Loading attendance settings" />
      ) : isError || !data ? (
        <EmptyState icon="alert-triangle" tone="error" title="Couldn't load settings" action={{ label: 'Retry', onPress: () => refetch() }} />
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: SP.xl, paddingBottom: 40, gap: 28 }}
          >
            {/* Biometric */}
            <View>
              <SectionHeader title="Biometric devices" />
              <Text style={{ color: T.textSub, fontSize: 13, marginBottom: 12, lineHeight: 18 }}>
                A successful scan at a branch's access device records the member's attendance.
              </Text>
              <SwitchRow label="Face recognition" description="Face scans count as attendance." value={faceEnabled} onValueChange={setFace} />
              <SwitchRow label="Fingerprint" description="Fingerprint scans count as attendance." value={fingerprintEnabled} onValueChange={setFingerprint} />
            </View>

            {/* Location rules */}
            <View>
              <SectionHeader title="Location check-in rules" />
              <Field
                label="Default check-in radius (metres)"
                value={defaultRadius}
                onChangeText={(v) => setDefaultRadius(v.replace(/[^\d]/g, ''))}
                keyboardType="numeric"
                error={radiusError}
              />
              <Field
                label="Reject GPS readings less accurate than (metres)"
                value={maxAccuracy}
                onChangeText={(v) => setMaxAccuracy(v.replace(/[^\d]/g, ''))}
                keyboardType="numeric"
                error={accuracyError}
              />
              {saved && <Text accessibilityLiveRegion="polite" style={{ color: T.textSub, fontSize: 12, marginBottom: 10 }}>{saved}</Text>}
              <PrimaryButton label="Save gym settings" onPress={saveGym} loading={update.isPending} disabled={!!radiusError || !!accuracyError} />
            </View>

            {/* Per-branch */}
            <View>
              <SectionHeader title="Branches" />
              <Text style={{ color: T.textSub, fontSize: 13, marginBottom: 12, lineHeight: 18 }}>
                Turn on location check-in per branch and set where the branch is — stand inside it and use your
                current location, or paste the coordinates from Google Maps.
              </Text>
              {data.branches.length === 0 ? (
                <EmptyState icon="map-pin" title="No active branches" subtitle="Add a branch first." />
              ) : (
                <View style={{ gap: 14 }}>
                  {data.branches.map(b => (
                    <BranchLocationEditor key={b.branchId} branch={b} defaultRadiusM={data.settings.defaultRadiusM} />
                  ))}
                </View>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </Screen>
  );
}
