import React from 'react';
import { View } from 'react-native';
import { T } from './theme';

interface Props {
  current: number;
  total: number;
  labels: string[];
  onStepPress?: (i: number) => void;
}

export default function StepIndicator({ current, total }: Props) {
  return (
    <View className="flex-row px-5 py-[10px] bg-surface border-b border-[#1C211C] gap-1">
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          className="flex-1 h-[2px] rounded-sm"
          style={{
            backgroundColor:
              i < current    ? T.brand :
              i === current  ? T.brand : T.line,
            opacity: i === current ? 0.5 : 1,
          }}
        />
      ))}
    </View>
  );
}
