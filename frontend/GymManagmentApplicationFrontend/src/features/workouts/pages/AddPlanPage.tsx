import React, { useState } from 'react';
import { Alert } from 'react-native';
import { useCreatePlan } from '../api/workoutQueries';
import { WORKOUT_GOALS, WORKOUT_DIFFICULTIES, GOAL_GENERAL, WorkoutPlanPayload } from '../types/workout.types';
import { Field } from '../../trainers/components/FormFields';
import ChipSelect, { humanize } from '../../exercises/components/ChipSelect';
import FormPage from '../../exercises/components/FormPage';
import { currentTenantId } from '../../../api/session';
import { apiErrorText } from '../../../api/apiError';
import { useToast } from '../../common/components/Toast';

interface Props { onBack: () => void; onCreated?: () => void }

export default function AddPlanPage({ onBack, onCreated }: Props) {
  const toast = useToast();
  const { mutate: create, isPending } = useCreatePlan();

  const [name, setName]               = useState('');
  const [description, setDescription] = useState('');
  const [weeks, setWeeks]             = useState('4');
  const [goal, setGoal]               = useState<number>(GOAL_GENERAL);
  const [difficulty, setDifficulty]   = useState(0);
  const [errors, setErrors]           = useState<{ name?: string; weeks?: string }>({});

  const submit = () => {
    const trimmed = name.trim();
    const w = Number(weeks);
    const errs: typeof errors = {};
    if (!trimmed) errs.name = 'Name is required';
    else if (trimmed.length > 200) errs.name = 'Name must be 200 characters or fewer';
    // DurationWeeks is a byte on the API and must be > 0.
    if (!weeks.trim() || !Number.isInteger(w) || w < 1 || w > 255) errs.weeks = 'Enter weeks between 1 and 255';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const payload: WorkoutPlanPayload = {
      tenantId: currentTenantId(),
      name: trimmed,
      description: description.trim() || undefined,
      durationWeeks: w,
      goal,
      difficulty,
    };

    create(payload, {
      onSuccess: () => {
        toast.show({ type: 'success', message: 'Plan created.' });
        onCreated?.();
        onBack();
      },
      onError: (e) => Alert.alert('Could not create plan', apiErrorText(e)),
    });
  };

  return (
    <FormPage eyebrow="Programs" title="New Plan" onBack={onBack} submitLabel="Create Plan" onSubmit={submit} submitting={isPending}>
      <Field label="Name *" value={name} onChangeText={setName} placeholder="e.g. 8-Week Strength Builder" error={errors.name} autoCapitalize="words" />
      <Field label="Description" value={description} onChangeText={setDescription} placeholder="Who it's for and what it achieves" multiline />
      <Field label="Duration (weeks) *" value={weeks} onChangeText={setWeeks} placeholder="4" keyboardType="number-pad" error={errors.weeks} />
      <ChipSelect label="Goal" value={goal} onChange={setGoal} options={WORKOUT_GOALS.map((g, i) => ({ value: i, label: humanize(g) }))} />
      <ChipSelect label="Difficulty" value={difficulty} onChange={setDifficulty} options={WORKOUT_DIFFICULTIES.map((d, i) => ({ value: i, label: d }))} />
    </FormPage>
  );
}
