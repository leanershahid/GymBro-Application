import React, { useEffect, useState } from 'react';
import { View, Text, Modal, Platform, Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { T, R, SP, withAlpha } from '../../../theme';
import PrimaryButton from '../../common/components/PrimaryButton';
import { useCheckIn, useCheckOut, useMyAttendanceStatus } from '../api/attendanceQueries';
import { formatDistance, getCurrentCoords } from '../utils/location';
import { apiErrorText } from '../../../api/apiError';
import { handleSafetyGateError } from '../../safety/routes';
import { useCheckInWithFace } from '../api/faceQueries';
import { CapturedSelfie, LocationFix } from '../types/attendance.types';
import { faceErrorFrom } from '../utils/faceCheck';
import FaceCamera from './FaceCamera';
import FaceEnrollFlow from './FaceEnrollFlow';

const sinceLabel = (iso: string) => {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  const at = new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return mins < 60 ? `since ${at} · ${mins} min` : `since ${at} · ${Math.floor(mins / 60)} h ${mins % 60} min`;
};

/**
 * Member/trainer location check-in. Renders nothing unless at least one branch of the gym has
 * location check-in turned on (or the user still has an open visit to check out of). The phone's GPS position is sent to the server, which decides
 * whether it's inside the branch radius.
 *
 * Face check-in (when the gym turned it on): once the location passes, the server answers
 * faceRequired and the card opens the front camera; the selfie goes with the location to
 * check-in/face. Not enrolled yet → FACE_ENROLL_REQUIRED opens the consent + enrolment flow first.
 */
export default function CheckInCard() {
  const { data: status, isLoading } = useMyAttendanceStatus();
  const checkIn = useCheckIn();
  const checkOut = useCheckOut();
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'err' | 'warn'; text: string } | null>(null);
  const [, tick] = useState(0);
  const faceCheckIn = useCheckInWithFace();
  const insets = useSafeAreaInsets();
  /** The location that passed; the face step re-sends it with the selfie. */
  const [faceFix, setFaceFix] = useState<LocationFix | null>(null);
  const [faceError, setFaceError] = useState<string | null>(null);
  const [enrollReason, setEnrollReason] = useState<string | null>(null);
  const [pendingFix, setPendingFix] = useState<LocationFix | null>(null);

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
  const busy = locating || checkIn.isPending || checkOut.isPending || faceCheckIn.isPending;
  const faceRequired = !!status.faceCheckRequired;

  /** A face-step error: retry in the camera, open enrolment, or send to the front desk. Returns true when handled. */
  const handleFaceError = (e: unknown, fix: LocationFix): boolean => {
    const face = faceErrorFrom(e);
    if (!face) return false;
    if (face.next === 'enroll' || face.next === 'consent') {
      setFaceFix(null);
      setEnrollReason(face.message);
      setPendingFix(fix);
    } else if (face.next === 'desk') {
      setFaceFix(null);
      setMessage({ tone: 'err', text: face.message });
    } else {
      setFaceFix(fix);
      setFaceError(face.attemptsLeft != null && face.attemptsLeft > 0 && !face.message.includes('left')
        ? `${face.message} (${face.attemptsLeft} left)` : face.message);
    }
    return true;
  };

  const doCheckIn = async () => {
    setMessage(null);
    setLocating(true);
    let fix: LocationFix | null = null;
    try {
      const c = await getCurrentCoords();
      setLocating(false);
      fix = { lat: c.lat, lng: c.lng, accuracyM: c.accuracyM };
      const res = await checkIn.mutateAsync(fix);
      const d = res.data;
      if (res.success) setMessage({ tone: 'ok', text: res.message });
      else if (d?.faceRequired) { setFaceError(null); setFaceFix(fix); }
      else setMessage({
        tone: 'warn',
        text: d?.distanceM != null && d.nearestBranch
          ? `You're ${formatDistance(d.distanceM)} from ${d.nearestBranch}. Move closer and try again.`
          : res.message,
      });
    } catch (e: unknown) {
      setLocating(false);
      if (handleSafetyGateError(e)) return;
      if (fix && handleFaceError(e, fix)) return;
      setMessage({ tone: 'err', text: apiErrorText(e) });
    }
  };

  const sendSelfie = async (selfie: CapturedSelfie) => {
    if (!faceFix) return;
    setFaceError(null);
    try {
      const res = await faceCheckIn.mutateAsync({ fix: faceFix, selfie });
      setFaceFix(null);
      const d = res.data;
      setMessage(res.success
        ? { tone: 'ok', text: res.message }
        : { tone: 'warn', text: d?.distanceM != null && d.nearestBranch ? `You're ${formatDistance(d.distanceM)} from ${d.nearestBranch}. Move closer and try again.` : res.message });
    } catch (e: unknown) {
      if (handleSafetyGateError(e)) { setFaceFix(null); return; }
      if (handleFaceError(e, faceFix)) return;
      setFaceError(apiErrorText(e));
    }
  };

  const doCheckOut = () => {
    setMessage(null);
    checkOut.mutate(undefined, {
      onSuccess: (res) => setMessage({ tone: 'ok', text: res.success ? 'Checked out. See you next time!' : res.message }),
      onError: (e: unknown) => setMessage({ tone: 'err', text: apiErrorText(e) }),
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
              : `Check in with your location${faceRequired ? ' + a selfie' : ''} · ${status.visitsThisMonth} visit${status.visitsThisMonth === 1 ? '' : 's'} this month`}
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
          accessibilityHint={faceRequired
            ? 'Uses your current location, then a selfie, to record attendance at the nearest branch'
            : 'Uses your current location to record attendance at the nearest branch'}
        />
      )}

      {/* Face step: location passed, now a live selfie */}
      <Modal visible={!!faceFix} animationType={Platform.OS === 'web' ? 'fade' : 'slide'} presentationStyle="fullScreen" onRequestClose={() => setFaceFix(null)}>
        <View style={{ flex: 1, backgroundColor: T.bg, paddingTop: insets.top }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: SP.xl, paddingVertical: SP.md }}>
            <Text accessibilityRole="header" style={{ flex: 1, color: T.text, fontSize: 18, fontWeight: '800' }}>Selfie check-in</Text>
            <Pressable onPress={() => setFaceFix(null)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Cancel check-in"
              style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: T.bgInput }}>
              <Feather name="x" size={20} color={T.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: SP.xl, paddingBottom: insets.bottom + 32 }}>
            {faceFix && (
              <FaceCamera
                onCapture={sendSelfie}
                onCancel={() => setFaceFix(null)}
                busy={faceCheckIn.isPending}
                error={faceError}
                hint="Your location is confirmed. Fit your face in the oval and take a selfie to finish checking in."
                captureLabel="Take selfie & check in"
              />
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Not enrolled yet: consent + reference selfie, then back to the face step */}
      <FaceEnrollFlow
        visible={!!enrollReason}
        reason={enrollReason ?? undefined}
        onClose={() => setEnrollReason(null)}
        onEnrolled={() => { if (pendingFix) { setFaceError(null); setFaceFix(pendingFix); } setPendingFix(null); }}
      />
    </View>
  );
}
