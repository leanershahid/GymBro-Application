import React from 'react';
import { Text, View } from 'react-native';
import BottomSheet from './BottomSheet';
import PrimaryButton from './PrimaryButton';
import { T, SP } from '../../../theme';

export interface ConfirmSheetProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  loading?: boolean;
  /** Red confirm button. Default true. */
  danger?: boolean;
  cancelLabel?: string;
}

/**
 * "Are you sure?" bottom sheet (ARCH-062). Use when the confirmation needs a loading state
 * while the action runs; for a plain question use `confirm()` from ./dialogs.
 */
export default function ConfirmSheet({ visible, title, message, confirmLabel, onConfirm, onClose, loading, danger = true, cancelLabel = 'Cancel' }: ConfirmSheetProps) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title={title}>
      <View style={{ padding: SP.xl, gap: SP.md }}>
        <Text style={{ color: T.textSub, fontSize: 14, lineHeight: 21 }}>{message}</Text>
        <PrimaryButton label={confirmLabel} onPress={onConfirm} loading={loading} variant={danger ? 'danger' : 'primary'} />
        <PrimaryButton label={cancelLabel} onPress={onClose} variant="secondary" disabled={loading} />
      </View>
    </BottomSheet>
  );
}

export { ConfirmSheet };
