import React, { useRef, useState } from 'react';
import { View, Text, Modal, Pressable, ScrollView, TextInput, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, SP, R, withAlpha } from '../../../theme';
import Avatar from '../../common/components/Avatar';
import { useToast } from '../../common/components/Toast';
import { apiErrorText } from '../../../api/apiError';
import { useMe } from '../../auth/api/authQueries';
import { SOCIAL_LIMITS, SocialPickedImage } from '../api/social.types';
import { useCreatePost } from '../api/socialQueries';

const mb = (b: number) => `${Math.round(b / (1024 * 1024))} MB`;

function mimeOf(a: ImagePicker.ImagePickerAsset): string {
  if (a.mimeType) return a.mimeType.toLowerCase();
  const ext = (a.fileName ?? a.uri).split('?')[0].split('.').pop()?.toLowerCase();
  return ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'unknown';
}

/** Full-screen composer: pick photos, preview/remove them, write a caption, publish with progress. */
export default function CreatePostModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const me = useMe();
  const create = useCreatePost();
  const [images, setImages] = useState<SocialPickedImage[]>([]);
  const [caption, setCaption] = useState('');
  const [problems, setProblems] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const sending = useRef(false);   // second guard against a double tap before React re-renders

  const busy = create.isPending;
  const left = SOCIAL_LIMITS.caption - caption.length;
  const captionBad = left < 0;
  const canPublish = images.length > 0 && !captionBad && !busy;

  const reset = () => { setImages([]); setCaption(''); setProblems([]); setProgress(0); };
  const close = () => { if (busy) return; reset(); onClose(); };

  const pick = async () => {
    const room = SOCIAL_LIMITS.images - images.length;
    if (room <= 0) { setProblems([`You can add up to ${SOCIAL_LIMITS.images} photos.`]); return; }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { setProblems(['Allow photo library access to choose pictures.']); return; }
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: room,
      quality: 0.75,   // re-encodes on pick, which keeps uploads small
    });
    if (r.canceled) return;

    const errs: string[] = [];
    const next = [...images];
    for (const a of r.assets) {
      const name = a.fileName ?? 'A photo';
      const type = mimeOf(a);
      if (!(SOCIAL_LIMITS.formats as readonly string[]).includes(type)) { errs.push(`${name}: only JPEG, PNG and WEBP are allowed.`); continue; }
      if (a.fileSize && a.fileSize > SOCIAL_LIMITS.imageBytes) { errs.push(`${name} is over ${mb(SOCIAL_LIMITS.imageBytes)}.`); continue; }
      if (next.some(x => x.uri === a.uri)) continue;
      if (next.length >= SOCIAL_LIMITS.images) { errs.push(`Only ${SOCIAL_LIMITS.images} photos fit in a post.`); break; }
      next.push({ uri: a.uri, mimeType: type, fileName: a.fileName, width: a.width, height: a.height, fileSize: a.fileSize });
    }
    setImages(next);
    setProblems(errs);
  };

  const publish = () => {
    if (!canPublish || sending.current) return;
    sending.current = true;
    setProblems([]);
    setProgress(0);
    create.mutate({ caption: caption.trim(), images, onProgress: setProgress }, {
      onSuccess: () => { sending.current = false; reset(); onClose(); toast.show({ message: 'Post published' }); },
      onError: e => { sending.current = false; setProblems([apiErrorText(e)]); },
    });
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close} presentationStyle="fullScreen">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: T.bg, paddingTop: Math.max(insets.top, 12) }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SP.lg, height: 52, borderBottomWidth: 1, borderBottomColor: T.line }}>
          <Pressable onPress={close} disabled={busy} hitSlop={10} accessibilityRole="button" accessibilityLabel="Cancel" style={{ minWidth: 64, minHeight: 44, justifyContent: 'center' }}>
            <Text style={{ color: busy ? T.textFaint : T.textSub, fontSize: 15 }}>Cancel</Text>
          </Pressable>
          <Text accessibilityRole="header" style={{ color: T.text, fontSize: 16, fontWeight: '800' }}>New post</Text>
          <Pressable onPress={publish} disabled={!canPublish} hitSlop={10} accessibilityRole="button" accessibilityLabel="Share post" style={{ minWidth: 64, minHeight: 44, justifyContent: 'center', alignItems: 'flex-end' }}>
            <Text style={{ color: canPublish ? T.brand : T.textFaint, fontSize: 15, fontWeight: '800' }}>{busy ? 'Sharing…' : 'Share'}</Text>
          </Pressable>
        </View>

        {busy && (
          <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }} style={{ height: 3, backgroundColor: T.bgInputActive }}>
            <View style={{ height: 3, width: `${Math.max(4, Math.round(progress * 100))}%`, backgroundColor: T.brand }} />
          </View>
        )}

        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: SP.lg, paddingBottom: 60, gap: SP.lg, maxWidth: 640, width: '100%', alignSelf: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.md }}>
            <Avatar uri={me.data?.avatarUrl} size={40} borderColor={T.brand} borderWidth={2} />
            <Text style={{ color: T.text, fontSize: 15, fontWeight: '700' }}>{[me.data?.firstName, me.data?.lastName].filter(Boolean).join(' ') || 'You'}</Text>
          </View>

          {/* Photos */}
          {images.length === 0 ? (
            <Pressable
              onPress={pick}
              accessibilityRole="button"
              accessibilityLabel="Choose photos"
              style={({ pressed }) => ({ height: 220, borderRadius: R.xl, borderWidth: 1.5, borderStyle: 'dashed', borderColor: T.brandBorder, backgroundColor: pressed ? withAlpha(T.brand, 0.14) : T.brandDim, alignItems: 'center', justifyContent: 'center', gap: 8 })}
            >
              <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: withAlpha(T.brand, 0.18), alignItems: 'center', justifyContent: 'center' }}>
                <Feather name="image" size={26} color={T.brand} />
              </View>
              <Text style={{ color: T.text, fontSize: 15, fontWeight: '800' }}>Add photos</Text>
              <Text style={{ color: T.textSub, fontSize: 12 }}>JPEG, PNG or WEBP · up to {SOCIAL_LIMITS.images} · {mb(SOCIAL_LIMITS.imageBytes)} each</Text>
            </Pressable>
          ) : (
            <View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SP.sm }}>
                {images.map((img, i) => (
                  <View key={img.uri} style={{ width: 132, height: 165, borderRadius: R.lg, overflow: 'hidden', backgroundColor: T.bgInputActive }}>
                    <Image source={{ uri: img.uri }} accessibilityLabel={`Selected photo ${i + 1}`} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    {i === 0 && (
                      <View style={{ position: 'absolute', left: 6, bottom: 6, paddingHorizontal: 7, paddingVertical: 2, borderRadius: R.pill, backgroundColor: withAlpha(T.black, 0.65) }}>
                        <Text style={{ color: T.text, fontSize: 10, fontWeight: '800' }}>COVER</Text>
                      </View>
                    )}
                    <Pressable
                      onPress={() => setImages(list => list.filter(x => x.uri !== img.uri))}
                      disabled={busy}
                      hitSlop={6}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove photo ${i + 1}`}
                      style={{ position: 'absolute', top: 6, right: 6, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: withAlpha(T.black, 0.7) }}
                    >
                      <Feather name="x" size={15} color={T.text} />
                    </Pressable>
                  </View>
                ))}
                {images.length < SOCIAL_LIMITS.images && (
                  <Pressable onPress={pick} disabled={busy} accessibilityRole="button" accessibilityLabel="Add more photos" style={{ width: 132, height: 165, borderRadius: R.lg, borderWidth: 1.5, borderStyle: 'dashed', borderColor: T.brandBorder, backgroundColor: T.brandDim, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <Feather name="plus" size={24} color={T.brand} />
                    <Text style={{ color: T.brand, fontSize: 12, fontWeight: '700' }}>Add more</Text>
                  </Pressable>
                )}
              </ScrollView>
              <Text style={{ color: T.textFaint, fontSize: 12, marginTop: 8 }}>{images.length} of {SOCIAL_LIMITS.images} photos</Text>
            </View>
          )}

          {/* Caption */}
          <View>
            <TextInput
              value={caption}
              onChangeText={setCaption}
              editable={!busy}
              multiline
              placeholder="Write a caption…"
              placeholderTextColor={T.textFaint}
              accessibilityLabel="Caption"
              style={{ minHeight: 110, color: T.text, fontSize: 15, lineHeight: 21, textAlignVertical: 'top', padding: SP.md, borderRadius: R.lg, borderWidth: 1, borderColor: captionBad ? T.err : T.line, backgroundColor: T.bgInput }}
            />
            <Text style={{ alignSelf: 'flex-end', marginTop: 4, fontSize: 12, color: captionBad ? T.err : left < 200 ? T.textSub : T.textFaint }}>
              {caption.length}/{SOCIAL_LIMITS.caption}
            </Text>
          </View>

          {problems.length > 0 && (
            <View accessibilityRole="alert" style={{ padding: SP.md, borderRadius: R.md, backgroundColor: withAlpha(T.err, 0.1), borderWidth: 1, borderColor: withAlpha(T.err, 0.3), gap: 4 }}>
              {problems.map(p => <Text key={p} style={{ color: T.err, fontSize: 13 }}>{p}</Text>)}
            </View>
          )}

          <Pressable
            onPress={publish}
            disabled={!canPublish}
            accessibilityRole="button"
            style={{ height: 52, borderRadius: R.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: canPublish ? T.brand : T.bgInputActive }}
          >
            <Text style={{ color: canPublish ? T.onBrand : T.textFaint, fontSize: 15, fontWeight: '800' }}>
              {busy ? `Uploading ${Math.round(progress * 100)}%` : 'Share post'}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
