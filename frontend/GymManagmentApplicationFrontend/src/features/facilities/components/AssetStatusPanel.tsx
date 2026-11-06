import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { T, R, SP, withAlpha } from '../../../theme';
import PrimaryButton from '../../common/components/PrimaryButton';
import { DateField } from '../../common/components/DatePicker';
import { Field, SwitchRow } from '../../common/components/FormFields';
import { confirm, notify } from '../../common/components/dialogs';
import { apiErrorText } from '../../../api/apiError';
import { useSetAssetStatus } from '../api/facilitiesQueries';
import type { Asset, AssetStatus } from '../types/facilities.types';
import { ASSET_STATUS_LABEL } from '../utils/facilitiesFormat';

const TONE: Record<AssetStatus, string> = { InService: T.ok, Limited: T.brandGold, OutOfService: T.err };

/** Asks before a key facility's outage is announced to members. True = post the notice. */
export async function askServiceNotice(name: string): Promise<boolean> {
  return confirm({
    title: 'Tell members too?',
    message: `${name} is a key facility. Post a service-status notice so members see it on Home and gym info? It ends automatically when ${name} is back in service.`,
    confirmLabel: 'Post notice', cancelLabel: 'Not now',
  });
}

/** In service / Limited / Out of service with reason and expected back date. */
export default function AssetStatusPanel({ asset }: { asset: Asset }) {
  const [status, setStatus] = useState<AssetStatus>(asset.status);
  const [reason, setReason] = useState(asset.statusReason ?? '');
  const [back, setBack] = useState(asset.expectedBackOn ?? '');
  const [resolve, setResolve] = useState(true);
  const save = useSetAssetStatus(asset.id);
  const changed = status !== asset.status || (status !== 'InService' && (reason !== (asset.statusReason ?? '') || back !== (asset.expectedBackOn ?? '')));

  const submit = async () => {
    const goingDown = status !== 'InService';
    const offerNotice = goingDown && asset.isKeyFacility && !asset.serviceStatusId;
    const postServiceNotice = offerNotice ? await askServiceNotice(asset.name) : false;
    try {
      const r = await save.mutateAsync({
        status, reason: goingDown ? reason.trim() || null : null, expectedBackOn: goingDown ? back || null : null,
        postServiceNotice, resolveOpenReports: !goingDown && resolve,
      });
      const bits = [
        r.serviceStatusPostedId ? 'Members can see the service notice.' : null,
        r.serviceStatusEnded ? 'The service notice has ended.' : null,
        r.reportsResolved ? `${r.reportsResolved} report${r.reportsResolved > 1 ? 's' : ''} closed as fixed.` : null,
      ].filter(Boolean);
      if (bits.length) notify(`${asset.name}: ${ASSET_STATUS_LABEL[r.asset.status]}`, bits.join(' '));
    } catch (e) { notify("Couldn't update the status", apiErrorText(e)); }
  };

  return (
    <View>
      <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: SP.sm, marginBottom: SP.lg }}>
        {(['InService', 'Limited', 'OutOfService'] as AssetStatus[]).map(s => {
          const active = s === status;
          return (
            <Pressable key={s} onPress={() => setStatus(s)} accessibilityRole="radio" accessibilityState={{ checked: active }} accessibilityLabel={ASSET_STATUS_LABEL[s]}
              style={{ flex: 1, minHeight: 52, borderRadius: R.lg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
                backgroundColor: active ? withAlpha(TONE[s], 0.16) : T.bgInput, borderWidth: 1, borderColor: active ? TONE[s] : T.line }}>
              <Text style={{ color: active ? T.text : T.textSub, fontSize: 13, fontWeight: '700', textAlign: 'center' }}>{ASSET_STATUS_LABEL[s]}</Text>
            </Pressable>
          );
        })}
      </View>
      {status !== 'InService' ? (
        <>
          <Field label="Reason" value={reason} onChangeText={setReason} placeholder="e.g. Belt replacement" />
          <DateField label="Expected back (optional)" value={back} onChange={setBack} />
        </>
      ) : asset.openReports > 0 && asset.status !== 'InService' ? (
        <SwitchRow label={`Close ${asset.openReports} open report${asset.openReports > 1 ? 's' : ''} as fixed`} value={resolve} onValueChange={setResolve}
          description="Reporters and +1s are told it's fixed." />
      ) : null}
      <PrimaryButton label="Update status" onPress={submit} loading={save.isPending} disabled={!changed || save.isPending}
        variant={status === 'OutOfService' ? 'danger' : 'primary'} />
    </View>
  );
}
