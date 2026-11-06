import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, SP, R, withAlpha } from '../../../theme';
import Screen from '../../common/components/Screen';
import LoadingState from '../../common/components/LoadingState';
import EmptyState from '../../common/components/EmptyState';
import PrimaryButton from '../../common/components/PrimaryButton';
import { describeApiError } from '../../../api/apiError';
import { useMySafety, usePendingWaivers } from '../api/safetyQueries';
import { HealthScreening, SafetyCompliance, SafetyStep } from '../api/safety.types';
import WaiverStep from '../components/WaiverStep';
import HealthStep from '../components/HealthStep';
import StepLayout from '../components/StepLayout';
import { EmergencyFields, EmergencySaveButton, useEmergencyForm } from '../components/EmergencyContactForm';
import { Notice, StepProgress, StepTitle } from '../components/SafetyUi';
import { fmtDay } from '../utils/safetyGate';

export interface SafetyFlowScreenProps {
  /** Close the flow (back to wherever it was opened from). */
  onClose: () => void;
  /** Step to open first; the flow still covers every outstanding step after it. */
  start?: SafetyStep;
  /** Show just this one step (e.g. "Renew health check" from Profile). */
  only?: SafetyStep;
  /** Why the flow opened (e.g. the booking gate's message), shown on the first step. */
  reason?: string;
}

type FlowStep = { kind: 'waiver'; index: number } | { kind: 'health' } | { kind: 'emergency' };

function planSteps(c: SafetyCompliance, pendingWaivers: number, start?: SafetyStep, only?: SafetyStep): FlowStep[] {
  const waivers: FlowStep[] = Array.from({ length: pendingWaivers }, (_, index) => ({ kind: 'waiver', index }));
  const health: FlowStep[] = !c.health.ok || only === 'health' ? [{ kind: 'health' }] : [];
  const emergency: FlowStep[] = !c.emergencyOk || only === 'emergency' ? [{ kind: 'emergency' }] : [];
  if (only === 'waiver') return waivers;
  if (only === 'health') return [{ kind: 'health' }];
  if (only === 'emergency') return [{ kind: 'emergency' }];
  const order = start === 'health' ? [health, waivers, emergency] : start === 'emergency' ? [emergency, waivers, health] : [waivers, health, emergency];
  return order.flat();
}

/**
 * "Get ready to train" flow: sign waiver(s) → health check (PAR-Q+ style) → emergency contact →
 * done. Only outstanding steps are shown; a progress bar tracks them. Self-contained (no router
 * needed): mount it as a screen or inside <SafetyFlowModal />.
 */
export default function SafetyFlowScreen({ onClose, start, only, reason }: SafetyFlowScreenProps) {
  const statusQ = useMySafety();
  const pendingQ = usePendingWaivers();
  // The plan is fixed when the flow opens, so refetches after each step don't reshuffle it.
  const [plan, setPlan] = useState<FlowStep[] | null>(null);
  const [pos, setPos] = useState(0);
  const [healthResult, setHealthResult] = useState<HealthScreening | null>(null);
  const waivers = useMemo(() => pendingQ.data ?? [], [pendingQ.data]);

  useEffect(() => {
    if (plan || !statusQ.data || !pendingQ.data) return;
    setPlan(planSteps(statusQ.data, pendingQ.data.length, start, only));
  }, [plan, statusQ.data, pendingQ.data, start, only]);

  const header = (stepNo: number, total: number) => (
    <View style={{ paddingHorizontal: SP.xl, paddingTop: SP.lg, paddingBottom: SP.sm, gap: SP.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ flex: 1, color: T.textSub, fontSize: 13, fontWeight: '600' }}>
          {total > 0 && stepNo <= total ? `Get ready to train · Step ${stepNo} of ${total}` : 'Get ready to train'}
        </Text>
        <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close"
          style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: T.bgInput, borderWidth: 1, borderColor: T.line }}>
          <Feather name="x" size={20} color={T.text} />
        </Pressable>
      </View>
      {total > 0 && <StepProgress step={Math.min(stepNo, total)} total={total} label={`Step ${Math.min(stepNo, total)} of ${total}`} />}
    </View>
  );

  if (statusQ.isError || pendingQ.isError) {
    return (
      <Screen>
        {header(0, 0)}
        <EmptyState icon="alert-triangle" tone="error" title="Couldn't load your checklist"
          subtitle={describeApiError(statusQ.error ?? pendingQ.error).message}
          action={{ label: 'Try again', onPress: () => { statusQ.refetch(); pendingQ.refetch(); } }} />
      </Screen>
    );
  }
  if (!plan || !statusQ.data) {
    return <Screen>{header(0, 0)}<LoadingState label="Loading your checklist" /></Screen>;
  }

  const total = plan.length;
  const next = () => setPos(p => p + 1);
  const step = plan[pos];

  // ── Done ──
  if (!step) {
    return (
      <Screen>
        {header(total + 1, total)}
        <StepLayout footer={<PrimaryButton label="Done" icon="check" onPress={onClose} />}>
          <View style={{ alignItems: 'center', paddingTop: SP.xxl, gap: SP.lg }}>
            <View style={{ width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: withAlpha(T.brand, 0.12), borderWidth: 1, borderColor: withAlpha(T.brand, 0.3) }}>
              <Feather name="check" size={40} color={T.brand} />
            </View>
            <Text accessibilityRole="header" style={{ color: T.text, fontSize: 26, fontWeight: '800', textAlign: 'center' }}>
              {total === 0 ? 'Nothing to do' : statusQ.data.canBook ? "You're all set" : 'Saved'}
            </Text>
            <Text style={{ color: T.textSub, fontSize: 15, lineHeight: 22, textAlign: 'center', maxWidth: 420 }}>
              {total === 0 ? 'Your waiver, health check and emergency contact are already up to date.'
                : statusQ.data.canBook ? 'Thanks! You can now book classes and check in.'
                : 'Thanks! A few checks are still open — finish them from Home or your Profile to book classes.'}
            </Text>
          </View>
          {healthResult?.needsClearance && (
            <View style={{ marginTop: SP.xl }}>
              <Notice icon="alert-circle" tone={T.brandGold} title="Check with your doctor">
                {`You answered yes to ${healthResult.yesCount} health question${healthResult.yesCount === 1 ? '' : 's'}. Please get your doctor's OK before training hard — the gym team has been told and may ask for a note.`}
              </Notice>
            </View>
          )}
          {healthResult && (
            <Text style={{ color: T.textFaint, fontSize: 12, textAlign: 'center', marginTop: SP.lg }}>
              Your health check is valid until {fmtDay(healthResult.expiresAt)}.
            </Text>
          )}
        </StepLayout>
      </Screen>
    );
  }

  const intro = pos === 0 && !!reason && (
    <View style={{ paddingHorizontal: SP.xl, paddingBottom: SP.sm }}>
      <Notice icon="lock" tone={T.sky}>{reason}</Notice>
    </View>
  );

  return (
    <Screen>
      {header(pos + 1, total)}
      {intro}
      {step.kind === 'waiver' && waivers[step.index] && (
        <WaiverStep key={waivers[step.index].versionId} waiver={waivers[step.index]} index={step.index} count={waivers.length} onSigned={next} />
      )}
      {step.kind === 'waiver' && !waivers[step.index] && <SkipMissing onNext={next} />}
      {step.kind === 'health' && (
        <HealthStep
          hasConsent={statusQ.data.hasHealthDataConsent}
          renewing={statusQ.data.health.status === 'expired'}
          onDone={r => { setHealthResult(r); next(); }}
        />
      )}
      {step.kind === 'emergency' && (
        <EmergencyStep initial={statusQ.data.emergencyContact} onSaved={next} onSkip={statusQ.data.missing.includes('emergency_contact') ? undefined : next} />
      )}
    </Screen>
  );
}

/** A waiver that disappeared between planning and showing (e.g. deactivated): move on. */
function SkipMissing({ onNext }: { onNext: () => void }) {
  const done = useRef(false);
  useEffect(() => { if (!done.current) { done.current = true; onNext(); } }, [onNext]);
  return null;
}

function EmergencyStep({ initial, onSaved, onSkip }: {
  initial: SafetyCompliance['emergencyContact']; onSaved: () => void; onSkip?: () => void;
}) {
  const form = useEmergencyForm(initial);
  return (
    <StepLayout footer={
      <>
        <EmergencySaveButton form={form} onSaved={onSaved} />
        {onSkip && <PrimaryButton label="Skip for now" variant="secondary" onPress={onSkip} disabled={form.saving} />}
      </>
    }>
      <StepTitle eyebrow="Emergency contact" title="Who should we call?" sub="If something happens while you're training, staff will call this person. Only gym staff can see it." />
      {initial?.source === 'legacy' && (
        <View style={{ marginBottom: SP.lg }}>
          <Notice icon="info" tone={T.sky}>We filled this in from your old profile. Please check it and save.</Notice>
        </View>
      )}
      <View style={{ backgroundColor: T.bgInput, borderRadius: R.lg, borderWidth: 1, borderColor: T.line, padding: SP.lg }}>
        <EmergencyFields form={form} />
      </View>
    </StepLayout>
  );
}
