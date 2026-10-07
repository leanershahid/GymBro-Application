import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput,
  StatusBar, Platform, ActivityIndicator, Alert, Image, TouchableOpacity,
} from 'react-native';

import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useMyProfile, useMyTimeline, useUpdateProfile } from '../api/memberAppQueries';
import { T, withAlpha } from '../../../theme';

function AvatarPicker({ uri, initials, onPick }: { uri?: string | null; initials: string; onPick: (u: string) => void }) {
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
    if (!result.canceled && result.assets[0]?.uri) onPick(result.assets[0].uri);
  };

  return (
    <TouchableOpacity onPress={pick} activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel="Change profile photo"
      style={{ alignItems: 'center', marginBottom: 12 }}>
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: 88, height: 88, borderRadius: 44, borderWidth: 2, borderColor: T.brand }}
        />
      ) : (
        <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: withAlpha(T.brand, 0.12), borderWidth: 2, borderColor: T.brand, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: T.brand, fontSize: 28, fontWeight: '800' }}>{initials}</Text>
        </View>
      )}
      {/* camera badge */}
      <View style={{ position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, borderRadius: 13, backgroundColor: T.brand, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: T.bg }}>
        <Feather name="camera" size={12} color={T.onBrand} />
      </View>
    </TouchableOpacity>
  );
}

function Field({ label, value, onChange, placeholder, keyboardType, editable = true }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; keyboardType?: any; editable?: boolean;
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ color: T.textSub, fontSize: 12, fontWeight: '600', marginBottom: 6 }}>{label}</Text>
      <TextInput
        style={{
          backgroundColor: editable ? T.bgInputActive : T.bgInput, borderRadius: 14,
          borderWidth: 1, borderColor: editable ? T.line : T.bgInputActive,
          color: editable ? T.text : T.textFaint,
          paddingHorizontal: 14, paddingVertical: 13, fontSize: 14,
        }}
        value={value} onChangeText={onChange}
        placeholder={placeholder ?? ''} placeholderTextColor={T.textFaint}
        keyboardType={keyboardType ?? 'default'}
        autoCapitalize="none" autoCorrect={false}
        editable={editable}
      />
    </View>
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

interface Props { userId: number; onLogout: () => void; }

export default function ProfileScreen({ userId, onLogout }: Props) {
  const { data: profile, isLoading } = useMyProfile(userId);
  const { data: timeline = [] }      = useMyTimeline(userId);
  const { mutate: update, isPending } = useUpdateProfile(userId);

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

  const handleSave = () => {
    update({ firstName: firstName.trim(), lastName: lastName.trim(), phone: phone || undefined }, {
      onSuccess: res => {
        if (res.success) { Alert.alert('Saved ✓', 'Profile updated.'); setEditing(false); }
        else             { Alert.alert('Error', res.message ?? 'Update failed.'); }
      },
      onError: () => Alert.alert('Error', 'Failed to connect to server.'),
    });
  };

  if (isLoading) return (
    <View className="flex-1 bg-bg items-center justify-center">
      <ActivityIndicator size="large" color={T.brand} />
    </View>
  );

  const initials = `${profile?.firstName?.[0] ?? ''}${profile?.lastName?.[0] ?? ''}`.toUpperCase() || 'M';

  return (
    <View className="flex-1 bg-bg" style={{ paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 0 }}>
      <StatusBar barStyle="light-content" backgroundColor={T.bg} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>

        {/* ── Avatar / name header ── */}
        <View style={{ alignItems: 'center', paddingTop: 32, paddingBottom: 24, paddingHorizontal: 20 }}>
          <AvatarPicker
            uri={avatarUri}
            initials={initials}
            onPick={(uri) => setAvatarUri(uri)}
          />
          <Text style={{ color: T.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.4 }}>
            {profile?.firstName} {profile?.lastName}
          </Text>
          <Text style={{ color: T.textSub, fontSize: 13, marginTop: 4 }}>{profile?.email}</Text>

          {/* Status badge */}
          <View style={{ marginTop: 10, backgroundColor: profile?.status === 'Active' ? withAlpha(T.brand, 0.12) : T.bgInput, borderWidth: 1, borderColor: profile?.status === 'Active' ? withAlpha(T.brand, 0.30) : T.line, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 }}>
            <Text style={{ color: profile?.status === 'Active' ? T.brand : T.textSub, fontSize: 11, fontWeight: '700' }}>
              {profile?.status ?? 'Member'}
            </Text>
          </View>

          {/* Trainer / Branch badges */}
          {(!!profile?.trainerId || !!profile?.branchId) && (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              {!!profile?.trainerId && (
                <View style={{ backgroundColor: withAlpha(T.sky, 0.10), borderWidth: 1, borderColor: withAlpha(T.sky, 0.25), borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Feather name="award" size={12} color={T.sky} />
                  <Text style={{ color: T.sky, fontSize: 11, fontWeight: '700' }}>Trainer #{profile.trainerId}</Text>
                </View>
              )}
              {!!profile?.branchId && (
                <View style={{ backgroundColor: withAlpha(T.violet, 0.10), borderWidth: 1, borderColor: withAlpha(T.violet, 0.25), borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Feather name="map-pin" size={12} color={T.violet} />
                  <Text style={{ color: T.violet, fontSize: 11, fontWeight: '700' }}>{profile.branchName ?? `Branch #${profile.branchId}`}</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* ── Tab switcher ── */}
        <View style={{ flexDirection: 'row', marginHorizontal: 20, backgroundColor: T.bgInput, borderRadius: 16, padding: 4, borderWidth: 1, borderColor: T.bgInputActive, marginBottom: 20 }}>
          {(['info', 'timeline'] as const).map(t => (
            <Pressable key={t} onPress={() => setTab(t)}
              style={{ flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', backgroundColor: tab === t ? T.brand : 'transparent' }}>
              <Text style={{ color: tab === t ? T.onBrand : T.textSub, fontSize: 13, fontWeight: '700', textTransform: 'capitalize' }}>{t}</Text>
            </Pressable>
          ))}
        </View>

        {/* ── Info tab ── */}
        {tab === 'info' && (
          <View style={{ paddingHorizontal: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <Text style={{ color: T.text, fontSize: 16, fontWeight: '700' }}>Personal Info</Text>
              <Pressable onPress={() => editing ? handleSave() : setEditing(true)} disabled={isPending}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: editing ? T.brand : T.bgInput, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: editing ? T.brand : T.line }}>
                {isPending ? <ActivityIndicator size="small" color={T.onBrand} /> : <Feather name={editing ? 'check' : 'edit-2'} size={14} color={editing ? T.onBrand : T.textSub} />}
                <Text style={{ color: editing ? T.onBrand : T.textSub, fontSize: 12, fontWeight: '700' }}>{editing ? 'Save' : 'Edit'}</Text>
              </Pressable>
            </View>
            {editing && (
              <Pressable onPress={() => setEditing(false)} style={{ marginBottom: 12, alignSelf: 'flex-start' }}>
                <Text style={{ color: T.err, fontSize: 12, fontWeight: '600' }}>Cancel</Text>
              </Pressable>
            )}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Field label="First Name" value={firstName} onChange={setFirstName} editable={editing} />
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Last Name" value={lastName} onChange={setLastName} editable={editing} />
              </View>
            </View>
            <Field label="Email" value={profile?.email ?? ''} onChange={() => {}} editable={false} />
            <Field label="Phone" value={phone} onChange={setPhone} placeholder="+91..." keyboardType="phone-pad" editable={editing} />
            <Field label="Date of Birth" value={profile?.dob ?? '—'} onChange={() => {}} editable={false} />
            <Field label="Gender" value={profile?.gender ?? '—'} onChange={() => {}} editable={false} />
            <Field label="Member Since" value={profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'} onChange={() => {}} editable={false} />

            {/* Logout */}
            <Pressable onPress={() => Alert.alert('Sign out', 'Are you sure?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign out', style: 'destructive', onPress: onLogout },
            ])} style={{ marginTop: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: withAlpha(T.err, 0.10), borderWidth: 1, borderColor: withAlpha(T.err, 0.25), borderRadius: 999, paddingVertical: 14 }}>
              <Feather name="log-out" size={16} color={T.err} />
              <Text style={{ color: T.err, fontSize: 14, fontWeight: '700' }}>Sign Out</Text>
            </Pressable>
          </View>
        )}

        {/* ── Timeline tab ── */}
        {tab === 'timeline' && (
          <View style={{ paddingHorizontal: 20 }}>
            <Text style={{ color: T.text, fontSize: 16, fontWeight: '700', marginBottom: 16 }}>Activity Timeline</Text>
            {timeline.length === 0 ? (
              <View style={{ alignItems: 'center', paddingTop: 32 }}>
                <Feather name="clock" size={28} color={T.textDisabled} />
                <Text style={{ color: T.textSub, fontSize: 13, marginTop: 10 }}>No activity yet</Text>
              </View>
            ) : (
              timeline.slice(0, 20).map((ev, i) => <TimelineRow key={i} event={ev} />)
            )}
          </View>
        )}

      </ScrollView>
    </View>
  );
}
