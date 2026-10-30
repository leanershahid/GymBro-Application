import React from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import BottomSheet from '../../common/components/BottomSheet';
import { T, SP } from '../../../theme';

export interface DetailRow { label: string; value: string | number | null | undefined }

interface Props {
  visible: boolean;
  onClose: () => void;
  title: string;
  loading?: boolean;
  error?: string | null;
  rows: DetailRow[];
  /** Optional actions under the fields (e.g. a delete button). */
  footer?: React.ReactNode;
}

/** Read-only bottom sheet listing an item's fields; empty values are skipped. */
export default function DetailSheet({ visible, onClose, title, loading, error, rows, footer }: Props) {
  const shown = rows.filter(r => r.value !== null && r.value !== undefined && String(r.value).trim() !== '');
  return (
    <BottomSheet visible={visible} onClose={onClose} title={title}>
      <ScrollView style={{ maxHeight: 520 }} contentContainerStyle={{ padding: SP.xl, gap: SP.md }}>
        {loading ? (
          <ActivityIndicator color={T.brand} style={{ marginVertical: SP.xl }} />
        ) : error ? (
          <Text style={{ color: T.err, fontSize: 14 }}>{error}</Text>
        ) : (
          shown.map(r => (
            <View key={r.label} style={{ borderBottomWidth: 1, borderBottomColor: T.line, paddingBottom: SP.md }}>
              <Text style={{ color: T.textFaint, fontSize: 11, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>
                {r.label}
              </Text>
              <Text style={{ color: T.text, fontSize: 15 }} selectable>{String(r.value)}</Text>
            </View>
          ))
        )}
        {!loading && footer}
      </ScrollView>
    </BottomSheet>
  );
}

export const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : null;
