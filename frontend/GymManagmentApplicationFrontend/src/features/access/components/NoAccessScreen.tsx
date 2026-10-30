import React from 'react';
import Screen from '../../common/components/Screen';
import EmptyState from '../../dashboard/components/EmptyState';

/** Shown for a screen the user's access list doesn't include — even if it was reached some other way. */
export default function NoAccessScreen({ onBack }: { onBack: () => void }) {
  return (
    <Screen style={{ justifyContent: 'center', padding: 24 }}>
      <EmptyState
        icon="lock"
        title="Not available"
        subtitle="Your account doesn't have access to this. Ask your gym admin if you need it."
        action={{ label: 'Go back', onPress: onBack }}
      />
    </Screen>
  );
}
