import { getMomentumColor } from '../../lib/mc/momentumUtils';

interface MomentumGaugeProps {
  value: number; // 0-100
  size?: number; // px, default 120
  label?: string;
}

const COLOR_MAP = {
  green: '#10b981',  // emerald-500
  amber: '#f59e0b',  // amber-500
  red: '#ef4444',    // red-500
} as const;

export function MomentumGauge({ value, size = 120, label }: MomentumGaugeProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const color = getMomentumColor(clamped);
  const stroke = COLOR_MAP[color];

  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;
  const center = size / 2;

  return (
    <div className="inline-flex flex-col items-center gap-1">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="transform -rotate-90"
        role="meter"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? 'Momentum gauge'}
      >
        {/* Background track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-gray-200 dark:text-gray-800"
        />
        {/* Animated fill */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 600ms ease-out, stroke 300ms ease' }}
        />
      </svg>
      {/* Percentage text overlaid on center */}
      <span
        className="mc-font-inter text-lg font-semibold -mt-[calc(50%+0.75rem)]"
        style={{ color: stroke, marginTop: -(size / 2 + 12) + 'px', position: 'relative' }}
      >
        {Math.round(clamped)}%
      </span>
      {label && (
        <span className="mc-label mt-1">{label}</span>
      )}
    </div>
  );
}
