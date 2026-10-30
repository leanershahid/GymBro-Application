import React, { useState } from 'react';
import { Alert } from 'react-native';
import FormPage from '../../exercises/components/FormPage';
import ChipSelect, { humanize } from '../../exercises/components/ChipSelect';
import { Field } from '../../trainers/components/FormFields';
import { useToast } from '../../common/components/Toast';
import { apiErrorText } from '../../../api/apiError';
import {
  Workout, WorkoutPlan, WorkoutGoal, WorkoutDifficulty,
  WORKOUT_GOALS, WORKOUT_DIFFICULTIES, toEnumIndex,
} from '../../workouts/types/workout.types';
import { useUpdateWorkout, useUpdatePlan } from '../api/programQueries';

type Props =
  | { kind: 'workout'; item: Workout; onBack: () => void }
  | { kind: 'plan'; item: WorkoutPlan; onBack: () => void };

const GOAL_OPTIONS = WORKOUT_GOALS.map(g => ({ value: g, label: humanize(g) }));
const DIFF_OPTIONS = WORKOUT_DIFFICULTIES.map(d => ({ value: d, label: d }));

/** Edit a workout's or plan's details (name, description, goal, difficulty, duration). */
export default function DetailsPage(props: Props) {
  const { kind, item, onBack } = props;
  const toast = useToast();
  const { mutate: updateWorkout, isPending: uw } = useUpdateWorkout();
  const { mutate: updatePlan, isPending: up } = useUpdatePlan();

  const [name, setName] = useState(item.name);
  const [description, setDescription] = useState(item.description ?? '');
  const [goal, setGoal] = useState<WorkoutGoal | null>(item.goal ?? null);
  const [difficulty, setDifficulty] = useState<WorkoutDifficulty | null>(item.difficulty ?? null);
  const [duration, setDuration] = useState(
    kind === 'workout' ? String(props.item.durationMin ?? '') : String(props.item.durationWeeks ?? ''),
  );
  const [errors, setErrors] = useState<{ name?: string; duration?: string }>({});

  const submit = () => {
    const errs: typeof errors = {};
    if (!name.trim()) errs.name = 'Name is required.';
    const d = duration.trim();
    if (kind === 'workout' && d && !(/^\d+$/.test(d) && Number(d) >= 1 && Number(d) <= 600)) errs.duration = 'Enter 1–600 minutes.';
    if (kind === 'plan' && !(/^\d+$/.test(d) && Number(d) >= 1 && Number(d) <= 52)) errs.duration = 'Enter 1–52 weeks.';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const common = {
      name: name.trim(),
      description: description.trim(),
      goal: goal ? toEnumIndex(WORKOUT_GOALS, goal) : undefined,
      difficulty: difficulty ? toEnumIndex(WORKOUT_DIFFICULTIES, difficulty) : undefined,
    };
    const onSuccess = (res: { success: boolean; message: string }) => {
      if (!res.success) { Alert.alert('Could not save', res.message || 'Changes were not saved.'); return; }
      toast.show({ type: 'success', message: res.message || 'Saved.' });
      onBack();
    };
    const onError = (e: unknown) => Alert.alert('Could not save', apiErrorText(e));

    if (kind === 'workout') {
      updateWorkout({ id: item.id, payload: { ...common, durationMin: d ? Number(d) : undefined } }, { onSuccess, onError });
    } else {
      updatePlan({ id: item.id, payload: { ...common, durationWeeks: Number(d) } }, { onSuccess, onError });
    }
  };

  return (
    <FormPage
      eyebrow={kind === 'workout' ? 'Edit workout details' : 'Edit plan details'}
      title={item.name}
      onBack={onBack}
      submitLabel="Save details"
      onSubmit={submit}
      submitting={uw || up}
    >
      <Field label="Name" value={name} onChangeText={v => { setName(v); setErrors(e => ({ ...e, name: undefined })); }} placeholder="Name" error={errors.name} />
      <Field label="Description" value={description} onChangeText={setDescription} placeholder="What is this for?" multiline />
      <ChipSelect<WorkoutGoal> label="Goal" options={GOAL_OPTIONS} value={goal} onChange={setGoal} />
      <ChipSelect<WorkoutDifficulty> label="Difficulty" options={DIFF_OPTIONS} value={difficulty} onChange={setDifficulty} />
      <Field
        label={kind === 'workout' ? 'Duration (min)' : 'Duration (weeks)'}
        value={duration}
        onChangeText={v => { setDuration(v); setErrors(e => ({ ...e, duration: undefined })); }}
        placeholder={kind === 'workout' ? '45' : '8'}
        keyboardType="number-pad"
        error={errors.duration}
      />
    </FormPage>
  );
}
