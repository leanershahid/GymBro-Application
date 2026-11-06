import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { T, R, SP } from '../../../theme';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import EmptyState from '../../common/components/EmptyState';
import Skeleton from '../../common/components/Skeleton';
import SmallButton from '../../common/components/SmallButton';
import { notify } from '../../common/components/dialogs';
import { apiErrorText } from '../../../api/apiError';
import { useCommentMine, useMyReport } from '../api/facilitiesQueries';
import { REPORT_STATUS_LABEL, dateTimeLabel, isOpenReport } from '../utils/facilitiesFormat';
import { Card, PhotoStrip, ReportStatusChip, SectionTitle } from '../components/FacilitiesUi';
import type { ReportStatus } from '../types/facilities.types';

interface Props { reportId: number; onBack?: () => void }

const STEPS: ReportStatus[] = ['Received', 'InProgress', 'Fixed'];

/** One of the member's reports: status steps, what they sent, the gym's replies, add a comment. */
export default function MyReportScreen({ reportId, onBack }: Props) {
  const q = useMyReport(reportId);
  const comment = useCommentMine(reportId);
  const [text, setText] = useState('');
  const r = q.data;

  const send = async () => {
    try { await comment.mutateAsync(text.trim()); setText(''); }
    catch (e) { notify("Couldn't add the comment", apiErrorText(e)); }
  };

  return (
    <Screen>
      <ScreenHeader eyebrow="Problem report" title={r?.subject ?? 'Report'} onBack={onBack} />
      {q.isLoading ? (
        <View style={{ paddingHorizontal: SP.xl }} accessibilityLabel="Loading the report"><Skeleton rows={3} height={96} /></View>
      ) : q.isError || !r ? (
        <EmptyState icon="alert-triangle" tone="error" title="Couldn't load this report" subtitle={apiErrorText(q.error)}
          action={{ label: 'Try again', onPress: () => q.refetch() }} />
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: SP.xl, paddingBottom: 130, gap: SP.xl }}>
            <Card>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: SP.sm }}>
                <Text style={{ color: T.text, fontSize: 16, fontWeight: '700', flex: 1 }}>{r.problemLabel}</Text>
                <ReportStatusChip status={r.status} />
              </View>
              <Text style={{ color: T.textSub, fontSize: 13, marginTop: 4 }}>
                {r.isMine ? 'You reported this' : 'You said you noticed this'} · {dateTimeLabel(r.createdAt)}{r.zone ? ` · ${r.zone}` : ''}
              </Text>
              {r.status !== 'CantReproduce' && (
                <View accessibilityRole="progressbar" accessibilityLabel={`Status: ${REPORT_STATUS_LABEL[r.status]}`}
                  style={{ flexDirection: 'row', gap: 6, marginTop: SP.lg }}>
                  {STEPS.map((s, i) => {
                    const reached = STEPS.indexOf(r.status) >= i;
                    return (
                      <View key={s} style={{ flex: 1, gap: 6 }}>
                        <View style={{ height: 4, borderRadius: 2, backgroundColor: reached ? T.brand : T.line }} />
                        <Text style={{ color: reached ? T.text : T.textFaint, fontSize: 12, fontWeight: '600' }}>{REPORT_STATUS_LABEL[s]}</Text>
                      </View>
                    );
                  })}
                </View>
              )}
              {r.resolutionNote && (
                <Text style={{ color: T.text, fontSize: 14, marginTop: SP.lg }}>{r.resolutionNote}</Text>
              )}
            </Card>

            {(r.description || r.photoUrls.length > 0) && (
              <View>
                <SectionTitle title="What you sent" />
                <Card style={{ gap: SP.md }}>
                  {r.description && <Text style={{ color: T.textSub, fontSize: 14 }}>{r.description}</Text>}
                  <PhotoStrip urls={r.photoUrls} />
                </Card>
              </View>
            )}

            <View>
              <SectionTitle title="Updates" />
              {r.comments.length === 0 ? (
                <Text style={{ color: T.textFaint, fontSize: 14 }}>
                  {isOpenReport(r.status) ? "No updates yet — we'll notify you when something changes." : 'No comments.'}
                </Text>
              ) : (
                <View style={{ gap: SP.sm }} accessibilityRole="list">
                  {r.comments.map(c => (
                    <View key={c.id} accessibilityLabel={`${c.authorName}: ${c.body}`}
                      style={{ padding: SP.md, borderRadius: R.lg, backgroundColor: c.isStaff ? T.brandDim : T.bgInput, borderWidth: 1, borderColor: c.isStaff ? T.brandBorder : T.line }}>
                      <Text style={{ color: c.isStaff ? T.brand : T.textSub, fontSize: 12, fontWeight: '700' }}>{c.authorName} · {dateTimeLabel(c.createdAt)}</Text>
                      <Text style={{ color: T.text, fontSize: 14, marginTop: 4 }}>{c.body}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {r.canComment && (
              <View style={{ gap: SP.sm }}>
                <TextInput value={text} onChangeText={setText} multiline maxLength={1000} placeholder="Add a comment"
                  placeholderTextColor={T.textFaint} accessibilityLabel="Add a comment"
                  style={{ minHeight: 72, borderRadius: R.lg, padding: SP.lg, color: T.text, fontSize: 15, textAlignVertical: 'top', backgroundColor: T.bgInput, borderWidth: 1, borderColor: T.line }} />
                <View style={{ alignSelf: 'flex-end' }}>
                  <SmallButton icon="send" label="Send" onPress={send} disabled={!text.trim()} busy={comment.isPending} />
                </View>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </Screen>
  );
}
