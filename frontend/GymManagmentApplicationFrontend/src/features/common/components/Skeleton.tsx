import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';

interface Props {
  rows?: number;
  height?: number;
  borderRadius?: number;
  gap?: number;
}

export default function Skeleton({ rows = 5, height = 88, borderRadius = 18, gap = 10 }: Props) {
  const op = useRef(new Animated.Value(0.25)).current;

  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(op, { toValue: 0.7, duration: 700, useNativeDriver: true }),
      Animated.timing(op, { toValue: 0.25, duration: 700, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [op]);

  return (
    <>
      {Array.from({ length: rows }, (_, k) => (
        <Animated.View
          key={k}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ height, borderRadius, backgroundColor: '#1C211C', marginBottom: gap, opacity: op }}
        />
      ))}
    </>
  );
}
