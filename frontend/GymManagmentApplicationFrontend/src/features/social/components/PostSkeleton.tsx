import React from 'react';
import { View } from 'react-native';
import { T, SP, R } from '../../../theme';
import Skeleton from '../../common/components/Skeleton';

/** Placeholder shaped like a post card while the feed loads. */
export default function PostSkeleton({ width }: { width: number }) {
  return (
    <View
      accessibilityLabel="Loading posts"
      style={{ width, backgroundColor: T.bgInput, borderRadius: R.xl, borderWidth: 1, borderColor: T.line, overflow: 'hidden', marginBottom: SP.lg }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.md, padding: SP.md }}>
        <View style={{ width: 40 }}><Skeleton rows={1} height={40} borderRadius={20} gap={0} /></View>
        <View style={{ flex: 1 }}>
          <Skeleton rows={2} height={11} borderRadius={6} gap={6} />
        </View>
      </View>
      <Skeleton rows={1} height={Math.round(width * 1.25)} borderRadius={0} gap={0} />
      <View style={{ padding: SP.md }}>
        <Skeleton rows={3} height={11} borderRadius={6} gap={8} />
      </View>
    </View>
  );
}
