import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, R, SP, withAlpha } from '../../../theme';
import FormPage from '../../exercises/components/FormPage';
import ChipSelect from '../../exercises/components/ChipSelect';
import { Field, RowGrid, GridCell } from '../../trainers/components/FormFields';
import Skeleton from '../../common/components/Skeleton';
import { useToast } from '../../common/components/Toast';
import EmptyState from '../../dashboard/components/EmptyState';
import { apiErrorText } from '../../../api/apiError';
import { useWorkoutStructure, useSaveWorkoutStructure } from '../api/programQueries';
import {
  SECTION_TYPES, SectionType, StructureSection, WorkoutStructure, LibraryExercise,
} from '../types/program.types';
import ExercisePickerSheet from './ExercisePickerSheet';
import IconButton from './IconButton';

// ─── Draft model (strings for inputs; converted on save) ────────────
interface DraftExercise {
  key: string;
  exerciseId: number;
  exerciseName: string;
  mode: 'reps' | 'time';
  sets: string;
  reps: string;
  duration: string;
  rest: string;
  tempo: string;
  weight: string;
  notes: string;
}

interface DraftSection {
  key: string;
  name: string;
  type: SectionType;
  rounds: string;
  rest: string;
  exercises: DraftExercise[];
}

let seq = 0;
const nextKey = () => `k${++seq}`;
const str = (v: number | string | null | undefined) => (v === null || v === undefined ? '' : String(v));

function toSectionType(t: string | null | undefined): SectionType {
  const hit = SECTION_TYPES.find(s => s.toLowerCase() === (t ?? '').toLowerCase());
  return hit ?? 'Main';
}

function toDraft(sections: StructureSection[]): DraftSection[] {
  return sections.map(s => ({
    key: nextKey(),
    name: s.name ?? '',
    type: toSectionType(s.type),
    rounds: str(s.rounds || 1),
    rest: str(s.restSeconds),
    exercises: s.exercises.map(e => ({
      key: nextKey(),
      exerciseId: e.exerciseId,
      exerciseName: e.exerciseName ?? `Exercise #${e.exerciseId}`,
      mode: !e.reps && e.durationSeconds ? 'time' : 'reps',
      sets: str(e.sets), reps: e.reps ?? '', duration: str(e.durationSeconds), rest: str(e.restSeconds),
      tempo: e.tempo ?? '', weight: e.weightSuggestion ?? '', notes: e.notes ?? '',
    })),
  }));
}

const intOrNull = (s: string) => (s.trim() === '' ? null : Number(s.trim()));
const isInt = (s: string, min: number, max: number) => {
  const n = Number(s.trim());
  return /^\d+$/.test(s.trim()) && n >= min && n <= max;
};
const blankToNull = (s: string) => (s.trim() ? s.trim() : null);

/** Returns a list of problems, empty when the draft can be saved. */
function validate(sections: DraftSection[]): string[] {
  const out: string[] = [];
  sections.forEach((s, si) => {
    const sName = s.name.trim() || `Section ${si + 1}`;
    if (!isInt(s.rounds || '1', 1, 255)) out.push(`${sName}: rounds must be 1–255.`);
    if (s.rest.trim() && !isInt(s.rest, 0, 3600)) out.push(`${sName}: rest must be 0–3600 seconds.`);
    s.exercises.forEach(e => {
      const label = `${sName} › ${e.exerciseName}`;
      if (e.sets.trim() && !isInt(e.sets, 1, 99)) out.push(`${label}: sets must be 1–99.`);
      if (e.mode === 'reps' && !e.reps.trim()) out.push(`${label}: enter reps (e.g. 10 or 8-12).`);
      if (e.mode === 'time' && !isInt(e.duration, 1, 7200)) out.push(`${label}: duration must be 1–7200 seconds.`);
      if (e.rest.trim() && !isInt(e.rest, 0, 3600)) out.push(`${label}: rest must be 0–3600 seconds.`);
    });
  });
  return out;
}

function toPayload(sections: DraftSection[]): WorkoutStructure {
  return {
    sections: sections.map(s => ({
      name: blankToNull(s.name),
      type: s.type,
      rounds: Number(s.rounds.trim() || '1'),
      restSeconds: intOrNull(s.rest),
      exercises: s.exercises.map(e => ({
        exerciseId: e.exerciseId,
        sets: intOrNull(e.sets),
        reps: e.mode === 'reps' ? blankToNull(e.reps) : null,
        durationSeconds: e.mode === 'time' ? intOrNull(e.duration) : null,
        restSeconds: intOrNull(e.rest),
        tempo: blankToNull(e.tempo),
        weightSuggestion: blankToNull(e.weight),
        notes: blankToNull(e.notes),
      })),
    })),
  };
}

const move = <X,>(arr: X[], from: number, to: number): X[] => {
  if (to < 0 || to >= arr.length) return arr;
  const copy = arr.slice();
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
};

// ─── Exercise card ──────────────────────────────────────────────────
function ExerciseCard({
  ex, index, count, onChange, onMove, onRemove,
}: {
  ex: DraftExercise; index: number; count: number;
  onChange: (patch: Partial<DraftExercise>) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  return (
    <View style={{ backgroundColor: T.bgInputActive, borderRadius: R.md, padding: SP.md, marginBottom: SP.sm, borderWidth: 1, borderColor: T.line }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.sm, marginBottom: SP.md }}>
        <Text style={{ color: T.textFaint, fontSize: 12, fontWeight: '800', width: 20 }}>{index + 1}</Text>
        <Text numberOfLines={2} style={{ flex: 1, color: T.text, fontSize: 14, fontWeight: '700' }}>{ex.exerciseName}</Text>
        <IconButton icon="arrow-up" label={`Move ${ex.exerciseName} up`} onPress={() => onMove(-1)} disabled={index === 0} size={30} />
        <IconButton icon="arrow-down" label={`Move ${ex.exerciseName} down`} onPress={() => onMove(1)} disabled={index === count - 1} size={30} />
        <IconButton icon="trash-2" label={`Remove ${ex.exerciseName}`} onPress={onRemove} tone="danger" size={30} />
      </View>

      <View style={{ flexDirection: 'row', gap: SP.sm, marginBottom: SP.md }}>
        {(['reps', 'time'] as const).map(m => {
          const on = ex.mode === m;
          return (
            <Pressable
              key={m}
              onPress={() => onChange({ mode: m })}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={m === 'reps' ? 'Measure by reps' : 'Measure by time'}
              style={{
                flex: 1, minHeight: 36, borderRadius: 999, alignItems: 'center', justifyContent: 'center',
                backgroundColor: on ? withAlpha(T.brand, 0.12) : T.bgInput,
                borderWidth: 1, borderColor: on ? withAlpha(T.brand, 0.4) : T.line,
              }}
            >
              <Text style={{ color: on ? T.brand : T.textSub, fontSize: 12, fontWeight: '700' }}>{m === 'reps' ? 'Reps' : 'Timed'}</Text>
            </Pressable>
          );
        })}
      </View>

      <RowGrid>
        <GridCell>
          <Field label="Sets" value={ex.sets} onChangeText={v => onChange({ sets: v })} placeholder="3" keyboardType="number-pad" />
        </GridCell>
        <GridCell>
          {ex.mode === 'reps'
            ? <Field label="Reps" value={ex.reps} onChangeText={v => onChange({ reps: v })} placeholder="8-12" autoCapitalize="characters" autoCorrect={false} />
            : <Field label="Duration (s)" value={ex.duration} onChangeText={v => onChange({ duration: v })} placeholder="45" keyboardType="number-pad" />}
        </GridCell>
      </RowGrid>
      <RowGrid>
        <GridCell>
          <Field label="Rest (s)" value={ex.rest} onChangeText={v => onChange({ rest: v })} placeholder="60" keyboardType="number-pad" />
        </GridCell>
        <GridCell>
          <Field label="Weight" value={ex.weight} onChangeText={v => onChange({ weight: v })} placeholder="e.g. 20 kg, RPE 8" autoCorrect={false} />
        </GridCell>
      </RowGrid>
      <Field label="Notes" value={ex.notes} onChangeText={v => onChange({ notes: v })} placeholder="Cues, tempo, form notes…" />
    </View>
  );
}

// ─── Editor ─────────────────────────────────────────────────────────
interface Props {
  workoutId: number;
  workoutName: string;
  onBack: () => void;
}

/** Sections → exercises editor for one workout. Save replaces the whole structure (PUT). */
export default function WorkoutEditor({ workoutId, workoutName, onBack }: Props) {
  const toast = useToast();
  const { data, isLoading, isError, error, refetch } = useWorkoutStructure(workoutId);
  const { mutate: save, isPending: saving } = useSaveWorkoutStructure(workoutId);

  const [sections, setSections] = useState<DraftSection[]>([]);
  const [dirty, setDirty] = useState(false);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    if (data && !loaded.current) {
      loaded.current = true;
      setSections(toDraft(data.sections ?? []));
    }
  }, [data]);

  const update = (fn: (prev: DraftSection[]) => DraftSection[]) => { setSections(fn); setDirty(true); };
  const patchSection = (key: string, patch: Partial<DraftSection>) =>
    update(prev => prev.map(s => (s.key === key ? { ...s, ...patch } : s)));
  const patchExercise = (sKey: string, eKey: string, patch: Partial<DraftExercise>) =>
    update(prev => prev.map(s => (s.key !== sKey ? s : { ...s, exercises: s.exercises.map(e => (e.key === eKey ? { ...e, ...patch } : e)) })));

  const addSection = () => {
    const isFirst = sections.length === 0;
    update(prev => [...prev, {
      key: nextKey(),
      name: isFirst ? 'Main' : `Section ${prev.length + 1}`,
      type: 'Main', rounds: '1', rest: '', exercises: [],
    }]);
  };

  const removeSection = (s: DraftSection, index: number) => {
    const doIt = () => update(prev => prev.filter(x => x.key !== s.key));
    if (s.exercises.length === 0) { doIt(); return; }
    Alert.alert(
      'Remove section?',
      `"${s.name.trim() || `Section ${index + 1}`}" and its ${s.exercises.length} exercise${s.exercises.length === 1 ? '' : 's'} will be removed.`,
      [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: doIt }],
    );
  };

  const addExercises = (picked: LibraryExercise[]) => {
    const sKey = pickerFor;
    setPickerFor(null);
    if (!sKey || picked.length === 0) return;
    update(prev => prev.map(s => (s.key !== sKey ? s : {
      ...s,
      exercises: [...s.exercises, ...picked.map(p => ({
        key: nextKey(), exerciseId: p.id, exerciseName: p.name, mode: 'reps' as const,
        sets: '3', reps: '10', duration: '', rest: '60', tempo: '', weight: '', notes: '',
      }))],
    })));
  };

  const handleSave = () => {
    if (saving || !data) return;
    const problems = validate(sections);
    if (problems.length) {
      const shown = problems.slice(0, 6);
      Alert.alert('Check the workout', `• ${shown.join('\n• ')}${problems.length > shown.length ? `\n…and ${problems.length - shown.length} more` : ''}`);
      return;
    }
    save(toPayload(sections), {
      onSuccess: res => {
        if (!res.success) { Alert.alert('Could not save', res.message || 'The workout was not saved.'); return; }
        if (res.data) setSections(toDraft(res.data.sections ?? []));
        setDirty(false);
        toast.show({ type: 'success', message: res.message || 'Workout saved.' });
      },
      onError: e => Alert.alert('Could not save', apiErrorText(e)),
    });
  };

  const handleBack = () => {
    if (!dirty) { onBack(); return; }
    Alert.alert('Discard changes?', 'You have unsaved changes to this workout.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: onBack },
    ]);
  };

  const exerciseCount = sections.reduce((n, s) => n + s.exercises.length, 0);
  const pickerSection = sections.find(s => s.key === pickerFor);

  return (
    <>
      <FormPage
        eyebrow="Edit workout"
        title={workoutName}
        onBack={handleBack}
        submitLabel={dirty ? 'Save workout' : 'Saved'}
        onSubmit={handleSave}
        submitting={saving}
      >
        {isLoading && <Skeleton rows={3} height={140} />}
        {isError && (
          <EmptyState icon="wifi-off" tone="error" title="Couldn't load this workout" subtitle={apiErrorText(error)} action={{ label: 'Retry', onPress: () => refetch() }} />
        )}

        {!isLoading && !isError && (
          <>
            <Text style={{ color: T.textSub, fontSize: 13, marginBottom: SP.lg }}>
              {sections.length} section{sections.length === 1 ? '' : 's'} · {exerciseCount} exercise{exerciseCount === 1 ? '' : 's'}
              {dirty ? '  ·  unsaved changes' : ''}
            </Text>

            {sections.length === 0 && (
              <EmptyState icon="layers" title="No sections yet" subtitle="Add a section (e.g. Warm-up, Main, Cool-down), then add exercises to it." />
            )}

            {sections.map((s, si) => (
              <View key={s.key} style={{ backgroundColor: T.bgInput, borderRadius: R.lg, padding: SP.lg, marginBottom: SP.lg, borderWidth: 1, borderColor: T.bgInputActive }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.sm, marginBottom: SP.md }}>
                  <View style={{ width: 3, height: 18, borderRadius: 2, backgroundColor: T.brand }} />
                  <Text style={{ flex: 1, color: T.textSub, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' }}>
                    Section {si + 1}
                  </Text>
                  <IconButton icon="arrow-up" label={`Move section ${si + 1} up`} onPress={() => update(p => move(p, si, si - 1))} disabled={si === 0} />
                  <IconButton icon="arrow-down" label={`Move section ${si + 1} down`} onPress={() => update(p => move(p, si, si + 1))} disabled={si === sections.length - 1} />
                  <IconButton icon="trash-2" label={`Remove section ${si + 1}`} onPress={() => removeSection(s, si)} tone="danger" />
                </View>

                <Field label="Section name" value={s.name} onChangeText={v => patchSection(s.key, { name: v })} placeholder="e.g. Warm-up" />
                <ChipSelect<SectionType>
                  label="Type"
                  options={SECTION_TYPES.map(t => ({ value: t, label: t }))}
                  value={s.type}
                  onChange={v => patchSection(s.key, { type: v })}
                />
                <RowGrid>
                  <GridCell>
                    <Field label="Rounds" value={s.rounds} onChangeText={v => patchSection(s.key, { rounds: v })} placeholder="1" keyboardType="number-pad" />
                  </GridCell>
                  <GridCell>
                    <Field label="Rest between rounds (s)" value={s.rest} onChangeText={v => patchSection(s.key, { rest: v })} placeholder="90" keyboardType="number-pad" />
                  </GridCell>
                </RowGrid>

                {s.exercises.length === 0 && (
                  <Text style={{ color: T.textFaint, fontSize: 13, marginBottom: SP.md }}>No exercises in this section yet.</Text>
                )}
                {s.exercises.map((e, ei) => (
                  <ExerciseCard
                    key={e.key}
                    ex={e}
                    index={ei}
                    count={s.exercises.length}
                    onChange={patch => patchExercise(s.key, e.key, patch)}
                    onMove={dir => update(prev => prev.map(x => (x.key !== s.key ? x : { ...x, exercises: move(x.exercises, ei, ei + dir) })))}
                    onRemove={() => update(prev => prev.map(x => (x.key !== s.key ? x : { ...x, exercises: x.exercises.filter(y => y.key !== e.key) })))}
                  />
                ))}

                <Pressable
                  onPress={() => setPickerFor(s.key)}
                  accessibilityRole="button"
                  accessibilityLabel={`Add exercises to section ${si + 1}`}
                  style={{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SP.sm, minHeight: 44,
                    borderRadius: R.md, borderWidth: 1, borderStyle: 'dashed', borderColor: withAlpha(T.brand, 0.45),
                  }}
                >
                  <Feather name="plus" size={16} color={T.brand} />
                  <Text style={{ color: T.brand, fontSize: 13, fontWeight: '700' }}>Add exercises</Text>
                </Pressable>
              </View>
            ))}

            <Pressable
              onPress={addSection}
              accessibilityRole="button"
              accessibilityLabel="Add section"
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SP.sm, minHeight: 48,
                borderRadius: R.lg, backgroundColor: T.bgInput, borderWidth: 1, borderColor: T.line,
              }}
            >
              <Feather name="layers" size={16} color={T.text} />
              <Text style={{ color: T.text, fontSize: 14, fontWeight: '700' }}>Add section</Text>
            </Pressable>
          </>
        )}
      </FormPage>

      <ExercisePickerSheet
        visible={pickerFor !== null}
        sectionName={pickerSection?.name.trim() || 'section'}
        onClose={() => setPickerFor(null)}
        onAdd={addExercises}
      />
    </>
  );
}
