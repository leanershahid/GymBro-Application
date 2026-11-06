import React from 'react';
import { Text, View } from 'react-native';
import { T, SP } from '../../../theme';

/** Bold spans: **text**. */
function Inline({ text, color }: { text: string; color: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return (
    <Text style={{ color, fontSize: 15, lineHeight: 23 }}>
      {parts.map((p, i) => p.startsWith('**') && p.endsWith('**')
        ? <Text key={i} style={{ fontWeight: '700', color: T.text }}>{p.slice(2, -2)}</Text>
        : <Text key={i}>{p}</Text>)}
    </Text>
  );
}

/**
 * Renders waiver text: plain paragraphs plus light markdown (# / ## headings, - or * bullets,
 * **bold**). Deliberately small: waivers are text documents, not rich content.
 */
export default function WaiverText({ body }: { body: string }) {
  const blocks = body.replace(/\r\n/g, '\n').split('\n');
  return (
    <View style={{ gap: SP.sm }}>
      {blocks.map((raw, i) => {
        const line = raw.trim();
        if (!line) return <View key={i} style={{ height: 4 }} />;
        const h = /^(#{1,3})\s+(.*)$/.exec(line);
        if (h) {
          return (
            <Text key={i} accessibilityRole="header"
              style={{ color: T.text, fontSize: h[1].length === 1 ? 19 : 16, fontWeight: '800', marginTop: SP.sm }}>
              {h[2]}
            </Text>
          );
        }
        const b = /^[-*•]\s+(.*)$/.exec(line);
        if (b) {
          return (
            <View key={i} style={{ flexDirection: 'row', gap: SP.sm, paddingLeft: SP.xs }}>
              <Text style={{ color: T.brand, fontSize: 15, lineHeight: 23 }}>•</Text>
              <View style={{ flex: 1 }}><Inline text={b[1]} color={T.textSub} /></View>
            </View>
          );
        }
        // [PLACEHOLDER …] lines stand out so nobody misses them.
        if (/^\[.*\]$/.test(line)) {
          return <Text key={i} style={{ color: T.brandGold, fontSize: 13, fontWeight: '700' }}>{line}</Text>;
        }
        return <Inline key={i} text={line} color={T.textSub} />;
      })}
    </View>
  );
}
