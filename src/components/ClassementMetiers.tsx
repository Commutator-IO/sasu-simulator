import { eur } from '../lib/format';
import {
  derniereMesure,
  PROFESSIONS,
  variationDepuis,
  type Profession,
} from '../lib/barometreTjm';

/**
 * Every profession's current day rate for one city, ranked, with how much it
 * moved since 2023 — the year most curves peak. A profession with no capture
 * around 2023 simply shows no variation rather than an invented one.
 */
export function ClassementMetiers({
  lieu,
  selection,
  onChoisir,
}: {
  lieu: string;
  /** Keys currently overlaid on the chart, highlighted here. */
  selection: string[];
  onChoisir?: (cle: string) => void;
}) {
  const lignes = PROFESSIONS.map((p: Profession) => {
    const der = derniereMesure(p);
    return {
      p,
      valeur: (der?.[lieu] as number) ?? 0,
      date: der?.date ?? '',
      variation: variationDepuis(p, lieu, 2023),
    };
  })
    .filter((l) => l.valeur > 0)
    .sort((a, b) => b.valeur - a.valeur);

  const max = Math.max(...lignes.map((l) => l.valeur));

  return (
    <div>
      <ul className="space-y-2.5">
        {lignes.map(({ p, valeur, variation }) => {
          const actif = selection.includes(p.cle);
          return (
            <li key={p.cle}>
              <button
                type="button"
                onClick={() => onChoisir?.(p.cle)}
                aria-pressed={actif}
                className={[
                  'group flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition',
                  actif ? 'bg-brand-50' : 'hover:bg-ink-100/70',
                ].join(' ')}
              >
                <span
                  className={[
                    'w-52 shrink-0 truncate text-sm',
                    actif ? 'font-semibold text-ink-900' : 'text-ink-600',
                  ].join(' ')}
                >
                  {p.libelle}
                </span>
                <span className="relative h-3 flex-1 overflow-hidden rounded-full bg-ink-100">
                  <span
                    className="absolute inset-y-0 left-0 rounded-full transition-all"
                    style={{ width: `${(valeur / max) * 100}%`, backgroundColor: p.couleur }}
                  />
                </span>
                <span className="tabular w-16 shrink-0 text-right text-sm font-semibold text-ink-900">
                  {eur(valeur)}
                </span>
                <span className="tabular w-24 shrink-0 text-right text-xs">
                  {variation ? (
                    <span
                      className={
                        variation.pourcent >= 0 ? 'text-brand-700' : 'text-gold-700'
                      }
                    >
                      {variation.pourcent >= 0 ? '+' : ''}
                      {variation.pourcent.toFixed(1)} % depuis {variation.depuis.slice(0, 4)}
                    </span>
                  ) : (
                    <span className="text-ink-300">—</span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
