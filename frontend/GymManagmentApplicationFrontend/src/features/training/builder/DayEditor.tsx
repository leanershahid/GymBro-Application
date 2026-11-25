import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { T, R, SP, withAlpha } from '../../../theme';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import PrimaryButton from '../../common/components/PrimaryButton';
import Skeleton from '../../common/components/Skeleton';
import EmptyState from '../../common/components/EmptyState';
import { Field, RowGrid, GridCell } from '../../common/components/FormFields';
import { useToast } from '../../common/components/Toast';
import { confirm, showAlert } from '../../common/components/dialogs';
import { apiErrorText } from '../../../api/apiError';
import { useStructure, useSaveStructure, useBuilderActions } from '../api/trainingQueries';
import type { SectionType } from '../api/training.types';
import {
  BLOCK_KINDS, DraftBlock, DraftExercise, SetRow, addSetRow, blockLabel, countExercises, groupIntoSuperset, isGroupBlock,
  moveExerciseToBlock, moveItem, newBlock, newExercise, nextSetType, removeSetRow, setMarker, toDraftBlocks, toStructure,
  validateBlocks,
} from './builderUtils';
import { ActionSheet, CellInput, Chip, IconBtn, MenuAction } from './BuilderUi';
import ExercisePicker, { PickedExercise } from './ExercisePicker';

/** The plan day being edited (absent when editing a library workout). */
export interface EditedDay {
  planId: number;
  week: number;
  day: number;
  title: string | null;
  notes: string | null;
}

interface Props {
  workoutId: number;
  /** Header title (day title or workout name; default: the workout's name). */
  title?: string;
  eyebrow?: string;
  day?: EditedDay;
  readOnly?: boolean;
  onBack: () => void;
  /** After a successful save. */
  onSaved?: () => void;
}

const COL = { set: 30, reps: 54, kg: 48, rpe: 40, rest: 48, time: 52, dist: 56, del: 28 };
const GAP = 5;

/**
 * Edits one day's workout (or a library workout): blocks (Single / Superset / Circuit…) → exercises →
 * a compact per-set table. Save replaces the whole structure (PUT /workouts/{id}/structure); a plan
 * day's title and notes go to PUT /plans/{id}/weeks/{w}/days/{d}.
 */
export default function DayEditor({ workoutId, title, eyebrow, day, readOnly, onBack, onSaved }: Props) {
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { data, isLoading, isError, error, refetch } = useStructure(workoutId);
  const save = useSaveStructure(workoutId);
  const { upsert } = useBuilderActions(day?.planId ?? 0);

  const [blocks, setBlocks] = useState<DraftBlock[]>([]);
  const [dayTitle, setDayTitle] = useState(day?.title ?? '');
  const [dayNotes, setDayNotes] = useState(day?.notes ?? '');
  const [dirty, setDirty] = useState(false);
  const [pickerFor, setPickerFor] = useState<string | 'new' | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [menuFor, setMenuFor] = useState<DraftExercise | null>(null);
  const [moveFor, setMoveFor] = useState<DraftExercise | null>(null);
  const [notesOpen, setNotesOpen] = useState<Set<string>>(new Set());
  const loaded = useRef(false);

  useEffect(() => {
    if (data && !loaded.current) {
      loaded.current = true;
      const draft = toDraftBlocks(data.sections ?? []);
      setBlocks(draft);
      setNotesOpen(new Set(draft.flatMap(b => b.exercises).filter(e => e.notes).map(e => e.key)));
    }
  }, [data]);

  const edit = (fn: (prev: DraftBlock[]) => DraftBlock[]) => { setBlocks(fn); setDirty(true); };
  const patchBlock = (key: string, patch: Partial<DraftBlock>) => edit(p => p.map(b => (b.key === key ? { ...b, ...patch } : b)));
  const patchEx = (exKey: string, fn: (e: DraftExercise) => DraftExercise) =>
    edit(p => p.map(b => (b.exercises.some(e => e.key === exKey) ? { ...b, exercises: b.exercises.map(e => (e.key === exKey ? fn(e) : e)) } : b)));
  const patchRow = (exKey: string, rowKey: string, patch: Partial<SetRow>) =>
    patchEx(exKey, e => ({ ...e, rows: e.rows.map(r => (r.key === rowKey ? { ...r, ...patch } : r)) }));

  const addExercises = (picked: PickedExercise[]) => {
    const target = pickerFor;
    setPickerFor(null);
    if (!target || picked.length === 0) return;
    const exs = picked.map(p => newExercise(p.id, p.name, p.timed));
    edit(prev => (target === 'new'
      ? [...prev, newBlock('Main', exs)]
      : prev.map(b => (b.key === target ? { ...b, exercises: [...b.exercises, ...exs] } : b))));
  };

  const removeBlock = async (b: DraftBlock, i: number) => {
    if (b.exercises.length && !(await confirm({
      title: 'Remove block?', destructive: true, confirmLabel: 'Remove',
      message: `"${b.name.trim() || `Block ${i + 1}`}" and its ${b.exercises.length} exercise${b.exercises.length === 1 ? '' : 's'} will be removed.`,
    }))) return;
    edit(p => p.filter(x => x.key !== b.key));
  };

  const toggleSelect = (key: string) => setSelected(s => {
    const n = new Set(s);
    if (n.has(key)) n.delete(key); else n.add(key);
    return n;
  });

  const groupSelected = () => {
    edit(p => groupIntoSuperset(p, selected));
    setSelected(new Set());
    setSelecting(false);
  };

  const handleSave = async () => {
    if (save.isPending || upsert.isPending || !data) return;
    const problems = validateBlocks(blocks);
    if (problems.length) {
      const shown = problems.slice(0, 6);
      showAlert('Check the workout', `• ${shown.join('\n• ')}${problems.length > shown.length ? `\n…and ${problems.length - shown.length} more` : ''}`);
      return;
    }
    try {
      if (day && (dayTitle.trim() !== (day.title ?? '') || dayNotes.trim() !== (day.notes ?? ''))) {
        await upsert.mutateAsync({ week: day.week, day: day.day, body: { title: dayTitle.trim() || null, notes: dayNotes.trim() || null, isRestDay: false } });
      }
      const saved = await save.mutateAsync(toStructure(blocks, workoutId, data.workoutName));
      setBlocks(toDraftBlocks(saved.sections ?? []));
      setDirty(false);
      toast.show({ type: 'success', message: day ? 'Day saved.' : 'Workout saved.' });
      onSaved?.();
    } catch (e) {
      showAlert('Could not save', apiErrorText(e));
    }
  };

  const handleBack = async () => {
    if (!dirty || readOnly) { onBack(); return; }
    if (await confirm({ title: 'Discard changes?', message: 'You have unsaved changes.', confirmLabel: 'Discard', cancelLabel: 'Keep editing', destructive: true })) onBack();
  };

  const exCount = countExercises(blocks);
  const menuActions: MenuAction[] = menuFor ? [
    { icon: 'corner-down-right', label: 'Move to another block…', onPress: () => setMoveFor(menuFor) },
    { icon: 'clock', label: menuFor.showTime ? 'Hide time column' : 'Show time column', onPress: () => patchEx(menuFor.key, e => ({ ...e, showTime: !e.showTime })) },
    { icon: 'navigation', label: menuFor.showDist ? 'Hide distance column' : 'Show distance column', onPress: () => patchEx(menuFor.key, e => ({ ...e, showDist: !e.showDist })) },
    { icon: 'file-text', label: 'Notes', onPress: () => setNotesOpen(s => new Set(s).add(menuFor.key)) },
    { icon: 'trash-2', label: 'Remove exercise', danger: true, onPress: () => edit(p => p.map(b => ({ ...b, exercises: b.exercises.filter(e => e.key !== menuFor.key) }))) },
  ] : [];
  const moveActions: MenuAction[] = moveFor ? [
    ...blocks.filter(b => !b.exercises.some(e => e.key === moveFor.key)).map(b => ({
      icon: 'layers' as const,
      label: `${b.name.trim() || `Block ${blocks.indexOf(b) + 1}`} · ${blockLabel(b.type)}`,
      onPress: () => edit(p => moveExerciseToBlock(p, moveFor.key, b.key)),
    })),
    { icon: 'plus-square', label: 'New block', onPress: () => edit(p => moveExerciseToBlock(p, moveFor.key, 'new')) },
  ] : [];

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScreenHeader
          eyebrow={eyebrow ?? (day ? `Week ${day.week} · Day ${day.day}` : 'Edit workout')}
          title={title ?? data?.workoutName ?? 'Workout'}
          onBack={handleBack}
          action={!readOnly && exCount > 1 ? {
            label: selecting ? 'Done' : 'Select', icon: selecting ? 'x' : 'check-square',
            onPress: () => { setSelecting(s => !s); setSelected(new Set()); },
          } : undefined}
        />
        <ScrollView contentContainerStyle={{ paddingHorizontal: SP.xl, paddingBottom: SP.xxl }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {isLoading && <Skeleton rows={3} height={140} />}
          {isError && <EmptyState icon="wifi-off" tone="error" title="Couldn't load this workout" subtitle={apiErrorText(error)} action={{ label: 'Retry', onPress: () => refetch() }} />}

          {!isLoading && !isError && (
            <>
              {day && (
                <>
                  <Field label="Day title" value={dayTitle} onChangeText={v => { setDayTitle(v); setDirty(true); }} placeholder="e.g. Push, Legs, Upper" editable={!readOnly} />
                  <Field label="Day notes" value={dayNotes} onChangeText={v => { setDayNotes(v); setDirty(true); }} placeholder="Focus, warm-up cues…" multiline editable={!readOnly} />
                </>
              )}
              <Text style={{ color: T.textSub, fontSize: 13, marginBottom: SP.lg }}>
                {blocks.length} block{blocks.length === 1 ? '' : 's'} · {exCount} exercise{exCount === 1 ? '' : 's'}
                {dirty ? '  ·  unsaved changes' : ''}
                {selecting ? '  ·  tap exercises to select' : ''}
              </Text>

              {blocks.length === 0 && (
                <EmptyState icon="layers" title="Nothing here yet" subtitle={readOnly ? undefined : 'Add exercises; group them into supersets or circuits later.'} />
              )}

              {blocks.map((b, bi) => (
                <BlockCard
                  key={b.key}
                  block={b}
                  index={bi}
                  count={blocks.length}
                  readOnly={!!readOnly}
                  selecting={selecting}
                  selected={selected}
                  notesOpen={notesOpen}
                  onPatch={patch => patchBlock(b.key, patch)}
                  onMove={dir => edit(p => moveItem(p, bi, bi + dir))}
                  onRemove={() => removeBlock(b, bi)}
                  onAdd={() => setPickerFor(b.key)}
                  onToggleSelect={toggleSelect}
                  onMoveExercise={(ei, dir) => edit(p => p.map(x => (x.key === b.key ? { ...x, exercises: moveItem(x.exercises, ei, ei + dir) } : x)))}
                  onMenu={setMenuFor}
                  onPatchEx={patchEx}
                  onPatchRow={patchRow}
                />
              ))}

              {!readOnly && (
                <Pressable
                  onPress={() => setPickerFor('new')}
                  accessibilityRole="button"
                  accessibilityLabel="Add exercises in a new block"
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SP.sm, minHeight: 48, borderRadius: R.lg, backgroundColor: T.bgInput, borderWidth: 1, borderColor: T.line }}
                >
                  <Feather name="plus" size={16} color={T.text} />
                  <Text style={{ color: T.text, fontSize: 14, fontWeight: '700' }}>Add exercises</Text>
                </Pressable>
              )}
            </>
          )}
        </ScrollView>

        {!readOnly && !isLoading && !isError && (
          <View style={{ paddingHorizontal: SP.xl, paddingTop: SP.md, paddingBottom: Math.max(insets.bottom, SP.lg), borderTopWidth: 1, borderTopColor: T.line, backgroundColor: T.bg }}>
            {selecting ? (
              <PrimaryButton
                label={selected.size >= 2 ? `Group ${selected.size} into superset` : 'Select 2 or more exercises'}
                icon="link"
                disabled={selected.size < 2}
                onPress={groupSelected}
              />
            ) : (
              <PrimaryButton label={dirty ? (day ? 'Save day' : 'Save workout') : 'Saved'} icon="check" onPress={handleSave} loading={save.isPending || upsert.isPending} disabled={!dirty} />
            )}
          </View>
        )}
      </KeyboardAvoidingView>

      <ExercisePicker
        visible={pickerFor !== null}
        title={pickerFor === 'new' || !pickerFor ? 'Add exercises' : `Add to ${blocks.find(b => b.key === pickerFor)?.name.trim() || 'block'}`}
        onClose={() => setPickerFor(null)}
        onAdd={addExercises}
      />
      <ActionSheet visible={menuFor !== null} title={menuFor?.name ?? ''} actions={menuActions} onClose={() => setMenuFor(null)} />
      <ActionSheet visible={moveFor !== null} title={`Move ${moveFor?.name ?? ''} to…`} actions={moveActions} onClose={() => setMoveFor(null)} />
    </Screen>
  );
}

// ─── Block ────────────────────────────────────────────────────────────────────
interface BlockProps {
  block: DraftBlock;
  index: number;
  count: number;
  readOnly: boolean;
  selecting: boolean;
  selected: ReadonlySet<string>;
  notesOpen: ReadonlySet<string>;
  onPatch: (patch: Partial<DraftBlock>) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  onAdd: () => void;
  onToggleSelect: (exKey: string) => void;
  onMoveExercise: (index: number, dir: -1 | 1) => void;
  onMenu: (e: DraftExercise) => void;
  onPatchEx: (exKey: string, fn: (e: DraftExercise) => DraftExercise) => void;
  onPatchRow: (exKey: string, rowKey: string, patch: Partial<SetRow>) => void;
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function BlockCard(p: BlockProps) {
  const { block: b, index: bi, readOnly } = p;
  const group = isGroupBlock(b.type);
  const accent = b.type === 'Superset' ? T.violet : b.type === 'Circuit' ? T.sky : T.brand;
  const kinds = BLOCK_KINDS.some(k => k.type === b.type) ? BLOCK_KINDS : [...BLOCK_KINDS, { type: b.type, label: b.type }];
  return (
    <View style={{ backgroundColor: T.bgInput, borderRadius: R.lg, padding: SP.md, marginBottom: SP.lg, borderWidth: 1, borderColor: group ? withAlpha(accent, 0.35) : T.bgInputActive }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.sm, marginBottom: SP.sm }}>
        <View style={{ width: 3, height: 18, borderRadius: 2, backgroundColor: accent }} />
        <Text style={{ flex: 1, color: T.textSub, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' }}>
          {LETTERS[bi % 26]} · {blockLabel(b.type)}{group ? ` · ${b.rounds || 1} rounds` : ''}
        </Text>
        {!readOnly && (
          <>
            <IconBtn icon="arrow-up" label={`Move block ${bi + 1} up`} onPress={() => p.onMove(-1)} disabled={bi === 0} />
            <IconBtn icon="arrow-down" label={`Move block ${bi + 1} down`} onPress={() => p.onMove(1)} disabled={bi === p.count - 1} />
            <IconBtn icon="trash-2" label={`Remove block ${bi + 1}`} onPress={p.onRemove} tone="danger" />
          </>
        )}
      </View>

      {!readOnly && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: SP.sm }}>
          {kinds.map(k => (
            <Chip key={k.type} small label={k.label} active={b.type === k.type} a11y={`Block type ${k.label}`}
              onPress={() => p.onPatch({ type: k.type as SectionType, rounds: isGroupBlock(k.type) && b.rounds === '1' ? '3' : b.rounds })} />
          ))}
        </ScrollView>
      )}
      {!readOnly && (
        <RowGrid>
          <GridCell><Field label="Block name" value={b.name} onChangeText={v => p.onPatch({ name: v })} placeholder={group ? 'e.g. Finisher' : 'Optional'} /></GridCell>
          {group && <GridCell><Field label="Rounds" value={b.rounds} onChangeText={v => p.onPatch({ rounds: v })} placeholder="3" keyboardType="number-pad" /></GridCell>}
          {group && <GridCell><Field label="Rest (s)" value={b.rest} onChangeText={v => p.onPatch({ rest: v })} placeholder="90" keyboardType="number-pad" /></GridCell>}
        </RowGrid>
      )}
      {readOnly && !!b.name && <Text style={{ color: T.text, fontWeight: '700', marginBottom: SP.sm }}>{b.name}</Text>}

      {b.exercises.length === 0 && <Text style={{ color: T.textFaint, fontSize: 13, marginBottom: SP.md }}>No exercises in this block yet.</Text>}
      {b.exercises.map((e, ei) => (
        <ExerciseCard
          key={e.key}
          ex={e}
          code={group ? `${LETTERS[bi % 26]}${ei + 1}` : String(ei + 1)}
          first={ei === 0}
          last={ei === b.exercises.length - 1}
          readOnly={readOnly}
          selecting={p.selecting}
          selected={p.selected.has(e.key)}
          notesOpen={p.notesOpen.has(e.key) || !!e.notes}
          onToggleSelect={() => p.onToggleSelect(e.key)}
          onMove={dir => p.onMoveExercise(ei, dir)}
          onMenu={() => p.onMenu(e)}
          onPatch={fn => p.onPatchEx(e.key, fn)}
          onPatchRow={(rowKey, patch) => p.onPatchRow(e.key, rowKey, patch)}
        />
      ))}

      {!readOnly && (
        <Pressable
          onPress={p.onAdd}
          accessibilityRole="button"
          accessibilityLabel={`Add exercises to block ${bi + 1}`}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SP.sm, minHeight: 42, borderRadius: R.md, borderWidth: 1, borderStyle: 'dashed', borderColor: withAlpha(T.brand, 0.45) }}
        >
          <Feather name="plus" size={15} color={T.brand} />
          <Text style={{ color: T.brand, fontSize: 13, fontWeight: '700' }}>Add exercises</Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── Exercise + set table ─────────────────────────────────────────────────────
interface ExProps {
  ex: DraftExercise;
  code: string;
  first: boolean;
  last: boolean;
  readOnly: boolean;
  selecting: boolean;
  selected: boolean;
  notesOpen: boolean;
  onToggleSelect: () => void;
  onMove: (dir: -1 | 1) => void;
  onMenu: () => void;
  onPatch: (fn: (e: DraftExercise) => DraftExercise) => void;
  onPatchRow: (rowKey: string, patch: Partial<SetRow>) => void;
}

function HeadCell({ w, children }: { w: number; children: string }) {
  return <Text style={{ width: w, textAlign: 'center', color: T.textFaint, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' }}>{children}</Text>;
}

function ExerciseCard(p: ExProps) {
  const { ex, readOnly } = p;
  const table = (
    <View style={{ gap: GAP }}>
      <View style={{ flexDirection: 'row', gap: GAP, alignItems: 'center' }}>
        <HeadCell w={COL.set}>Set</HeadCell>
        <HeadCell w={COL.reps}>Reps</HeadCell>
        <HeadCell w={COL.kg}>kg</HeadCell>
        <HeadCell w={COL.rpe}>RPE</HeadCell>
        <HeadCell w={COL.rest}>Rest s</HeadCell>
        {ex.showTime && <HeadCell w={COL.time}>Time s</HeadCell>}
        {ex.showDist && <HeadCell w={COL.dist}>Dist m</HeadCell>}
        {!readOnly && <View style={{ width: COL.del }} />}
      </View>
      {ex.rows.map((r, i) => {
        const n = ex.rows.slice(0, i + 1).filter(x => x.type !== 'warmup').length;
        const tag = `${ex.name} set ${i + 1}`;
        return (
          <View key={r.key} style={{ flexDirection: 'row', gap: GAP, alignItems: 'center' }}>
            <Pressable
              onPress={() => p.onPatchRow(r.key, { type: nextSetType(r.type) })}
              disabled={readOnly}
              accessibilityRole="button"
              accessibilityLabel={`${tag}: ${r.type} set. Tap to change the set type`}
              style={{ width: COL.set, height: 34, borderRadius: R.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: r.type === 'normal' ? T.bgInputActive : withAlpha(r.type === 'warmup' ? T.brandGold : T.rose, 0.15) }}
            >
              <Text style={{ color: r.type === 'normal' ? T.textSub : r.type === 'warmup' ? T.brandGold : T.rose, fontSize: 12, fontWeight: '800' }}>{setMarker(r.type, n)}</Text>
            </Pressable>
            <CellInput width={COL.reps} value={r.reps} onChangeText={v => p.onPatchRow(r.key, { reps: v })} placeholder={ex.legacyReps ?? '8-12'} label={`${tag} reps`} keyboardType="numbers-and-punctuation" editable={!readOnly} />
            <CellInput width={COL.kg} value={r.kg} onChangeText={v => p.onPatchRow(r.key, { kg: v })} placeholder="–" label={`${tag} kilograms`} editable={!readOnly} />
            <CellInput width={COL.rpe} value={r.rpe} onChangeText={v => p.onPatchRow(r.key, { rpe: v })} placeholder="–" label={`${tag} RPE`} editable={!readOnly} />
            <CellInput width={COL.rest} value={r.rest} onChangeText={v => p.onPatchRow(r.key, { rest: v })} placeholder="–" label={`${tag} rest seconds`} keyboardType="number-pad" editable={!readOnly} />
            {ex.showTime && <CellInput width={COL.time} value={r.time} onChangeText={v => p.onPatchRow(r.key, { time: v })} placeholder="–" label={`${tag} time seconds`} keyboardType="number-pad" editable={!readOnly} />}
            {ex.showDist && <CellInput width={COL.dist} value={r.dist} onChangeText={v => p.onPatchRow(r.key, { dist: v })} placeholder="–" label={`${tag} distance metres`} editable={!readOnly} />}
            {!readOnly && (
              <Pressable onPress={() => p.onPatch(e => ({ ...e, rows: removeSetRow(e.rows, r.key) }))} disabled={ex.rows.length <= 1} hitSlop={6}
                accessibilityRole="button" accessibilityLabel={`Delete ${tag}`}
                style={{ width: COL.del, height: 34, alignItems: 'center', justifyContent: 'center', opacity: ex.rows.length <= 1 ? 0.3 : 1 }}>
                <Feather name="x" size={15} color={T.textFaint} />
              </Pressable>
            )}
          </View>
        );
      })}
    </View>
  );
  const wide = ex.showTime || ex.showDist;

  return (
    <Pressable
      onPress={p.selecting ? p.onToggleSelect : undefined}
      disabled={!p.selecting}
      accessibilityRole={p.selecting ? 'checkbox' : undefined}
      accessibilityState={p.selecting ? { checked: p.selected } : undefined}
      style={{
        backgroundColor: p.selected ? withAlpha(T.brand, 0.08) : T.bgInputActive, borderRadius: R.md, padding: SP.md, marginBottom: SP.sm,
        borderWidth: 1, borderColor: p.selected ? withAlpha(T.brand, 0.5) : T.line,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.sm, marginBottom: SP.sm }}>
        {p.selecting && (
          <View style={{ width: 22, height: 22, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: p.selected ? T.brand : 'transparent', borderWidth: 1.5, borderColor: p.selected ? T.brand : T.textFaint }}>
            {p.selected && <Feather name="check" size={14} color={T.onBrand} />}
          </View>
        )}
        <Text style={{ color: T.textFaint, fontSize: 12, fontWeight: '800', minWidth: 20 }}>{p.code}</Text>
        <Text numberOfLines={2} style={{ flex: 1, color: T.text, fontSize: 14, fontWeight: '700' }}>{ex.name}</Text>
        {!readOnly && !p.selecting && (
          <>
            <IconBtn icon="arrow-up" label={`Move ${ex.name} up`} onPress={() => p.onMove(-1)} disabled={p.first} size={30} />
            <IconBtn icon="arrow-down" label={`Move ${ex.name} down`} onPress={() => p.onMove(1)} disabled={p.last} size={30} />
            <IconBtn icon="more-horizontal" label={`More for ${ex.name}`} onPress={p.onMenu} size={30} />
          </>
        )}
      </View>

      {wide ? <ScrollView horizontal showsHorizontalScrollIndicator={false}>{table}</ScrollView> : table}

      {!readOnly && (
        <View style={{ flexDirection: 'row', gap: 6, marginTop: SP.sm, flexWrap: 'wrap' }}>
          <Chip small icon="plus" label="Set" a11y={`Add a set to ${ex.name}`} onPress={() => p.onPatch(e => ({ ...e, rows: addSetRow(e.rows) }))} />
          <Chip small icon="clock" label="Time" active={ex.showTime} a11y={`Time column for ${ex.name}`} onPress={() => p.onPatch(e => ({ ...e, showTime: !e.showTime }))} />
          <Chip small icon="navigation" label="Dist" active={ex.showDist} a11y={`Distance column for ${ex.name}`} onPress={() => p.onPatch(e => ({ ...e, showDist: !e.showDist }))} />
        </View>
      )}
      {(p.notesOpen || (readOnly && !!ex.notes)) && (
        <View style={{ marginTop: SP.sm }}>
          <Field label="Notes" value={ex.notes} onChangeText={v => p.onPatch(e => ({ ...e, notes: v }))} placeholder="Cues, tempo, form notes…" multiline editable={!readOnly} />
        </View>
      )}
    </Pressable>
  );
}
