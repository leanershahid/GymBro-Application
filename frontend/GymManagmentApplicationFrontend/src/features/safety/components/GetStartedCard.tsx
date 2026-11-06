import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, SP, R, withAlpha } from '../../../theme';
import Skeleton from '../../common/components/Skeleton';
import { useMySafety } from '../api/safetyQueries';
import { SafetyCompliance, SafetyStep } from '../api/safety.types';
import { SafetyFlowRequest, fmtDay } from '../utils/safetyGate';
import { SafetyFlowModal } from './SafetyGateHost';

type FeatherIcon = React.ComponentProps<typeof Feather>['name'];

interface Item { step: SafetyStep; icon: FeatherIcon; title: string; detail: string; done: boolean; urgent: boolean }

function itemsOf(c: SafetyCompliance): Item[] {
  const items: Item[] = [];
  if (c.waivers.length > 0) {
    const resign = c.waivers.some(w => w.status === 'resign_required');
    items.push({
      step: 'waiver', icon: 'file-text', title: resign ? 'Re-sign updated waiver' : 'Sign the waiver',
      detail: c.waiverOk ? 'Signed' : resign ? 'The gym updated its waiver' : 'Takes about 2 minutes',
      done: c.waiverOk, urgent: !c.waiverOk && c.gatingEnabled,
    });
  }
  const h = c.health;
  items.push({
    step: 'health', icon: 'heart',
    title: h.status === 'expired' ? 'Renew your health check' : 'Health check',
    detail: h.status === 'missing' ? '7 quick yes/no questions'
      : h.status === 'expired' ? `Expired ${fmtDay(h.expiresAt)}`
      : h.status === 'needs_clearance' ? 'Done · doctor’s OK recommended'
      : `Valid until ${fmtDay(h.expiresAt)}`,
    done: h.status !== 'missing' && h.status !== 'expired',
    urgent: (h.status === 'missing' || h.status === 'expired') && c.gatingEnabled,
  });
  items.push({
    step: 'emergency', icon: 'phone-call', title: 'Emergency contact',
    detail: c.emergencyContact ? c.emergencyContact.name : 'Who we call if you need help',
    done: c.emergencyOk, urgent: false,
  });
  return items;
}

/**
 * Home "Get started" checklist (Waiver · Health check · Emergency contact) with progress, shown
 * until everything is done (Glofox / PushPress style). Self-contained: tapping a row opens the
 * flow in a modal, unless `onOpenStep` is given (then the host navigates instead).
 */
export default function GetStartedCard({ onOpenStep }: { onOpenStep?: (step: SafetyStep) => void }) {
  const q = useMySafety();
  const [request, setRequest] = useState<SafetyFlowRequest | null>(null);

  if (q.isLoading) return <Skeleton rows={1} height={168} borderRadius={R.xl} />;
  // Errors / complete checklist: stay out of the way on Home.
  if (q.isError || !q.data || q.data.checklistComplete) return null;

  const c = q.data;
  const items = itemsOf(c);
  const open = (step: SafetyStep) => (onOpenStep ? onOpenStep(step) : setRequest({ start: step }));
  const pct = Math.round((c.stepsDone / Math.max(1, c.stepsTotal)) * 100);
  const blocked = c.gatingEnabled && !c.canBook;

  return (
    <View style={{ backgroundColor: T.bgInput, borderRadius: R.xl, borderWidth: 1, borderColor: blocked ? withAlpha(T.brandGold, 0.35) : T.line, padding: SP.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SP.sm }}>
        <View style={{ flex: 1 }}>
          <Text accessibilityRole="header" style={{ color: T.text, fontSize: 18, fontWeight: '800' }}>Get started</Text>
          <Text style={{ color: T.textSub, fontSize: 13, marginTop: 2 }}>
            {blocked ? 'Finish these to book classes and check in' : 'A few things to keep you safe'}
          </Text>
        </View>
        <Text accessibilityLabel={`${c.stepsDone} of ${c.stepsTotal} done`} style={{ color: T.brand, fontSize: 15, fontWeight: '800' }}>
          {c.stepsDone}/{c.stepsTotal}
        </Text>
      </View>

      <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: pct }}
        style={{ height: 6, borderRadius: 3, backgroundColor: T.line, overflow: 'hidden', marginBottom: SP.md }}>
        <View style={{ width: `${pct}%`, height: 6, backgroundColor: T.brand, borderRadius: 3 }} />
      </View>

      {items.map(it => (
        <Pressable
          key={it.step}
          onPress={() => open(it.step)}
          accessibilityRole="button"
          accessibilityLabel={`${it.title}. ${it.done ? 'Done' : 'To do'}. ${it.detail}`}
          style={({ pressed }) => ({
            flexDirection: 'row', alignItems: 'center', gap: SP.md, minHeight: 56, paddingVertical: SP.sm,
            borderTopWidth: 1, borderTopColor: T.line, opacity: pressed ? 0.7 : 1,
          })}
        >
          <View style={{
            width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
            backgroundColor: it.done ? withAlpha(T.brand, 0.14) : it.urgent ? withAlpha(T.brandGold, 0.12) : T.bgInputActive,
          }}>
            <Feather name={it.done ? 'check' : it.icon} size={17} color={it.done ? T.brand : it.urgent ? T.brandGold : T.textSub} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ color: it.done ? T.textSub : T.text, fontSize: 15, fontWeight: '600', textDecorationLine: it.done ? 'line-through' : 'none' }}>{it.title}</Text>
            <Text numberOfLines={1} style={{ color: T.textFaint, fontSize: 12, marginTop: 2 }}>{it.detail}</Text>
          </View>
          <Feather name="chevron-right" size={18} color={T.textFaint} />
        </Pressable>
      ))}

      {!onOpenStep && <SafetyFlowModal request={request} onClose={() => setRequest(null)} />}
    </View>
  );
}
