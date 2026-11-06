import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, SP, R, withAlpha } from '../../../theme';
import { useLayout } from '../../../utils/useLayout';
import { describeApiError } from '../../../api/apiError';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import SearchBar from '../../common/components/SearchBar';
import SegmentedTabs from '../../common/components/SegmentedTabs';
import EmptyState from '../../common/components/EmptyState';
import Skeleton from '../../common/components/Skeleton';
import PaginationFooter from '../../common/components/PaginationFooter';
import StatusPill from '../../common/components/StatusPill';
import { useQueue, useStaffOptions, useSupportCount } from '../api/supportQueries';
import { DeskMode } from '../api/supportApi';
import { QueueFilter, SupportCategory, SupportPriority, SupportRequestSummary } from '../api/support.types';
import { CATEGORIES, PRIORITY_LABEL, PRIORITY_TONE, SlaChip, StatusChip, ago, dueText } from '../components/SupportUi';
import { CannedRepliesTab, FaqTab, FeedbackTab, SupportSettingsTab } from '../components/SupportAdminTabs';

type Tab = 'requests' | 'faq' | 'replies' | 'feedback' | 'settings';
const TABS: { key: Tab; label: string }[] = [
  { key: 'requests', label: 'Requests' }, { key: 'faq', label: 'FAQ' }, { key: 'replies', label: 'Replies' },
  { key: 'feedback', label: 'Feedback' }, { key: 'settings', label: 'Settings' },
];
type StatusKey = NonNullable<QueueFilter['status']>;
const STATUSES: { key: StatusKey; label: string }[] = [
  { key: 'active', label: 'Active' }, { key: 'open', label: 'Open' }, { key: 'waiting', label: 'Waiting' },
  { key: 'resolved', label: 'Resolved' }, { key: 'closed', label: 'Closed' }, { key: 'all', label: 'All' },
];

interface Props {
  mode?: DeskMode;
  onBack?: () => void;
  onOpen: (requestId: number) => void;
  onOpenMember?: (memberId: number) => void;
}

function Chip({ label, on, onPress, tone = T.brand }: { label: string; on: boolean; onPress: () => void; tone?: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={label}
      style={{ minHeight: 36, paddingHorizontal: 14, justifyContent: 'center', borderRadius: R.pill, borderWidth: 1,
        borderColor: on ? tone : T.line, backgroundColor: on ? withAlpha(tone, 0.14) : T.bgInput }}>
      <Text style={{ color: on ? T.text : T.textSub, fontSize: 13, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

const Row = React.memo(function Row({ r, onOpen, staff }: { r: SupportRequestSummary; onOpen: (id: number) => void; staff: boolean }) {
  const overdue = !!r.sla?.overdue;
  const firstDue = r.sla && (r.sla.firstResponse === 'overdue' || r.sla.firstResponse === 'due_soon') ? `Reply ${dueText(r.sla.firstResponseDueAt)}`
    : r.sla && (r.sla.resolution === 'overdue' || r.sla.resolution === 'due_soon') ? `Resolve ${dueText(r.sla.resolutionDueAt)}` : null;
  return (
    <Pressable onPress={() => onOpen(r.id)} accessibilityRole="button"
      accessibilityLabel={`${r.subject} from ${r.memberName ?? 'member'}, ${r.status}${overdue ? ', overdue' : ''}${r.assigneeName ? `, assigned to ${r.assigneeName}` : ', unassigned'}`}
      style={({ pressed }) => ({
        backgroundColor: pressed ? T.bgInputActive : T.bgInput, borderRadius: R.lg, borderWidth: 1, padding: SP.lg, gap: 6,
        borderColor: overdue ? withAlpha(T.err, 0.5) : T.line, borderLeftWidth: overdue ? 4 : 1, borderLeftColor: overdue ? T.err : T.line,
      })}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text numberOfLines={1} style={{ flex: 1, color: T.text, fontSize: 15, fontWeight: '700' }}>{r.subject}</Text>
        <Text style={{ color: T.textFaint, fontSize: 12 }}>{ago(r.lastMessageAt)}</Text>
      </View>
      <Text numberOfLines={1} style={{ color: T.textSub, fontSize: 13 }}>
        {r.memberName ?? 'Member'} · {r.categoryLabel}{r.branchName ? ` · ${r.branchName}` : ''}
      </Text>
      {!!r.preview && <Text numberOfLines={1} style={{ color: T.textFaint, fontSize: 13 }}>{r.lastMessageBy === 'member' ? '↩ ' : ''}{r.preview}</Text>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginTop: 2 }}>
        <StatusChip status={r.status} staff />
        {r.priority !== 'normal' && <StatusPill label={PRIORITY_LABEL[r.priority]} tone={PRIORITY_TONE[r.priority]} />}
        <SlaChip sla={r.sla} />
        {staff && <Text style={{ color: r.assigneeName ? T.textSub : T.brandGold, fontSize: 12 }}>{r.assigneeName ? `→ ${r.assigneeName}` : 'Unassigned'}</Text>}
        {firstDue && <Text style={{ color: overdue ? T.err : T.brandGold, fontSize: 12, fontWeight: '600' }}>{firstDue}</Text>}
      </View>
    </Pressable>
  );
});

const keyOf = (r: SupportRequestSummary) => String(r.id);

/** Staff support queue (filters, SLA highlighting) + FAQ, saved replies, class feedback and settings. Trainers: their assigned requests only. */
export default function SupportQueuePage({ mode = 'staff', onBack, onOpen }: Props) {
  const staff = mode === 'staff';
  const { hPad } = useLayout();
  const [tab, setTab] = useState<Tab>('requests');
  const [status, setStatus] = useState<StatusKey>('active');
  const [category, setCategory] = useState<SupportCategory | ''>('');
  const [priority, setPriority] = useState<SupportPriority | ''>('');
  const [assignee, setAssignee] = useState('');
  const [overdue, setOverdue] = useState(false);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  useEffect(() => { const t = setTimeout(() => setSearch(query.trim()), 300); return () => clearTimeout(t); }, [query]);
  useEffect(() => { setPage(1); }, [status, category, priority, assignee, overdue, search]);

  const filter: QueueFilter = { status, category, priority, assignee, overdue: overdue || undefined, search: search || undefined, page, size: 20 };
  const q = useQueue(mode, filter);
  const count = useSupportCount(mode).data;
  const people = useStaffOptions(staff && showFilters).data ?? [];
  const items = q.data?.items ?? [];
  const renderItem = useCallback(({ item }: { item: SupportRequestSummary }) => <Row r={item} onOpen={onOpen} staff={staff} />, [onOpen, staff]);
  const filtersOn = !!category || !!priority || !!assignee;

  const header = (
    <View style={{ gap: SP.md, paddingBottom: SP.md }}>
      {count && (
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {staff && <Chip label={`Unassigned · ${count.unassigned}`} on={assignee === 'none'} tone={T.brandGold} onPress={() => setAssignee(a => (a === 'none' ? '' : 'none'))} />}
          <Chip label={`Overdue · ${count.overdue}`} on={overdue} tone={T.err} onPress={() => setOverdue(o => !o)} />
          {staff && <Chip label={`Mine · ${count.mine}`} on={assignee === 'me'} onPress={() => setAssignee(a => (a === 'me' ? '' : 'me'))} />}
        </View>
      )}
      <SearchBar value={query} onChangeText={setQuery} placeholder="Search subject, member or #id" label="Search requests" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {STATUSES.map(s => <Chip key={s.key} label={s.label} on={status === s.key} onPress={() => setStatus(s.key)} />)}
      </ScrollView>
      <Pressable onPress={() => setShowFilters(f => !f)} accessibilityRole="button" accessibilityState={{ expanded: showFilters }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36 }}>
        <Feather name="sliders" size={15} color={filtersOn ? T.brand : T.textSub} />
        <Text style={{ color: filtersOn ? T.brand : T.textSub, fontSize: 13, fontWeight: '600' }}>{showFilters ? 'Hide filters' : filtersOn ? 'Filters on' : 'More filters'}</Text>
      </Pressable>
      {showFilters && (
        <View style={{ gap: 8 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            <Chip label="Any category" on={!category} onPress={() => setCategory('')} />
            {CATEGORIES.map(c => <Chip key={c.key} label={c.label} on={category === c.key} onPress={() => setCategory(c.key)} />)}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            <Chip label="Any priority" on={!priority} onPress={() => setPriority('')} />
            {(['urgent', 'high', 'normal', 'low'] as SupportPriority[]).map(p => <Chip key={p} label={PRIORITY_LABEL[p]} on={priority === p} onPress={() => setPriority(p)} />)}
          </ScrollView>
          {staff && people.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              <Chip label="Anyone" on={!assignee} onPress={() => setAssignee('')} />
              {people.map(p => <Chip key={p.id} label={p.name} on={assignee === String(p.id)} onPress={() => setAssignee(String(p.id))} />)}
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );

  return (
    <Screen>
      <ScreenHeader eyebrow={staff ? 'Members' : 'Assigned to you'} title={staff ? 'Support' : 'Help requests'} onBack={onBack} />
      {staff && (
        <View style={{ paddingHorizontal: hPad, paddingBottom: SP.md }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <SegmentedTabs tabs={TABS} value={tab} onChange={setTab} />
          </ScrollView>
        </View>
      )}
      {tab === 'requests' && (
        <FlatList
          data={items}
          keyExtractor={keyOf}
          renderItem={renderItem}
          ListHeaderComponent={header}
          ItemSeparatorComponent={() => <View style={{ height: SP.md }} />}
          contentContainerStyle={{ paddingHorizontal: hPad, paddingBottom: 120, width: '100%', maxWidth: 900, alignSelf: 'center' }}
          keyboardShouldPersistTaps="handled"
          refreshing={q.isRefetching}
          onRefresh={() => q.refetch()}
          ListEmptyComponent={
            q.isLoading ? <Skeleton rows={4} height={96} /> :
            q.isError ? <EmptyState icon="alert-triangle" tone="error" title="Couldn't load requests" subtitle={describeApiError(q.error).message} action={{ label: 'Try again', onPress: () => q.refetch() }} /> :
            <EmptyState icon="smile" title={status === 'active' && !search && !filtersOn && !overdue ? 'All caught up' : 'Nothing matches'}
              subtitle={status === 'active' && !search && !filtersOn && !overdue
                ? (staff ? 'No open requests from members right now.' : 'Nothing is assigned to you right now.')
                : 'Try another filter or search.'}
              action={filtersOn || overdue || search ? { label: 'Clear filters', onPress: () => { setCategory(''); setPriority(''); setAssignee(''); setOverdue(false); setQuery(''); } } : undefined} />
          }
          ListFooterComponent={q.data && q.data.totalPages > 1
            ? <PaginationFooter page={page} totalPages={q.data.totalPages} onChange={setPage} /> : null}
        />
      )}
      {tab === 'faq' && <FaqTab />}
      {tab === 'replies' && <CannedRepliesTab />}
      {tab === 'feedback' && <FeedbackTab />}
      {tab === 'settings' && <SupportSettingsTab />}
    </Screen>
  );
}
