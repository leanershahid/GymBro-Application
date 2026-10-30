import React from 'react';
import { Text, View } from 'react-native';
import { T } from '../../../theme';
import SegmentedTabs from '../../common/components/SegmentedTabs';
import { AccessApp } from '../types/access.types';

const TABS: { key: AccessApp; label: string }[] = [
  { key: 'admin', label: 'Admin app' },
  { key: 'trainer', label: 'Trainer app' },
  { key: 'member', label: 'Member app' },
];

const NOTES: Record<AccessApp, string> = {
  admin: 'Admin-app modules work for anyone — a trainer or member given them can switch to the admin app.',
  trainer: 'Trainer-app modules need a trainer profile; for anyone else those screens stay empty.',
  member: 'Member-app modules need a gym membership; for anyone else those screens stay empty.',
};

/** Which app's modules an access screen shows. `home` (the app the role signs in to) is marked. */
export default function AppPicker({ value, home, onChange }: { value: AccessApp; home?: AccessApp; onChange: (a: AccessApp) => void }) {
  return (
    <View style={{ gap: 8, marginBottom: 12 }}>
      <SegmentedTabs
        tabs={TABS.map(t => ({ key: t.key, label: t.key === home ? `${t.label} ★` : t.label }))}
        value={value}
        onChange={onChange}
      />
      <Text style={{ color: T.textFaint, fontSize: 12, lineHeight: 17 }}>
        {value === home ? '★ The app this role signs in to. ' : ''}{NOTES[value]}
      </Text>
    </View>
  );
}
