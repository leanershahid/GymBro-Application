import React, { useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { T, R, SP } from '../../../theme';
import BottomSheet from '../../common/components/BottomSheet';
import PrimaryButton from '../../common/components/PrimaryButton';
import SmallButton from '../../common/components/SmallButton';
import StatusPill from '../../common/components/StatusPill';
import { Field } from '../../common/components/FormFields';
import { useToast } from '../../common/components/Toast';
import { showAlert } from '../../common/components/dialogs';
import { apiErrorText } from '../../../api/apiError';
import { PenaltyFilter } from '../api/bookingRulesApi';
import { usePenalties, useWaivePenalty } from '../api/bookingRulesQueries';
import { BookingPenalty } from '../types/bookingRules.types';
import { longDay, penaltyDetail, penaltyTitle, utc } from '../utils/bookingRulesFormat';

/** One penalty row: what it was, fee / strike, waived state, and Waive (when allowed). */
export function PenaltyRow({ p, showMember, showLabel, onWaive }: {
  p: BookingPenalty; showMember?: boolean; showLabel?: boolean; onWaive?: (p: BookingPenalty) => void;
}) {
  const when = utc(p.sessionStartsAt);
  return (
    <View style={{ padding: SP.md, marginBottom: SP.sm, borderRadius: R.md, borderWidth: 1, borderColor: T.line, backgroundColor: T.bgInput }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.sm }}>
        <Text style={{ flex: 1, color: T.text, fontSize: 14, fontWeight: '700' }} numberOfLines={1}>
          {penaltyTitle(p.type)}{showMember && p.clientName ? ` · ${p.clientName}` : ''}
        </Text>
        <StatusPill label={p.waived ? 'Waived' : p.strike ? 'Strike' : p.feeAmount ? 'Fee' : 'Recorded'} tone={p.waived ? 'neutral' : p.strike ? 'warn' : 'err'} />
      </View>
      <Text style={{ color: T.textSub, fontSize: 12, marginTop: 4 }}>
        {showLabel && p.label ? `${p.label} · ` : ''}{when ? longDay(when) : ''} · {penaltyDetail(p)}
      </Text>
      {p.waived && (
        <Text style={{ color: T.textFaint, fontSize: 12, marginTop: 2 }}>
          Waived{p.waivedByName ? ` by ${p.waivedByName}` : ''}{p.waiveReason ? `: ${p.waiveReason}` : ''}
        </Text>
      )}
      {!p.waived && onWaive && (
        <View style={{ flexDirection: 'row', marginTop: SP.sm }}>
          <SmallButton icon="rotate-ccw" label="Waive" size="sm" tone={T.textSub} onPress={() => onWaive(p)} />
        </View>
      )}
    </View>
  );
}

/** Reason sheet for waiving; the server voids an unpaid fee invoice and audit-logs it. */
export function WaiveSheet({ penalty, onClose }: { penalty: BookingPenalty | null; onClose: () => void }) {
  const toast = useToast();
  const waive = useWaivePenalty();
  const [reason, setReason] = useState('');
  const close = () => { setReason(''); onClose(); };
  const submit = () => {
    if (!penalty || !reason.trim()) return;
    waive.mutate({ id: penalty.id, reason: reason.trim() }, {
      onSuccess: ({ message }) => { toast.show({ type: 'success', message: message || 'Penalty waived.' }); close(); },
      onError: e => showAlert('Couldn’t waive', apiErrorText(e)),
    });
  };
  return (
    <BottomSheet visible={!!penalty} onClose={close} title="Waive penalty">
      <View style={{ padding: SP.xl }}>
        {penalty && (
          <Text style={{ color: T.textSub, fontSize: 14, marginBottom: SP.lg, lineHeight: 20 }}>
            {penaltyTitle(penalty.type)}{penalty.clientName ? ` for ${penalty.clientName}` : ''} — {penaltyDetail(penalty)}.
            {penalty.feeAmount ? ' An unpaid fee invoice is voided; a paid one stays (refund it in Billing).' : ''}
          </Text>
        )}
        <Field label="Reason (kept in the audit log)" value={reason} onChangeText={setReason} placeholder="e.g. Doctor's appointment" multiline />
        <PrimaryButton label="Waive" icon="rotate-ccw" onPress={submit} loading={waive.isPending} disabled={!reason.trim()} />
      </View>
    </BottomSheet>
  );
}

/**
 * Staff: penalties applied for a class roster or a PT session, with Waive. Hidden while empty;
 * also hidden when the caller can't read them (no classes module).
 */
export default function PenaltyList({ filter, canWaive = true, title = 'Penalties applied' }: {
  filter: PenaltyFilter; canWaive?: boolean; title?: string;
}) {
  const { data, isLoading, isError } = usePenalties(filter);
  const [waiving, setWaiving] = useState<BookingPenalty | null>(null);
  if (isLoading) return <ActivityIndicator color={T.brand} style={{ marginVertical: SP.md }} />;
  if (isError || !data?.length) return null;
  return (
    <View style={{ marginTop: SP.lg }}>
      <Text style={{ color: T.textSub, fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: SP.sm }}>{title}</Text>
      {data.map(p => <PenaltyRow key={p.id} p={p} showMember={!filter.memberId} onWaive={canWaive ? setWaiving : undefined} />)}
      <WaiveSheet penalty={waiving} onClose={() => setWaiving(null)} />
    </View>
  );
}
