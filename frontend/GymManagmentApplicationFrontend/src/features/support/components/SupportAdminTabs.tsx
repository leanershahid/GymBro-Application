import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, SP } from '../../../theme';
import { useLayout } from '../../../utils/useLayout';
import { apiErrorText, describeApiError } from '../../../api/apiError';
import PrimaryButton from '../../common/components/PrimaryButton';
import EmptyState from '../../common/components/EmptyState';
import LoadingState from '../../common/components/LoadingState';
import SegmentedTabs from '../../common/components/SegmentedTabs';
import { Field, SwitchRow } from '../../common/components/FormFields';
import { confirm } from '../../common/components/dialogs';
import { useToast } from '../../common/components/Toast';
import {
  useCanned, useDeleteCanned, useDeleteFaq, useFaqs, useFeedbackSummary, useSaveCanned, useSaveFaq, useSaveSupportSettings, useSupportSettings,
} from '../api/supportQueries';
import { CannedReply, FeedbackAverage, SupportFaq, SupportSettings } from '../api/support.types';
import { Card, SectionTitle, StarRating, ago } from './SupportUi';

function Body({ children }: { children: React.ReactNode }) {
  const { hPad } = useLayout();
  return (
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: hPad, paddingBottom: 120, gap: SP.lg, width: '100%', maxWidth: 760, alignSelf: 'center' }}>
      {children}
    </ScrollView>
  );
}

function IconButton({ icon, label, onPress, tone = T.textSub }: { icon: React.ComponentProps<typeof Feather>['name']; label: string; onPress: () => void; tone?: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={6}
      style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: T.bgInputActive, borderWidth: 1, borderColor: T.line }}>
      <Feather name={icon} size={16} color={tone} />
    </Pressable>
  );
}

// ── FAQ ──────────────────────────────────────────────────────────────────

function FaqEditor({ faq, onDone }: { faq?: SupportFaq; onDone: () => void }) {
  const toast = useToast();
  const save = useSaveFaq();
  const [question, setQuestion] = useState(faq?.question ?? '');
  const [answer, setAnswer] = useState(faq?.answer ?? '');
  const [published, setPublished] = useState(faq?.isPublished ?? true);
  const submit = () => save.mutate({ id: faq?.id, question, answer, isPublished: published, category: faq?.category ?? null }, {
    onSuccess: () => { toast.show({ message: 'Question saved.' }); onDone(); },
    onError: e => toast.show({ type: 'error', message: apiErrorText(e) }),
  });
  return (
    <Card accent={T.brand}>
      <Field label="Question" value={question} onChangeText={setQuestion} placeholder="e.g. How do I freeze my membership?" />
      <Field label="Answer" value={answer} onChangeText={setAnswer} multiline placeholder="Keep it short and friendly." />
      <SwitchRow label="Show to members" value={published} onValueChange={setPublished} />
      <View style={{ flexDirection: 'row', gap: SP.md }}>
        <PrimaryButton label="Cancel" variant="secondary" onPress={onDone} style={{ flex: 1 }} />
        <PrimaryButton label="Save" icon="check" loading={save.isPending} disabled={!question.trim() || !answer.trim()} onPress={submit} style={{ flex: 1 }} />
      </View>
    </Card>
  );
}

export function FaqTab() {
  const toast = useToast();
  const q = useFaqs();
  const remove = useDeleteFaq();
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const faqs = q.data ?? [];
  const doDelete = async (f: SupportFaq) => {
    if (!(await confirm({ title: 'Remove this question?', message: f.question, confirmLabel: 'Remove', destructive: true }))) return;
    remove.mutate(f.id, { onError: e => toast.show({ type: 'error', message: apiErrorText(e) }) });
  };
  return (
    <Body>
      <Text style={{ color: T.textSub, fontSize: 14 }}>Members see these above "Contact us" in Help & feedback, and can search them.</Text>
      {editing === 'new' ? <FaqEditor onDone={() => setEditing(null)} /> : <PrimaryButton label="Add a question" icon="plus" onPress={() => setEditing('new')} />}
      {q.isLoading && <LoadingState label="Loading questions" />}
      {q.isError && <EmptyState icon="alert-triangle" tone="error" title="Couldn't load questions" subtitle={describeApiError(q.error).message} action={{ label: 'Try again', onPress: () => q.refetch() }} />}
      {q.isSuccess && faqs.length === 0 && editing !== 'new' && (
        <EmptyState icon="help-circle" title="No questions yet" subtitle="Answer the things members ask most — opening hours, freezing, guest passes." action={{ label: 'Add a question', onPress: () => setEditing('new') }} />
      )}
      {faqs.map(f => editing === f.id ? <FaqEditor key={f.id} faq={f} onDone={() => setEditing(null)} /> : (
        <Card key={f.id}>
          <View style={{ flexDirection: 'row', gap: SP.md, alignItems: 'flex-start' }}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ color: T.text, fontSize: 15, fontWeight: '700' }}>{f.question}</Text>
              <Text numberOfLines={3} style={{ color: T.textSub, fontSize: 13 }}>{f.answer}</Text>
              {!f.isPublished && <Text style={{ color: T.brandGold, fontSize: 12 }}>Hidden from members</Text>}
            </View>
            <IconButton icon="edit-2" label={`Edit ${f.question}`} onPress={() => setEditing(f.id)} />
            <IconButton icon="trash-2" label={`Remove ${f.question}`} tone={T.err} onPress={() => doDelete(f)} />
          </View>
        </Card>
      ))}
    </Body>
  );
}

// ── Saved (canned) replies ───────────────────────────────────────────────

function CannedEditor({ reply, onDone }: { reply?: CannedReply; onDone: () => void }) {
  const toast = useToast();
  const save = useSaveCanned();
  const [title, setTitle] = useState(reply?.title ?? '');
  const [body, setBody] = useState(reply?.body ?? '');
  const submit = () => save.mutate({ id: reply?.id, title, body }, {
    onSuccess: () => { toast.show({ message: 'Saved reply stored.' }); onDone(); },
    onError: e => toast.show({ type: 'error', message: apiErrorText(e) }),
  });
  return (
    <Card accent={T.brand}>
      <Field label="Name" value={title} onChangeText={setTitle} placeholder="e.g. Fixed — thanks for reporting" />
      <Field label="Reply" value={body} onChangeText={setBody} multiline placeholder="Thanks for letting us know! We've…" />
      <View style={{ flexDirection: 'row', gap: SP.md }}>
        <PrimaryButton label="Cancel" variant="secondary" onPress={onDone} style={{ flex: 1 }} />
        <PrimaryButton label="Save" icon="check" loading={save.isPending} disabled={!title.trim() || !body.trim()} onPress={submit} style={{ flex: 1 }} />
      </View>
    </Card>
  );
}

export function CannedRepliesTab() {
  const toast = useToast();
  const q = useCanned('staff');
  const remove = useDeleteCanned();
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const list = q.data ?? [];
  const doDelete = async (c: CannedReply) => {
    if (!(await confirm({ title: 'Remove this saved reply?', message: c.title, confirmLabel: 'Remove', destructive: true }))) return;
    remove.mutate(c.id, { onError: e => toast.show({ type: 'error', message: apiErrorText(e) }) });
  };
  return (
    <Body>
      <Text style={{ color: T.textSub, fontSize: 14 }}>Pick one when replying to fill the message box, then tweak it before sending.</Text>
      {editing === 'new' ? <CannedEditor onDone={() => setEditing(null)} /> : <PrimaryButton label="Add a saved reply" icon="plus" onPress={() => setEditing('new')} />}
      {q.isLoading && <LoadingState label="Loading saved replies" />}
      {q.isError && <EmptyState icon="alert-triangle" tone="error" title="Couldn't load saved replies" subtitle={describeApiError(q.error).message} action={{ label: 'Try again', onPress: () => q.refetch() }} />}
      {q.isSuccess && list.length === 0 && editing !== 'new' && (
        <EmptyState icon="message-square" title="No saved replies yet" subtitle="Save the answers you type most often." action={{ label: 'Add a saved reply', onPress: () => setEditing('new') }} />
      )}
      {list.map(c => editing === c.id ? <CannedEditor key={c.id} reply={c} onDone={() => setEditing(null)} /> : (
        <Card key={c.id}>
          <View style={{ flexDirection: 'row', gap: SP.md, alignItems: 'flex-start' }}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ color: T.text, fontSize: 15, fontWeight: '700' }}>{c.title}</Text>
              <Text numberOfLines={3} style={{ color: T.textSub, fontSize: 13 }}>{c.body}</Text>
            </View>
            <IconButton icon="edit-2" label={`Edit ${c.title}`} onPress={() => setEditing(c.id)} />
            <IconButton icon="trash-2" label={`Remove ${c.title}`} tone={T.err} onPress={() => doDelete(c)} />
          </View>
        </Card>
      ))}
    </Body>
  );
}

// ── Class feedback ───────────────────────────────────────────────────────

function AverageList({ rows, empty }: { rows: FeedbackAverage[]; empty: string }) {
  if (rows.length === 0) return <Text style={{ color: T.textSub, fontSize: 14 }}>{empty}</Text>;
  return (
    <View style={{ gap: 10 }}>
      {rows.map(r => (
        <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: SP.md }} accessible accessibilityLabel={`${r.name}: ${r.average.toFixed(1)} out of 5 from ${r.count} ratings`}>
          <Text numberOfLines={1} style={{ flex: 1, color: T.text, fontSize: 14, fontWeight: '600' }}>{r.name}</Text>
          <View style={{ width: 90, height: 6, borderRadius: 3, backgroundColor: T.bgInputActive, overflow: 'hidden' }}>
            <View style={{ width: `${(r.average / 5) * 100}%`, height: 6, backgroundColor: r.average >= 4 ? T.brand : r.average >= 3 ? T.brandGold : T.err }} />
          </View>
          <Text style={{ width: 70, textAlign: 'right', color: T.textSub, fontSize: 13 }}>★ {r.average.toFixed(1)} · {r.count}</Text>
        </View>
      ))}
    </View>
  );
}

export function FeedbackTab() {
  const [days, setDays] = useState<'30' | '90' | '365'>('90');
  const q = useFeedbackSummary(Number(days));
  const s = q.data;
  return (
    <Body>
      <SegmentedTabs tabs={[{ key: '30', label: '30 days' }, { key: '90', label: '90 days' }, { key: '365', label: '1 year' }]} value={days} onChange={setDays} />
      {q.isLoading && <LoadingState label="Loading feedback" />}
      {q.isError && <EmptyState icon="alert-triangle" tone="error" title="Couldn't load feedback" subtitle={describeApiError(q.error).message} action={{ label: 'Try again', onPress: () => q.refetch() }} />}
      {s && (
        <>
          <View style={{ flexDirection: 'row', gap: SP.md }}>
            <Card style={{ flex: 1 }}>
              <Text style={{ color: T.textSub, fontSize: 12 }}>Classes</Text>
              <Text style={{ color: T.text, fontSize: 26, fontWeight: '800' }}>{s.count ? `★ ${s.average.toFixed(1)}` : '—'}</Text>
              <Text style={{ color: T.textFaint, fontSize: 12 }}>{s.count} ratings</Text>
            </Card>
            <Card style={{ flex: 1 }}>
              <Text style={{ color: T.textSub, fontSize: 12 }}>Support</Text>
              <Text style={{ color: T.text, fontSize: 26, fontWeight: '800' }}>{s.supportRatings ? `★ ${s.supportAverage.toFixed(1)}` : '—'}</Text>
              <Text style={{ color: T.textFaint, fontSize: 12 }}>{s.supportRatings} ratings</Text>
            </Card>
          </View>
          <Card><SectionTitle>By class type</SectionTitle><AverageList rows={s.byClassType} empty="No class ratings yet. Members are asked after classes they attended." /></Card>
          <Card><SectionTitle>By trainer</SectionTitle><AverageList rows={s.byTrainer} empty="No trainer ratings yet." /></Card>
          <Card>
            <SectionTitle>Recent comments</SectionTitle>
            {s.recentComments.length === 0 && <Text style={{ color: T.textSub, fontSize: 14 }}>No comments yet.</Text>}
            <View style={{ gap: SP.md }}>
              {s.recentComments.map((c, i) => (
                <View key={i} style={{ gap: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <StarRating value={c.score} size={14} label="Score" />
                    <Text style={{ color: T.textFaint, fontSize: 12 }}>{c.className}{c.trainerName ? ` · ${c.trainerName}` : ''} · {ago(c.at)}</Text>
                  </View>
                  <Text style={{ color: T.text, fontSize: 14 }}>{c.comment}</Text>
                </View>
              ))}
            </View>
          </Card>
        </>
      )}
    </Body>
  );
}

// ── Settings ─────────────────────────────────────────────────────────────

export function SupportSettingsTab() {
  const toast = useToast();
  const q = useSupportSettings();
  const save = useSaveSupportSettings();
  const [s, setS] = useState<SupportSettings | null>(null);
  const [first, setFirst] = useState('');
  const [resolve, setResolve] = useState('');
  useEffect(() => {
    if (q.data && !s) { setS(q.data); setFirst(String(q.data.firstResponseHours)); setResolve(String(q.data.resolutionHours)); }
  }, [q.data, s]);
  if (q.isLoading || !s) return q.isError
    ? <EmptyState icon="alert-triangle" tone="error" title="Couldn't load settings" subtitle={describeApiError(q.error).message} action={{ label: 'Try again', onPress: () => q.refetch() }} />
    : <LoadingState label="Loading settings" />;
  const submit = () => save.mutate({ ...s, firstResponseHours: Number(first) || 0, resolutionHours: Number(resolve) || 0 }, {
    onSuccess: () => toast.show({ message: 'Settings saved.' }),
    onError: e => toast.show({ type: 'error', message: apiErrorText(e) }),
  });
  return (
    <Body>
      <Card>
        <SectionTitle>Response targets</SectionTitle>
        <Text style={{ color: T.textSub, fontSize: 13, marginBottom: SP.md }}>Requests past these show as overdue in the queue and in the daily digest. "Waiting on member" pauses the resolution clock.</Text>
        <Field label="First reply within (hours)" value={first} onChangeText={setFirst} keyboardType="number-pad" />
        <Field label="Resolve within (hours)" value={resolve} onChangeText={setResolve} keyboardType="number-pad" />
      </Card>
      <Card>
        <SectionTitle>Members</SectionTitle>
        <SwitchRow label="Members can send requests in the app" value={s.requestsEnabled} onValueChange={v => setS({ ...s, requestsEnabled: v })}
          description="Off: Help & feedback shows the FAQ only." />
        <SwitchRow label='Ask "How was your class?"' value={s.postClassFeedback} onValueChange={v => setS({ ...s, postClassFeedback: v })}
          description="A card on Home after a class they attended, once per booking." />
      </Card>
      <PrimaryButton label="Save settings" icon="check" loading={save.isPending} onPress={submit} />
    </Body>
  );
}
