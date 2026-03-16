import { Massage } from '../../types';

interface MassageVisualFallbackProps {
  massage: Massage;
  className?: string;
  compact?: boolean;
  showDescription?: boolean;
  showTags?: boolean;
}

const FALLBACK_PALETTES = [
  {
    shell: 'from-slate-950 via-slate-900 to-cyan-950',
    glowA: 'bg-cyan-500/20',
    glowB: 'bg-emerald-400/15',
    badge: 'border-cyan-300/25 bg-cyan-400/10 text-cyan-100',
  },
  {
    shell: 'from-zinc-950 via-neutral-900 to-fuchsia-950',
    glowA: 'bg-fuchsia-500/20',
    glowB: 'bg-amber-300/15',
    badge: 'border-fuchsia-300/25 bg-fuchsia-400/10 text-fuchsia-100',
  },
  {
    shell: 'from-slate-950 via-indigo-950 to-slate-900',
    glowA: 'bg-indigo-500/20',
    glowB: 'bg-sky-300/15',
    badge: 'border-indigo-300/25 bg-indigo-400/10 text-indigo-100',
  },
];

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash);
}

export default function MassageVisualFallback({
  massage,
  className = '',
  compact = false,
  showDescription = true,
  showTags = true,
}: MassageVisualFallbackProps) {
  const palette = FALLBACK_PALETTES[hashString(massage.id || massage.name) % FALLBACK_PALETTES.length];
  const description = (massage.shortDescription || massage.longDescription || '').trim();
  const visibleTags = massage.purposeTags.slice(0, compact ? 2 : 4);

  return (
    <div className={`relative h-full w-full overflow-hidden bg-gradient-to-br ${palette.shell} ${className}`}>
      <div className={`absolute -left-12 top-8 h-40 w-40 rounded-full blur-3xl ${palette.glowA}`} />
      <div className={`absolute -right-8 bottom-0 h-48 w-48 rounded-full blur-3xl ${palette.glowB}`} />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:32px_32px] opacity-20" />

      <div className={`relative z-10 flex h-full flex-col ${compact ? 'justify-end p-5' : 'justify-between p-8'}`}>
        <div className="flex items-center justify-between gap-3">
          <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${palette.badge}`}>
            Eform Spa
          </span>
          {massage.duration && (
            <span className="inline-flex items-center rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs font-medium text-white/80">
              {massage.duration}
            </span>
          )}
        </div>

        <div className="space-y-3">
          <h3 className={`${compact ? 'text-2xl' : 'text-4xl'} max-w-3xl font-semibold leading-tight text-white drop-shadow-sm`}>
            {massage.name}
          </h3>

          {showDescription && description && (
            <p className={`${compact ? 'text-sm' : 'text-base'} max-w-2xl leading-relaxed text-white/75`}>
              {description}
            </p>
          )}

          {showTags && visibleTags.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {visibleTags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-white/12 bg-black/20 px-3 py-1 text-xs font-medium text-white/85 backdrop-blur-sm"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
