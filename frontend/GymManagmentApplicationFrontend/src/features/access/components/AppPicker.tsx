import React from 'react';
import { Text, View } from 'react-native';
import { T } from '../../../theme';
import SegmentedTabs from '../../common/components/SegmentedTabs';
import { AccessApp } from '../types/access.types';

const TABS: { key: AccessApp; label: string }[] = [
  { key: 'admin', label: 'Management' },
  { key: 'trainer', label: 'Training' },
  { key: 'member', label: 'Member' },
];

const NOTES: Record<AccessApp, string> = {
  admin: 'Gym management modules — members, billing, branches and more.',
  trainer: 'Coaching modules. Their screens show data only for people with a trainer profile.',
  member: 'Member modules. Their screens show data only for people with a gym membership.',
};

/**
 * Which group of modules an access screen shows. Everyone uses the same app; these groups only
 * organise the module list. `home` (the group of the role's own screens) is marked.
 */
export default function AppPicker({ value, home, onChange }: { value: AccessApp; home?: AccessApp; onChange: (a: AccessApp) => void }) {
  return (
    <View style={{ gap: 8, marginBottom: 12 }}>
      <SegmentedTabs
        tabs={TABS.map(t => ({ key: t.key, label: t.key === home ? `${t.label} ★` : t.label }))}
        value={value}
        onChange={onChange}
      />
      <Text style={{ color: T.textFaint, fontSize: 12, lineHeight: 17 }}>
        {value === home ? '★ This role’s own modules. ' : ''}{NOTES[value]}
      </Text>
    </View>
  );
}
