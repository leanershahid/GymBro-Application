import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Linking } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, R, withAlpha } from '../../../theme';
import { Field, SwitchRow } from '../../trainers/components/FormFields';
import PrimaryButton from '../../common/components/PrimaryButton';
import StatusPill from '../../common/components/StatusPill';
import { BranchGeofence } from '../types/attendance.types';
import { useClearBranchGeofence, useSetBranchGeofence } from '../api/attendanceQueries';
import { formatCoords, getCurrentCoords, isShortMapsLink, parseCoordinates } from '../utils/location';

interface Props {
  branch: BranchGeofence;
  defaultRadiusM: number;
}

/**
 * One branch's location check-in setup: on/off, the branch's coordinates (from this phone's
 * GPS or pasted from Google Maps), and the allowed radius.
 */
export default function BranchLocationEditor({ branch, defaultRadiusM }: Props) {
  const [enabled, setEnabled] = useState(branch.enabled);
  const [lat, setLat] = useState<number | null>(branch.lat);
  const [lng, setLng] = useState<number | null>(branch.lng);
  const [radius, setRadius] = useState(branch.hasOwnRadius && branch.radiusM ? String(branch.radiusM) : '');
  const [paste, setPaste] = useState('');
  const [message, setMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [locating, setLocating] = useState(false);

  const save = useSetBranchGeofence();
  const clear = useClearBranchGeofence();

  // Keep in sync when the server copy changes (after save / refetch).
  useEffect(() => {
    setEnabled(branch.enabled);
    setLat(branch.lat);
    setLng(branch.lng);
    setRadius(branch.hasOwnRadius && branch.radiusM ? String(branch.radiusM) : '');
  }, [branch.enabled, branch.lat, branch.lng, branch.radiusM, branch.hasOwnRadius]);

  const hasLocation = lat !== null && lng !== null;
  const radiusNum = radius.trim() === '' ? null : Number(radius);
  const radiusError = radiusNum !== null && (!Number.isInteger(radiusNum) || radiusNum < 20 || radiusNum > 5000)
    ? 'Enter a whole number between 20 and 5000' : undefined;

  const useMyLocation = async () => {
    setMessage(null);
    setLocating(true);
    try {
      const c = await getCurrentCoords();
      setLat(Number(c.lat.toFixed(7)));
      setLng(Number(c.lng.toFixed(7)));
      setMessage({
        tone: 'ok',
        text: c.accuracyM && c.accuracyM > 50
          ? `Location captured (±${Math.round(c.accuracyM)} m). Stand inside the gym near the entrance for better accuracy.`
          : 'Location captured from this device.',
      });
    } catch (e) {
      setMessage({ tone: 'err', text: e instanceof Error ? e.message : 'Could not read this device’s location.' });
    } finally {
      setLocating(false);
    }
  };

  const applyPaste = (text: string) => {
    setPaste(text);
    if (!text.trim()) return;
    const c = parseCoordinates(text);
    if (c) {
      setLat(Number(c.lat.toFixed(7)));
      setLng(Number(c.lng.toFixed(7)));
      setMessage({ tone: 'ok', text: 'Coordinates read from Google Maps.' });
    } else {
      setMessage({
        tone: 'err',
        text: isShortMapsLink(text)
          ? 'Short maps.app.goo.gl links hide the coordinates. In Google Maps, long-press the gym and copy the numbers shown (e.g. 9.9312, 76.2673), or open the link and copy the full address-bar URL.'
          : 'No coordinates found. Paste numbers like 9.9312, 76.2673 or a full Google Maps link.',
      });
    }
  };

  const onSave = () => {
    setMessage(null);
    if (enabled && !hasLocation) {
      setMessage({ tone: 'err', text: 'Set the branch location first (use your current location or paste from Google Maps).' });
      return;
    }
    if (radiusError) return;
    save.mutate(
      {
        branchId: branch.branchId,
        payload: { enabled, lat: lat ?? undefined, lng: lng ?? undefined, radiusM: radiusNum },
      },
      {
        onSuccess: (res) => setMessage(res.success
          ? { tone: 'ok', text: enabled ? 'Saved. Members can check in here.' : 'Saved. Location check-in is off for this branch.' }
          : { tone: 'err', text: res.message || 'Could not save.' }),
        onError: (e: any) => setMessage({ tone: 'err', text: e?.response?.data?.message ?? 'Could not save. Check your connection.' }),
      },
    );
  };

  const onRemove = () => {
    setMessage(null);
    clear.mutate(branch.branchId, {
      onSuccess: () => { setPaste(''); setMessage({ tone: 'ok', text: 'Location removed.' }); },
      onError: () => setMessage({ tone: 'err', text: 'Could not remove the location.' }),
    });
  };

  const openInMaps = () => {
    if (hasLocation) Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`);
  };

  return (
    <View style={{ padding: 16, borderRadius: R.lg, backgroundColor: T.bgInput, borderWidth: 1, borderColor: T.line, gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 8 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ color: T.text, fontSize: 16, fontWeight: '800' }}>{branch.name}</Text>
          {branch.city ? <Text numberOfLines={1} style={{ color: T.textSub, fontSize: 12 }}>{branch.city}</Text> : null}
        </View>
        <StatusPill
          label={branch.isActive ? 'Check-in on' : branch.isConfigured ? 'Off' : 'Not set up'}
          tone={branch.isActive ? 'ok' : 'neutral'}
          dot
        />
      </View>

      <SwitchRow
        label="Allow location check-in"
        description="Members and trainers can mark attendance from the app when they are inside this branch's radius."
        value={enabled}
        onValueChange={setEnabled}
      />

      {/* Current location */}
      <View style={{
        padding: 12, borderRadius: R.md, marginBottom: 12,
        backgroundColor: withAlpha(hasLocation ? T.brand : T.text, 0.05), borderWidth: 1, borderColor: hasLocation ? withAlpha(T.brand, 0.25) : T.line,
      }}>
        <Text style={{ color: T.textSub, fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' }}>Branch location</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 8 }}>
          <Feather name="map-pin" size={15} color={hasLocation ? T.brand : T.textFaint} />
          <Text selectable style={{ flex: 1, color: hasLocation ? T.text : T.textFaint, fontSize: 14, fontWeight: '600' }}>
            {hasLocation ? formatCoords(lat!, lng!) : 'Not set'}
          </Text>
          {hasLocation && (
            <Pressable onPress={openInMaps} hitSlop={10} accessibilityRole="link" accessibilityLabel="Open this location in Google Maps">
              <Text style={{ color: T.brand, fontSize: 12, fontWeight: '700' }}>View map</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Option 1 — this device's GPS */}
      <PrimaryButton
        label={locating ? 'Getting location…' : 'Use my current location'}
        icon="navigation"
        variant="secondary"
        loading={locating}
        onPress={useMyLocation}
        accessibilityHint="Stand inside the branch and tap to save its location from this device's GPS"
        style={{ marginBottom: 12 }}
      />

      {/* Option 2 — paste from Google Maps */}
      <Field
        label="Or paste from Google Maps"
        value={paste}
        onChangeText={applyPaste}
        placeholder="9.9312, 76.2673  or a Google Maps link"
        autoCapitalize="none"
        autoCorrect={false}
      />

      <Field
        label={`Check-in radius in metres (blank = gym default, ${defaultRadiusM} m)`}
        value={radius}
        onChangeText={(v) => setRadius(v.replace(/[^\d]/g, ''))}
        placeholder={String(defaultRadiusM)}
        keyboardType="numeric"
        error={radiusError}
      />

      {message && (
        <Text
          accessibilityLiveRegion="polite"
          style={{ color: message.tone === 'ok' ? T.brand : T.err, fontSize: 12, marginBottom: 10, lineHeight: 17 }}
        >
          {message.text}
        </Text>
      )}

      <PrimaryButton label="Save branch" onPress={onSave} loading={save.isPending} disabled={!!radiusError} />
      {branch.isConfigured && (
        <PrimaryButton
          label="Remove location"
          variant="danger"
          onPress={onRemove}
          loading={clear.isPending}
          style={{ marginTop: 10 }}
        />
      )}
    </View>
  );
}
