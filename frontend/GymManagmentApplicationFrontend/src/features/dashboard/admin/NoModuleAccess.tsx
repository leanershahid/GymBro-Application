import React from 'react';
import ScreenRoot from '../../common/components/Screen';
import EmptyState from '../../common/components/EmptyState';

/** Shown instead of a page when the signed-in user's own module access doesn't grant it. */
export default function NoModuleAccess({ onBack }: { onBack: () => void }) {
  return (
    <ScreenRoot style={{ justifyContent: 'center' }}>
      <EmptyState
        icon="lock"
        tone="error"
        title="No access"
        subtitle="Your account doesn't have access to this module. Ask an admin to grant it."
        action={{ label: 'Go back', onPress: onBack }}
      />
    </ScreenRoot>
  );
}
