import React from 'react';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import AccessPanel from '../components/AccessPanel';

interface Props {
  userId: number;
  userName: string;
  onBack: () => void;
}

export default function ManageUserAccessPage({ userId, userName, onBack }: Props) {
  return (
    <Screen>
      <ScreenHeader eyebrow="Manage access" title={userName} onBack={onBack} />
      <AccessPanel userId={userId} />
    </Screen>
  );
}
