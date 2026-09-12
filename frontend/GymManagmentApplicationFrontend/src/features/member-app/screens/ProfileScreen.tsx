import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput,
  StatusBar, Platform, ActivityIndicator, Alert, Image, TouchableOpacity,
} from 'react-native';

import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useMyProfile, useMyTimeline, useUpdateProfile } from '../api/memberAppQueries';

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
          style={{ width: 88, height: 88, borderRadius: 44, borderWidth: 2, borderColor: '#7ED321' }}
        />
      ) : (
        <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: 'rgba(126,211,33,0.12)', borderWidth: 2, borderColor: '#7ED321', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#7ED321', fontSize: 28, fontWeight: '800' }}>{initials}</Text>
        </View>
      )}
      {/* camera badge */}
      <View style={{ position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, borderRadius: 13, backgroundColor: '#7ED321', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#0A0F0A' }}>
        <Feather name="camera" size={12} color="#000" />
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
      <Text style={{ color: '#AAAAAA', fontSize: 12, fontWeight: '600', marginBottom: 6 }}>{label}</Text>
      <TextInput
        style={{
          backgroundColor: editable ? '#1C211C' : '#151915', borderRadius: 14,
          borderWidth: 1, borderColor: editable ? '#242B24' : '#1E1E1E',
          color: editable ? '#FFFFFF' : '#666666',
          paddingHorizontal: 14, paddingVertical: 13, fontSize: 14,
        }}
        value={value} onChangeText={onChange}
        placeholder={placeholder ?? ''} placeholderTextColor="#555"
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
      <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(126,211,33,0.10)', borderWidth: 1, borderColor: 'rgba(126,211,33,0.22)', alignItems: 'center', justifyContent: 'center', marginRight: 12, marginTop: 2 }}>
        <Feather name={icon} size={14} color="#7ED321" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '600' }}>{event.description}</Text>
        <Text style={{ color: '#666666', fontSize: 11, marginTop: 3 }}>
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
      <ActivityIndicator size="large" color="#7ED321" />
    </View>
  );

  const initials = `${profile?.firstName?.[0] ?? ''}${profile?.lastName?.[0] ?? ''}`.toUpperCase() || 'M';

  return (
    <View className="flex-1 bg-bg" style={{ paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 0 }}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0F0A" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>

        {/* ── Avatar / name header ── */}
        <View style={{ alignItems: 'center', paddingTop: 32, paddingBottom: 24, paddingHorizontal: 20 }}>
          <AvatarPicker
            uri={avatarUri}
            initials={initials}
            onPick={(uri) => setAvatarUri(uri)}
          />
          <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '800', letterSpacing: -0.4 }}>
            {profile?.firstName} {profile?.lastName}
          </Text>
          <Text style={{ color: '#AAAAAA', fontSize: 13, marginTop: 4 }}>{profile?.email}</Text>

          {/* Status badge */}
          <View style={{ marginTop: 10, backgroundColor: profile?.status === 'Active' ? 'rgba(126,211,33,0.12)' : '#151915', borderWidth: 1, borderColor: profile?.status === 'Active' ? 'rgba(126,211,33,0.30)' : '#242B24', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 }}>
            <Text style={{ color: profile?.status === 'Active' ? '#7ED321' : '#AAAAAA', fontSize: 11, fontWeight: '700' }}>
              {profile?.status ?? 'Member'}
            </Text>
          </View>

          {/* Trainer / Branch badges */}
          {(!!profile?.trainerId || !!profile?.branchId) && (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              {!!profile?.trainerId && (
                <View style={{ backgroundColor: 'rgba(34,211,238,0.10)', borderWidth: 1, borderColor: 'rgba(34,211,238,0.25)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Feather name="award" size={12} color="#22D3EE" />
                  <Text style={{ color: '#22D3EE', fontSize: 11, fontWeight: '700' }}>Trainer #{profile.trainerId}</Text>
                </View>
              )}
              {!!profile?.branchId && (
                <View style={{ backgroundColor: 'rgba(167,139,250,0.10)', borderWidth: 1, borderColor: 'rgba(167,139,250,0.25)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Feather name="map-pin" size={12} color="#A78BFA" />
                  <Text style={{ color: '#A78BFA', fontSize: 11, fontWeight: '700' }}>Branch #{profile.branchId}</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* ── Tab switcher ── */}
        <View style={{ flexDirection: 'row', marginHorizontal: 20, backgroundColor: '#151915', borderRadius: 16, padding: 4, borderWidth: 1, borderColor: '#1C211C', marginBottom: 20 }}>
          {(['info', 'timeline'] as const).map(t => (
            <Pressable key={t} onPress={() => setTab(t)}
              style={{ flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', backgroundColor: tab === t ? '#7ED321' : 'transparent' }}>
              <Text style={{ color: tab === t ? '#000' : '#AAAAAA', fontSize: 13, fontWeight: '700', textTransform: 'capitalize' }}>{t}</Text>
            </Pressable>
          ))}
        </View>

        {/* ── Info tab ── */}
        {tab === 'info' && (
          <View style={{ paddingHorizontal: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>Personal Info</Text>
              <Pressable onPress={() => editing ? handleSave() : setEditing(true)} disabled={isPending}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: editing ? '#7ED321' : '#151915', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: editing ? '#7ED321' : '#242B24' }}>
                {isPending ? <ActivityIndicator size="small" color="#000" /> : <Feather name={editing ? 'check' : 'edit-2'} size={14} color={editing ? '#000' : '#AAAAAA'} />}
                <Text style={{ color: editing ? '#000' : '#AAAAAA', fontSize: 12, fontWeight: '700' }}>{editing ? 'Save' : 'Edit'}</Text>
              </Pressable>
            </View>
            {editing && (
              <Pressable onPress={() => setEditing(false)} style={{ marginBottom: 12, alignSelf: 'flex-start' }}>
                <Text style={{ color: '#EF4444', fontSize: 12, fontWeight: '600' }}>Cancel</Text>
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
            ])} style={{ marginTop: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(239,68,68,0.10)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)', borderRadius: 999, paddingVertical: 14 }}>
              <Feather name="log-out" size={16} color="#EF4444" />
              <Text style={{ color: '#EF4444', fontSize: 14, fontWeight: '700' }}>Sign Out</Text>
            </Pressable>
          </View>
        )}

        {/* ── Timeline tab ── */}
        {tab === 'timeline' && (
          <View style={{ paddingHorizontal: 20 }}>
            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700', marginBottom: 16 }}>Activity Timeline</Text>
            {timeline.length === 0 ? (
              <View style={{ alignItems: 'center', paddingTop: 32 }}>
                <Feather name="clock" size={28} color="#444" />
                <Text style={{ color: '#AAAAAA', fontSize: 13, marginTop: 10 }}>No activity yet</Text>
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
