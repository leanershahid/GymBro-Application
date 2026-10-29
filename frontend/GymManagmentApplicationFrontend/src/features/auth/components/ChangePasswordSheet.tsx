import React, { useState } from 'react';
import { View, Text } from 'react-native';
import BottomSheet from '../../common/components/BottomSheet';
import PrimaryButton from '../../common/components/PrimaryButton';
import { Field } from '../../trainers/components/FormFields';
import { useToast } from '../../common/components/Toast';
import { useChangePassword } from '../api/authQueries';
import { T } from '../../../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Called after a successful change — every session is revoked, so the app signs out. */
  onChanged: () => void;
}

type Errors = Partial<Record<'current' | 'next' | 'confirm', string>>;

/** Change password (used by the admin, member and trainer profiles). */
export default function ChangePasswordSheet({ visible, onClose, onChanged }: Props) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState('');
  const { mutate, isPending } = useChangePassword();
  const toast = useToast();

  const close = () => {
    setCurrent(''); setNext(''); setConfirm(''); setErrors({}); setFormError('');
    onClose();
  };

  const submit = () => {
    const e: Errors = {};
    if (!current) e.current = 'Enter your current password.';
    if (next.length < 8 || !/[A-Za-z]/.test(next) || !/\d/.test(next))
      e.next = 'At least 8 characters, with a letter and a number.';
    else if (next === current) e.next = 'Choose a password different from the current one.';
    if (confirm !== next) e.confirm = 'Passwords do not match.';
    setErrors(e);
    setFormError('');
    if (Object.keys(e).length) return;

    mutate({ currentPassword: current, newPassword: next }, {
      onSuccess: (res) => {
        if (!res.success) {
          if (/current password/i.test(res.message)) setErrors({ current: res.message });
          else setFormError([res.message, ...(res.errors ?? [])].filter(Boolean).join('\n'));
          return;
        }
        toast.show({ type: 'success', message: 'Password changed. Please sign in again.' });
        close();
        onChanged();
      },
      onError: () => setFormError('Could not reach the server. Please try again.'),
    });
  };

  return (
    <BottomSheet visible={visible} onClose={close} title="Change password" leftAction={{ label: 'Cancel', onPress: close }}>
      <View style={{ gap: 12 }}>
        <Field label="Current password" value={current} onChangeText={setCurrent} secureTextEntry autoCapitalize="none" error={errors.current} />
        <Field label="New password" value={next} onChangeText={setNext} secureTextEntry autoCapitalize="none" error={errors.next} />
        <Field label="Confirm new password" value={confirm} onChangeText={setConfirm} secureTextEntry autoCapitalize="none" error={errors.confirm} />
        <Text style={{ color: T.textSub, fontSize: 12 }}>You'll be signed out on all devices after changing it.</Text>
        {!!formError && <Text style={{ color: T.err, fontSize: 13 }}>{formError}</Text>}
        <PrimaryButton label="Change password" onPress={submit} loading={isPending} />
      </View>
    </BottomSheet>
  );
}
