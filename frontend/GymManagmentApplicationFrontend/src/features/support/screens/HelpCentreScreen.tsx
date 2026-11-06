import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, SP, R, withAlpha } from '../../../theme';
import { useLayout } from '../../../utils/useLayout';
import { describeApiError } from '../../../api/apiError';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import SearchBar from '../../common/components/SearchBar';
import PrimaryButton from '../../common/components/PrimaryButton';
import EmptyState from '../../common/components/EmptyState';
import LoadingState from '../../common/components/LoadingState';
import Skeleton from '../../common/components/Skeleton';
import { useHelpCentre, useMyRequests } from '../api/supportQueries';
import { SupportFaq, SupportRequestSummary } from '../api/support.types';
import { Card, RowButton, SectionTitle, StatusChip, ago, categoryOf } from '../components/SupportUi';

interface Props {
  onBack: () => void;
  onNew: () => void;
  onOpen: (requestId: number) => void;
}

function useDebounced(value: string, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

const FaqItem = React.memo(function FaqItem({ f }: { f: SupportFaq }) {
  const [open, setOpen] = useState(false);
  return (
    <Pressable onPress={() => setOpen(o => !o)} accessibilityRole="button" accessibilityLabel={f.question}
      accessibilityState={{ expanded: open }} accessibilityHint={open ? 'Hides the answer' : 'Shows the answer'}
      style={({ pressed }) => ({ backgroundColor: pressed ? T.bgInputActive : T.bgInput, borderRadius: R.lg, borderWidth: 1, borderColor: open ? T.brandBorder : T.line, padding: SP.lg, minHeight: 52 })}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.md }}>
        <Text style={{ flex: 1, color: T.text, fontSize: 15, fontWeight: '600' }}>{f.question}</Text>
        <Feather name={open ? 'chevron-up' : 'chevron-down'} size={18} color={T.textSub} />
      </View>
      {open && <Text selectable style={{ color: T.textSub, fontSize: 14, lineHeight: 21, marginTop: SP.sm }}>{f.answer}</Text>}
    </Pressable>
  );
});

const RequestRow = React.memo(function RequestRow({ r, onOpen }: { r: SupportRequestSummary; onOpen: (id: number) => void }) {
  const c = categoryOf(r.category);
  const needsYou = r.status === 'waiting';
  return (
    <RowButton onPress={() => onOpen(r.id)} label={`${r.subject}, ${r.status === 'waiting' ? 'waiting on you' : r.status}, ${ago(r.lastMessageAt)}`}
      style={needsYou ? { borderColor: withAlpha(T.brandGold, 0.4) } : undefined}>
      <View style={{ flexDirection: 'row', gap: SP.md, alignItems: 'flex-start' }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: T.brandDim, alignItems: 'center', justifyContent: 'center' }}>
          <Feather name={c.icon} size={18} color={T.brand} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text numberOfLines={1} style={{ color: T.text, fontSize: 15, fontWeight: '700' }}>{r.subject}</Text>
          {!!r.preview && <Text numberOfLines={1} style={{ color: T.textSub, fontSize: 13 }}>{r.lastMessageBy === 'staff' ? 'Gym: ' : 'You: '}{r.preview}</Text>}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
            <StatusChip status={r.status} />
            <Text style={{ color: T.textFaint, fontSize: 12 }}>{c.label} · {ago(r.lastMessageAt)}</Text>
          </View>
        </View>
      </View>
    </RowButton>
  );
});

/** Help & feedback: searchable FAQ, "Contact us", and the member's requests. */
export default function HelpCentreScreen({ onBack, onNew, onOpen }: Props) {
  const { hPad } = useLayout();
  const [query, setQuery] = useState('');
  const search = useDebounced(query.trim());
  const help = useHelpCentre(search);
  const mine = useMyRequests();
  const h = help.data;
  const requests = mine.data ?? [];

  return (
    <Screen>
      <ScreenHeader eyebrow="Support" title="Help & feedback" onBack={onBack} />
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: hPad, paddingBottom: 120, gap: SP.xxl, width: '100%', maxWidth: 680, alignSelf: 'center' }}>

        {h && h.waitingOnYou > 0 && (
          <Card accent={T.brandGold}>
            <Text style={{ color: T.text, fontSize: 15, fontWeight: '700' }}>
              {h.waitingOnYou === 1 ? 'The gym replied to your request' : `The gym replied to ${h.waitingOnYou} of your requests`}
            </Text>
            <Text style={{ color: T.textSub, fontSize: 13, marginTop: 4 }}>Have a look below and let them know if it's sorted.</Text>
          </Card>
        )}

        {/* ── FAQ ── */}
        <View>
          <SectionTitle>Quick answers</SectionTitle>
          <SearchBar value={query} onChangeText={setQuery} placeholder="Search help (e.g. freeze, locker)" label="Search help" style={{ marginBottom: SP.md }} />
          {help.isLoading && <Skeleton rows={3} height={52} borderRadius={16} gap={8} />}
          {help.isError && !h && (
            <EmptyState icon="alert-triangle" tone="error" title="Couldn't load help" subtitle={describeApiError(help.error).message}
              action={{ label: 'Try again', onPress: () => help.refetch() }} />
          )}
          {h && (
            <View style={{ gap: 8 }}>
              {h.faqs.map(f => <FaqItem key={f.id} f={f} />)}
              {h.faqs.length === 0 && (
                <Text style={{ color: T.textSub, fontSize: 14, paddingVertical: 8 }}>
                  {search ? `Nothing matches "${search}". Ask us below — we're happy to help.` : 'No quick answers yet. Ask us anything below.'}
                </Text>
              )}
            </View>
          )}
        </View>

        {/* ── Contact us ── */}
        {h && (
          <Card accent={T.brand}>
            <View style={{ flexDirection: 'row', gap: SP.md, alignItems: 'center', marginBottom: SP.md }}>
              <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: T.brandDim, alignItems: 'center', justifyContent: 'center' }}>
                <Feather name="message-circle" size={20} color={T.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <Text accessibilityRole="header" style={{ color: T.text, fontSize: 18, fontWeight: '700' }}>Contact us</Text>
                <Text style={{ color: T.textSub, fontSize: 13, marginTop: 2 }}>
                  {h.requestsEnabled ? `Questions, problems or ideas — we usually reply within ${h.firstResponseHours} hours.` : 'Please speak to the front desk — in-app requests are paused.'}
                </Text>
              </View>
            </View>
            {h.requestsEnabled && <PrimaryButton label="Start a request" icon="edit-3" onPress={onNew} />}
          </Card>
        )}

        {/* ── My requests ── */}
        <View>
          <SectionTitle>Your requests</SectionTitle>
          {mine.isLoading && <LoadingState label="Loading your requests" />}
          {mine.isError && (
            <EmptyState icon="alert-triangle" tone="error" title="Couldn't load your requests" subtitle={describeApiError(mine.error).message}
              action={{ label: 'Try again', onPress: () => mine.refetch() }} />
          )}
          {mine.isSuccess && requests.length === 0 && (
            <EmptyState icon="inbox" title="No requests yet" subtitle="When you ask us something, you can follow the conversation here."
              action={h?.requestsEnabled ? { label: 'Start a request', onPress: onNew } : undefined} />
          )}
          <View style={{ gap: SP.md }}>
            {requests.map(r => <RequestRow key={r.id} r={r} onOpen={onOpen} />)}
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}
