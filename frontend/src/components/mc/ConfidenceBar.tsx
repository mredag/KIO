/**
 * Color-coded confidence bar for 0.0–1.0 scores.
 * Reuses MC glassmorphism dark theme patterns.
 */

export function getConfidenceColor(value: number): { bg: string; text: string; glow: string } {
  if (value < 0.5) {
    return { bg: 'bg-red-500', text: 'text-red-400', glow: 'shadow-red-500/30' };
  }
  if (value < 0.8) {
    return { bg: 'bg-amber-500', text: 'text-amber-400', glow: 'shadow-amber-500/30' };
  }
  return { bg: 'bg-green-500', text: 'text-green-400', glow: 'shadow-green-500/30' };
}

interface ConfidenceBarProps {
  value: number;
  size?: 'sm' | 'md';
  showLabel?: boolean;
}

export function ConfidenceBar({ value, size = 'md', showLabel = true }: ConfidenceBarProps) {
  const clamped = Math.max(0, Math.min(1, value));
  const pct = Math.round(clamped * 100);
  const { bg, text, glow } = getConfidenceColor(clamped);

  const barH = size === 'sm' ? 'h-1.5' : 'h-2.5';
  const fontSize = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <div className="flex items-center gap-2">
      <div
        className={`flex-1 ${barH} rounded-full bg-white/[0.06] overflow-hidden`}
        role="meter"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Confidence ${pct}%`}
      >
        <div
          className={`${barH} rounded-full ${bg} shadow-sm ${glow} transition-all duration-300`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <span className={`${fontSize} ${text} font-medium tabular-nums mc-font-inter`}>
          {pct}%
        </span>
      )}
    </div>
  );
}
