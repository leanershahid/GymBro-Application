import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { T, SP } from '../../../theme';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import PrimaryButton from '../../common/components/PrimaryButton';
import LoadingState from '../../common/components/LoadingState';
import EmptyState from '../../common/components/EmptyState';
import SectionHeader from '../../dashboard/components/Sectionheader';
import { Field, SwitchRow } from '../../common/components/FormFields';
import { useAttendanceSettings, useUpdateAttendanceSettings } from '../api/attendanceQueries';
import BranchLocationEditor from '../components/BranchLocationEditor';
import { apiErrorText } from '../../../api/apiError';
import { retentionText, validateFaceSettings } from '../utils/faceCheck';
import { showAlert } from '../../common/components/dialogs';

interface Props { onBack?: () => void; onOpenLog?: () => void }

/** Admin: how members can record attendance — biometric devices and per-branch location check-in. */
export default function AttendanceSettingsPage({ onBack, onOpenLog }: Props) {
  const { data, isLoading, isError, refetch } = useAttendanceSettings();
  const update = useUpdateAttendanceSettings();

  const [faceEnabled, setFace] = useState(true);
  const [fingerprintEnabled, setFingerprint] = useState(true);
  const [defaultRadius, setDefaultRadius] = useState('');
  const [maxAccuracy, setMaxAccuracy] = useState('');
  const [faceCheckEnabled, setFaceCheck] = useState(false);
  const [threshold, setThreshold] = useState('90');
  const [keepDays, setKeepDays] = useState('30');
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    setFace(data.settings.faceEnabled);
    setFingerprint(data.settings.fingerprintEnabled);
    setDefaultRadius(String(data.settings.defaultRadiusM));
    setMaxAccuracy(String(data.settings.maxAccuracyM));
    setFaceCheck(data.settings.faceCheckEnabled);
    setThreshold(String(data.settings.faceMatchThreshold));
    setKeepDays(String(data.settings.keepCheckInSelfiesDays));
  }, [data]);

  const radiusNum = Number(defaultRadius);
  const accuracyNum = Number(maxAccuracy);
  const radiusError = !Number.isInteger(radiusNum) || radiusNum < 20 || radiusNum > 5000 ? 'Between 20 and 5000' : undefined;
  const accuracyError = !Number.isInteger(accuracyNum) || accuracyNum < 10 || accuracyNum > 1000 ? 'Between 10 and 1000' : undefined;

  const faceErrors = validateFaceSettings({ threshold, keepDays });
  const faceReady = !!data?.faceServiceConfigured && !!data?.privateStorageConfigured;

  const saveGym = () => {
    setSaved(null);
    update.mutate(
      {
        faceEnabled, fingerprintEnabled, defaultRadiusM: radiusNum, maxAccuracyM: accuracyNum,
        faceCheckEnabled, faceMatchThreshold: Number(threshold), keepCheckInSelfiesDays: Number(keepDays),
      },
      {
        onSuccess: (res) => setSaved(res.success ? 'Saved.' : res.message || 'Could not save.'),
        onError: (e: unknown) => setSaved(apiErrorText(e)),
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
              <SwitchRow label="Face scanners" description="Face scans at an access device count as attendance." value={faceEnabled} onValueChange={setFace} />
              <SwitchRow label="Fingerprint" description="Fingerprint scans count as attendance." value={fingerprintEnabled} onValueChange={setFingerprint} />
            </View>

            {/* Face check-in (self check-in only) */}
            <View>
              <SectionHeader title="Face check-in" />
              <Text style={{ color: T.textSub, fontSize: 13, marginBottom: 10, lineHeight: 18 }}>
                When on, members who check themselves in must be at the branch AND take a live selfie that matches the
                reference photo they set up once. Front-desk check-in doesn’t change.
              </Text>
              <View style={{ gap: 6, marginBottom: 12 }}>
                {[
                  'Consent: each member agrees on a consent screen before their photo is taken (recorded as “biometric_face”). Without it they check in at the desk.',
                  'Privacy: photos are stored privately, only staff can view them, and they are deleted when the member withdraws consent or deletes their account.',
                  retentionText(Number.isInteger(Number(keepDays)) ? Number(keepDays) : 0),
                  data.faceProvider === 'aws'
                    ? 'Cost: faces are compared by AWS Rekognition, about USD 0.001 per check-in attempt (billed to the AWS account set up on the server).'
                    : 'Cost: faces are compared on the GymBro server itself, so there is no per-check fee (the server needs more memory).',
                  'Limits: a printed photo held up to the camera isn’t detected (no liveness check). Staff can review kept selfies; after 3 failed tries in 10 minutes the member must use the front desk.',
                ].map(t => (
                  <Text key={t.slice(0, 12)} style={{ color: T.textFaint, fontSize: 12, lineHeight: 17 }}>• {t}</Text>
                ))}
              </View>
              {!faceReady && (
                <Text accessibilityRole="alert" style={{ color: T.brandGold, fontSize: 12, marginBottom: 10, lineHeight: 17 }}>
                  {!data.faceServiceConfigured
                    ? 'Not available yet: no face matching service is configured on the server.'
                    : 'Not available yet: private photo storage (Cloudinary or Supabase) isn’t configured on the server.'}
                </Text>
              )}
              <SwitchRow
                label="Require a selfie at self check-in"
                description={faceReady ? 'Location AND face. Off by default.' : 'Needs server setup first.'}
                value={faceCheckEnabled}
                onValueChange={(v) => {
                  if (v && !faceReady) { showAlert('Face check-in isn’t available', 'Ask your GymBro administrator to set up the face matching service and private photo storage first.'); return; }
                  setFaceCheck(v);
                }}
              />
              <Field
                label="Match threshold (80–99, higher is stricter)"
                value={threshold}
                onChangeText={(v) => setThreshold(v.replace(/[^\d]/g, ''))}
                keyboardType="numeric"
                error={faceErrors.threshold}
              />
              <Field
                label="Keep check-in selfies for (days, 0 = don’t keep)"
                value={keepDays}
                onChangeText={(v) => setKeepDays(v.replace(/[^\d]/g, ''))}
                keyboardType="numeric"
                error={faceErrors.keepDays}
              />
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
              <PrimaryButton label="Save gym settings" onPress={saveGym} loading={update.isPending} disabled={!!radiusError || !!accuracyError || !!faceErrors.threshold || !!faceErrors.keepDays} />
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
