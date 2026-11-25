import React, { useRef, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { T, SP, R, withAlpha } from '../../../theme';
import PrimaryButton from '../../common/components/PrimaryButton';
import { CapturedSelfie } from '../types/attendance.types';
import { browserCameraAvailable, selfieMimeType } from '../utils/faceCheck';

interface Props {
  /** Called with a live front-camera capture (never a gallery file). */
  onCapture: (selfie: CapturedSelfie) => void;
  onCancel?: () => void;
  /** Uploading / comparing: the shutter is disabled and a spinner shows over the preview. */
  busy?: boolean;
  busyLabel?: string;
  /** Instruction above the preview. */
  hint?: string;
  /** Error / retry message from the last attempt, shown under the preview. */
  error?: string | null;
  captureLabel?: string;
}

/** True when this device can show a live camera (always on phones; getUserMedia over https on web). */
export function cameraSupported(): boolean {
  if (Platform.OS !== 'web') return true;
  if (typeof window === 'undefined') return false;
  return browserCameraAvailable(typeof navigator === 'undefined' ? undefined : navigator, window.isSecureContext);
}

/**
 * Front-camera selfie with a face oval guide. Live capture only (anti-spoof hygiene: no gallery, the
 * capture time is sent with the photo). On a browser without camera access it asks to use the phone app.
 */
export default function FaceCamera({ onCapture, onCancel, busy, busyLabel = 'Checking your face…', hint, error, captureLabel = 'Take selfie' }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [ready, setReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  if (!cameraSupported()) {
    return (
      <Notice icon="smartphone" title="Use the app on your phone to check in"
        text="This browser can't open a camera. Open GymBro on your phone to take your check-in selfie, or check in at the front desk."
        onCancel={onCancel} />
    );
  }

  if (!permission) {
    return <View style={{ padding: SP.xl, alignItems: 'center' }}><ActivityIndicator color={T.brand} accessibilityLabel="Opening camera" /></View>;
  }

  if (!permission.granted) {
    const blocked = !permission.canAskAgain;
    return (
      <Notice
        icon="camera-off"
        title="Camera access needed"
        text={blocked
          ? 'Camera access is turned off for GymBro. Turn it on in your phone settings to take your selfie.'
          : 'GymBro needs the front camera to take a selfie that confirms it’s you. The photo is only used for check-in.'}
        actionLabel={blocked ? (Platform.OS === 'web' ? undefined : 'Open settings') : 'Allow camera'}
        onAction={blocked ? (Platform.OS === 'web' ? undefined : () => Linking.openSettings()) : () => requestPermission()}
        onCancel={onCancel}
      />
    );
  }

  const take = async () => {
    if (!camera.current || capturing || busy) return;
    setCameraError(null);
    setCapturing(true);
    try {
      const photo = await camera.current.takePictureAsync({ quality: 0.6, shutterSound: false });
      if (!photo?.uri) throw new Error('No photo');
      onCapture({ uri: photo.uri, mimeType: selfieMimeType(photo.uri), capturedAt: new Date().toISOString() });
    } catch {
      setCameraError('The camera couldn’t take a photo. Try again.');
    } finally {
      setCapturing(false);
    }
  };

  const message = cameraError ?? error;

  return (
    <View style={{ gap: SP.md }}>
      {hint && <Text style={{ color: T.textSub, fontSize: 13, lineHeight: 18, textAlign: 'center' }}>{hint}</Text>}

      <View
        accessible
        accessibilityLabel="Front camera preview. Fit your face inside the oval."
        style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: R.xl, overflow: 'hidden', backgroundColor: T.black, alignSelf: 'center', maxWidth: 420 }}
      >
        <CameraView
          ref={camera}
          style={{ flex: 1 }}
          facing="front"
          mode="picture"
          mirror
          animateShutter={false}
          onCameraReady={() => setReady(true)}
          onMountError={() => setCameraError('The camera couldn’t start. Close other apps using it and try again.')}
        />
        {/* Face oval guide */}
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{
            width: '62%', aspectRatio: 0.75, borderRadius: 999, borderWidth: 3,
            borderColor: message ? T.brandGold : T.brand, backgroundColor: 'transparent',
          }} />
        </View>
        {(busy || capturing || !ready) && (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: T.overlay, gap: SP.sm }}>
            <ActivityIndicator color={T.brand} />
            <Text style={{ color: T.text, fontSize: 13, fontWeight: '600' }}>{busy ? busyLabel : !ready ? 'Starting camera…' : 'Taking photo…'}</Text>
          </View>
        )}
      </View>

      {message && (
        <View accessibilityRole="alert" accessibilityLiveRegion="polite"
          style={{ flexDirection: 'row', gap: 8, padding: SP.md, borderRadius: R.md, backgroundColor: withAlpha(T.brandGold, 0.08), borderWidth: 1, borderColor: withAlpha(T.brandGold, 0.25) }}>
          <Feather name="alert-circle" size={15} color={T.brandGold} style={{ marginTop: 1 }} />
          <Text style={{ flex: 1, color: T.brandGold, fontSize: 13, lineHeight: 18 }}>{message}</Text>
        </View>
      )}

      <PrimaryButton
        label={message ? 'Try again' : captureLabel}
        icon="camera"
        onPress={take}
        loading={busy || capturing}
        disabled={!ready}
        accessibilityHint="Takes a selfie with the front camera"
      />
      {onCancel && <PrimaryButton label="Cancel" variant="secondary" onPress={onCancel} disabled={busy} />}
    </View>
  );
}

function Notice({ icon, title, text, actionLabel, onAction, onCancel }: {
  icon: React.ComponentProps<typeof Feather>['name']; title: string; text: string;
  actionLabel?: string; onAction?: () => void; onCancel?: () => void;
}) {
  return (
    <View style={{ gap: SP.md, alignItems: 'center', paddingVertical: SP.lg }}>
      <View style={{ width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: withAlpha(T.sky, 0.12) }}>
        <Feather name={icon} size={24} color={T.sky} />
      </View>
      <Text accessibilityRole="header" style={{ color: T.text, fontSize: 16, fontWeight: '800', textAlign: 'center' }}>{title}</Text>
      <Text style={{ color: T.textSub, fontSize: 13, lineHeight: 19, textAlign: 'center' }}>{text}</Text>
      {actionLabel && onAction && <PrimaryButton label={actionLabel} icon="camera" onPress={onAction} style={{ alignSelf: 'stretch' }} />}
      {onCancel && (
        <Pressable onPress={onCancel} accessibilityRole="button" accessibilityLabel="Close" hitSlop={8} style={{ minHeight: 44, justifyContent: 'center' }}>
          <Text style={{ color: T.textSub, fontSize: 14, fontWeight: '600' }}>Close</Text>
        </Pressable>
      )}
    </View>
  );
}
