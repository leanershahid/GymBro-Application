import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, R, SP, withAlpha } from '../../../theme';
import { useLayout } from '../../../utils/useLayout';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import PrimaryButton from '../../common/components/PrimaryButton';
import SearchBar from '../../common/components/SearchBar';
import EmptyState from '../../common/components/EmptyState';
import Skeleton from '../../common/components/Skeleton';
import { notify } from '../../common/components/dialogs';
import { apiErrorText } from '../../../api/apiError';
import { useCreateReport, useFacilityBranches, usePlusOne, useReportOptions } from '../api/facilitiesQueries';
import { fetchOpenForAsset } from '../api/facilitiesApi';
import type { AssetPick, ExistingReport, ProblemType } from '../types/facilities.types';
import { ASSET_STATUS_LABEL, REPORT_STATUS_LABEL, filterZones } from '../utils/facilitiesFormat';
import { Card, PhotoPicker, SectionTitle } from '../components/FacilitiesUi';

interface Props {
  onBack?: () => void;
  /** Opens one report (member area); trainers have no report screen. */
  onOpenReport?: (id: number) => void;
  onOpenMyReports?: () => void;
}

type Target = { kind: 'asset'; asset: AssetPick } | { kind: 'other' };
type Step = 'pick' | 'details' | 'duplicate' | 'done';

const PROBLEM_ICON: Record<ProblemType, React.ComponentProps<typeof Feather>['name']> = {
  broken: 'x-octagon', damaged: 'alert-triangle', unsafe: 'alert-octagon', dirty: 'droplet', missing_part: 'package', other: 'more-horizontal',
};

/**
 * "Report a problem" for members and trainers — built to take under 30 seconds: branch (defaults
 * to yours) → tap the machine (big tiles by zone, searchable) or "Something else" → what's wrong →
 * photo (optional) → send. A machine that is already reported shows "Already reported — we're on
 * it" with +1 / comment instead of a second report.
 */
export default function ReportProblemScreen({ onBack, onOpenReport, onOpenMyReports }: Props) {
  const branches = useFacilityBranches();
  const [picked, setBranchId] = useState(0);
  // Defaults to the member's own branch until they pick another.
  const branchId = picked || (branches.data?.find(x => x.isMine) ?? branches.data?.[0])?.id || 0;
  const options = useReportOptions(branchId);

  const [step, setStep] = useState<Step>('pick');
  const [target, setTarget] = useState<Target | null>(null);
  const [existing, setExisting] = useState<ExistingReport | null>(null);
  const [createdId, setCreatedId] = useState(0);
  const [checking, setChecking] = useState(false);

  const reset = () => { setStep('pick'); setTarget(null); setExisting(null); setCreatedId(0); };

  const chooseAsset = async (asset: AssetPick) => {
    setTarget({ kind: 'asset', asset });
    if (asset.hasOpenReport) {
      setChecking(true);
      try {
        const open = await fetchOpenForAsset(asset.id);
        if (open) { setExisting(open); setStep('duplicate'); return; }
      } catch { /* fall through to the form; the server still guards duplicates */ } finally { setChecking(false); }
    }
    setStep('details');
  };

  const title = step === 'done' ? 'Thanks!' : step === 'duplicate' ? 'Already reported' : 'Report a problem';
  const back = step === 'pick' || step === 'done' ? onBack : reset;

  return (
    <Screen>
      <ScreenHeader eyebrow="Help us fix it" title={title} onBack={back}
        action={step === 'pick' && onOpenMyReports ? { label: 'My reports', icon: 'list', onPress: onOpenMyReports } : undefined} />
      {branches.isLoading || (branchId > 0 && options.isLoading) ? (
        <View style={{ paddingHorizontal: SP.xl }} accessibilityLabel="Loading"><Skeleton rows={4} height={96} /></View>
      ) : branches.isError || options.isError ? (
        <EmptyState icon="wifi-off" tone="error" title="Couldn't load the gym's equipment" subtitle={apiErrorText(branches.error ?? options.error)}
          action={{ label: 'Try again', onPress: () => { branches.refetch(); options.refetch(); } }} />
      ) : !options.data ? (
        <EmptyState icon="map-pin" title="No branch to report for" subtitle="Ask the front desk for help." />
      ) : !options.data.canReport ? (
        <EmptyState icon="message-circle" title="Tell the front desk" subtitle="Your gym takes equipment problems at the front desk rather than in the app." />
      ) : step === 'pick' ? (
        <PickStep branches={branches.data ?? []} branchId={branchId} onBranch={id => { setBranchId(id); reset(); }}
          zones={options.data.zones} onAsset={chooseAsset} onOther={() => { setTarget({ kind: 'other' }); setStep('details'); }} checking={checking} />
      ) : step === 'duplicate' && existing ? (
        <DuplicateStep existing={existing} onDone={id => { setCreatedId(id); setStep('done'); }} onOpen={onOpenReport ? () => onOpenReport(existing.reportId) : undefined} />
      ) : step === 'details' && target ? (
        <DetailsStep branchId={branchId} target={target} types={options.data.problemTypes} maxPhotos={options.data.maxPhotos}
          onCreated={id => { setCreatedId(id); setStep('done'); }}
          onDuplicate={e => { setExisting(e); setStep('duplicate'); }} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: SP.xl, paddingBottom: 110, gap: SP.lg }}>
          <Card tint={T.ok}>
            <View style={{ flexDirection: 'row', gap: SP.md, alignItems: 'center' }}>
              <Feather name="check-circle" size={28} color={T.ok} />
              <View style={{ flex: 1 }}>
                <Text accessibilityRole="header" style={{ color: T.text, fontSize: 17, fontWeight: '700' }}>We've got it</Text>
                <Text style={{ color: T.textSub, fontSize: 14, marginTop: 4 }}>We'll let you know when it's fixed.</Text>
              </View>
            </View>
          </Card>
          {createdId > 0 && onOpenReport && <PrimaryButton label="See the report" icon="eye" onPress={() => onOpenReport(createdId)} />}
          <PrimaryButton label="Report something else" variant="secondary" onPress={reset} />
        </ScrollView>
      )}
    </Screen>
  );
}

// ── Step 1: branch + machine ───────────────────────────────────────────

function PickStep({ branches, branchId, onBranch, zones, onAsset, onOther, checking }: {
  branches: { id: number; name: string; isMine: boolean }[]; branchId: number; onBranch: (id: number) => void;
  zones: { zone: string; assets: AssetPick[] }[]; onAsset: (a: AssetPick) => void; onOther: () => void; checking: boolean;
}) {
  const [term, setTerm] = useState('');
  const { width } = useLayout();
  const shown = useMemo(() => filterZones(zones, term), [zones, term]);
  const cols = width >= 700 ? 4 : width >= 360 ? 2 : 1;
  const tileW = `${100 / cols - 2}%` as const;

  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: SP.xl, paddingBottom: 110, gap: SP.lg }}>
      {branches.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SP.sm }} accessibilityRole="tablist">
          {branches.map(b => {
            const active = b.id === branchId;
            return (
              <Pressable key={b.id} onPress={() => onBranch(b.id)} accessibilityRole="tab" accessibilityState={{ selected: active }}
                accessibilityLabel={`${b.name}${b.isMine ? ', your branch' : ''}`}
                style={{ minHeight: 44, paddingHorizontal: SP.lg, borderRadius: R.pill, justifyContent: 'center',
                  backgroundColor: active ? T.brand : T.bgInput, borderWidth: 1, borderColor: active ? T.brand : T.line }}>
                <Text style={{ color: active ? T.onBrand : T.text, fontSize: 14, fontWeight: '700' }}>{b.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
      <Text style={{ color: T.textSub, fontSize: 14 }}>Tap the machine or area that has a problem.</Text>
      <SearchBar value={term} onChangeText={setTerm} placeholder="Search equipment (e.g. treadmill)" label="Search equipment" />

      {shown.map(z => (
        <View key={z.zone}>
          <SectionTitle title={z.zone} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.sm, justifyContent: 'space-between' }}>
            {z.assets.map(a => <AssetTile key={a.id} a={a} width={tileW} onPress={() => onAsset(a)} disabled={checking} />)}
          </View>
        </View>
      ))}
      {shown.length === 0 && term.length > 0 && (
        <Text style={{ color: T.textFaint, fontSize: 14 }}>Nothing matches "{term}". Use "Something else" below.</Text>
      )}

      <Pressable onPress={onOther} accessibilityRole="button" accessibilityLabel="Something else: describe where the problem is"
        style={({ pressed }) => ({
          minHeight: 72, borderRadius: R.lg, padding: SP.lg, flexDirection: 'row', alignItems: 'center', gap: SP.md,
          backgroundColor: pressed ? T.bgInputActive : T.bgInput, borderWidth: 1, borderStyle: 'dashed', borderColor: T.textDisabled,
        })}>
        <Feather name="edit-3" size={22} color={T.brand} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: T.text, fontSize: 15, fontWeight: '700' }}>Something else</Text>
          <Text style={{ color: T.textSub, fontSize: 13 }}>Showers, lockers, lights, the building…</Text>
        </View>
      </Pressable>
    </ScrollView>
  );
}

const AssetTile = React.memo(function AssetTile({ a, width, onPress, disabled }: { a: AssetPick; width: `${number}%`; onPress: () => void; disabled?: boolean }) {
  const down = a.status !== 'InService';
  const label = `${a.name}${a.assetType ? `, ${a.assetType}` : ''}${down ? `, ${ASSET_STATUS_LABEL[a.status]}` : ''}${a.hasOpenReport ? ', already reported' : ''}`;
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label}
      style={({ pressed }) => ({
        width, minHeight: 88, padding: SP.md, borderRadius: R.lg, justifyContent: 'space-between', gap: SP.sm,
        backgroundColor: pressed ? T.brandDim : T.bgInput, borderWidth: 1,
        borderColor: pressed ? T.brandBorder : a.hasOpenReport ? withAlpha(T.brandGold, 0.35) : T.line,
      })}>
      <Text numberOfLines={2} style={{ color: T.text, fontSize: 15, fontWeight: '700' }}>{a.name}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {a.hasOpenReport
          ? <><Feather name="flag" size={12} color={T.brandGold} /><Text style={{ color: T.brandGold, fontSize: 12, fontWeight: '600' }}>Reported</Text></>
          : down
            ? <><Feather name="tool" size={12} color={T.err} /><Text style={{ color: T.err, fontSize: 12, fontWeight: '600' }}>{ASSET_STATUS_LABEL[a.status]}</Text></>
            : <Text numberOfLines={1} style={{ color: T.textFaint, fontSize: 12 }}>{a.assetType ?? ' '}</Text>}
      </View>
    </Pressable>
  );
});

// ── Step 2: what's wrong ───────────────────────────────────────────────

function DetailsStep({ branchId, target, types, maxPhotos, onCreated, onDuplicate }: {
  branchId: number; target: Target; types: { key: ProblemType; label: string; urgent: boolean }[]; maxPhotos: number;
  onCreated: (id: number) => void; onDuplicate: (e: ExistingReport) => void;
}) {
  const [type, setType] = useState<ProblemType | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [where, setWhere] = useState('');
  const create = useCreateReport();
  const other = target.kind === 'other';
  const needsText = other && type === 'other' && !description.trim();
  const canSend = !!type && (!other || where.trim().length > 0) && !needsText;

  const send = async () => {
    if (!type) return;
    try {
      const r = await create.mutateAsync({
        branchId, assetId: target.kind === 'asset' ? target.asset.id : null, otherLocation: other ? where.trim() : null,
        problemType: type, description: description.trim() || null, photoUrls: photos,
      });
      if ('duplicate' in r) onDuplicate(r.duplicate); else onCreated(r.created.id);
    } catch (e) {
      notify("Couldn't send the report", apiErrorText(e));
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: SP.xl, paddingBottom: 130, gap: SP.xl }}>
        <Card>
          <Text style={{ color: T.textFaint, fontSize: 12, fontWeight: '600' }}>REPORTING</Text>
          <Text style={{ color: T.text, fontSize: 17, fontWeight: '700', marginTop: 4 }}>
            {target.kind === 'asset' ? target.asset.name : 'Something else'}
          </Text>
          {target.kind === 'asset' && target.asset.zone && <Text style={{ color: T.textSub, fontSize: 13 }}>{target.asset.zone}</Text>}
        </Card>

        {other && (
          <View>
            <SectionTitle title="Where is it?" />
            <TextInput value={where} onChangeText={setWhere} placeholder="e.g. Men's changing room, shower 2" placeholderTextColor={T.textFaint}
              accessibilityLabel="Where is the problem" maxLength={200}
              style={{ minHeight: 52, borderRadius: R.lg, paddingHorizontal: SP.lg, color: T.text, fontSize: 15, backgroundColor: T.bgInput, borderWidth: 1, borderColor: T.line }} />
          </View>
        )}

        <View>
          <SectionTitle title="What's wrong?" />
          <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.sm, justifyContent: 'space-between' }}>
            {types.map(t => {
              const active = type === t.key;
              const c = t.urgent ? T.err : T.brand;
              return (
                <Pressable key={t.key} onPress={() => setType(t.key)} accessibilityRole="radio" accessibilityState={{ checked: active }}
                  accessibilityLabel={t.urgent ? `${t.label}: urgent, staff are alerted straight away` : t.label}
                  style={{
                    width: '31.5%', minWidth: 96, flexGrow: 1, minHeight: 72, borderRadius: R.lg, alignItems: 'center', justifyContent: 'center', gap: 6, padding: SP.sm,
                    backgroundColor: active ? withAlpha(c, 0.15) : T.bgInput, borderWidth: 1, borderColor: active ? c : T.line,
                  }}>
                  <Feather name={PROBLEM_ICON[t.key]} size={20} color={active || t.urgent ? c : T.textSub} />
                  <Text style={{ color: active ? T.text : T.textSub, fontSize: 13, fontWeight: '700', textAlign: 'center' }}>{t.label}</Text>
                </Pressable>
              );
            })}
          </View>
          {type === 'unsafe' && (
            <Text style={{ color: T.err, fontSize: 13, marginTop: SP.sm }}>
              Staff are alerted right away. Please keep others away from it and tell the front desk if someone is hurt.
            </Text>
          )}
        </View>

        <View>
          <SectionTitle title="Add a photo" />
          <PhotoPicker urls={photos} onChange={setPhotos} max={maxPhotos} big />
        </View>

        <View>
          <SectionTitle title={needsText || other && type === 'other' ? 'Tell us more' : 'Anything else? (optional)'} />
          <TextInput value={description} onChangeText={setDescription} multiline maxLength={2000}
            placeholder="e.g. The belt slips when running fast" placeholderTextColor={T.textFaint} accessibilityLabel="Description"
            style={{ minHeight: 96, borderRadius: R.lg, padding: SP.lg, color: T.text, fontSize: 15, textAlignVertical: 'top', backgroundColor: T.bgInput, borderWidth: 1, borderColor: T.line }} />
        </View>

        <PrimaryButton label={type === 'unsafe' ? 'Send urgent report' : 'Send report'} icon="send" onPress={send}
          loading={create.isPending} disabled={!canSend || create.isPending} variant={type === 'unsafe' ? 'danger' : 'primary'}
          accessibilityHint={!type ? 'Pick what is wrong first' : undefined} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Already reported ───────────────────────────────────────────────────

function DuplicateStep({ existing, onDone, onOpen }: { existing: ExistingReport; onDone: (id: number) => void; onOpen?: () => void }) {
  const [comment, setComment] = useState('');
  const plus = usePlusOne();
  const send = async (unsafe = false) => {
    try {
      await plus.mutateAsync({ id: existing.reportId, comment: comment.trim() || undefined, unsafe });
      onDone(existing.reportId);
    } catch (e) {
      notify("Couldn't add your +1", apiErrorText(e));
    }
  };
  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: SP.xl, paddingBottom: 110, gap: SP.lg }}>
      <Card tint={T.brandGold}>
        <View style={{ flexDirection: 'row', gap: SP.md, alignItems: 'center' }}>
          <Feather name="flag" size={26} color={T.brandGold} />
          <View style={{ flex: 1 }}>
            <Text accessibilityRole="header" style={{ color: T.text, fontSize: 17, fontWeight: '700' }}>Already reported — we're on it</Text>
            <Text style={{ color: T.textSub, fontSize: 14, marginTop: 4 }}>
              {existing.assetName} · {REPORT_STATUS_LABEL[existing.status]}
              {existing.plusOneCount > 0 ? ` · ${existing.plusOneCount} other${existing.plusOneCount === 1 ? '' : 's'} noticed too` : ''}
            </Text>
          </View>
        </View>
      </Card>
      {existing.alreadyFollowing ? (
        <>
          <Text style={{ color: T.textSub, fontSize: 14 }}>
            {existing.isMine ? 'You reported this one.' : "You've already said you noticed this."} We'll tell you when it's fixed.
          </Text>
          {onOpen && <PrimaryButton label="See the report" icon="eye" onPress={onOpen} />}
        </>
      ) : (
        <>
          <Text style={{ color: T.textSub, fontSize: 14 }}>Add a +1 so we know it affects you too — we'll tell you when it's fixed.</Text>
          <TextInput value={comment} onChangeText={setComment} multiline maxLength={1000} placeholder="Add a comment (optional)"
            placeholderTextColor={T.textFaint} accessibilityLabel="Comment"
            style={{ minHeight: 80, borderRadius: R.lg, padding: SP.lg, color: T.text, fontSize: 15, textAlignVertical: 'top', backgroundColor: T.bgInput, borderWidth: 1, borderColor: T.line }} />
          <PrimaryButton label="+1, I noticed this too" icon="thumbs-up" onPress={() => send(false)} loading={plus.isPending} disabled={plus.isPending} />
          <PrimaryButton label="It's unsafe — alert staff" icon="alert-octagon" variant="danger" onPress={() => send(true)} disabled={plus.isPending} />
        </>
      )}
    </ScrollView>
  );
}
