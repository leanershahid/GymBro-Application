import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, ListRenderItemInfo, ScrollView, Text, TextInput, View } from 'react-native';
import { T, SP, R } from '../../../theme';
import { useLayout } from '../../../utils/useLayout';
import { apiErrorText, describeApiError } from '../../../api/apiError';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import SearchBar from '../../common/components/SearchBar';
import SegmentedTabs from '../../common/components/SegmentedTabs';
import Skeleton from '../../common/components/Skeleton';
import EmptyState from '../../common/components/EmptyState';
import PrimaryButton from '../../common/components/PrimaryButton';
import { SwitchRow } from '../../common/components/FormFields';
import { useToast } from '../../common/components/Toast';
import { useMessagingSettings, useReviewList, useSaveMessagingSettings } from '../api/messagingQueries';
import type { MessagingSettings, ReviewConversationSummary } from '../api/messaging.types';
import { Banner, ReviewRow } from '../components/MessagingUi';

const keyOf = (c: ReviewConversationSummary) => String(c.id);
const Gap = () => <View style={{ height: 10 }} />;

/** Admin (module admin.messages): search trainer ↔ member threads read-only, and the gym's messaging policy. */
export default function MessagesReviewPage({ onBack, onOpen }: { onBack: () => void; onOpen: (id: number) => void }) {
  const { hPad } = useLayout();
  const [tab, setTab] = useState<'threads' | 'reported' | 'settings'>('threads');
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  useEffect(() => { const h = setTimeout(() => setTerm(search.trim()), 350); return () => clearTimeout(h); }, [search]);
  const q = useReviewList(term, tab === 'reported');
  const renderRow = useCallback(({ item }: ListRenderItemInfo<ReviewConversationSummary>) => <ReviewRow c={item} onPress={onOpen} />, [onOpen]);

  return (
    <Screen>
      <ScreenHeader eyebrow="Safeguarding" title="Messages review" onBack={onBack} />
      <View style={{ paddingHorizontal: hPad, gap: SP.md, paddingBottom: SP.md, width: '100%', maxWidth: 820, alignSelf: 'center' }}>
        <SegmentedTabs tabs={[{ key: 'threads', label: 'Conversations' }, { key: 'reported', label: 'Reported' }, { key: 'settings', label: 'Settings' }]}
          value={tab} onChange={setTab} />
        {tab !== 'settings' && (
          <>
            <Banner icon="eye" tone={T.brandGold}>Read-only. Every conversation you open is recorded in the audit log, and members and trainers are told threads may be reviewed for safety.</Banner>
            <SearchBar value={search} onChangeText={setSearch} placeholder="Search by member or trainer…" label="Search by member or trainer name or email" />
          </>
        )}
      </View>
      {tab === 'settings' ? <SettingsForm /> : (
        <>
          {q.isLoading && <View style={{ paddingHorizontal: hPad }}><Skeleton rows={4} height={80} /></View>}
          {q.isError && <EmptyState icon="alert-triangle" tone="error" title="Couldn't load conversations" subtitle={describeApiError(q.error).message} action={{ label: 'Try again', onPress: () => q.refetch() }} />}
          {q.data && (
            <FlatList data={q.data} keyExtractor={keyOf} renderItem={renderRow} ItemSeparatorComponent={Gap}
              contentContainerStyle={{ paddingHorizontal: hPad, paddingBottom: 48, flexGrow: 1, width: '100%', maxWidth: 820, alignSelf: 'center' }}
              ListEmptyComponent={
                <EmptyState icon={tab === 'reported' ? 'flag' : 'message-square'}
                  title={term ? 'No matches' : tab === 'reported' ? 'No reported messages' : 'No conversations yet'}
                  subtitle={term ? 'Try another name or email.' : tab === 'reported' ? 'Reports from members and trainers show up here and in Support.' : 'Trainer ↔ member conversations will appear here once they start.'}
                  action={term ? { label: 'Clear search', onPress: () => setSearch('') } : undefined} />
              } />
          )}
        </>
      )}
    </Screen>
  );
}

function SettingsForm() {
  const { hPad } = useLayout();
  const toast = useToast();
  const q = useMessagingSettings();
  const save = useSaveMessagingSettings();
  const [s, setS] = useState<MessagingSettings | null>(null);
  useEffect(() => { if (q.data) setS(q.data); }, [q.data]);
  if (q.isLoading || !s) return <View style={{ paddingHorizontal: hPad }}><Skeleton rows={3} height={56} /></View>;
  const set = (p: Partial<MessagingSettings>) => setS({ ...s, ...p });
  const input = { color: T.text, fontSize: 14, padding: SP.md, backgroundColor: T.bgInput, borderRadius: R.md, borderWidth: 1, borderColor: T.line } as const;
  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: hPad, paddingBottom: 48, width: '100%', maxWidth: 820, alignSelf: 'center' }}>
      <SwitchRow label="Trainer ↔ member messaging" value={s.enabled} onValueChange={v => set({ enabled: v })}
        description="Off: existing conversations stay readable, nobody can send." />
      <SwitchRow label="Allow members under 18" value={s.allowMembersUnder18} onValueChange={v => set({ allowMembersUnder18: v })}
        description="Uses the member's date of birth. Off by default for safeguarding." />
      <Text style={{ color: T.textSub, fontSize: 13, marginBottom: 6 }}>Outside-hours notice (optional)</Text>
      <TextInput value={s.outsideHoursNotice ?? ''} onChangeText={v => set({ outsideHoursNotice: v })} multiline maxLength={300}
        placeholder="e.g. Coaches reply between 8am and 8pm. For anything urgent, call the front desk." placeholderTextColor={T.textFaint}
        accessibilityLabel="Outside-hours notice" style={{ ...input, minHeight: 72, textAlignVertical: 'top' }} />
      <Text style={{ color: T.textFaint, fontSize: 12, marginTop: 6, marginBottom: SP.lg }}>Shown at the top of a member's conversation outside working hours.</Text>
      <View style={{ flexDirection: 'row', gap: SP.md }}>
        {(['workingHoursStart', 'workingHoursEnd'] as const).map(k => (
          <View key={k} style={{ flex: 1 }}>
            <Text style={{ color: T.textSub, fontSize: 13, marginBottom: 6 }}>{k === 'workingHoursStart' ? 'Working hours from' : 'Until'}</Text>
            <TextInput value={s[k]} onChangeText={v => set({ [k]: v })} placeholder="08:00" placeholderTextColor={T.textFaint} maxLength={5}
              accessibilityLabel={k === 'workingHoursStart' ? 'Working hours start, HH:mm' : 'Working hours end, HH:mm'} style={input} />
          </View>
        ))}
      </View>
      <PrimaryButton label="Save settings" icon="save" loading={save.isPending} style={{ marginTop: SP.xl }}
        onPress={() => save.mutate({ ...s, outsideHoursNotice: s.outsideHoursNotice?.trim() || null }, {
          onSuccess: () => toast.show({ message: 'Messaging settings saved.' }),
          onError: e => toast.show({ type: 'error', message: apiErrorText(e) }),
        })} />
    </ScrollView>
  );
}
