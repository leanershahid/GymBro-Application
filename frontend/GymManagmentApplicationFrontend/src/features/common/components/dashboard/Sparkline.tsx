import React, { useId } from 'react';
import Svg, { Path, Defs, LinearGradient, Stop, Circle } from 'react-native-svg';
import { T } from '../../../../theme';

interface Props {
  values: number[];
  width: number;
  height?: number;
  color?: string;
  /** Fill the area under the line with a fading gradient. */
  area?: boolean;
  /** Mark the last point with a dot. */
  endDot?: boolean;
}

/** Smooth mini line chart for KPI tiles and hero cards. */
export default function Sparkline({ values, width, height = 36, color = T.brand, area = true, endDot = true }: Props) {
  const gid = `spark-${useId().replace(/:/g, '')}`;
  if (values.length < 2 || width <= 0) return null;

  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const pad = 3;
  const step = (width - pad * 2) / (values.length - 1);
  const pts = values.map((v, i) => ({ x: pad + i * step, y: pad + (height - pad * 2) * (1 - (v - min) / range) }));

  // Catmull-Rom → cubic Bézier for a smooth curve.
  let line = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
    line += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  const last = pts[pts.length - 1];
  const fill = `${line} L ${last.x} ${height} L ${pts[0].x} ${height} Z`;

  return (
    <Svg width={width} height={height} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Defs>
        <LinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity={0.35} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      {area && <Path d={fill} fill={`url(#${gid})`} />}
      <Path d={line} stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" />
      {endDot && <Circle cx={last.x} cy={last.y} r={3.5} fill={color} stroke={T.bg} strokeWidth={1.5} />}
    </Svg>
  );
}
