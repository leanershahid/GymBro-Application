import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, Pressable,
  Platform, Alert, Switch, KeyboardAvoidingView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import {
  useTrainerProfile, useTrainerSchedule, useTrainerPerformance,
  useTrainerEarnings, useUpdateTrainerProfile, useUpdateSchedule,
} from '../api/trainerAppQueries';
import { ScheduleSlot } from '../types/trainer-app.types';
import { T, R, withAlpha } from '../../../theme';
import Screen from '../../common/components/Screen';
import SegmentedTabs from '../../common/components/SegmentedTabs';
import PrimaryButton from '../../common/components/PrimaryButton';
import LoadingState from '../../common/components/LoadingState';
import StatusPill from '../../common/components/StatusPill';
import EmptyState from '../../dashboard/components/EmptyState';
import { Field, SwitchRow } from '../../trainers/components/FormFields';
import ChangePasswordSheet from '../../auth/components/ChangePasswordSheet';
import AppSwitcher from '../../access/components/AppSwitcher';

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
  const [pwOpen, setPwOpen] = useState(false);
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

  if (isLoading) return <LoadingState fullScreen label="Loading profile" />;

  const initials = profile?.displayName?.split(' ').map(w => w[0]).join('').toUpperCase() || 'T';

  return (
    <Screen>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 60 }}>

        {/* Avatar */}
        <View style={{ alignItems: 'center', paddingTop: 30, paddingBottom: 20, paddingHorizontal: 20 }}>
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: withAlpha(T.brand, 0.12), borderWidth: 2, borderColor: T.brand, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <Text style={{ color: T.brand, fontSize: 26, fontWeight: '800' }}>{initials}</Text>
          </View>
          <Text numberOfLines={1} style={{ color: T.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.4 }}>{profile?.displayName ?? 'Trainer'}</Text>
          <Text numberOfLines={1} style={{ color: T.textSub, fontSize: 13, marginTop: 4 }}>{profile?.email}</Text>
          {profile?.trainerCode && (
            <View style={{ marginTop: 10, alignSelf: 'center' }}>
              <StatusPill label={profile.trainerCode} tone="neutral" />
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
        <SegmentedTabs
          tabs={[{ key: 'info', label: 'Info' }, { key: 'schedule', label: 'Schedule' }, { key: 'earnings', label: 'Earnings' }]}
          value={tab}
          onChange={setTab}
          style={{ marginHorizontal: 20, marginBottom: 24 }}
        />

        {/* Info tab */}
        {tab === 'info' && (
          <View style={{ paddingHorizontal: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <Text style={{ color: T.text, fontSize: 16, fontWeight: '700' }}>Profile Info</Text>
              {!editing && (
                <Pressable onPress={() => setEditing(true)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Edit profile info"
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, backgroundColor: T.bgInput, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: T.line }}>
                  <Feather name="edit-2" size={13} color={T.textSub} />
                  <Text style={{ color: T.textSub, fontSize: 12, fontWeight: '700' }}>Edit</Text>
                </Pressable>
              )}
            </View>

            {/* Read-only fields */}
            {[
              { label: 'Experience', value: profile?.experienceYears ? `${profile.experienceYears} years` : '—' },
              { label: 'Branch',     value: profile?.branchName || '—' },
              { label: 'Rating',     value: profile?.rating ? `${profile.rating.toFixed(1)} / 5` : '—' },
            ].map(row => (
              <View key={row.label} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: T.bgInput, borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: T.bgInputActive }}>
                <Text style={{ color: T.textSub, fontSize: 12, width: 90 }}>{row.label}</Text>
                <Text numberOfLines={1} style={{ color: T.text, fontSize: 14, fontWeight: '600', flex: 1 }}>{row.value}</Text>
              </View>
            ))}

            <View style={{ marginTop: 8 }}>
              {/* Editable: Bio */}
              <Field label="Bio" value={bio} onChangeText={setBio} placeholder="Your professional bio…" multiline editable={editing} />

              {/* Editable: Phone */}
              <Field label="Phone" value={phone} onChangeText={setPhone} placeholder="+91…" keyboardType="phone-pad" editable={editing} autoCapitalize="none" autoCorrect={false} />
            </View>

            {/* Available toggle */}
            {editing ? (
              <SwitchRow
                label="Accepting new clients"
                description="Toggle your availability status"
                value={available}
                onValueChange={setAvailable}
              />
            ) : (
              <View
                accessible
                accessibilityLabel={`Accepting new clients: ${available ? 'yes' : 'no'}`}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: T.bgInput, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: T.bgInputActive, marginBottom: 16 }}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={{ color: T.text, fontSize: 14, fontWeight: '600' }}>Accepting new clients</Text>
                  <Text style={{ color: T.textSub, fontSize: 11, marginTop: 2 }}>Tap Edit to change your availability</Text>
                </View>
                <StatusPill label={available ? 'Yes' : 'No'} tone={available ? 'brand' : 'neutral'} />
              </View>
            )}

            {editing && (
              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 8 }}>
                <PrimaryButton label="Cancel" variant="secondary" onPress={() => setEditing(false)} disabled={savingProfile} style={{ flex: 1 }} />
                <PrimaryButton label="Save" icon="check" onPress={handleSaveProfile} loading={savingProfile} style={{ flex: 1 }} />
              </View>
            )}

            <PrimaryButton
              label="Change password"
              icon="lock"
              variant="secondary"
              style={{ marginTop: 24 }}
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

        {/* Schedule tab */}
        {tab === 'schedule' && (
          <View style={{ paddingHorizontal: 20 }}>
            <Text style={{ color: T.text, fontSize: 16, fontWeight: '700', marginBottom: 16 }}>Weekly Availability</Text>
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
                    accessibilityLabel={`Available on ${day}`}
                    trackColor={{ false: T.line, true: T.brand }} thumbColor={active ? T.onBrand : T.text} />
                </View>
              );
            })}
            <PrimaryButton label="Save schedule" icon="check" onPress={handleSaveSchedule} loading={savingSchedule} style={{ marginTop: 12 }} />
          </View>
        )}

        {/* Earnings tab */}
        {tab === 'earnings' && (
          <View style={{ paddingHorizontal: 20 }}>
            <Text style={{ color: T.text, fontSize: 16, fontWeight: '700', marginBottom: 16 }}>Earnings</Text>
            {earnings ? (
              <>
                <View style={{ backgroundColor: T.bgInput, borderRadius: R.xl, padding: 20, borderWidth: 1, borderColor: T.bgInputActive, marginBottom: 16 }}>
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
                  <View style={{ backgroundColor: T.bgInput, borderRadius: R.lg, padding: 16, borderWidth: 1, borderColor: T.bgInputActive, gap: 10 }}>
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
              <EmptyState icon="dollar-sign" title="No earnings data available" />
            )}
          </View>
        )}
      </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
