import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { TrainerPayload, Certification, Document } from '../types/trainer.types';
import { Field, RowGrid, GridCell } from './FormFields';
import { DateField } from './DatePicker';
import GlassCard from './GlassCard';
import { T } from '../../../theme';
import UploadField from '../../common/components/UploadField';

interface Props {
  data: Partial<TrainerPayload>;
  onChange: (fields: Partial<TrainerPayload>) => void;
}

const emptyCert = (): Certification => ({
  certificateName: '', certificateNumber: '', issuedBy: '',
  issueDate: '', expiryDate: '', documentUrl: '',
});
const emptyDoc = (): Document => ({
  documentType: '', documentNumber: '', documentUrl: '', expiryDate: '',
});

export default function StepCertDocuments({ data, onChange }: Props) {
  const certs = data.certifications ?? [];
  const docs  = data.documents ?? [];

  return (
    <ScrollView
      className="flex-1 bg-bg"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 48, gap: 12 }}
      showsVerticalScrollIndicator={false}
    >
      <Text className="text-[30px] font-extrabold text-white mb-[6px]" style={{ letterSpacing: -0.5 }}>
        Certs & Docs
      </Text>
      <Text className="text-[14px] font-normal text-sub mb-1" style={{ lineHeight: 20 }}>
        Certifications and identity documents
      </Text>

      {/* ── Certifications header ────────────────────────────── */}
      <GlassCard style={{ padding: 16 }}>
        <View className="flex-row items-center gap-3">
          <View className="w-10 h-10 rounded-xl bg-brand/10 border border-brand/25 items-center justify-center">
            <Text className="text-[18px]" importantForAccessibility="no">🎖</Text>
          </View>
          <View className="flex-1">
            <Text accessibilityRole="header" className="text-[15px] font-bold text-white">Certifications</Text>
            <Text className="text-[12px] text-sub mt-[2px]">Professional certifications and qualifications</Text>
          </View>
        </View>
      </GlassCard>

      {certs.map((cert, i) => (
        <GlassCard key={i} style={{ padding: 16 }} elevated>
          <View className="flex-row justify-between items-center mb-[14px]">
            <View className="px-2 py-[3px] bg-brand/10 rounded-full border border-brand/25">
              <Text className="text-[11px] font-extrabold text-brand" style={{ letterSpacing: 1 }}>CERT {i + 1}</Text>
            </View>
            <TouchableOpacity
              onPress={() => onChange({ certifications: certs.filter((_, idx) => idx !== i) })}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={`Remove certification ${i + 1}`}
              style={{ minHeight: 32, justifyContent: 'center', paddingHorizontal: 4 }}
            >
              <Text className="text-[13px] font-semibold" style={{ color: T.err }}>Remove</Text>
            </TouchableOpacity>
          </View>

          <Field label="Certificate Name"   value={cert.certificateName}   onChangeText={(v) => onChange({ certifications: certs.map((c, idx) => idx === i ? { ...c, certificateName: v } : c) })} />
          <Field label="Certificate Number" value={cert.certificateNumber} onChangeText={(v) => onChange({ certifications: certs.map((c, idx) => idx === i ? { ...c, certificateNumber: v } : c) })} />
          <Field label="Issued By"          value={cert.issuedBy}          onChangeText={(v) => onChange({ certifications: certs.map((c, idx) => idx === i ? { ...c, issuedBy: v } : c) })} />
          <RowGrid>
            <GridCell>
              <DateField label="Issue Date"  value={cert.issueDate}  onChange={(v) => onChange({ certifications: certs.map((c, idx) => idx === i ? { ...c, issueDate: v } : c) })} />
            </GridCell>
            <GridCell>
              <DateField label="Expiry Date" value={cert.expiryDate} onChange={(v) => onChange({ certifications: certs.map((c, idx) => idx === i ? { ...c, expiryDate: v } : c) })} />
            </GridCell>
          </RowGrid>
          <UploadField label="Certificate" kind="document" folder="documents" hint="Photo or scan of the certificate" value={cert.documentUrl} onChange={(v) => onChange({ certifications: certs.map((c, idx) => idx === i ? { ...c, documentUrl: v } : c) })} />
        </GlassCard>
      ))}

      <TouchableOpacity
        className="flex-row items-center justify-center rounded-[14px] p-[14px] bg-brand/10 border border-brand/25"
        onPress={() => onChange({ certifications: [...certs, emptyCert()] })}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel="Add certification"
      >
        <Text className="text-[14px] font-bold text-brand">＋  Add Certification</Text>
      </TouchableOpacity>

      {/* ── Documents header ─────────────────────────────────── */}
      <GlassCard style={{ padding: 16 }}>
        <View className="flex-row items-center gap-3">
          <View className="w-10 h-10 rounded-xl bg-brand/10 border border-brand/25 items-center justify-center">
            <Text className="text-[18px]" importantForAccessibility="no">📁</Text>
          </View>
          <View className="flex-1">
            <Text accessibilityRole="header" className="text-[15px] font-bold text-white">Documents</Text>
            <Text className="text-[12px] text-sub mt-[2px]">Identity, address, or other documents</Text>
          </View>
        </View>
      </GlassCard>

      {docs.map((doc, i) => (
        <GlassCard key={i} style={{ padding: 16 }} elevated>
          <View className="flex-row justify-between items-center mb-[14px]">
            <View className="px-2 py-[3px] bg-brand/10 rounded-full border border-brand/25">
              <Text className="text-[11px] font-extrabold text-brand" style={{ letterSpacing: 1 }}>DOC {i + 1}</Text>
            </View>
            <TouchableOpacity
              onPress={() => onChange({ documents: docs.filter((_, idx) => idx !== i) })}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={`Remove document ${i + 1}`}
              style={{ minHeight: 32, justifyContent: 'center', paddingHorizontal: 4 }}
            >
              <Text className="text-[13px] font-semibold" style={{ color: T.err }}>Remove</Text>
            </TouchableOpacity>
          </View>

          <RowGrid>
            <GridCell>
              <Field label="Document Type"   value={doc.documentType}   onChangeText={(v) => onChange({ documents: docs.map((d, idx) => idx === i ? { ...d, documentType: v } : d) })} />
            </GridCell>
            <GridCell>
              <Field label="Document Number" value={doc.documentNumber} onChangeText={(v) => onChange({ documents: docs.map((d, idx) => idx === i ? { ...d, documentNumber: v } : d) })} />
            </GridCell>
          </RowGrid>
          <UploadField label="Document" kind="document" folder="documents" hint="Photo or scan of the document" value={doc.documentUrl} onChange={(v) => onChange({ documents: docs.map((d, idx) => idx === i ? { ...d, documentUrl: v } : d) })} />
          <DateField label="Expiry Date" value={doc.expiryDate} onChange={(v) => onChange({ documents: docs.map((d, idx) => idx === i ? { ...d, expiryDate: v } : d) })} />
        </GlassCard>
      ))}

      <TouchableOpacity
        className="flex-row items-center justify-center rounded-[14px] p-[14px] bg-brand/10 border border-brand/25"
        onPress={() => onChange({ documents: [...docs, emptyDoc()] })}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel="Add document"
      >
        <Text className="text-[14px] font-bold text-brand">＋  Add Document</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
