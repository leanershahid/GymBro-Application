import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, Pressable,
  Platform, Alert, Image, TouchableOpacity, KeyboardAvoidingView, ActivityIndicator,
} from 'react-native';

import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useMyProfile, useMyTimeline, useUpdateProfile, useUploadPhoto, useAssignedTrainer } from '../api/memberAppQueries';
import { T, withAlpha } from '../../../theme';
import Screen from '../../common/components/Screen';
import SegmentedTabs from '../../common/components/SegmentedTabs';
import PrimaryButton from '../../common/components/PrimaryButton';
import LoadingState from '../../common/components/LoadingState';
import StatusPill from '../../common/components/StatusPill';
import EmptyState from '../../dashboard/components/EmptyState';
import { Field, RowGrid, GridCell } from '../../trainers/components/FormFields';
import ChangePasswordSheet from '../../auth/components/ChangePasswordSheet';
import { PickedFile } from '../../../api/upload';
import { apiErrorText } from '../../../api/apiError';
import AppSwitcher from '../../access/components/AppSwitcher';

function AvatarPicker({ uri, initials, onPick, uploading }: { uri?: string | null; initials: string; onPick: (f: PickedFile) => void; uploading?: boolean }) {
  const pick = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    const asset = result.canceled ? undefined : result.assets[0];
    if (asset?.uri) onPick({ uri: asset.uri, mimeType: asset.mimeType, fileName: asset.fileName });
  };

  return (
    <TouchableOpacity onPress={pick} activeOpacity={0.8} disabled={uploading}
      accessibilityRole="button"
      accessibilityState={{ busy: !!uploading }}
      accessibilityLabel="Change profile photo"
      style={{ alignItems: 'center', marginBottom: 12 }}>
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: 88, height: 88, borderRadius: 44, borderWidth: 2, borderColor: T.brand }}
        />
      ) : (
        <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: withAlpha(T.brand, 0.12), borderWidth: 2, borderColor: T.brand, alignItems: 'center', justifyContent: 'center' }}>
          {initials
            ? <Text style={{ color: T.brand, fontSize: 28, fontWeight: '800' }}>{initials}</Text>
            : <Feather name="user" size={32} color={T.brand} />}
        </View>
      )}
      {uploading && (
        <View style={{ position: 'absolute', top: 0, width: 88, height: 88, borderRadius: 44, backgroundColor: withAlpha(T.black, 0.55), alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={T.brand} />
        </View>
      )}
      {/* camera badge */}
      <View style={{ position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, borderRadius: 13, backgroundColor: T.brand, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: T.bg }}>
        <Feather name="camera" size={12} color={T.onBrand} />
      </View>
    </TouchableOpacity>
  );
}

function TimelineRow({ event }: { event: { eventType: string; description: string; occurredAt: string } }) {
  const icons: Record<string, string> = {
    WorkoutCompleted: 'activity', CheckIn: 'log-in', Payment: 'credit-card',
    PlanAssigned: 'book-open', default: 'circle',
  };
  const icon = (icons[event.eventType] ?? icons.default) as any;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 }}>
      <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: withAlpha(T.brand, 0.10), borderWidth: 1, borderColor: withAlpha(T.brand, 0.22), alignItems: 'center', justifyContent: 'center', marginRight: 12, marginTop: 2 }}>
        <Feather name={icon} size={14} color={T.brand} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: T.text, fontSize: 13, fontWeight: '600' }}>{event.description}</Text>
        <Text style={{ color: T.textFaint, fontSize: 11, marginTop: 3 }}>
          {new Date(event.occurredAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    </View>
  );
}

interface Props { userId: number; onLogout: () => void; onOpenBilling?: () => void; }

export default function ProfileScreen({ userId, onLogout, onOpenBilling }: Props) {
  const { data: profile, isLoading } = useMyProfile(userId);
  const { data: timeline = [] }      = useMyTimeline(userId);
  const { mutate: update, isPending } = useUpdateProfile(userId);
  const { mutate: uploadPhoto, isPending: uploading } = useUploadPhoto(userId);
  const { data: trainer }            = useAssignedTrainer(profile?.trainerId);

  const [pwOpen, setPwOpen] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName,  setLastName]  = useState('');
  const [phone,     setPhone]     = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [editing,   setEditing]   = useState(false);
  const [tab,       setTab]       = useState<'info' | 'timeline'>('info');

  useEffect(() => {
    if (profile) {
      setFirstName(profile.firstName);
      setLastName(profile.lastName);
      setPhone(profile.phone ?? '');
      setAvatarUri(profile.avatarUrl ?? null);
    }
  }, [profile]);

  // Photos upload as soon as they're picked; the preview shows the local file meanwhile.
  const handlePhoto = (file: PickedFile) => {
    const previous = avatarUri;
    setAvatarUri(file.uri);
    uploadPhoto(file, {
      onSuccess: res => {
        if (res.success && res.data?.url) setAvatarUri(res.data.url);
        else { setAvatarUri(previous); Alert.alert('Photo not saved', res.message ?? 'Upload failed.'); }
      },
      onError: e => { setAvatarUri(previous); Alert.alert('Photo not saved', apiErrorText(e)); },
    });
  };

  const handleSave = () => {
    update({ firstName: firstName.trim(), lastName: lastName.trim(), phone: phone || undefined }, {
      onSuccess: res => {
        if (res.success) { Alert.alert('Saved ✓', 'Profile updated.'); setEditing(false); }
        else             { Alert.alert('Error', res.message ?? 'Update failed.'); }
      },
      onError: () => Alert.alert('Error', 'Failed to connect to server.'),
    });
  };

  if (isLoading) return <LoadingState fullScreen label="Loading profile" />;

  const initials = `${profile?.firstName?.[0] ?? ''}${profile?.lastName?.[0] ?? ''}`.toUpperCase();
  // Chips show real names only — hidden when the name isn't available.
  const trainerName = trainer?.displayName?.trim() || null;
  const branchName  = profile?.branchId ? profile.branchName?.trim() || null : null;

  return (
    <Screen>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 60 }}>

        {/* ── Avatar / name header ── */}
        <View style={{ alignItems: 'center', paddingTop: 32, paddingBottom: 24, paddingHorizontal: 20 }}>
          <AvatarPicker
            uri={avatarUri}
            initials={initials}
            onPick={handlePhoto}
            uploading={uploading}
          />
          <Text numberOfLines={1} style={{ color: T.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.4 }}>
            {profile?.firstName} {profile?.lastName}
          </Text>
          <Text numberOfLines={1} style={{ color: T.textSub, fontSize: 13, marginTop: 4 }}>{profile?.email}</Text>

          {/* Status badge */}
          {!!profile?.status && (
          <View style={{ marginTop: 10, alignSelf: 'center' }}>
            <StatusPill label={profile.status} tone={profile.status === 'Active' ? 'brand' : 'neutral'} />
          </View>
          )}

          {/* Trainer / Branch badges */}
          {(!!trainerName || !!branchName) && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 10 }}>
              {!!trainerName && (
                <View accessible accessibilityLabel={`Trainer: ${trainerName}`} style={{ backgroundColor: withAlpha(T.sky, 0.10), borderWidth: 1, borderColor: withAlpha(T.sky, 0.25), borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Feather name="award" size={12} color={T.sky} />
                  <Text style={{ color: T.sky, fontSize: 11, fontWeight: '700' }}>{trainerName}</Text>
                </View>
              )}
              {!!branchName && (
                <View accessible accessibilityLabel={`Branch: ${branchName}`} style={{ backgroundColor: withAlpha(T.violet, 0.10), borderWidth: 1, borderColor: withAlpha(T.violet, 0.25), borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Feather name="map-pin" size={12} color={T.violet} />
                  <Text style={{ color: T.violet, fontSize: 11, fontWeight: '700' }}>{branchName}</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* ── Tab switcher ── */}
        <SegmentedTabs
          tabs={[{ key: 'info', label: 'Info' }, { key: 'timeline', label: 'Timeline' }]}
          value={tab}
          onChange={setTab}
          style={{ marginHorizontal: 20, marginBottom: 24 }}
        />

        {/* ── Info tab ── */}
        {tab === 'info' && (
          <View style={{ paddingHorizontal: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <Text style={{ color: T.text, fontSize: 16, fontWeight: '700' }}>Personal Info</Text>
              {!editing && (
                <Pressable onPress={() => setEditing(true)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Edit personal info"
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, backgroundColor: T.bgInput, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: T.line }}>
                  <Feather name="edit-2" size={14} color={T.textSub} />
                  <Text style={{ color: T.textSub, fontSize: 12, fontWeight: '700' }}>Edit</Text>
                </Pressable>
              )}
            </View>
            <RowGrid>
              <GridCell>
                <Field label="First Name" value={firstName} onChangeText={setFirstName} editable={editing} autoCapitalize="words" autoCorrect={false} />
              </GridCell>
              <GridCell>
                <Field label="Last Name" value={lastName} onChangeText={setLastName} editable={editing} autoCapitalize="words" autoCorrect={false} />
              </GridCell>
            </RowGrid>
            <Field label="Email" value={profile?.email ?? ''} onChangeText={() => {}} editable={false} />
            <Field label="Phone" value={phone} onChangeText={setPhone} placeholder="+91..." keyboardType="phone-pad" editable={editing} autoCapitalize="none" autoCorrect={false} />
            <Field label="Date of Birth" value={profile?.dob ?? '—'} onChangeText={() => {}} editable={false} />
            <Field label="Gender" value={profile?.gender ?? '—'} onChangeText={() => {}} editable={false} />
            <Field label="Member Since" value={profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'} onChangeText={() => {}} editable={false} />

            {editing && (
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
                <PrimaryButton label="Cancel" variant="secondary" onPress={() => setEditing(false)} disabled={isPending} style={{ flex: 1 }} />
                <PrimaryButton label="Save" icon="check" onPress={handleSave} loading={isPending} style={{ flex: 1 }} />
              </View>
            )}

            {onOpenBilling && (
              <PrimaryButton
                label="Membership & payments"
                icon="credit-card"
                variant="secondary"
                style={{ marginTop: 24 }}
                onPress={onOpenBilling}
              />
            )}
            <PrimaryButton
              label="Change password"
              icon="lock"
              variant="secondary"
              style={{ marginTop: onOpenBilling ? 12 : 24 }}
              onPress={() => setPwOpen(true)}
            />
            <ChangePasswordSheet visible={pwOpen} onClose={() => setPwOpen(false)} onChanged={onLogout} />

            <AppSwitcher />

            {/* Logout */}
            <PrimaryButton
              label="Sign Out"
              icon="log-out"
              variant="danger"
              style={{ marginTop: 12 }}
              onPress={() => Alert.alert('Sign out', 'Are you sure?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Sign out', style: 'destructive', onPress: onLogout },
              ])}
            />
          </View>
        )}

        {/* ── Timeline tab ── */}
        {tab === 'timeline' && (
          <View style={{ paddingHorizontal: 20 }}>
            <Text style={{ color: T.text, fontSize: 16, fontWeight: '700', marginBottom: 16 }}>Activity Timeline</Text>
            {timeline.length === 0 ? (
              <EmptyState icon="clock" title="No activity yet" />
            ) : (
              timeline.slice(0, 20).map((ev, i) => <TimelineRow key={i} event={ev} />)
            )}
          </View>
        )}

      </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
