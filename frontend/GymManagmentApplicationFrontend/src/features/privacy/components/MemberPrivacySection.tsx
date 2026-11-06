import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { T, SP } from '../../../theme';
import PrimaryButton from '../../common/components/PrimaryButton';
import { Field, SwitchRow } from '../../common/components/FormFields';
import { confirm, showAlert } from '../../common/components/dialogs';
import { apiErrorText } from '../../../api/apiError';
import { useMenu } from '../../access/context/AccessContext';
import { useDeleteMemberAccount } from '../api/privacyQueries';
import { Card, fmtDate } from './PrivacyUi';

/** Admin route key of the privacy requests page (ModuleCatalog `admin.privacy` → Route "privacy-requests"). */
const PRIVACY_ROUTE = 'privacy-requests';

/**
 * Member detail → "Delete account" (admins with the Privacy requests module only): for a member
 * who asks at the desk. Needs a reason; schedules the deletion with the gym's grace period, or runs
 * it now. Audit-logged on the server.
 */
export default function MemberPrivacySection({ memberId, memberName, onDeleted }: { memberId: number; memberName: string; onDeleted?: () => void }) {
  const { routes } = useMenu();
  const del = useDeleteMemberAccount();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [now, setNow] = useState(false);
  if (!routes.has(PRIVACY_ROUTE)) return null;

  const submit = async () => {
    const ok = await confirm({
      title: now ? `Delete ${memberName}'s account now?` : `Schedule deletion of ${memberName}'s account?`,
      message: now
        ? 'Personal data is removed straight away. Invoices, payments and orders are kept without the name. This can’t be undone.'
        : 'The member is signed out and can keep the account by signing in during the grace period.',
      confirmLabel: now ? 'Delete now' : 'Schedule deletion', destructive: true,
    });
    if (!ok) return;
    del.mutate({ memberId, reason: reason.trim(), processNow: now }, {
      onSuccess: r => {
        const res = r as { scheduledFor?: string; status?: string } | undefined;
        showAlert(now ? 'Account deleted' : 'Deletion scheduled',
          now ? `${memberName}'s personal data has been removed.` : `It will happen on ${fmtDate(res?.scheduledFor)}.`);
        setOpen(false);
        onDeleted?.();
      },
      onError: e => showAlert('Couldn’t delete the account', apiErrorText(e)),
    });
  };

  return (
    <Card title="Privacy" tone="danger" subtitle="If the member asks you to delete their account, do it here. It's recorded in the audit log.">
      {!open ? (
        <PrimaryButton label="Delete member's account" icon="trash-2" variant="danger" onPress={() => setOpen(true)} />
      ) : (
        <View>
          <Field label="Reason (no personal details)" value={reason} onChangeText={setReason} placeholder="Asked at the desk on 3 Nov" />
          <SwitchRow label="Delete now" description="Skip the grace period. Only if the member asked for it to happen straight away."
            value={now} onValueChange={setNow} />
          <Text style={{ color: T.textFaint, fontSize: 12, marginBottom: SP.md }}>Not possible while the member owes money or has an order on its way.</Text>
          <View style={{ flexDirection: 'row', gap: SP.md }}>
            <PrimaryButton label="Cancel" variant="secondary" onPress={() => setOpen(false)} disabled={del.isPending} style={{ flex: 1 }} />
            <PrimaryButton label={now ? 'Delete now' : 'Schedule'} icon="trash-2" variant="danger" loading={del.isPending}
              disabled={reason.trim().length < 3} onPress={submit} style={{ flex: 1 }} />
          </View>
        </View>
      )}
    </Card>
  );
}
