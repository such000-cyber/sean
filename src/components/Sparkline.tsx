import { useMemo, useState, useEffect } from 'react';
import type { Reading } from '@/lib/supabase';

interface SparklineProps {
  readings: Reading[];
  color: string;
  width?: number;
  height?: number;
}

export function Sparkline({ readings, color, width = 120, height = 40 }: SparklineProps) {
  const [animated, setAnimated] = useState(false);

  const sorted = useMemo(
    () => [...readings].sort((a, b) => a.reading_date.localeCompare(b.reading_date)),
    [readings]
  );

  const points = useMemo(() => {
    if (sorted.length < 2) return null;
    const values = sorted.map((r) => r.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const stepX = width / (sorted.length - 1);
    return sorted.map((r, i) => {
      const x = i * stepX;
      const y = height - ((r.value - min) / range) * (height - 6) - 3;
      return { x, y };
    });
  }, [sorted, width, height]);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 50);
    return () => clearTimeout(t);
  }, []);

  if (!points || points.length < 2) {
    return (
      <div
        className="flex items-center justify-center text-xs text-slate-400"
        style={{ width, height }}
      >
        Няма данни
      </div>
    );
  }

  const pathD = points
    .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
    .join(' ');

  const areaD = `${pathD} L ${width} ${height} L 0 ${height} Z`;

  const gid = `spark-${color.replace('#', '')}`;

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={areaD}
        fill={`url(#${gid})`}
        style={{
          opacity: animated ? 1 : 0,
          transition: 'opacity 0.6s ease',
        }}
      />
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          strokeDasharray: 1000,
          strokeDashoffset: animated ? 0 : 1000,
          transition: 'stroke-dashoffset 0.8s ease',
        }}
      />
      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={2.5}
          fill={color}
          style={{
            opacity: animated ? 1 : 0,
            transition: `opacity 0.3s ease ${0.4 + i * 0.05}s`,
          }}
        />
      ))}
    </svg>
  );
}
