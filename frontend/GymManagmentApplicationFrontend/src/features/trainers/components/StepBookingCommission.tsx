import React, { useRef, useCallback, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Switch,
  PanResponder, LayoutChangeEvent,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { TrainerPayload } from '../types/trainer.types';
import { T } from './theme';

type MCIcon = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

interface Props {
  data: Partial<TrainerPayload>;
  onChange: (fields: Partial<TrainerPayload>) => void;
}

/* ── Block wrapper ─────────────────────────────────────────────── */
function Block({ num, title, children }: { num: string; title: string; children: React.ReactNode }) {
  return (
    <View className="px-5 pt-[22px] pb-[10px]">
      <View className="flex-row items-center gap-[10px] mb-4">
        <View className="w-7 h-7 rounded-lg bg-[rgba(126,211,33,0.10)] border border-[rgba(126,211,33,0.25)] items-center justify-center">
          <Text className="text-[11px] font-extrabold text-brand" style={{ letterSpacing: 0.5 }}>{num}</Text>
        </View>
        <Text className="text-[16px] font-bold text-white">{title}</Text>
      </View>
      {children}
    </View>
  );
}

/* ── Permission toggle card ────────────────────────────────────── */
function PermissionCard({ icon, label, sub, value, onValueChange }: {
  icon: MCIcon; label: string; sub: string;
  value: boolean; onValueChange: (v: boolean) => void;
}) {
  return (
    <TouchableOpacity
      className={`flex-row items-center gap-3 px-[14px] py-3 rounded-xl border mb-2 ${
        value ? 'border-[rgba(126,211,33,0.25)] bg-[rgba(126,211,33,0.10)]' : 'border-line bg-input'
      }`}
      onPress={() => onValueChange(!value)}
      activeOpacity={0.75}
    >
      <View className={`w-10 h-10 rounded-[10px] items-center justify-center ${value ? 'bg-[rgba(126,211,33,0.10)]' : 'bg-surface'}`}>
        <MaterialCommunityIcons name={icon} size={20} color={value ? T.brand : T.textFaint} />
      </View>
      <View className="flex-1">
        <Text className={`text-[14px] font-semibold ${value ? 'text-white' : 'text-sub'}`}>{label}</Text>
        <Text className="text-[12px] text-faint mt-[2px]">{sub}</Text>
      </View>
      <View className={`w-2 h-2 rounded-full ${value ? 'bg-brand' : 'bg-line'}`} />
    </TouchableOpacity>
  );
}

/* ── Numeric stat tile ─────────────────────────────────────────── */
function StatTile({ icon, label, value, onChange }: {
  icon: MCIcon; label: string; value: string; onChange: (v: string) => void;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View
      className="flex-1 items-center py-[14px] px-[10px] rounded-xl border gap-1"
      style={{
        minWidth: '45%',
        borderColor: focused ? '#444444' : T.line,
        backgroundColor: focused ? '#1C211C' : T.bgInput,
      }}
    >
      <MaterialCommunityIcons name={icon} size={18} color={focused ? T.textSub : T.textFaint} />
      <TextInput
        className="text-[22px] font-extrabold text-white text-center p-0"
        style={{ minWidth: 50 }}
        value={value}
        onChangeText={onChange}
        keyboardType="numeric"
        placeholder="—"
        placeholderTextColor={T.textFaint}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      <Text
        className="text-[11px] font-semibold uppercase"
        style={{ letterSpacing: 0.8, color: focused ? T.textSub : T.textFaint }}
      >
        {label}
      </Text>
    </View>
  );
}

/* ── Commission percentage slider ──────────────────────────────── */
function Slider({ icon, label, value, onChange }: {
  icon: MCIcon; label: string; value: number; onChange: (n: number) => void;
}) {
  const pct    = Math.min(Math.max(value, 0), 100);
  const trackW = useRef(0);
  const [drag, setDrag] = useState(false);

  const clamp = useCallback((x: number) => {
    const raw = Math.round((x / trackW.current) * 100);
    return Math.min(Math.max(raw, 0), 100);
  }, []);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant:     (e) => { setDrag(true);  if (trackW.current > 0) onChange(clamp(e.nativeEvent.locationX)); },
      onPanResponderMove:      (e) => { if (trackW.current > 0) onChange(clamp(e.nativeEvent.locationX)); },
      onPanResponderRelease:   ()  => setDrag(false),
      onPanResponderTerminate: ()  => setDrag(false),
    })
  ).current;

  return (
    <View className="mb-6">
      <View className="flex-row justify-between items-center mb-3">
        <View className="flex-row items-center gap-2">
          <MaterialCommunityIcons name={icon} size={16} color={T.textSub} />
          <Text className="text-[14px] font-semibold text-white">{label}</Text>
        </View>
        <View className="flex-row items-baseline gap-[1px] px-[10px] py-1 rounded-full bg-[rgba(126,211,33,0.10)]">
          <Text className="text-[16px] font-extrabold text-brand">{pct}</Text>
          <Text className="text-[11px] font-bold text-brand">%</Text>
        </View>
      </View>

      <View
        className="h-9 justify-center relative"
        onLayout={(e: LayoutChangeEvent) => { trackW.current = e.nativeEvent.layout.width; }}
        {...pan.panHandlers}
      >
        <View className="absolute left-0 right-0 h-[4px] rounded-full bg-line" />
        <View
          className="absolute left-0 h-[4px] rounded-full bg-brand"
          style={{ width: `${pct}%` as any }}
        />
        <View
          className="absolute w-5 h-5 rounded-full bg-bg border-2 border-brand items-center justify-center"
          style={{
            top: '50%',
            marginTop: -10,
            marginLeft: -10,
            left: `${pct}%` as any,
            transform: drag ? [{ scale: 1.3 }] : [],
          }}
        >
          <View className="w-2 h-2 rounded-full bg-brand" />
        </View>
      </View>

      <View className="flex-row justify-between mt-1">
        {['0%', '50%', '100%'].map((l) => (
          <Text key={l} className="text-[10px] text-faint">{l}</Text>
        ))}
      </View>
    </View>
  );
}

/* ── Main component ────────────────────────────────────────────── */
export default function StepBookingCommission({ data, onChange }: Props) {
  const bs = data.bookingSettings    ?? {} as any;
  const cs = data.commissionSettings ?? {} as any;
  const updateBs = (f: object) => onChange({ bookingSettings:    { ...bs, ...f } });
  const updateCs = (f: object) => onChange({ commissionSettings: { ...cs, ...f } });

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ paddingBottom: 48 }} showsVerticalScrollIndicator={false}>

      <Block num="01" title="Booking Permissions">
        <PermissionCard icon="weight-lifter"       label="Personal Training" sub="1-on-1 sessions"  value={bs.canTakePersonalTraining ?? false} onValueChange={(v) => updateBs({ canTakePersonalTraining: v })} />
        <PermissionCard icon="account-group"       label="Group Classes"     sub="Multi-client"      value={bs.canTakeGroupClasses ?? false}      onValueChange={(v) => updateBs({ canTakeGroupClasses: v })} />
        <PermissionCard icon="monitor-account"     label="Online Sessions"   sub="Remote coaching"   value={bs.canTakeOnlineSessions ?? false}    onValueChange={(v) => updateBs({ canTakeOnlineSessions: v })} />
        <PermissionCard icon="star-circle-outline" label="Trial Sessions"    sub="Free intro"        value={bs.canTakeTrialSessions ?? false}     onValueChange={(v) => updateBs({ canTakeTrialSessions: v })} />

        <TouchableOpacity
          className="flex-row items-center gap-3 pt-3 mt-1 border-t border-[#151915]"
          onPress={() => updateBs({ requiresApprovalForBooking: !bs.requiresApprovalForBooking })}
          activeOpacity={0.75}
        >
          <MaterialCommunityIcons
            name="shield-check-outline" size={20}
            color={bs.requiresApprovalForBooking ? T.brand : T.textFaint}
          />
          <View className="flex-1">
            <Text className={`text-[14px] font-semibold ${bs.requiresApprovalForBooking ? 'text-white' : 'text-sub'}`}>
              Requires Approval
            </Text>
            <Text className="text-[12px] text-faint mt-[2px]">All bookings need manual confirmation</Text>
          </View>
          <Switch
            value={bs.requiresApprovalForBooking ?? false}
            onValueChange={(v) => updateBs({ requiresApprovalForBooking: v })}
            trackColor={{ false: '#2A2A2A', true: T.brand }}
            thumbColor={bs.requiresApprovalForBooking ? T.onBrand : '#FFFFFF'}
            ios_backgroundColor="#2A2A2A"
          />
        </TouchableOpacity>
      </Block>

      <View className="h-px bg-[#151915] mx-5" />

      <Block num="02" title="Session Limits">
        <View className="flex-row flex-wrap gap-[10px]">
          <StatTile icon="account-multiple-outline" label="Max Clients"    value={String(bs.maxClients ?? '')}             onChange={(v) => updateBs({ maxClients: Number(v) })} />
          <StatTile icon="weather-sunny"            label="Daily Max"      value={String(bs.maxDailySessions ?? '')}        onChange={(v) => updateBs({ maxDailySessions: Number(v) })} />
          <StatTile icon="calendar-week"            label="Weekly Max"     value={String(bs.maxWeeklySessions ?? '')}       onChange={(v) => updateBs({ maxWeeklySessions: Number(v) })} />
          <StatTile icon="clock-time-four-outline"  label="Duration (min)" value={String(bs.sessionDurationMinutes ?? '')} onChange={(v) => updateBs({ sessionDurationMinutes: Number(v) })} />
          <StatTile icon="timer-pause-outline"      label="Buffer (min)"   value={String(bs.bufferTimeMinutes ?? '')}       onChange={(v) => updateBs({ bufferTimeMinutes: Number(v) })} />
        </View>
      </Block>

      <View className="h-px bg-[#151915] mx-5" />

      <Block num="03" title="Commission Eligibility">
        <PermissionCard icon="card-account-details-outline" label="Membership"    sub="Membership sales" value={cs.eligibleForMembershipCommission ?? false}       onValueChange={(v) => updateCs({ eligibleForMembershipCommission: v })} />
        <PermissionCard icon="dumbbell"                     label="Personal Trng" sub="PT sessions"       value={cs.eligibleForPersonalTrainingCommission ?? false} onValueChange={(v) => updateCs({ eligibleForPersonalTrainingCommission: v })} />
        <PermissionCard icon="pill"                         label="Supplements"   sub="Product sales"     value={cs.eligibleForSupplementCommission ?? false}       onValueChange={(v) => updateCs({ eligibleForSupplementCommission: v })} />
      </Block>

      <View className="h-px bg-[#151915] mx-5" />

      <Block num="04" title="Commission Rates">
        <Slider icon="card-account-details" label="Membership"       value={cs.membershipCommissionPercentage ?? 0} onChange={(v) => updateCs({ membershipCommissionPercentage: v })} />
        <Slider icon="dumbbell"             label="Personal Training" value={cs.ptCommissionPercentage ?? 0}         onChange={(v) => updateCs({ ptCommissionPercentage: v })} />
        <Slider icon="pill"                 label="Supplements"       value={cs.supplementCommissionPercentage ?? 0} onChange={(v) => updateCs({ supplementCommissionPercentage: v })} />
      </Block>

    </ScrollView>
  );
}
