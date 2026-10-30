import React, { useState } from 'react';
import { Text, Pressable, Alert, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useCreateExercise, useMuscles, useUploadExerciseVideo } from '../api/exerciseQueries';
import { EXERCISE_CATEGORIES, DIFFICULTIES, ExercisePayload } from '../types/exercise.types';
import { Field } from '../../trainers/components/FormFields';
import ChipSelect from '../components/ChipSelect';
import FormPage from '../components/FormPage';
import { PickedFile } from '../../../api/upload';
import { currentTenantId } from '../../../api/session';
import { apiErrorText } from '../../../api/apiError';
import { useToast } from '../../common/components/Toast';
import { T, withAlpha } from '../../../theme';

interface Props { onBack: () => void; onCreated?: () => void }

const MAX_VIDEO_BYTES = 110 * 1024 * 1024; // API request limit

export default function AddExercisePage({ onBack, onCreated }: Props) {
  const toast = useToast();
  const { mutateAsync: create, isPending: creating } = useCreateExercise();
  const { mutateAsync: uploadVideo, isPending: uploading } = useUploadExerciseVideo();
  const { data: muscles = [], isLoading: musclesLoading } = useMuscles();

  const [name, setName]                 = useState('');
  const [description, setDescription]   = useState('');
  const [instructions, setInstructions] = useState('');
  const [category, setCategory]         = useState(0);  // Strength
  const [difficulty, setDifficulty]     = useState(0);  // Beginner
  const [muscleIds, setMuscleIds]       = useState<number[]>([]);
  const [tags, setTags]                 = useState('');
  const [video, setVideo]               = useState<(PickedFile & { size?: number }) | null>(null);
  const [errors, setErrors]             = useState<{ name?: string; video?: string }>({});

  const pickVideo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow access to your media library.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], quality: 1 });
    const a = res.canceled ? null : res.assets[0];
    if (!a?.uri) return;
    if (a.fileSize && a.fileSize > MAX_VIDEO_BYTES) {
      setErrors(e => ({ ...e, video: 'Video must be under 110 MB.' }));
      return;
    }
    setErrors(e => ({ ...e, video: undefined }));
    setVideo({ uri: a.uri, mimeType: a.mimeType, fileName: a.fileName, size: a.fileSize });
  };

  const submit = async () => {
    const trimmed = name.trim();
    const errs: typeof errors = {};
    if (!trimmed) errs.name = 'Name is required';
    else if (trimmed.length > 200) errs.name = 'Name must be 200 characters or fewer';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const tagList = tags.split(',').map(t => t.trim()).filter(Boolean);
    const payload: ExercisePayload = {
      tenantId: currentTenantId() || undefined,
      name: trimmed,
      description: description.trim() || undefined,
      instructions: instructions.trim() || undefined,
      category,
      difficulty,
      tags: tagList.length ? tagList : undefined,
      muscleIds: muscleIds.length ? muscleIds : undefined,
    };

    let id: number | undefined;
    try {
      const res = await create(payload);
      id = res.data?.id;
    } catch (e) {
      Alert.alert('Could not create exercise', apiErrorText(e));
      return;
    }

    if (video && id) {
      try {
        await uploadVideo({ id, file: video });
      } catch (e) {
        toast.show({ type: 'error', message: `Exercise created, but the video upload failed. ${apiErrorText(e)}` });
        onCreated?.();
        onBack();
        return;
      }
    }

    toast.show({ type: 'success', message: video && id ? 'Exercise created with video.' : 'Exercise created.' });
    onCreated?.();
    onBack();
  };

  const busy = creating || uploading;

  return (
    <FormPage
      eyebrow="Library"
      title="New Exercise"
      onBack={onBack}
      submitLabel={uploading ? 'Uploading video…' : 'Create Exercise'}
      onSubmit={submit}
      submitting={busy}
    >
      <Field label="Name *" value={name} onChangeText={setName} placeholder="e.g. Barbell Back Squat" error={errors.name} autoCapitalize="words" />
      <Field label="Description" value={description} onChangeText={setDescription} placeholder="Short summary" multiline />
      <Field label="Instructions" value={instructions} onChangeText={setInstructions} placeholder="Step-by-step cues" multiline />

      <ChipSelect
        label="Category"
        value={category}
        onChange={setCategory}
        options={EXERCISE_CATEGORIES.map((c, i) => ({ value: i, label: c }))}
      />
      <ChipSelect
        label="Difficulty"
        value={difficulty}
        onChange={setDifficulty}
        options={DIFFICULTIES.map((d, i) => ({ value: i, label: d }))}
      />

      {musclesLoading ? (
        <ActivityIndicator color={T.brand} style={{ marginBottom: 16 }} />
      ) : muscles.length > 0 ? (
        <ChipSelect
          multiple
          label="Muscle groups"
          value={muscleIds}
          onChange={setMuscleIds}
          options={muscles.map(m => ({ value: m.id, label: m.name }))}
        />
      ) : null}

      <Field label="Tags" value={tags} onChangeText={setTags} placeholder="Comma separated, e.g. legs, compound" autoCapitalize="none" />

      {/* Video (uploaded after the exercise is created) */}
      <Text style={{ color: T.textSub, fontSize: 13, marginBottom: 7 }}>Demo video (optional)</Text>
      <Pressable
        onPress={pickVideo}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={video ? 'Change demo video' : 'Choose demo video'}
        style={{
          flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, marginBottom: 6,
          backgroundColor: video ? withAlpha(T.brand, 0.10) : T.bgInput,
          borderWidth: 1, borderColor: errors.video ? T.err : video ? withAlpha(T.brand, 0.25) : T.line,
        }}>
        <Feather name="video" size={20} color={video ? T.brand : T.textSub} />
        <Text style={{ flex: 1, color: video ? T.text : T.textSub, fontSize: 14 }} numberOfLines={1}>
          {video ? (video.fileName || 'Video selected') : 'Choose a video from your library'}
        </Text>
        {video && (
          <Pressable onPress={() => setVideo(null)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Remove video">
            <Feather name="x" size={18} color={T.textSub} />
          </Pressable>
        )}
      </Pressable>
      {errors.video
        ? <Text style={{ color: T.err, fontSize: 12, marginBottom: 16 }}>{errors.video}</Text>
        : <Text style={{ color: T.textFaint, fontSize: 12, marginBottom: 16 }}>Up to 110 MB. Uploaded right after the exercise is saved.</Text>}
    </FormPage>
  );
}
