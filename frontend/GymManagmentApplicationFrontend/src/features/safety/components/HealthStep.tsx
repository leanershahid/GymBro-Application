import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { T, SP, R } from '../../../theme';
import PrimaryButton from '../../common/components/PrimaryButton';
import LoadingState from '../../common/components/LoadingState';
import EmptyState from '../../common/components/EmptyState';
import { Field } from '../../common/components/FormFields';
import { describeApiError } from '../../../api/apiError';
import { useHealthQuestions, useSubmitHealth } from '../api/safetyQueries';
import { HealthScreening } from '../api/safety.types';
import StepLayout from './StepLayout';
import { CheckRow, Notice, StepTitle, YesNo } from './SafetyUi';

/**
 * PAR-Q+ style questionnaire: 7 yes/no questions, optional details, and health-data consent
 * (asked here when it isn't on record yet — the API refuses the answers without it).
 */
export default function HealthStep({ hasConsent, renewing, onDone, onSkip }: {
  hasConsent: boolean; renewing?: boolean; onDone: (result: HealthScreening) => void; onSkip?: () => void;
}) {
  const q = useHealthQuestions();
  const submit = useSubmitHealth();
  const [answers, setAnswers] = useState<(boolean | null)[]>([]);
  const [consent, setConsent] = useState(hasConsent);
  const [conditions, setConditions] = useState('');
  const [medications, setMedications] = useState('');
  const [injuries, setInjuries] = useState('');
  const [pregnancy, setPregnancy] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (q.isLoading) return <LoadingState label="Loading health questions" />;
  if (q.isError || !q.data) {
    return (
      <EmptyState icon="alert-triangle" tone="error" title="Couldn't load the health check"
        subtitle={describeApiError(q.error).message} action={{ label: 'Try again', onPress: () => q.refetch() }} />
    );
  }

  const questions = q.data.questions;
  const answered = questions.filter((_, i) => answers[i] != null).length;
  const anyYes = answers.some(a => a === true);
  const complete = answered === questions.length && consent;
  const set = (i: number, v: boolean) => setAnswers(prev => { const n = [...prev]; n[i] = v; return n; });
  const years = Math.round(q.data.validDays / 365);

  const send = () => {
    setError(null);
    submit.mutate({
      answers: questions.map((_, i) => answers[i] === true),
      conditions: conditions.trim() || undefined, medications: medications.trim() || undefined,
      injuries: injuries.trim() || undefined, pregnancy: pregnancy.trim() || undefined,
      grantHealthDataConsent: consent,
    }, {
      onSuccess: onDone,
      onError: e => setError(describeApiError(e).message),
    });
  };

  return (
    <StepLayout
      footer={
        <>
          {!!error && <Text accessibilityRole="alert" style={{ color: T.err, fontSize: 13 }}>{error}</Text>}
          <PrimaryButton
            label={complete ? 'Submit health check' : `Answer all questions (${answered}/${questions.length})`}
            icon="check"
            onPress={send}
            loading={submit.isPending}
            disabled={!complete}
          />
          {onSkip && <PrimaryButton label="Not now" variant="secondary" onPress={onSkip} disabled={submit.isPending} />}
        </>
      }
    >
      <StepTitle
        eyebrow={renewing ? 'Yearly health check' : 'Health check'}
        title="A few questions about your health"
        sub={`This helps your coaches keep you safe. It takes about a minute and is valid for ${years >= 1 ? `${years} year${years > 1 ? 's' : ''}` : `${q.data.validDays} days`}. Only gym admins and your own trainer can see your answers.`}
      />

      {!hasConsent && (
        <View style={{ marginBottom: SP.lg }}>
          <CheckRow
            checked={consent}
            onToggle={() => setConsent(c => !c)}
            label="I agree that the gym can store my health information to keep me safe while I train."
            hint="Required before you can submit your answers"
          />
        </View>
      )}

      <View style={{ gap: SP.md }}>
        {questions.map((question, i) => (
          <View key={question.key} style={{ backgroundColor: T.bgInput, borderRadius: R.lg, borderWidth: 1, borderColor: T.line, padding: SP.lg, gap: SP.md }}>
            <Text style={{ color: T.textFaint, fontSize: 12, fontWeight: '700' }}>QUESTION {i + 1} OF {questions.length}</Text>
            <Text style={{ color: T.text, fontSize: 16, lineHeight: 23, fontWeight: '600' }}>{question.text}</Text>
            {!!question.help && <Text style={{ color: T.textSub, fontSize: 13, lineHeight: 19 }}>{question.help}</Text>}
            <YesNo value={answers[i] ?? null} onChange={v => set(i, v)} label={question.text} />
          </View>
        ))}
      </View>

      {anyYes && (
        <View style={{ marginTop: SP.lg }}>
          <Notice icon="info" tone={T.brandGold} title="Thanks for telling us">
            Because you answered yes, we recommend checking with your doctor before training hard. You can still submit — the gym team will be in touch.
          </Notice>
        </View>
      )}

      <Text accessibilityRole="header" style={{ color: T.text, fontSize: 17, fontWeight: '700', marginTop: SP.xl, marginBottom: SP.md }}>
        Anything else we should know? (optional)
      </Text>
      <Field label="Medical conditions" value={conditions} onChangeText={setConditions} placeholder="e.g. asthma, diabetes" multiline />
      <Field label="Medications" value={medications} onChangeText={setMedications} placeholder="e.g. inhaler before exercise" multiline />
      <Field label="Injuries or pain" value={injuries} onChangeText={setInjuries} placeholder="e.g. sore lower back, old knee injury" multiline />
      <Field label="Pregnancy" value={pregnancy} onChangeText={setPregnancy} placeholder="e.g. no / 20 weeks / prefer not to say" />
    </StepLayout>
  );
}
