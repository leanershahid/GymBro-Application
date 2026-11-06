import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, View, Text, KeyboardAvoidingView, Platform } from 'react-native';
import { T, SP } from '../../../theme';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import PrimaryButton from '../../common/components/PrimaryButton';
import LoadingState from '../../common/components/LoadingState';
import EmptyState from '../../common/components/EmptyState';
import ChipSelect from '../../common/components/ChipSelect';
import UploadField from '../../common/components/UploadField';
import { DateField } from '../../common/components/DatePicker';
import { Field, SwitchRow } from '../../common/components/FormFields';
import { confirm, notify } from '../../common/components/dialogs';
import { apiErrorText } from '../../../api/apiError';
import {
  useAnnouncementAdmin, useAudienceCount, useAudienceOptions, useDeleteAnnouncement, useSaveAnnouncement, useUnscheduleAnnouncement,
} from '../api/operationsQueries';
import type { AnnouncementAction, AnnouncementAudience, AnnouncementPayload } from '../types/operations.types';
import { isoToLocalParts, localDateTimeToIso } from '../utils/hours';
import { Card, SectionTitle, TimeField } from '../components/OperationsUi';

interface Props {
  /** Edit an existing one; omit/0 to compose a new one. */
  announcementId?: number;
  onBack: () => void;
  onSaved: () => void;
}

const AUDIENCES: { value: AnnouncementAudience; label: string }[] = [
  { value: 'AllMembers', label: 'All members' }, { value: 'Branches', label: 'Branches' }, { value: 'Plans', label: 'Plans' },
  { value: 'Tags', label: 'Member tags' }, { value: 'Staff', label: 'Trainers & staff' },
];

/** Member app screens a button can open (route keys of the member area). */
const CTA_ROUTES: { value: string; label: string }[] = [
  { value: 'book', label: 'Book a class' }, { value: 'shop', label: 'Shop' }, { value: 'billing', label: 'Membership' },
  { value: 'community', label: 'Community' }, { value: 'train', label: 'Train' }, { value: 'branch-info', label: 'Gym info' },
];

/** Admin: write an announcement, choose who gets it, then save as draft, schedule or send now. */
export default function AnnouncementEditorPage({ announcementId = 0, onBack, onSaved }: Props) {
  const existing = useAnnouncementAdmin(announcementId);
  const options = useAudienceOptions();
  const save = useSaveAnnouncement();
  const unschedule = useUnscheduleAnnouncement();
  const remove = useDeleteAnnouncement();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [withCta, setWithCta] = useState(false);
  const [ctaLabel, setCtaLabel] = useState('');
  const [ctaRoute, setCtaRoute] = useState<string | null>(null);
  const [audience, setAudience] = useState<AnnouncementAudience>('AllMembers');
  const [ids, setIds] = useState<number[]>([]);
  const [pinned, setPinned] = useState(false);
  const [urgent, setUrgent] = useState(false);
  const [scheduled, setScheduled] = useState(false);
  const [sendDate, setSendDate] = useState('');
  const [sendTime, setSendTime] = useState('09:00');
  const [expires, setExpires] = useState(false);
  const [expDate, setExpDate] = useState('');
  const [expTime, setExpTime] = useState('23:59');
  const [error, setError] = useState<string | null>(null);

  const a = existing.data;
  useEffect(() => {
    if (!a) return;
    setTitle(a.title); setBody(a.body); setImageUrl(a.imageUrl ?? '');
    setWithCta(!!a.ctaRoute); setCtaLabel(a.ctaLabel ?? ''); setCtaRoute(a.ctaRoute);
    setAudience(a.audience); setIds(a.audienceIds); setPinned(a.isPinned); setUrgent(a.isUrgent);
    if (a.status === 'Scheduled' && a.publishAt) { setScheduled(true); const [d, t] = isoToLocalParts(a.publishAt); setSendDate(d); setSendTime(t); }
    if (a.expiresAt) { setExpires(true); const [d, t] = isoToLocalParts(a.expiresAt); setExpDate(d); setExpTime(t); }
  }, [a]);

  const sent = a?.status === 'Published' || a?.status === 'Expired';
  const needsIds = audience === 'Branches' || audience === 'Plans' || audience === 'Tags';
  const count = useAudienceCount(audience, needsIds ? ids : []);
  const idOptions = useMemo(() => {
    const o = options.data;
    const list = audience === 'Branches' ? o?.branches : audience === 'Plans' ? o?.plans : audience === 'Tags' ? o?.tags : [];
    return (list ?? []).map(x => ({ value: x.id, label: x.name }));
  }, [options.data, audience]);

  const build = (action: AnnouncementAction): AnnouncementPayload | string => {
    if (!title.trim()) return 'Give the announcement a title.';
    if (!body.trim()) return 'Write the announcement text.';
    if (withCta && (!ctaLabel.trim() || !ctaRoute)) return 'A button needs a label and a screen to open.';
    if (needsIds && ids.length === 0 && !sent) return 'Pick at least one branch, plan or tag.';
    const publishAt = scheduled ? localDateTimeToIso(sendDate, sendTime) : null;
    if (action === 'schedule' && !publishAt) return 'Pick the date and time to send it.';
    const expiresAt = expires ? localDateTimeToIso(expDate, expTime) : null;
    if (expires && !expiresAt) return 'Pick when it should expire.';
    return {
      title: title.trim(), body: body.trim(), imageUrl: imageUrl || null,
      ctaLabel: withCta ? ctaLabel.trim() : null, ctaRoute: withCta ? ctaRoute : null,
      audience, audienceIds: needsIds ? ids : [], isPinned: pinned, isUrgent: urgent,
      publishAt, expiresAt, action,
    };
  };

  const submit = async (action: AnnouncementAction) => {
    setError(null);
    const payload = build(action);
    if (typeof payload === 'string') { setError(payload); return; }
    if (action === 'publish') {
      const n = count.data;
      const ok = await confirm({
        title: 'Send now?',
        message: `${n != null ? `${n.toLocaleString()} ${n === 1 ? 'person' : 'people'} will` : 'Everyone in the audience will'} get an in-app notification${urgent ? ' and an urgent push (ignores quiet hours)' : ' and a push'}.`,
        confirmLabel: 'Send',
      });
      if (!ok) return;
    }
    save.mutate({ id: announcementId || undefined, payload }, {
      onSuccess: async (res) => {
        await notify(
          res.status === 'Published' ? 'Sent' : res.status === 'Scheduled' ? 'Scheduled' : res.status === 'Publishing' ? 'Sending' : 'Saved',
          res.status === 'Published' ? `Delivered to ${res.recipientCount.toLocaleString()} ${res.recipientCount === 1 ? 'person' : 'people'}.` : undefined,
        );
        onSaved();
      },
      onError: (e) => setError(apiErrorText(e)),
    });
  };

  const onUnschedule = () => unschedule.mutate(announcementId, { onSuccess: () => setScheduled(false), onError: (e) => setError(apiErrorText(e)) });
  const onDelete = async () => {
    const ok = await confirm({
      title: sent ? 'Take this down?' : 'Delete this announcement?',
      message: sent ? 'It disappears from members\' feeds. Reach stats are kept.' : 'This can\'t be undone.',
      confirmLabel: sent ? 'Take down' : 'Delete', destructive: true,
    });
    if (ok) remove.mutate(announcementId, { onSuccess: onSaved, onError: (e) => setError(apiErrorText(e)) });
  };

  if (announcementId > 0 && existing.isLoading) return <Screen><ScreenHeader title="Announcement" onBack={onBack} /><LoadingState label="Loading announcement" /></Screen>;
  if (announcementId > 0 && (existing.isError || !a)) {
    return (
      <Screen>
        <ScreenHeader title="Announcement" onBack={onBack} />
        <EmptyState icon="alert-triangle" tone="error" title="Couldn't load it" subtitle={apiErrorText(existing.error)} action={{ label: 'Try again', onPress: () => existing.refetch() }} />
      </Screen>
    );
  }

  const busy = save.isPending;
  return (
    <Screen>
      <ScreenHeader eyebrow={announcementId ? (sent ? 'Sent announcement' : 'Edit announcement') : 'New announcement'} title={title.trim() || 'Announcement'} onBack={onBack} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: SP.xl, paddingBottom: 60, gap: SP.xxl }}>
          {sent && a && (
            <Card tint={T.ok}>
              <Text style={{ color: T.text, fontSize: 14, fontWeight: '700' }}>
                Reached {a.recipientCount.toLocaleString()} · read by {a.readCount.toLocaleString()}
              </Text>
              <Text style={{ color: T.textSub, fontSize: 13, marginTop: 4 }}>Edits update the feed but don't notify anyone again. The audience can't change.</Text>
            </Card>
          )}

          <View>
            <SectionTitle title="Message" />
            <Field label="Title" value={title} onChangeText={setTitle} placeholder="Pool closed this weekend" />
            <Field label="Text" value={body} onChangeText={setBody} multiline placeholder={'What members need to know.\n- Bullets with a dash\n- **Bold** with double stars'} />
            <UploadField label="Image (optional)" value={imageUrl} onChange={setImageUrl} folder="media" square={false} hint="Wide pictures (16:9) look best." />
            <SwitchRow label="Add a button" description="Opens a screen in the member app, e.g. Book a class." value={withCta} onValueChange={setWithCta} />
            {withCta && (
              <>
                <Field label="Button label" value={ctaLabel} onChangeText={setCtaLabel} placeholder="Book now" />
                <ChipSelect label="Button opens" options={CTA_ROUTES} value={ctaRoute} onChange={setCtaRoute} />
              </>
            )}
          </View>

          <View>
            <SectionTitle title="Audience" />
            {sent ? (
              <Text style={{ color: T.textSub, fontSize: 14 }}>{a?.audienceLabel}</Text>
            ) : (
              <>
                <ChipSelect label="Who gets it" options={AUDIENCES} value={audience} onChange={(v) => { setAudience(v); setIds([]); }} />
                {needsIds && (
                  options.isLoading ? <LoadingState label="Loading options" />
                    : idOptions.length === 0
                      ? <Text style={{ color: T.textSub, fontSize: 13, marginBottom: SP.md }}>Nothing to choose from yet.</Text>
                      : <ChipSelect multiple label={audience === 'Branches' ? 'Branches' : audience === 'Plans' ? 'Membership plans' : 'Tags'} options={idOptions} value={ids} onChange={setIds} />
                )}
                <Text accessibilityLiveRegion="polite" style={{ color: T.textSub, fontSize: 13 }}>
                  {count.isFetching ? 'Counting…' : count.data != null ? `Reaches ${count.data.toLocaleString()} ${count.data === 1 ? 'person' : 'people'} right now.` : ' '}
                </Text>
              </>
            )}
          </View>

          <View>
            <SectionTitle title="Options" />
            <SwitchRow label="Pin to the top" description="Stays above newer announcements in the feed." value={pinned} onValueChange={setPinned} />
            {!sent && (
              <SwitchRow label="Urgent" description="Red badge, and the push ignores members' quiet hours. Use for closures and safety." value={urgent} onValueChange={setUrgent} />
            )}
            {!sent && (
              <>
                <SwitchRow label="Schedule for later" value={scheduled} onValueChange={setScheduled} />
                {scheduled && (
                  <View style={{ flexDirection: 'row', gap: SP.md, alignItems: 'flex-end' }}>
                    <View style={{ flex: 1 }}><DateField label="Send on" value={sendDate} onChange={setSendDate} minYear={new Date().getFullYear()} /></View>
                    <View style={{ marginBottom: 16 }}><TimeField label="Send at" value={sendTime} onChange={setSendTime} /></View>
                  </View>
                )}
              </>
            )}
            <SwitchRow label="Expires" description="Hidden from the feed after this time." value={expires} onValueChange={setExpires} />
            {expires && (
              <View style={{ flexDirection: 'row', gap: SP.md, alignItems: 'flex-end' }}>
                <View style={{ flex: 1 }}><DateField label="Expires on" value={expDate} onChange={setExpDate} minYear={new Date().getFullYear()} /></View>
                <View style={{ marginBottom: 16 }}><TimeField label="Expires at" value={expTime} onChange={setExpTime} /></View>
              </View>
            )}
          </View>

          {error && <Text accessibilityRole="alert" style={{ color: T.err, fontSize: 14 }}>{error}</Text>}

          <View style={{ gap: SP.md }}>
            {sent ? (
              <PrimaryButton label="Save changes" icon="check" loading={busy} onPress={() => submit('draft')} />
            ) : (
              <>
                {scheduled
                  ? <PrimaryButton label={a?.status === 'Scheduled' ? 'Update schedule' : 'Schedule'} icon="clock" loading={busy} onPress={() => submit('schedule')} />
                  : <PrimaryButton label="Send now" icon="send" loading={busy} onPress={() => submit('publish')} />}
                <PrimaryButton label="Save as draft" variant="secondary" disabled={busy} onPress={() => submit('draft')} />
                {a?.status === 'Scheduled' && (
                  <PrimaryButton label="Unschedule (back to draft)" variant="secondary" loading={unschedule.isPending} onPress={onUnschedule} />
                )}
              </>
            )}
            {announcementId > 0 && (
              <PrimaryButton label={sent ? 'Take down' : 'Delete'} variant="danger" icon="trash-2" loading={remove.isPending} onPress={onDelete} />
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
