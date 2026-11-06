import React from 'react';
import { Modal, Platform, ScrollView, Share, Text, View } from 'react-native';
import { T, SP, R } from '../../../theme';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import LoadingState from '../../common/components/LoadingState';
import EmptyState from '../../common/components/EmptyState';
import { describeApiError } from '../../../api/apiError';
import { useSignedCopy } from '../api/safetyQueries';
import { WaiverSignature } from '../api/safety.types';
import WaiverText from './WaiverText';

const fmtStamp = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });

const esc = (s: string) => s.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!));

function signatureBlock(s: WaiverSignature) {
  return [
    `Signed by: ${s.signedName}${s.memberName ? ` (account: ${s.memberName})` : ''}`,
    `Signed at: ${fmtStamp(s.signedAt)}`,
    `Version: ${s.version}`,
    s.ip ? `IP address: ${s.ip}` : null,
    s.userAgent ? `Device: ${s.userAgent}` : null,
    `Document fingerprint (SHA-256): ${s.bodyHash}`,
  ].filter(Boolean) as string[];
}

/** Print (web: a clean print window) or share (phones) the signed copy. */
export function printSignedCopy(s: WaiverSignature) {
  const lines = signatureBlock(s);
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const w = window.open('', '_blank');
    if (!w) return;
    // Print stylesheet only: this is a paper document, not an app screen.
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(s.title)} — signed copy</title>
<style>body{font:14px/1.55 system-ui,sans-serif;max-width:720px;margin:32px auto;padding:0 16px;color:#111}
pre{white-space:pre-wrap;font:inherit}h1{font-size:20px}.sig{border-top:1px solid #999;margin-top:24px;padding-top:12px}</style>
</head><body><h1>${esc(s.title)}</h1><pre>${esc(s.body ?? '')}</pre><div class="sig">${lines.map(l => `<div>${esc(l)}</div>`).join('')}</div>
<script>window.onload=function(){window.print()}</script></body></html>`);
    w.document.close();
    return;
  }
  Share.share({ title: `${s.title} — signed copy`, message: `${s.title}\n\n${s.body ?? ''}\n\n${lines.join('\n')}` }).catch(() => undefined);
}

/** Full-screen view of one signed waiver, exactly as signed, with a Print / Share action. */
export default function SignedWaiverSheet({ signatureId, onClose }: { signatureId: number | null; onClose: () => void }) {
  const q = useSignedCopy(signatureId);
  return (
    <Modal visible={!!signatureId} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <Screen>
        <ScreenHeader
          eyebrow="Signed copy"
          title={q.data?.title ?? 'Waiver'}
          onBack={onClose}
          action={q.data ? { label: Platform.OS === 'web' ? 'Print' : 'Share', icon: Platform.OS === 'web' ? 'printer' : 'share', onPress: () => printSignedCopy(q.data!) } : undefined}
        />
        {q.isLoading ? <LoadingState label="Loading signed copy" /> : q.isError || !q.data ? (
          <EmptyState icon="alert-triangle" tone="error" title="Couldn't load the signed copy"
            subtitle={describeApiError(q.error).message} action={{ label: 'Try again', onPress: () => q.refetch() }} />
        ) : (
          <ScrollView contentContainerStyle={{ paddingHorizontal: SP.xl, paddingBottom: SP.xxl, maxWidth: 720, width: '100%', alignSelf: 'center' }}>
            <View style={{ backgroundColor: T.bgInput, borderRadius: R.lg, borderWidth: 1, borderColor: T.line, padding: SP.lg }}>
              <WaiverText body={q.data.body ?? ''} />
            </View>
            <View style={{ marginTop: SP.lg, padding: SP.lg, borderRadius: R.lg, borderWidth: 1, borderColor: T.line, gap: 6 }}>
              <Text style={{ color: T.text, fontSize: 22, fontStyle: 'italic', fontWeight: '600' }}>{q.data.signedName}</Text>
              {signatureBlock(q.data).map(l => <Text key={l} selectable style={{ color: T.textSub, fontSize: 12 }}>{l}</Text>)}
            </View>
          </ScrollView>
        )}
      </Screen>
    </Modal>
  );
}
