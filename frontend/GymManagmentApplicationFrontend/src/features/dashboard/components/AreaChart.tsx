import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Circle, Line } from 'react-native-svg';
import { RevenueTrendPoint } from '../types/dashboard';
import { T } from '../../trainers/components/theme';

interface AreaChartProps {
  data: RevenueTrendPoint[];
  width: number;
  height?: number;
  /** Y-axis gridline labels, drawn evenly spaced top-to-bottom (e.g. ["80K","60K","40K","20K","0"]). */
  yLabels?: string[];
  /** X-axis labels, one per data point (falls back to each point's own label). */
  xLabels?: string[];
}

/**
 * Same svg-geometry exception as Revenuesparkline/DonutRing — the path is
 * computed from data + container width, so this uses inline props not NativeWind.
 */
export default function AreaChart({ data, width, height = 88, yLabels, xLabels }: AreaChartProps) {
  if (!data.length) return null;

  const hasAxes = !!yLabels?.length;
  const yAxisWidth = hasAxes ? 34 : 0;
  const xAxisHeight = hasAxes ? 18 : 0;
  const chartWidth = width - yAxisWidth;
  const chartHeight = height - xAxisHeight;

  const max = Math.max(...data.map((p) => p.value), 1);
  const min = Math.min(...data.map((p) => p.value), 0);
  const range = Math.max(max - min, 1);
  const padTop = 10;
  const usableHeight = chartHeight - padTop;
  const stepX = data.length > 1 ? chartWidth / (data.length - 1) : chartWidth;

  const points = data.map((p, i) => ({
    x: i * stepX,
    y: padTop + usableHeight - ((p.value - min) / range) * usableHeight,
  }));

  const linePath = points
    .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
    .join(' ');

  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${chartHeight} L ${points[0].x.toFixed(1)} ${chartHeight} Z`;

  const last = points[points.length - 1];
  const labels = xLabels ?? data.map((d) => d.label);

  return (
    <View style={{ width, height }}>
      <View style={{ flexDirection: 'row' }}>
        {hasAxes && (
          <View style={{ width: yAxisWidth, height: chartHeight, justifyContent: 'space-between', paddingBottom: 4 }}>
            {yLabels!.map((l) => (
              <Text key={l} style={{ color: T.textFaint, fontSize: 9.5 }}>{l}</Text>
            ))}
          </View>
        )}

        <View style={{ width: chartWidth, height: chartHeight }}>
          <Svg width={chartWidth} height={chartHeight}>
            <Defs>
              <LinearGradient id="areaFade" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={T.brand} stopOpacity="0.35" />
                <Stop offset="1" stopColor={T.brand} stopOpacity="0" />
              </LinearGradient>
            </Defs>
            {hasAxes && yLabels!.map((_, i) => {
              const y = (chartHeight / (yLabels!.length - 1)) * i;
              return <Line key={i} x1={0} y1={y} x2={chartWidth} y2={y} stroke={T.line} strokeWidth={1} strokeDasharray="4 4" />;
            })}
            <Path d={areaPath} fill="url(#areaFade)" />
            <Path d={linePath} stroke={T.brand} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
            <Circle cx={last.x} cy={last.y} r={4} fill={T.brand} stroke={T.bg} strokeWidth={2} />
          </Svg>
        </View>
      </View>

      {hasAxes && (
        <View style={{ flexDirection: 'row', marginLeft: yAxisWidth, marginTop: 4, justifyContent: 'space-between' }}>
          {labels.map((l, i) => (
            <Text key={i} style={{ color: T.textFaint, fontSize: 9.5 }}>{l}</Text>
          ))}
        </View>
      )}
    </View>
  );
}
