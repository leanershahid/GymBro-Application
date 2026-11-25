import React from 'react';
import { Text, View } from 'react-native';
import { Image } from 'expo-image';
import { T, SP, R } from '../../../theme';
import BottomSheet from '../../common/components/BottomSheet';
import LoadingState from '../../common/components/LoadingState';
import StatusPill from '../../common/components/StatusPill';
import { describeApiError } from '../../../api/apiError';
import { useFaceAttemptPhotos } from '../api/faceQueries';
import { attemptBadge } from '../utils/faceCheck';

/** Staff: a kept check-in selfie next to the member's reference photo (signed, short-lived links). */
export default function FacePhotosSheet({ attemptId, memberName, onClose }: { attemptId: number | null; memberName?: string | null; onClose: () => void }) {
  const q = useFaceAttemptPhotos(attemptId);
  const d = q.data;

  const photo = (label: string, url: string | null) => (
    <View style={{ flex: 1, gap: SP.xs }}>
      <Text style={{ color: T.textSub, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' }}>{label}</Text>
      {url ? (
        <Image source={{ uri: url }} contentFit="cover" accessibilityLabel={`${label} of ${memberName ?? 'the member'}`}
          style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: R.md, backgroundColor: T.bg }} />
      ) : (
        <View style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: R.md, backgroundColor: T.bg, alignItems: 'center', justifyContent: 'center', padding: SP.sm }}>
          <Text style={{ color: T.textFaint, fontSize: 12, textAlign: 'center' }}>Not kept</Text>
        </View>
      )}
    </View>
  );

  return (
    <BottomSheet visible={attemptId != null} onClose={onClose} title={memberName ? `Face check · ${memberName}` : 'Face check'}>
      <View style={{ padding: SP.xl, gap: SP.md }}>
        {q.isLoading ? <LoadingState label="Loading photos" /> : q.isError || !d ? (
          <Text style={{ color: T.err, fontSize: 13 }}>{describeApiError(q.error).message}</Text>
        ) : (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.sm }}>
              <StatusPill label={attemptBadge(d).label} tone={attemptBadge(d).tone} />
              <Text style={{ color: T.textSub, fontSize: 12 }}>{new Date(d.at).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: SP.md, width: '100%', maxWidth: 480, alignSelf: 'center' }}>
              {photo('Check-in selfie', d.selfieUrl)}
              {photo('Reference photo', d.referenceUrl)}
            </View>
            <Text style={{ color: T.textFaint, fontSize: 11, lineHeight: 16 }}>
              Face photos are biometric data: view them only to check a disputed check-in. Links expire after a few minutes.
            </Text>
          </>
        )}
      </View>
    </BottomSheet>
  );
}
