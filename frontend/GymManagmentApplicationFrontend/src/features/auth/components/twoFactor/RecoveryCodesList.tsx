import React from 'react';
import { Text, View } from 'react-native';
import { T, withAlpha } from '../../../../theme';
import SmallButton from '../../../common/components/SmallButton';
import { useToast } from '../../../common/components/Toast';
import { recoveryCodesText } from '../../utils/twoFactor';
import { copyText, downloadText } from '../../utils/shareText';

/** The 10 recovery codes, shown once, with copy and download (share sheet on phones). */
export default function RecoveryCodesList({ codes, account }: { codes: string[]; account: string }) {
  const toast = useToast();
  const text = recoveryCodesText(codes, account);

  const onCopy = async () => {
    const r = await copyText(text);
    if (r === 'copied') toast.show({ message: 'Recovery codes copied.' });
    else if (r === 'failed') toast.show({ type: 'error', message: 'Could not copy. Write the codes down instead.' });
  };
  const onDownload = async () => {
    const r = await downloadText('gymbro-recovery-codes.txt', text);
    if (r === 'failed') toast.show({ type: 'error', message: 'Could not save the file. Copy or write the codes down instead.' });
  };

  return (
    <View style={{ gap: 12 }}>
      <View
        style={{
          backgroundColor: T.bgInput, borderRadius: 16, borderWidth: 1, borderColor: withAlpha(T.brand, 0.25),
          padding: 16, flexDirection: 'row', flexWrap: 'wrap', rowGap: 10,
        }}
        accessible
        accessibilityLabel={`Recovery codes: ${codes.join(', ')}`}
      >
        {codes.map((c, i) => (
          <Text
            key={c}
            selectable
            style={{ width: '50%', color: T.text, fontSize: 15, fontWeight: '600', letterSpacing: 1, fontFamily: 'monospace' }}
          >
            {`${String(i + 1).padStart(2, ' ')}. ${c}`}
          </Text>
        ))}
      </View>
      <Text style={{ color: T.textSub, fontSize: 13, lineHeight: 18 }}>
        Each code signs you in once if you lose your phone. Store them somewhere safe — you won't see them again.
      </Text>
      <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
        <SmallButton icon="copy" label="Copy" onPress={onCopy} />
        <SmallButton icon="download" label="Download" onPress={onDownload} />
      </View>
    </View>
  );
}
