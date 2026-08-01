import type { Rendezvous } from '../lib/actualites';

/**
 * Where you stand in the company's year: two duties behind, two ahead.
 *
 * A list of eleven obligations answers "what is owed" but not "what now" — and
 * that second question is the one someone opening the page in September
 * actually has. Four entries around today answer it without being read.
 *
 * Only the fixed dates appear. A monthly return has no single point to sit on,
 * and placing one would say something untrue about when it falls.
 */
export function TimelineAnnee({
  passees,
  aVenir,
}: {
  passees: Rendezvous[];
  aVenir: Rendezvous[];
}) {
  if (!passees.length && !aVenir.length) return null;

  const cases = [
    ...passees.map((r) => ({ r, etat: 'passe' as const })),
    { r: null, etat: 'ici' as const },
    ...aVenir.map((r) => ({ r, etat: 'avenir' as const })),
  ];

  return (
    <div className="relative">
      {/* The rule sits behind the dots, at their centre. */}
      <div
        aria-hidden="true"
        className="absolute top-[0.3125rem] right-0 left-0 h-px bg-ink-200"
      />
      <ol className="relative m-0 flex list-none gap-2 overflow-x-auto p-0 pb-1 sm:gap-3">
        {cases.map(({ r, etat }, i) => (
          <li
            key={r ? r.titre : `ici-${i}`}
            className="flex min-w-[7.5rem] flex-1 flex-col items-center text-center"
          >
            <span
              aria-hidden="true"
              className={[
                'h-2.5 w-2.5 shrink-0 rounded-full',
                etat === 'passe' && 'bg-ink-300',
                etat === 'ici' && 'bg-brand-600 ring-4 ring-brand-100',
                etat === 'avenir' && 'border-2 border-brand-500 bg-white',
              ]
                .filter(Boolean)
                .join(' ')}
            />
            {etat === 'ici' ? (
              <>
                <span className="mt-2 text-xs font-semibold text-brand-700">
                  Aujourd’hui
                </span>
                <span className="text-[11px] text-ink-400">vous êtes ici</span>
              </>
            ) : (
              <>
                <span
                  className={[
                    'tabular mt-2 text-xs font-semibold',
                    etat === 'passe' ? 'text-ink-400' : 'text-ink-900',
                  ].join(' ')}
                >
                  {r!.quand}
                </span>
                <span
                  className={[
                    'text-[11px] leading-snug',
                    etat === 'passe' ? 'text-ink-400' : 'text-ink-600',
                  ].join(' ')}
                >
                  {r!.titre}
                </span>
              </>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
