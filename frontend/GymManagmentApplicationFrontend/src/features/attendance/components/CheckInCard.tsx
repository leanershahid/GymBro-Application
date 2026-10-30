import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, R, withAlpha } from '../../../theme';
import PrimaryButton from '../../common/components/PrimaryButton';
import { useCheckIn, useCheckOut, useMyAttendanceStatus } from '../api/attendanceQueries';
import { formatDistance, getCurrentCoords } from '../utils/location';

const sinceLabel = (iso: string) => {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  const at = new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return mins < 60 ? `since ${at} · ${mins} min` : `since ${at} · ${Math.floor(mins / 60)} h ${mins % 60} min`;
};

/**
 * Member/trainer location check-in. Renders nothing unless at least one branch of the gym has
 * location check-in turned on (or the user still has an open visit to check out of). The phone's GPS position is sent to the server, which decides
 * whether it's inside the branch radius.
 */
export default function CheckInCard() {
  const { data: status, isLoading } = useMyAttendanceStatus();
  const checkIn = useCheckIn();
  const checkOut = useCheckOut();
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'err' | 'warn'; text: string } | null>(null);
  const [, tick] = useState(0);

  // Keep "since … · n min" fresh while checked in.
  useEffect(() => {
    if (!status?.openVisit) return;
    const id = setInterval(() => tick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, [status?.openVisit]);

  if (isLoading || !status) return null;

  const open = status.openVisit;
  // Nothing to do here until the gym switches location check-in on (an open visit can still be closed).
  if (!status.locationEnabled && !open) return null;
  const busy = locating || checkIn.isPending || checkOut.isPending;

  const doCheckIn = async () => {
    setMessage(null);
    setLocating(true);
    try {
      const c = await getCurrentCoords();
      setLocating(false);
      const res = await checkIn.mutateAsync({ lat: c.lat, lng: c.lng, accuracyM: c.accuracyM });
      const d = res.data;
      if (res.success) setMessage({ tone: 'ok', text: res.message });
      else setMessage({
        tone: 'warn',
        text: d?.distanceM != null && d.nearestBranch
          ? `You're ${formatDistance(d.distanceM)} from ${d.nearestBranch}. Move closer and try again.`
          : res.message,
      });
    } catch (e: any) {
      setLocating(false);
      setMessage({ tone: 'err', text: e?.response?.data?.message ?? (e instanceof Error ? e.message : 'Check-in failed.') });
    }
  };

  const doCheckOut = () => {
    setMessage(null);
    checkOut.mutate(undefined, {
      onSuccess: (res) => setMessage({ tone: 'ok', text: res.success ? 'Checked out. See you next time!' : res.message }),
      onError: (e: any) => setMessage({ tone: 'err', text: e?.response?.data?.message ?? 'Check-out failed.' }),
    });
  };

  const accent = open ? T.brand : T.sky;
  const msgColor = message?.tone === 'ok' ? T.brand : message?.tone === 'warn' ? T.brandGold : T.err;

  return (
    <View style={{
      padding: 16, borderRadius: R.lg, gap: 12,
      backgroundColor: withAlpha(accent, 0.06), borderWidth: 1, borderColor: withAlpha(accent, 0.3),
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: withAlpha(accent, 0.15) }}>
          <Feather name={open ? 'check-circle' : 'map-pin'} size={18} color={accent} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ color: T.text, fontSize: 15, fontWeight: '800' }}>
            {open ? `Checked in at ${open.branchName ?? 'the gym'}` : 'At the gym?'}
          </Text>
          <Text numberOfLines={1} style={{ color: T.textSub, fontSize: 12, marginTop: 2 }}>
            {open
              ? sinceLabel(open.checkInAt)
              : `Check in with your location · ${status.visitsThisMonth} visit${status.visitsThisMonth === 1 ? '' : 's'} this month`}
          </Text>
        </View>
      </View>

      {message && (
        <Text accessibilityLiveRegion="polite" style={{ color: msgColor, fontSize: 12, lineHeight: 17 }}>{message.text}</Text>
      )}

      {open ? (
        <PrimaryButton label="Check out" icon="log-out" variant="secondary" onPress={doCheckOut} loading={checkOut.isPending} disabled={busy} />
      ) : (
        <PrimaryButton
          label={locating ? 'Getting your location…' : 'Check in'}
          icon="map-pin"
          onPress={doCheckIn}
          loading={busy}
          accessibilityHint="Uses your current location to record attendance at the nearest branch"
        />
      )}
    </View>
  );
}
