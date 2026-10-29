import React, { useState } from 'react';
import { Text, Alert } from 'react-native';
import { useCreateWorkout } from '../api/workoutQueries';
import { WORKOUT_GOALS, WORKOUT_DIFFICULTIES, GOAL_GENERAL, WorkoutPayload } from '../types/workout.types';
import { Field, SwitchRow, RowGrid, GridCell } from '../../trainers/components/FormFields';
import ChipSelect, { humanize } from '../../exercises/components/ChipSelect';
import FormPage from '../../exercises/components/FormPage';
import { currentTenantId } from '../../../api/session';
import { apiErrorText } from '../../../api/apiError';
import { useToast } from '../../common/components/Toast';
import { T } from '../../../theme';

interface Props { onBack: () => void; onCreated?: () => void }

export default function AddWorkoutPage({ onBack, onCreated }: Props) {
  const toast = useToast();
  const { mutate: create, isPending } = useCreateWorkout();

  const [name, setName]               = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory]       = useState('');
  const [goal, setGoal]               = useState<number>(GOAL_GENERAL);
  const [difficulty, setDifficulty]   = useState(0);
  const [duration, setDuration]       = useState('');
  const [isPublic, setIsPublic]       = useState(false);
  const [tags, setTags]               = useState('');
  const [errors, setErrors]           = useState<{ name?: string; duration?: string }>({});

  const submit = () => {
    const trimmed = name.trim();
    const errs: typeof errors = {};
    if (!trimmed) errs.name = 'Name is required';
    else if (trimmed.length > 200) errs.name = 'Name must be 200 characters or fewer';
    const mins = duration.trim() ? Number(duration) : undefined;
    if (mins !== undefined && (!Number.isInteger(mins) || mins <= 0 || mins > 1440)) errs.duration = 'Enter minutes between 1 and 1440';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const tagList = tags.split(',').map(t => t.trim()).filter(Boolean);
    const payload: WorkoutPayload = {
      tenantId: currentTenantId(),
      name: trimmed,
      description: description.trim() || undefined,
      category: category.trim() || undefined,
      goal,
      difficulty,
      durationMin: mins,
      isPublic,
      tags: tagList.length ? tagList : undefined,
    };

    create(payload, {
      onSuccess: () => {
        toast.show({ type: 'success', message: 'Workout created.' });
        onCreated?.();
        onBack();
      },
      onError: (e) => Alert.alert('Could not create workout', apiErrorText(e)),
    });
  };

  return (
    <FormPage eyebrow="Training" title="New Workout" onBack={onBack} submitLabel="Create Workout" onSubmit={submit} submitting={isPending}>
      <Field label="Name *" value={name} onChangeText={setName} placeholder="e.g. Upper Body Power" error={errors.name} autoCapitalize="words" />
      <Field label="Description" value={description} onChangeText={setDescription} placeholder="What this session covers" multiline />

      <RowGrid>
        <GridCell>
          <Field label="Category" value={category} onChangeText={setCategory} placeholder="e.g. Strength" autoCapitalize="words" />
        </GridCell>
        <GridCell>
          <Field label="Duration (min)" value={duration} onChangeText={setDuration} placeholder="45" keyboardType="number-pad" error={errors.duration} />
        </GridCell>
      </RowGrid>

      <ChipSelect label="Goal" value={goal} onChange={setGoal} options={WORKOUT_GOALS.map((g, i) => ({ value: i, label: humanize(g) }))} />
      <ChipSelect label="Difficulty" value={difficulty} onChange={setDifficulty} options={WORKOUT_DIFFICULTIES.map((d, i) => ({ value: i, label: d }))} />

      <Field label="Tags" value={tags} onChangeText={setTags} placeholder="Comma separated, e.g. push, hypertrophy" autoCapitalize="none" />
      <SwitchRow label="Public" description="Visible to every member of the gym" value={isPublic} onValueChange={setIsPublic} />

      <Text style={{ color: T.textFaint, fontSize: 12 }}>
        Exercises can't be attached yet — the workouts API only stores the workout's details.
      </Text>
    </FormPage>
  );
}
