import { getConfidenceColor } from './ConfidenceBar';

interface RubricChartProps {
  scores: Record<string, number> | null;
}

export function RubricChart({ scores }: RubricChartProps) {
  if (!scores || Object.keys(scores).length === 0) return null;

  return (
    <div className="space-y-2">
      {Object.entries(scores).map(([key, raw]) => {
        const value = Math.max(0, Math.min(1, raw));
        const pct = Math.round(value * 100);
        const { bg, glow } = getConfidenceColor(value);

        return (
          <div key={key} className="flex items-center gap-3">
            <span className="w-28 shrink-0 text-sm text-gray-400 truncate">
              {key.charAt(0).toUpperCase() + key.slice(1)}
            </span>
            <div
              className="flex-1 h-2.5 rounded-full bg-white/[0.06] overflow-hidden"
              role="meter"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${key} ${pct}%`}
            >
              <div
                className={`h-2.5 rounded-full ${bg} shadow-sm ${glow} transition-all duration-300`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-10 shrink-0 text-sm text-gray-400 text-right tabular-nums">
              {pct}%
            </span>
          </div>
        );
      })}
    </div>
  );
}
