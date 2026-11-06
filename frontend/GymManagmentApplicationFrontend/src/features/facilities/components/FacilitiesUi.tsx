import React, { useState } from 'react';
import { ActivityIndicator, Image, Linking, Platform, Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { T, R, SP, withAlpha } from '../../../theme';
import StatusPill from '../../common/components/StatusPill';
import { showAlert } from '../../common/components/dialogs';
import { describeApiError } from '../../../api/apiError';
import { uploadPicked } from '../api/facilitiesApi';
import type { AssetStatus, IncidentSeverity, ReportStatus } from '../types/facilities.types';
import { ASSET_STATUS_LABEL, ASSET_STATUS_TONE, REPORT_STATUS_LABEL, REPORT_STATUS_TONE, SEVERITY_TONE } from '../utils/facilitiesFormat';

/** Building blocks shared by the facilities screens. */

export const AssetStatusChip = ({ status }: { status: AssetStatus }) =>
  <StatusPill label={ASSET_STATUS_LABEL[status]} tone={ASSET_STATUS_TONE[status]} dot />;

export const ReportStatusChip = ({ status }: { status: ReportStatus }) =>
  <StatusPill label={REPORT_STATUS_LABEL[status]} tone={REPORT_STATUS_TONE[status]} dot />;

export const SeverityChip = ({ severity }: { severity: IncidentSeverity }) =>
  <StatusPill label={severity} tone={SEVERITY_TONE[severity]} />;

export const UrgentChip = () => <StatusPill label="Urgent" tone="err" />;

export function Card({ children, tint, style }: { children: React.ReactNode; tint?: string; style?: object }) {
  return (
    <View style={[{
      backgroundColor: tint ? withAlpha(tint, 0.08) : T.bgInput, borderRadius: R.lg, padding: SP.lg,
      borderWidth: 1, borderColor: tint ? withAlpha(tint, 0.28) : T.line,
    }, style]}>
      {children}
    </View>
  );
}

export function SectionTitle({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SP.md, gap: SP.sm }}>
      <Text accessibilityRole="header" style={{ color: T.text, fontSize: 18, fontWeight: '700', flexShrink: 1 }}>{title}</Text>
      {right}
    </View>
  );
}

/** A tappable list row with title, subtitle and something on the right (chips, chevron). */
export function ListRow({ title, subtitle, right, onPress, label, tint }: {
  title: string; subtitle?: string | null; right?: React.ReactNode; onPress?: () => void; label?: string; tint?: string;
}) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined} accessibilityLabel={label ?? title}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: SP.md, padding: SP.lg, minHeight: 64, borderRadius: R.lg,
        backgroundColor: pressed ? T.bgInputActive : tint ? withAlpha(tint, 0.08) : T.bgInput,
        borderWidth: 1, borderColor: tint ? withAlpha(tint, 0.3) : T.line,
      })}>
      <View style={{ flex: 1, gap: 4 }}>
        <Text numberOfLines={2} style={{ color: T.text, fontSize: 15, fontWeight: '700' }}>{title}</Text>
        {!!subtitle && <Text numberOfLines={2} style={{ color: T.textSub, fontSize: 13 }}>{subtitle}</Text>}
      </View>
      {right}
      {onPress && <Feather name="chevron-right" size={18} color={T.textFaint} />}
    </Pressable>
  );
}

/** Horizontal photo thumbnails; tap opens the full image. */
export function PhotoStrip({ urls, size = 84 }: { urls: string[]; size?: number }) {
  if (urls.length === 0) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.sm }}>
      {urls.map((u, i) => (
        <Pressable key={u} onPress={() => Linking.openURL(u).catch(() => showAlert("Couldn't open the photo"))}
          accessibilityRole="imagebutton" accessibilityLabel={`Photo ${i + 1} of ${urls.length}, opens full size`}>
          <Image source={{ uri: u }} style={{ width: size, height: size, borderRadius: R.md, backgroundColor: T.bgInputActive }} />
        </Pressable>
      ))}
    </View>
  );
}

/**
 * Photo-first picker: "Take photo" (camera on phones) and "Choose", up to `max`, each uploaded
 * straight away so the form only carries URLs.
 */
export function PhotoPicker({ urls, onChange, max = 3, big }: { urls: string[]; onChange: (u: string[]) => void; max?: number; big?: boolean }) {
  const [busy, setBusy] = useState(false);
  const full = urls.length >= max;

  const pick = async (camera: boolean) => {
    if (full || busy) return;
    try {
      if (Platform.OS !== 'web') {
        const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (perm.status !== 'granted') { showAlert(camera ? 'Allow camera access to take a photo.' : 'Allow photo access to add one.'); return; }
      }
      const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.7 };
      const result = camera && Platform.OS !== 'web' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      const asset = result.canceled ? null : result.assets[0];
      if (!asset?.uri) return;
      setBusy(true);
      const url = await uploadPicked({ uri: asset.uri, mimeType: asset.mimeType, fileName: asset.fileName });
      onChange([...urls, url].slice(0, max));
    } catch (e) {
      showAlert("Couldn't add the photo", describeApiError(e).message);
    } finally {
      setBusy(false);
    }
  };

  const tile = big ? 96 : 72;
  return (
    <View style={{ gap: SP.md }}>
      <View style={{ flexDirection: 'row', gap: SP.sm }}>
        {Platform.OS !== 'web' && (
          <PickButton icon="camera" label="Take photo" onPress={() => pick(true)} disabled={full || busy} big={big} />
        )}
        <PickButton icon="image" label={Platform.OS === 'web' ? 'Add photo' : 'Choose'} onPress={() => pick(false)} disabled={full || busy} big={big} />
      </View>
      {(urls.length > 0 || busy) && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.sm }}>
          {urls.map((u, i) => (
            <View key={u}>
              <Image source={{ uri: u }} accessibilityLabel={`Photo ${i + 1}`} style={{ width: tile, height: tile, borderRadius: R.md, backgroundColor: T.bgInputActive }} />
              <Pressable onPress={() => onChange(urls.filter(x => x !== u))} accessibilityRole="button" accessibilityLabel={`Remove photo ${i + 1}`}
                hitSlop={10} style={{ position: 'absolute', top: -6, right: -6, width: 26, height: 26, borderRadius: 13, backgroundColor: T.bgNav, borderWidth: 1, borderColor: T.line, alignItems: 'center', justifyContent: 'center' }}>
                <Feather name="x" size={14} color={T.text} />
              </Pressable>
            </View>
          ))}
          {busy && (
            <View accessibilityLabel="Uploading photo" style={{ width: tile, height: tile, borderRadius: R.md, backgroundColor: T.bgInput, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color={T.brand} />
            </View>
          )}
        </View>
      )}
      <Text style={{ color: T.textFaint, fontSize: 12 }}>{urls.length}/{max} photos · optional, but they help us fix it faster</Text>
    </View>
  );
}

function PickButton({ icon, label, onPress, disabled, big }: { icon: 'camera' | 'image'; label: string; onPress: () => void; disabled?: boolean; big?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }}
      style={({ pressed }) => ({
        flex: 1, minHeight: big ? 72 : 52, borderRadius: R.lg, alignItems: 'center', justifyContent: 'center', gap: 6,
        flexDirection: big ? 'column' : 'row', opacity: disabled ? 0.5 : 1,
        backgroundColor: pressed ? T.brandDim : T.bgInput, borderWidth: 1, borderColor: pressed ? T.brandBorder : T.line,
      })}>
      <Feather name={icon} size={big ? 24 : 18} color={T.brand} />
      <Text style={{ color: T.text, fontSize: 14, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

