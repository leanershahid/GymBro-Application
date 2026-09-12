import React from 'react';
import {
  View, Text, ScrollView, Pressable, ImageBackground,
  StatusBar, Platform, ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTrainerProfile, useTrainerPerformance, useTrainerEarnings, useMyClients } from '../api/trainerAppQueries';

type FeatherIconName = React.ComponentProps<typeof Feather>['name'];

const IMG_HERO    = require('../../../assets/dashboard/hero-athlete.jpg');
const IMG_COACH1  = require('../../../assets/dashboard/coach-1.jpg');

function StatCard({ label, value, color, icon }: { label: string; value: string | number; color: string; icon: FeatherIconName }) {
  return (
    <View style={{ flex: 1, backgroundColor: '#151915', borderRadius: 18, padding: 14, borderWidth: 1, borderColor: '#1C211C', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: color + '18', borderWidth: 1, borderColor: color + '35', alignItems: 'center', justifyContent: 'center' }}>
        <Feather name={icon} size={16} color={color} />
      </View>
      <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '800', letterSpacing: -0.5 }}>{value}</Text>
      <Text style={{ color: '#AAAAAA', fontSize: 11, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

interface Props {
  trainerId: number;
  onNavigate: (screen: string) => void;
}

export default function TrainerHomeScreen({ trainerId, onNavigate }: Props) {
  const { data: profile,  isLoading } = useTrainerProfile(trainerId);
  const { data: perf }                = useTrainerPerformance(trainerId);
  const { data: earnings }            = useTrainerEarnings(trainerId);
  const { data: clients = [] }        = useMyClients(trainerId);

  const now    = new Date();
  const hour   = now.getHours();
  const greet  = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const name   = profile?.displayName ?? 'Coach';

  const today = now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  const quickLinks: { icon: FeatherIconName; label: string; screen: string; color: string }[] = [
    { icon: 'users',     label: 'Clients',  screen: 'clients',  color: '#22D3EE' },
    { icon: 'activity',  label: 'Programs', screen: 'builder',  color: '#7ED321' },
    { icon: 'trending-up',label: 'Performance', screen: 'performance', color: '#A78BFA' },
    { icon: 'user',      label: 'Profile',  screen: 'profile',  color: '#FACC15' },
  ];

  if (isLoading) return (
    <View style={{ flex: 1, backgroundColor: '#0A0F0A', alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" color="#7ED321" />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#0A0F0A', paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 0 }}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0F0A" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>

        {/* ── Hero header ── */}
        <ImageBackground source={IMG_HERO} style={{ width: '100%', height: 260 }} resizeMode="cover">
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.62)', padding: 20, justifyContent: 'space-between' }}>
            {/* Top bar */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8 }}>
              <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(126,211,33,0.18)', borderWidth: 2, borderColor: '#7ED321', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#7ED321', fontSize: 16, fontWeight: '800' }}>{name[0]?.toUpperCase() ?? 'T'}</Text>
              </View>
              <Pressable onPress={() => onNavigate('notifications')}
                accessibilityRole="button"
                accessibilityLabel="Notifications"
                style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.50)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.20)', alignItems: 'center', justifyContent: 'center' }}>
                <Feather name="bell" size={18} color="rgba(255,255,255,0.85)" />
                <View style={{ position: 'absolute', top: 6, right: 7, width: 7, height: 7, borderRadius: 4, backgroundColor: '#7ED321', borderWidth: 1.5, borderColor: '#0A0F0A' }} />
              </Pressable>
            </View>

            {/* Greeting */}
            <View>
              <Text style={{ color: 'rgba(255,255,255,0.60)', fontSize: 12, marginBottom: 4 }}>{today}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, fontWeight: '500', marginBottom: 4 }}>{greet}, {name}</Text>
              <Text style={{ color: '#FFFFFF', fontSize: 28, fontWeight: '800', letterSpacing: -0.5, lineHeight: 34 }}>
                Your clients{'\n'}need <Text style={{ color: '#7ED321' }}>you today</Text>
              </Text>
            </View>
          </View>
        </ImageBackground>

        {/* ── Stats row ── */}
        <View style={{ flexDirection: 'row', paddingHorizontal: 20, gap: 10, marginTop: 20, marginBottom: 28 }}>
          <StatCard label="Clients"  value={perf?.totalClients  ?? clients.length} color="#7ED321" icon="users" />
          <StatCard label="Sessions" value={perf?.totalSessions ?? '—'}            color="#22D3EE" icon="activity" />
          <StatCard label="Rating"   value={perf?.rating ? perf.rating.toFixed(1) : '—'} color="#FACC15" icon="star" />
        </View>

        {/* ── Earnings card ── */}
        {earnings && (
          <View style={{ marginHorizontal: 20, marginBottom: 28, backgroundColor: '#151915', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#1C211C' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <Text style={{ color: '#AAAAAA', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 }}>
                {new Date(earnings.year, earnings.month - 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' })}
              </Text>
              <View style={{ backgroundColor: 'rgba(126,211,33,0.10)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(126,211,33,0.25)' }}>
                <Text style={{ color: '#7ED321', fontSize: 11, fontWeight: '700' }}>Earnings</Text>
              </View>
            </View>
            <Text style={{ color: '#FFFFFF', fontSize: 32, fontWeight: '900', letterSpacing: -1, marginBottom: 8 }}>
              ₹{earnings.totalEarnings.toLocaleString('en-IN')}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Feather name="trending-up" size={14} color="#22C55E" />
              <Text style={{ color: '#22C55E', fontSize: 13, fontWeight: '600' }}>
                ₹{earnings.commissionEarned.toLocaleString('en-IN')} commission
              </Text>
            </View>
          </View>
        )}

        {/* ── Quick links ── */}
        <View style={{ flexDirection: 'row', paddingHorizontal: 20, gap: 10, marginBottom: 28, flexWrap: 'wrap' }}>
          {quickLinks.map(q => (
            <Pressable key={q.screen} onPress={() => onNavigate(q.screen)}
              style={({ pressed }) => ({
                width: '47%', alignItems: 'center', gap: 8, paddingVertical: 18,
                backgroundColor: pressed ? q.color + '14' : '#151915',
                borderRadius: 18, borderWidth: 1,
                borderColor: pressed ? q.color + '35' : '#1C211C',
              })}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: q.color + '14', borderWidth: 1, borderColor: q.color + '30', alignItems: 'center', justifyContent: 'center' }}>
                <Feather name={q.icon} size={18} color={q.color} />
              </View>
              <Text style={{ color: '#AAAAAA', fontSize: 12, fontWeight: '600' }}>{q.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* ── Recent clients ── */}
        {clients.length > 0 && (
          <View style={{ paddingHorizontal: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '700' }}>My Clients</Text>
              <Pressable onPress={() => onNavigate('clients')}
                accessibilityRole="button"
                accessibilityLabel="View all clients"
                style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: '#7ED321', alignItems: 'center', justifyContent: 'center' }}>
                <Feather name="arrow-up-right" size={16} color="#000" />
              </Pressable>
            </View>
            {clients.slice(0, 4).map((c, i) => {
              const colors = ['#7ED321', '#22D3EE', '#A78BFA', '#FACC15'];
              const col = colors[i % colors.length];
              return (
                <Pressable key={c.assignmentId} onPress={() => onNavigate(`client-${c.clientId}`)}
                  style={({ pressed }) => ({
                    flexDirection: 'row', alignItems: 'center',
                    backgroundColor: pressed ? '#1C211C' : '#151915',
                    borderRadius: 16, padding: 14, marginBottom: 10,
                    borderWidth: 1, borderColor: '#1C211C',
                  })}>
                  <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: col + '18', borderWidth: 1.5, borderColor: col + '50', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                    <Text style={{ color: col, fontSize: 16, fontWeight: '800' }}>{c.clientId}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700' }}>Client #{c.clientId}</Text>
                    <Text style={{ color: '#AAAAAA', fontSize: 11, marginTop: 2 }}>
                      Since {new Date(c.assignedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </Text>
                  </View>
                  <View style={{ backgroundColor: c.status === 'Active' ? 'rgba(126,211,33,0.12)' : '#1C211C', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: c.status === 'Active' ? 'rgba(126,211,33,0.28)' : '#242B24' }}>
                    <Text style={{ color: c.status === 'Active' ? '#7ED321' : '#AAAAAA', fontSize: 11, fontWeight: '700' }}>{c.status}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* ── PT Sessions coming soon ── */}
        <View style={{ marginHorizontal: 20, marginTop: 8, backgroundColor: '#151915', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#1C211C', flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(167,139,250,0.12)', borderWidth: 1, borderColor: 'rgba(167,139,250,0.25)', alignItems: 'center', justifyContent: 'center' }}>
            <Feather name="calendar" size={20} color="#A78BFA" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700' }}>PT Sessions</Text>
            <Text style={{ color: '#AAAAAA', fontSize: 12, marginTop: 2 }}>Session calendar coming soon</Text>
          </View>
          <View style={{ backgroundColor: '#1C211C', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: '#242B24' }}>
            <Text style={{ color: '#666', fontSize: 11, fontWeight: '700' }}>SOON</Text>
          </View>
        </View>

      </ScrollView>
    </View>
  );
}
