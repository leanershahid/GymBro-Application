import React, { useState } from 'react';
import { ActivityIndicator, Image, Linking, Platform, Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { T, R, withAlpha } from '../../../theme';
import { uploadFile } from '../../../api/upload';
import { describeApiError } from '../../../api/apiError';

type Folder = 'logos' | 'avatars' | 'documents' | 'media';

interface Props {
  label: string;
  /** The stored file's URL ('' or undefined when empty). */
  value?: string | null;
  onChange: (url: string) => void;
  /** Where the file goes (POST /uploads?folder=…). */
  folder: Folder;
  /** "image" previews the picture; "document" shows a file chip that opens it. */
  kind?: 'image' | 'document';
  /** Image preview shape. */
  shape?: 'square' | 'circle';
  /** Crop to a square while picking (logos, photos). */
  square?: boolean;
  hint?: string;
  error?: string;
}

const isUrl = (v?: string | null) => !!v && /^https?:\/\//i.test(v);

/**
 * Pick a picture from the device and upload it (to Cloudinary, via the server) instead of typing a
 * URL. The field's value is still the file's URL, so forms and the API don't change.
 */
export default function UploadField({ label, value, onChange, folder, kind = 'image', shape = 'square', square = true, hint, error }: Props) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const has = isUrl(value);

  const pick = async () => {
    setFailed(null);
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { setFailed('Allow photo access to upload.'); return; }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: kind === 'image' && square,
      aspect: [1, 1],
      quality: 0.85,
    });
    const asset = result.canceled ? null : result.assets[0];
    if (!asset?.uri) return;

    setBusy(true);
    try {
      const res = await uploadFile<{ url: string }>(
        `/uploads?kind=${kind}&folder=${folder}`, 'file',
        { uri: asset.uri, mimeType: asset.mimeType, fileName: asset.fileName },
      );
      if (res.success && res.data?.url) onChange(res.data.url);
      else setFailed(res.message || "Couldn't upload this file.");
    } catch (e) {
      setFailed(describeApiError(e).message);
    } finally {
      setBusy(false);
    }
  };

  const size = 72;
  const message = failed ?? error;

  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ color: T.textSub, fontSize: 13, fontWeight: '600', marginBottom: 8 }}>{label}</Text>
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, borderRadius: R.lg,
        backgroundColor: T.bgInput, borderWidth: 1, borderColor: message ? withAlpha(T.err, 0.5) : T.line,
      }}>
        {kind === 'image' ? (
          <View style={{
            width: size, height: size, borderRadius: shape === 'circle' ? size / 2 : 14, overflow: 'hidden',
            alignItems: 'center', justifyContent: 'center', backgroundColor: withAlpha(T.textFaint, 0.12),
          }}>
            {has
              ? <Image source={{ uri: value! }} style={{ width: size, height: size }} accessibilityLabel={`${label} preview`} />
              : <Feather name="image" size={24} color={T.textFaint} />}
          </View>
        ) : (
          <View style={{ width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: has ? T.brandDim : withAlpha(T.textFaint, 0.12) }}>
            <Feather name={has ? 'file-text' : 'file'} size={22} color={has ? T.brand : T.textFaint} />
          </View>
        )}

        <View style={{ flex: 1, gap: 8 }}>
          <Text numberOfLines={1} style={{ color: has ? T.text : T.textFaint, fontSize: 13 }}>
            {busy ? 'Uploading…' : has ? (kind === 'document' ? 'File uploaded' : 'Uploaded') : hint ?? 'No file yet'}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Pressable
              onPress={pick}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={has ? `Change ${label}` : `Upload ${label}`}
              accessibilityState={{ busy, disabled: busy }}
              style={({ pressed }) => ({
                minHeight: 40, paddingHorizontal: 14, borderRadius: 999, flexDirection: 'row', alignItems: 'center', gap: 6,
                backgroundColor: pressed ? T.brandDark : T.brand, opacity: busy ? 0.6 : 1,
              })}
            >
              {busy ? <ActivityIndicator size="small" color={T.onBrand} /> : <Feather name="upload" size={15} color={T.onBrand} />}
              <Text style={{ color: T.onBrand, fontSize: 13, fontWeight: '800' }}>{has ? 'Change' : 'Upload'}</Text>
            </Pressable>
            {has && kind === 'document' && (
              <Pressable onPress={() => Linking.openURL(value!)} accessibilityRole="link" accessibilityLabel={`Open ${label}`}
                style={{ minHeight: 40, paddingHorizontal: 14, borderRadius: 999, justifyContent: 'center', borderWidth: 1, borderColor: T.line }}>
                <Text style={{ color: T.text, fontSize: 13, fontWeight: '700' }}>Open</Text>
              </Pressable>
            )}
            {has && !busy && (
              <Pressable onPress={() => onChange('')} accessibilityRole="button" accessibilityLabel={`Remove ${label}`}
                style={{ minHeight: 40, paddingHorizontal: 12, borderRadius: 999, justifyContent: 'center' }}>
                <Text style={{ color: T.err, fontSize: 13, fontWeight: '700' }}>Remove</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
      {!!message && <Text style={{ color: T.err, fontSize: 12, marginTop: 6 }}>{message}</Text>}
    </View>
  );
}
