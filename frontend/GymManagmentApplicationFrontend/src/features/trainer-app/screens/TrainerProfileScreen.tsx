import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput,
  StatusBar, Platform, ActivityIndicator, Alert, Switch,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import {
  useTrainerProfile, useTrainerSchedule, useTrainerPerformance,
  useTrainerEarnings, useUpdateTrainerProfile, useUpdateSchedule,
} from '../api/trainerAppQueries';
import { ScheduleSlot } from '../types/trainer-app.types';
import { T, withAlpha } from '../../../theme';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface Props { trainerId: number; onLogout: () => void; }

export default function TrainerProfileScreen({ trainerId, onLogout }: Props) {
  const { data: profile, isLoading }    = useTrainerProfile(trainerId);
  const { data: schedule = [] }         = useTrainerSchedule(trainerId);
  const { data: perf }                  = useTrainerPerformance(trainerId);
  const { data: earnings }              = useTrainerEarnings(trainerId);
  const { mutate: updateProfile, isPending: savingProfile } = useUpdateTrainerProfile(trainerId);
  const { mutate: updateSchedule, isPending: savingSchedule } = useUpdateSchedule(trainerId);

  const [tab,       setTab]       = useState<'info' | 'schedule' | 'earnings'>('info');
  const [editing,   setEditing]   = useState(false);
  const [bio,       setBio]       = useState('');
  const [phone,     setPhone]     = useState('');
  const [available, setAvailable] = useState(true);
  const [slots,     setSlots]     = useState<ScheduleSlot[]>([]);

  useEffect(() => {
    if (profile) { setBio(profile.bio ?? ''); setPhone(profile.phone ?? ''); setAvailable(profile.isAvailable); }
  }, [profile]);

  useEffect(() => {
    if (schedule.length) setSlots(schedule);
  }, [schedule]);

  const handleSaveProfile = () => {
    updateProfile({ bio, phone: phone || undefined, isAvailable: available }, {
      onSuccess: res => { if (res.success) { Alert.alert('Saved ✓', 'Profile updated.'); setEditing(false); } },
      onError:   () => Alert.alert('Error', 'Failed to save.'),
    });
  };

  const handleSaveSchedule = () => {
    updateSchedule(slots, {
      onSuccess: res => res.success && Alert.alert('Saved ✓', 'Schedule updated.'),
      onError:   () => Alert.alert('Error', 'Failed to save schedule.'),
    });
  };

  const toggleSlot = (dayOfWeek: number) => {
    setSlots(prev => {
      const existing = prev.find(s => s.dayOfWeek === dayOfWeek);
      if (existing) {
        return prev.map(s => s.dayOfWeek === dayOfWeek ? { ...s, isActive: !s.isActive } : s);
      }
      return [...prev, { dayOfWeek, startTime: '09:00:00', endTime: '17:00:00', isActive: true }];
    });
  };

  if (isLoading) return (
    <View style={{ flex: 1, backgroundColor: T.bg, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" color={T.brand} />
    </View>
  );

  const initials = profile?.displayName?.split(' ').map(w => w[0]).join('').toUpperCase() || 'T';

  return (
    <View style={{ flex: 1, backgroundColor: T.bg, paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 0 }}>
      <StatusBar barStyle="light-content" backgroundColor={T.bg} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>

        {/* Avatar */}
        <View style={{ alignItems: 'center', paddingTop: 30, paddingBottom: 20, paddingHorizontal: 20 }}>
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: withAlpha(T.brand, 0.12), borderWidth: 2, borderColor: T.brand, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <Text style={{ color: T.brand, fontSize: 26, fontWeight: '800' }}>{initials}</Text>
          </View>
          <Text style={{ color: T.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.4 }}>{profile?.displayName ?? 'Trainer'}</Text>
          <Text style={{ color: T.textSub, fontSize: 13, marginTop: 4 }}>{profile?.email}</Text>
          {profile?.trainerCode && (
            <View style={{ marginTop: 10, backgroundColor: T.bgInput, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4, borderWidth: 1, borderColor: T.line }}>
              <Text style={{ color: T.textSub, fontSize: 11, fontWeight: '700' }}>{profile.trainerCode}</Text>
            </View>
          )}

          {/* Specializations */}
          {!!profile?.specializations?.length && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10, justifyContent: 'center' }}>
              {profile.specializations.map(s => (
                <View key={s} style={{ backgroundColor: withAlpha(T.brand, 0.10), borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1, borderColor: withAlpha(T.brand, 0.25) }}>
                  <Text style={{ color: T.brand, fontSize: 11, fontWeight: '600' }}>{s}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Tab switcher */}
        <View style={{ flexDirection: 'row', marginHorizontal: 20, backgroundColor: T.bgInput, borderRadius: 16, padding: 4, borderWidth: 1, borderColor: T.bgInputActive, marginBottom: 20 }}>
          {(['info', 'schedule', 'earnings'] as const).map(t => (
            <Pressable key={t} onPress={() => setTab(t)}
              style={{ flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', backgroundColor: tab === t ? T.brand : 'transparent' }}>
              <Text style={{ color: tab === t ? T.onBrand : T.textSub, fontSize: 12, fontWeight: '700', textTransform: 'capitalize' }}>{t}</Text>
            </Pressable>
          ))}
        </View>

        {/* Info tab */}
        {tab === 'info' && (
          <View style={{ paddingHorizontal: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <Text style={{ color: T.text, fontSize: 16, fontWeight: '700' }}>Profile Info</Text>
              <Pressable onPress={() => editing ? handleSaveProfile() : setEditing(true)} disabled={savingProfile}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: editing ? T.brand : T.bgInput, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: editing ? T.brand : T.line }}>
                {savingProfile ? <ActivityIndicator size="small" color={T.onBrand} /> : <Feather name={editing ? 'check' : 'edit-2'} size={13} color={editing ? T.onBrand : T.textSub} />}
                <Text style={{ color: editing ? T.onBrand : T.textSub, fontSize: 12, fontWeight: '700' }}>{editing ? 'Save' : 'Edit'}</Text>
              </Pressable>
            </View>
            {editing && <Pressable onPress={() => setEditing(false)} style={{ marginBottom: 12 }}><Text style={{ color: T.err, fontSize: 12 }}>Cancel</Text></Pressable>}

            {/* Read-only fields */}
            {[
              { label: 'Experience', value: profile?.experienceYears ? `${profile.experienceYears} years` : '—' },
              { label: 'Branch',     value: profile?.branchName ?? (profile?.branchId ? `#${profile.branchId}` : '—') },
              { label: 'Rating',     value: profile?.rating ? `${profile.rating.toFixed(1)} / 5` : '—' },
            ].map(row => (
              <View key={row.label} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: T.bgInput, borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: T.bgInputActive }}>
                <Text style={{ color: T.textSub, fontSize: 12, width: 90 }}>{row.label}</Text>
                <Text style={{ color: T.text, fontSize: 14, fontWeight: '600' }}>{row.value}</Text>
              </View>
            ))}

            {/* Editable: Bio */}
            <Text style={{ color: T.textSub, fontSize: 12, marginBottom: 6, marginTop: 8 }}>Bio</Text>
            <TextInput
              style={{ backgroundColor: editing ? T.bgInputActive : T.bgInput, borderRadius: 14, borderWidth: 1, borderColor: editing ? T.textDisabled : T.bgInputActive, color: editing ? T.text : T.textFaint, padding: 14, fontSize: 14, height: 80, textAlignVertical: 'top', marginBottom: 12 }}
              value={bio} onChangeText={setBio} placeholder="Your professional bio…" placeholderTextColor={T.textFaint}
              multiline editable={editing}
            />

            {/* Editable: Phone */}
            <Text style={{ color: T.textSub, fontSize: 12, marginBottom: 6 }}>Phone</Text>
            <TextInput
              style={{ backgroundColor: editing ? T.bgInputActive : T.bgInput, borderRadius: 14, borderWidth: 1, borderColor: editing ? T.textDisabled : T.bgInputActive, color: editing ? T.text : T.textFaint, padding: 14, fontSize: 14, marginBottom: 12 }}
              value={phone} onChangeText={setPhone} placeholder="+91…" placeholderTextColor={T.textFaint}
              keyboardType="phone-pad" editable={editing}
            />

            {/* Available toggle */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: T.bgInput, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: T.bgInputActive, marginBottom: 20 }}>
              <View>
                <Text style={{ color: T.text, fontSize: 14, fontWeight: '600' }}>Accepting new clients</Text>
                <Text style={{ color: T.textSub, fontSize: 11, marginTop: 2 }}>Toggle your availability status</Text>
              </View>
              <Switch value={available} onValueChange={setAvailable} disabled={!editing}
                trackColor={{ false: T.line, true: T.brand }} thumbColor={available ? T.onBrand : T.text} />
            </View>

            {/* Logout */}
            <Pressable onPress={() => Alert.alert('Sign out', 'Are you sure?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign out', style: 'destructive', onPress: onLogout },
            ])} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: withAlpha(T.err, 0.10), borderWidth: 1, borderColor: withAlpha(T.err, 0.25), borderRadius: 999, paddingVertical: 14 }}>
              <Feather name="log-out" size={16} color={T.err} />
              <Text style={{ color: T.err, fontSize: 14, fontWeight: '700' }}>Sign Out</Text>
            </Pressable>
          </View>
        )}

        {/* Schedule tab */}
        {tab === 'schedule' && (
          <View style={{ paddingHorizontal: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <Text style={{ color: T.text, fontSize: 16, fontWeight: '700' }}>Weekly Availability</Text>
              <Pressable onPress={handleSaveSchedule} disabled={savingSchedule}
                style={{ backgroundColor: T.brand, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {savingSchedule ? <ActivityIndicator size="small" color={T.onBrand} /> : <Feather name="check" size={13} color={T.onBrand} />}
                <Text style={{ color: T.onBrand, fontSize: 12, fontWeight: '700' }}>Save</Text>
              </Pressable>
            </View>
            {DAYS.map((day, i) => {
              const dow   = i + 1;
              const slot  = slots.find(s => s.dayOfWeek === dow);
              const active = slot?.isActive ?? false;
              return (
                <View key={day} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: active ? withAlpha(T.brand, 0.07) : T.bgInput, borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: active ? withAlpha(T.brand, 0.22) : T.bgInputActive }}>
                  <Text style={{ color: T.text, fontSize: 14, fontWeight: '700', width: 40 }}>{day}</Text>
                  <View style={{ flex: 1 }}>
                    {active && slot ? (
                      <Text style={{ color: T.textSub, fontSize: 12 }}>{slot.startTime.slice(0,5)} – {slot.endTime.slice(0,5)}</Text>
                    ) : (
                      <Text style={{ color: T.textFaint, fontSize: 12 }}>Unavailable</Text>
                    )}
                  </View>
                  <Switch value={active} onValueChange={() => toggleSlot(dow)}
                    trackColor={{ false: T.line, true: T.brand }} thumbColor={active ? T.onBrand : T.text} />
                </View>
              );
            })}
          </View>
        )}

        {/* Earnings tab */}
        {tab === 'earnings' && (
          <View style={{ paddingHorizontal: 20 }}>
            <Text style={{ color: T.text, fontSize: 16, fontWeight: '700', marginBottom: 16 }}>Earnings</Text>
            {earnings ? (
              <>
                <View style={{ backgroundColor: T.bgInput, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: T.bgInputActive, marginBottom: 16 }}>
                  <Text style={{ color: T.textSub, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                    {new Date(earnings.year, earnings.month - 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' })}
                  </Text>
                  <Text style={{ color: T.text, fontSize: 32, fontWeight: '900', letterSpacing: -1, marginBottom: 10 }}>
                    ₹{earnings.totalEarnings.toLocaleString('en-IN')}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: T.brand }} />
                    <Text style={{ color: T.textSub, fontSize: 13 }}>
                      ₹{earnings.commissionEarned.toLocaleString('en-IN')} commission
                    </Text>
                  </View>
                </View>
                {perf && (
                  <View style={{ backgroundColor: T.bgInput, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: T.bgInputActive, gap: 10 }}>
                    {[
                      { label: 'Total Clients',  value: perf.totalClients },
                      { label: 'Total Sessions', value: perf.totalSessions },
                      { label: 'Avg Rating',     value: `${perf.rating.toFixed(1)} / 5` },
                    ].map(row => (
                      <View key={row.label} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ color: T.textSub, fontSize: 13 }}>{row.label}</Text>
                        <Text style={{ color: T.text, fontSize: 13, fontWeight: '700' }}>{row.value}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </>
            ) : (
              <View style={{ alignItems: 'center', paddingTop: 40 }}>
                <Feather name="dollar-sign" size={28} color={T.textDisabled} />
                <Text style={{ color: T.textSub, fontSize: 13, marginTop: 10 }}>No earnings data available</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
