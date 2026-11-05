import React, { useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Feather } from '@expo/vector-icons';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import Avatar from '../../common/components/Avatar';
import EmptyState from '../../common/components/EmptyState';
import { T, SP, R, Shadow, withAlpha } from '../../../theme';
import { useMe } from '../../auth/api/authQueries';
import { useToast } from '../../common/components/Toast';
import { ENDPOINTS } from '../../../api/endpoints';
import { queryKeys } from '../../../api/queryKeys';
import { uploadFile, PickedFile } from '../../../api/upload';
import { apiErrorText } from '../../../api/apiError';
import DetailRow from '../../common/components/DetailRow';


function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{
      backgroundColor: T.bgInput, borderRadius: R.lg, borderWidth: 1, borderColor: T.line,
      paddingHorizontal: SP.lg, marginBottom: SP.lg,
    }}>
      <Text style={{
        color: T.textSub, fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase',
        paddingTop: SP.md, paddingBottom: 4,
      }}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function Divider() {
  return <View style={{ height: 1, backgroundColor: T.lineSubtle }} />;
}

interface Props {
  onBack: () => void;
  roleLabel: string;
}

/** Full-page view of everything known about the signed-in admin/staff user. */
export default function AdminProfileDetailsPage({ onBack, roleLabel }: Props) {
  const { data: profile, isLoading, isError, refetch } = useMe();
  const toast = useToast();
  const qc = useQueryClient();
  const [localUri, setLocalUri] = useState<string | null>(null);
  const upload = useMutation({
    mutationFn: (file: PickedFile) => uploadFile<{ url: string }>(`${ENDPOINTS.MEMBERS}/${profile!.userId}/photo`, 'photo', file),
    onSuccess: res => {
      if (!res.success) { setLocalUri(null); toast.show({ type: 'error', message: res.message || 'Photo not saved.' }); return; }
      qc.invalidateQueries({ queryKey: queryKeys.auth.me });
      toast.show({ message: 'Profile photo updated' });
    },
    onError: e => { setLocalUri(null); toast.show({ type: 'error', message: apiErrorText(e) }); },
  });
  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { toast.show({ type: 'error', message: 'Allow photo library access to change your photo.' }); return; }
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    const a = r.canceled ? undefined : r.assets[0];
    if (!a?.uri) return;
    setLocalUri(a.uri);
    upload.mutate({ uri: a.uri, mimeType: a.mimeType, fileName: a.fileName });
  };
  const fullName = profile ? `${profile.firstName} ${profile.lastName}`.trim() : '';

  return (
    <Screen>
      <ScreenHeader title="Profile details" eyebrow="Account" onBack={onBack} />

      {isLoading && (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={T.brand} />
        </View>
      )}

      {!isLoading && isError && (
        <EmptyState
          icon="alert-triangle"
          tone="error"
          title="Couldn't load your profile"
          subtitle="Check your connection and try again."
          action={{ label: 'Try again', onPress: () => refetch() }}
        />
      )}

      {!isLoading && !isError && profile && (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: SP.xl, paddingBottom: SP.xxl }}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero: avatar + name + role */}
          <View style={{ alignItems: 'center', marginVertical: SP.lg }}>
            <Pressable onPress={pickPhoto} disabled={upload.isPending} accessibilityRole="button" accessibilityLabel="Change profile photo" accessibilityState={{ busy: upload.isPending }}>
              <Avatar uri={localUri ?? profile.avatarUrl} size={100} borderWidth={3} borderColor={T.brand} style={Shadow.neon} />
              {upload.isPending && (
                <View style={{ position: 'absolute', top: 0, left: 0, width: 100, height: 100, borderRadius: 50, backgroundColor: withAlpha(T.black, 0.55), alignItems: 'center', justifyContent: 'center' }}>
                  <ActivityIndicator color={T.brand} />
                </View>
              )}
              <View style={{ position: 'absolute', bottom: 2, right: 2, width: 30, height: 30, borderRadius: 15, backgroundColor: T.brand, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: T.bg }}>
                <Feather name="camera" size={14} color={T.onBrand} />
              </View>
            </Pressable>
            <Text style={{ color: T.textFaint, fontSize: 12, marginTop: 6 }}>Tap to change photo</Text>

            <Text style={{ color: T.text, fontSize: 21, fontWeight: '800', marginTop: SP.md, letterSpacing: -0.3 }}>
              {fullName || 'Unnamed user'}
            </Text>

            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8,
              backgroundColor: T.brandDim, borderWidth: 1, borderColor: T.brandBorder,
              borderRadius: R.pill, paddingHorizontal: 10, paddingVertical: 4,
            }}>
              <Feather name="shield" size={11} color={T.brand} />
              <Text style={{ color: T.brand, fontSize: 11, fontWeight: '700' }}>{roleLabel}</Text>
            </View>
          </View>

          {/* Contact */}
          <Section title="Contact">
            <DetailRow icon="mail" label="Email" value={profile.email} />
            <Divider />
            <DetailRow icon="phone" label="Phone" value={profile.phone || 'Not set'} />
          </Section>

          {/* Account */}
          <Section title="Account">
            <DetailRow
              icon={profile.isEmailVerified ? 'check-circle' : 'alert-circle'}
              label="Email status"
              value={profile.isEmailVerified ? 'Verified' : 'Not verified'}
            />
            <Divider />
            <DetailRow icon="shield" label="Role" value={roleLabel} />
          </Section>
        </ScrollView>
      )}
    </Screen>
  );
}
