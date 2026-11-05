import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { T } from '../../../theme';

export interface ChipOption<V> { value: V; label: string }

interface BaseProps<V> {
  label: string;
  options: ChipOption<V>[];
  error?: string;
  hint?: string;
}

type Props<V> = BaseProps<V> & (
  | { multiple?: false; value: V | null; onChange: (v: V) => void }
  | { multiple: true; value: V[]; onChange: (v: V[]) => void }
);

/** Wrapping pill selector (single or multi). Used by the exercise / workout / plan / lead forms. */
export default function ChipSelect<V extends string | number>(props: Props<V>) {
  const { label, options, error, hint } = props;
  const isActive = (v: V) => (props.multiple ? props.value.includes(v) : props.value === v);

  const toggle = (v: V) => {
    if (props.multiple) {
      props.onChange(props.value.includes(v) ? props.value.filter(x => x !== v) : [...props.value, v]);
    } else {
      props.onChange(v);
    }
  };

  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ color: T.textSub, fontSize: 13, marginBottom: 7 }}>{label}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {options.map(o => {
          const active = isActive(o.value);
          return (
            <Pressable
              key={String(o.value)}
              onPress={() => toggle(o.value)}
              hitSlop={{ top: 4, bottom: 4 }}
              accessibilityRole={props.multiple ? 'checkbox' : 'radio'}
              accessibilityLabel={`${label}: ${o.label}`}
              accessibilityState={props.multiple ? { checked: active } : { selected: active }}
              style={{
                minHeight: 36, justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
                backgroundColor: active ? T.brand : T.bgInput, borderWidth: 1, borderColor: active ? T.brand : T.line,
              }}>
              <Text style={{ color: active ? T.onBrand : T.textSub, fontSize: 12, fontWeight: '700' }}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {!!hint && !error && <Text style={{ color: T.textFaint, fontSize: 12, marginTop: 6 }}>{hint}</Text>}
      {!!error && <Text style={{ color: T.err, fontSize: 12, marginTop: 6 }}>{error}</Text>}
    </View>
  );
}

/** "WeightLoss" → "Weight Loss", "walk-in" → "Walk-in". */
export const humanize = (s: string) =>
  s ? (s.charAt(0).toUpperCase() + s.slice(1)).replace(/([a-z])([A-Z])/g, '$1 $2') : s;
