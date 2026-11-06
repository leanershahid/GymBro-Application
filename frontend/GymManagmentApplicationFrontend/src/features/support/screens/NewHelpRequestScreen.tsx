import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, SP, R, withAlpha } from '../../../theme';
import { useLayout } from '../../../utils/useLayout';
import { apiErrorText } from '../../../api/apiError';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import PrimaryButton from '../../common/components/PrimaryButton';
import ChipSelect from '../../common/components/ChipSelect';
import { Field, SwitchRow } from '../../common/components/FormFields';
import { useToast } from '../../common/components/Toast';
import { useBranchDirectory } from '../../operations/api/operationsQueries';
import { useCreateRequest } from '../api/supportQueries';
import { SupportCategory } from '../api/support.types';
import { CATEGORIES, PhotoField, SectionTitle } from '../components/SupportUi';

interface Props {
  onBack: () => void;
  /** Opens the new request's thread (replaces this form). */
  onCreated: (requestId: number) => void;
  initialCategory?: string;
}

type Method = 'app' | 'email' | 'phone';
const METHODS: { value: Method; label: string }[] = [
  { value: 'app', label: 'In the app' }, { value: 'email', label: 'Email' }, { value: 'phone', label: 'Phone call' },
];

/** Raise a request: category, subject, message, up to 3 photos, branch, contact preference. */
export default function NewHelpRequestScreen({ onBack, onCreated, initialCategory }: Props) {
  const { hPad, width } = useLayout();
  const toast = useToast();
  const create = useCreateRequest();
  const branches = useBranchDirectory().data ?? [];
  const [category, setCategory] = useState<SupportCategory | null>(
    CATEGORIES.some(c => c.key === initialCategory) ? (initialCategory as SupportCategory) : null);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [branchId, setBranchId] = useState<number | null>(null);
  const [canContact, setCanContact] = useState(false);
  const [method, setMethod] = useState<Method>('app');
  const [tried, setTried] = useState(false);

  const errors = {
    category: !category ? 'Pick what this is about.' : undefined,
    subject: !subject.trim() ? 'Give it a short title.' : undefined,
    message: message.trim().length < 5 ? 'Tell us a little more.' : undefined,
  };
  const valid = !errors.category && !errors.subject && !errors.message;
  const cols = width >= 600 ? 4 : 2;

  const submit = () => {
    setTried(true);
    if (!valid || !category || create.isPending) return;
    create.mutate(
      { category, subject: subject.trim(), message: message.trim(), photos, branchId, canContact, contactMethod: canContact ? method : undefined },
      {
        onSuccess: d => { toast.show({ message: "Thanks — we've got your request." }); onCreated(d.id); },
        onError: e => toast.show({ type: 'error', message: apiErrorText(e) }),
      },
    );
  };

  return (
    <Screen>
      <ScreenHeader eyebrow="Help & feedback" title="New request" onBack={onBack} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: hPad, paddingBottom: 120, width: '100%', maxWidth: 680, alignSelf: 'center' }}>
          <SectionTitle>What's it about?</SectionTitle>
          <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: SP.sm }}>
            {CATEGORIES.map(c => {
              const on = c.key === category;
              return (
                <Pressable key={c.key} onPress={() => setCategory(c.key)} accessibilityRole="radio" accessibilityState={{ checked: on }}
                  accessibilityLabel={c.label} accessibilityHint={c.hint}
                  style={({ pressed }) => ({
                    width: `${Math.floor(100 / cols) - 3}%` as `${number}%`, flexGrow: 1, minHeight: 84, padding: SP.md, gap: 6, borderRadius: R.lg, borderWidth: 1,
                    borderColor: on ? T.brand : T.line, backgroundColor: on ? withAlpha(T.brand, 0.12) : pressed ? T.bgInputActive : T.bgInput,
                  })}>
                  <Feather name={c.icon} size={18} color={on ? T.brand : T.textSub} />
                  <Text style={{ color: T.text, fontSize: 13, fontWeight: '700' }}>{c.label}</Text>
                  <Text numberOfLines={1} style={{ color: T.textFaint, fontSize: 11 }}>{c.hint}</Text>
                </Pressable>
              );
            })}
          </View>
          {tried && errors.category && <Text style={{ color: T.err, fontSize: 12, marginBottom: SP.md }}>{errors.category}</Text>}

          <View style={{ height: SP.lg }} />
          <Field label="Subject" value={subject} onChangeText={setSubject} placeholder="e.g. Hot water in the men's showers" error={tried ? errors.subject : undefined} />
          <Field label="Message" value={message} onChangeText={setMessage} multiline
            placeholder="What happened, when, and anything that helps us sort it." error={tried ? errors.message : undefined} />
          <PhotoField photos={photos} onChange={setPhotos} />

          {branches.length > 1 && (
            <ChipSelect<number> label="Which branch? (optional)" value={branchId}
              options={branches.map(b => ({ value: b.id, label: b.name }))}
              onChange={v => setBranchId(v === branchId ? null : v)} />
          )}

          <SwitchRow label="Can we contact you about this?" value={canContact} onValueChange={setCanContact}
            description="We'll always reply here too." />
          {canContact && (
            <ChipSelect<Method> label="Best way to reach you" value={method} options={METHODS} onChange={setMethod} />
          )}

          <PrimaryButton label="Send request" icon="send" loading={create.isPending} onPress={submit} style={{ marginTop: SP.md }} />
          <Text style={{ color: T.textFaint, fontSize: 12, textAlign: 'center', marginTop: SP.md }}>
            Your gym's team will see this. Please don't share card numbers or passwords.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
