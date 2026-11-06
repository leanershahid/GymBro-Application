import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, SP, R } from '../../../theme';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import PrimaryButton from '../../common/components/PrimaryButton';
import LoadingState from '../../common/components/LoadingState';
import EmptyState from '../../common/components/EmptyState';
import SegmentedTabs from '../../common/components/SegmentedTabs';
import { DateField } from '../../common/components/DatePicker';
import { Field, SwitchRow } from '../../common/components/FormFields';
import { confirm, notify } from '../../common/components/dialogs';
import BranchDropdown from '../../branches/components/BranchDropdown';
import { apiErrorText } from '../../../api/apiError';
import {
  useDeleteHoursException, useHoursConfig, useOperationsSettings, useSaveBranchProfile, useSaveOperationsSettings,
  useSaveWeeklyHours, useUpsertHoursException,
} from '../api/operationsQueries';
import type { Interval, WeekdayHours } from '../types/operations.types';
import { cleanWeek, dayError, formatInterval, normalizeTime } from '../utils/hours';
import WeeklyHoursEditor from '../components/WeeklyHoursEditor';
import { Card, IconButton, SectionTitle, TimeField } from '../components/OperationsUi';

interface Props {
  /** Branch to edit; 0/omitted shows a branch picker first. */
  branchId?: number;
  onBack?: () => void;
}

type Tab = 'week' | 'closures' | 'info';
const TABS: { key: Tab; label: string }[] = [{ key: 'week', label: 'Weekly' }, { key: 'closures', label: 'Holidays' }, { key: 'info', label: 'Info' }];

/** Admin: a branch's weekly hours, holiday closures / special hours, member info notes, and the check-in setting. */
export default function BranchHoursPage({ branchId = 0, onBack }: Props) {
  const [selected, setSelected] = useState(branchId);
  const [tab, setTab] = useState<Tab>('week');
  const config = useHoursConfig(selected);

  return (
    <Screen>
      <ScreenHeader eyebrow="Branch" title={config.data?.branchName ?? 'Hours & info'} onBack={onBack} />
      <View style={{ paddingHorizontal: SP.xl }}>
        <BranchDropdown value={selected || null} onChange={(b) => setSelected(b.id)} label="Branch" />
      </View>
      {!selected ? (
        <EmptyState icon="map-pin" title="Pick a branch" subtitle="Hours are set per branch, in that branch's time zone." />
      ) : config.isLoading ? (
        <LoadingState label="Loading hours" />
      ) : config.isError || !config.data ? (
        <EmptyState icon="alert-triangle" tone="error" title="Couldn't load hours" subtitle={apiErrorText(config.error)}
          action={{ label: 'Try again', onPress: () => config.refetch() }} />
      ) : (
        <>
          <SegmentedTabs tabs={TABS} value={tab} onChange={setTab} style={{ marginHorizontal: SP.xl, marginBottom: SP.md }} />
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: SP.xl, paddingBottom: 60, gap: SP.xl }}>
              <Text style={{ color: T.textFaint, fontSize: 12 }}>All times are in {config.data.timezone}.</Text>
              {tab === 'week' && <WeekTab branchId={selected} weekly={config.data.weekly} />}
              {tab === 'closures' && <ClosuresTab branchId={selected} exceptions={config.data.exceptions} />}
              {tab === 'info' && <InfoTab branchId={selected} amenities={config.data.amenities} accessibility={config.data.accessibility} />}
            </ScrollView>
          </KeyboardAvoidingView>
        </>
      )}
    </Screen>
  );
}

function WeekTab({ branchId, weekly }: { branchId: number; weekly: WeekdayHours[] }) {
  const [week, setWeek] = useState(weekly);
  const save = useSaveWeeklyHours();
  useEffect(() => setWeek(weekly), [weekly]);
  const invalid = week.some(d => dayError(d.intervals) !== null);
  const dirty = JSON.stringify(week) !== JSON.stringify(weekly);

  return (
    <View style={{ gap: SP.lg }}>
      <WeeklyHoursEditor value={week} onChange={setWeek} />
      <PrimaryButton
        label={dirty ? 'Save weekly hours' : 'Saved'}
        icon="check"
        disabled={invalid || !dirty}
        loading={save.isPending}
        accessibilityHint={invalid ? 'Fix the highlighted days first' : undefined}
        onPress={() => save.mutate({ branchId, days: cleanWeek(week) }, {
          onSuccess: () => notify('Opening hours saved'),
          onError: (e) => notify('Couldn\'t save', apiErrorText(e)),
        })}
      />
      <CheckInSetting />
    </View>
  );
}

/** Gym-wide: block member self check-in while the branch is closed (desk check-in still works). */
function CheckInSetting() {
  const settings = useOperationsSettings();
  const save = useSaveOperationsSettings();
  if (!settings.data) return null;
  return (
    <View>
      <SectionTitle title="Check-in" />
      <SwitchRow
        label="Block self check-in outside hours"
        description="Applies to every branch with hours set. Front desk check-in still works."
        value={settings.data.blockSelfCheckInOutsideHours}
        onValueChange={(v) => save.mutate({ blockSelfCheckInOutsideHours: v }, { onError: (e) => notify('Couldn\'t save', apiErrorText(e)) })}
      />
    </View>
  );
}

function ClosuresTab({ branchId, exceptions }: { branchId: number; exceptions: { id: number; date: string; isClosed: boolean; intervals: Interval[]; note: string | null }[] }) {
  const upsert = useUpsertHoursException();
  const remove = useDeleteHoursException();
  const [date, setDate] = useState('');
  const [closed, setClosed] = useState(true);
  const [intervals, setIntervals] = useState<Interval[]>([{ opens: '08:00', closes: '14:00' }]);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const add = () => {
    setError(null);
    if (!date) { setError('Pick a date.'); return; }
    if (!closed && dayError(intervals)) { setError(dayError(intervals)); return; }
    upsert.mutate({
      branchId,
      payload: { date, isClosed: closed, note: note.trim() || null, intervals: closed ? [] : intervals.map(i => ({ opens: normalizeTime(i.opens)!, closes: normalizeTime(i.closes)! })) },
    }, {
      onSuccess: () => { setDate(''); setNote(''); setClosed(true); },
      onError: (e) => setError(apiErrorText(e)),
    });
  };

  return (
    <View style={{ gap: SP.xl }}>
      <Card>
        <Text style={{ color: T.text, fontSize: 16, fontWeight: '700', marginBottom: SP.md }}>Add a holiday or special day</Text>
        <DateField label="Date" value={date} onChange={setDate} minYear={new Date().getFullYear()} />
        <SwitchRow label="Closed all day" value={closed} onValueChange={setClosed} />
        {!closed && (
          <View style={{ gap: SP.sm, marginBottom: SP.md }}>
            {intervals.map((iv, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: SP.sm }}>
                <TimeField label={`Interval ${i + 1} opens`} value={iv.opens} onChange={v => setIntervals(intervals.map((x, k) => (k === i ? { ...x, opens: v } : x)))} />
                <Text style={{ color: T.textFaint }}>to</Text>
                <TimeField label={`Interval ${i + 1} closes`} value={iv.closes} onChange={v => setIntervals(intervals.map((x, k) => (k === i ? { ...x, closes: v } : x)))} />
                <View style={{ flex: 1 }} />
                {intervals.length > 1 && <IconButton icon="trash-2" label={`Remove interval ${i + 1}`} tone={T.textSub} onPress={() => setIntervals(intervals.filter((_, k) => k !== i))} />}
              </View>
            ))}
            <Pressable onPress={() => setIntervals([...intervals, { opens: '16:00', closes: '20:00' }])} accessibilityRole="button" accessibilityLabel="Add an interval"
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, alignSelf: 'flex-start' }}>
              <Feather name="plus" size={16} color={T.brand} />
              <Text style={{ color: T.brand, fontSize: 14, fontWeight: '600' }}>Add interval</Text>
            </Pressable>
          </View>
        )}
        <Field label="Note for members (optional)" value={note} onChangeText={setNote} placeholder="Diwali — closed" />
        {error && <Text accessibilityRole="alert" style={{ color: T.err, fontSize: 13, marginBottom: SP.md }}>{error}</Text>}
        <PrimaryButton label="Add" icon="plus" loading={upsert.isPending} onPress={add} />
      </Card>

      <View>
        <SectionTitle title="Upcoming" />
        {exceptions.length === 0 ? (
          <Text style={{ color: T.textSub, fontSize: 14 }}>No holidays or special days coming up.</Text>
        ) : (
          <View style={{ gap: SP.sm }}>
            {exceptions.map(e => (
              <View key={e.id} style={{ flexDirection: 'row', alignItems: 'center', gap: SP.md, padding: SP.md, borderRadius: R.lg, backgroundColor: T.bgInput, borderWidth: 1, borderColor: T.line }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: T.text, fontSize: 15, fontWeight: '700' }}>
                    {new Date(`${e.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                  </Text>
                  <Text style={{ color: e.isClosed ? T.err : T.brandGold, fontSize: 13, marginTop: 2 }}>
                    {e.isClosed ? 'Closed' : e.intervals.map(formatInterval).join(', ')}
                  </Text>
                  {e.note && <Text style={{ color: T.textSub, fontSize: 13, marginTop: 2 }}>{e.note}</Text>}
                </View>
                <IconButton icon="trash-2" label={`Remove ${e.date}`} tone={T.err}
                  onPress={async () => { if (await confirm({ title: 'Remove this day?', confirmLabel: 'Remove', destructive: true })) remove.mutate({ branchId, id: e.id }); }} />
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

function InfoTab({ branchId, amenities, accessibility }: { branchId: number; amenities: string | null; accessibility: string | null }) {
  const [a, setA] = useState(amenities ?? '');
  const [acc, setAcc] = useState(accessibility ?? '');
  const save = useSaveBranchProfile();
  useEffect(() => { setA(amenities ?? ''); setAcc(accessibility ?? ''); }, [amenities, accessibility]);
  return (
    <View>
      <Text style={{ color: T.textSub, fontSize: 13, lineHeight: 18, marginBottom: SP.lg }}>
        Shown on the member "Gym info" screen with the address, phone and hours (edit those on the branch itself).
        Use "- " for bullets and **bold**.
      </Text>
      <Field label="Amenities" value={a} onChangeText={setA} multiline placeholder={'- Free parking\n- Lockers & showers\n- Sauna'} />
      <Field label="Accessibility" value={acc} onChangeText={setAcc} multiline placeholder={'- Step-free entrance\n- Accessible changing room'} />
      <PrimaryButton label="Save info" icon="check" loading={save.isPending}
        onPress={() => save.mutate({ branchId, amenities: a, accessibility: acc }, {
          onSuccess: () => notify('Branch info saved'),
          onError: (e) => notify('Couldn\'t save', apiErrorText(e)),
        })} />
    </View>
  );
}
