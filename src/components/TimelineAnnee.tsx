import {
  INITIALES_MOIS,
  moisDeRecurrence,
  type Rendezvous,
} from '../lib/actualites';

/**
 * One hue per recurring duty. Two categories only, taken from the palette the
 * site already uses, so the strip needs no colour of its own.
 */
const TEINTES: Record<string, { plein: string; passe: string; texte: string }> = {
  DSN: { plein: 'bg-brand-500', passe: 'bg-brand-200', texte: 'text-brand-700' },
  TVA: { plein: 'bg-gold-500', passe: 'bg-gold-200', texte: 'text-gold-700' },
};
const TEINTE_DEFAUT = {
  plein: 'bg-ink-400',
  passe: 'bg-ink-200',
  texte: 'text-ink-600',
};

/**
 * Where you stand in the company's year: two duties behind, two ahead.
 *
 * A list of eleven obligations answers "what is owed" but not "what now" — and
 * that second question is the one someone opening the page in September
 * actually has. Four entries around today answer it without being read.
 *
 * The annual line carries only the yearly milestones. The monthly duties sit on
 * their own row underneath, and only at their next fall: twelve payroll returns
 * strung along the same axis would bury the four instalments that give the year
 * its shape.
 */
export function TimelineAnnee({
  passees,
  aVenir,
  recurrentes = [],
  moisCourant = new Date().getMonth() + 1,
}: {
  /** One entry per date, since several duties can share a day. */
  passees: Rendezvous[][];
  aVenir: Rendezvous[][];
  recurrentes?: { rdv: Rendezvous; quand: string }[];
  /** Current month, 1-indexed, so months already run are shown as spent. */
  moisCourant?: number;
}) {
  if (!passees.length && !aVenir.length) return null;

  const cases = [
    ...passees.map((g) => ({ g, etat: 'passe' as const })),
    { g: null, etat: 'ici' as const },
    ...aVenir.map((g) => ({ g, etat: 'avenir' as const })),
  ].filter((c) => c.etat === 'ici' || c.g!.length > 0);

  return (
    <div className="relative">
      {/* The rule sits behind the dots, at their centre. */}
      <div
        aria-hidden="true"
        className="absolute top-[0.3125rem] right-0 left-0 h-px bg-ink-200"
      />
      <ol className="relative m-0 flex list-none gap-2 overflow-x-auto p-0 pb-1 sm:gap-3">
        {cases.map(({ g, etat }, i) => (
          <li
            key={g ? g[0].titre : `ici-${i}`}
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
                  {g![0].quand}
                </span>
                <span
                  className={[
                    'text-[11px] leading-snug',
                    etat === 'passe' ? 'text-ink-400' : 'text-ink-600',
                  ].join(' ')}
                >
                  {g!.map((r) => r.titre).join(' · ')}
                </span>
              </>
            )}
          </li>
        ))}
      </ol>

      {recurrentes.length > 0 && (
        <div className="mt-5 border-t border-ink-100 pt-4">
          {/* The annual line above shows moments; this shows a rhythm. A duty
              that returns every month is a different kind of fact, and a dot
              per month says it without a sentence. */}
          <div className="overflow-x-auto">
            <div className="min-w-[20rem]">
              <div className="flex gap-1">
                {INITIALES_MOIS.map((lettre, i) => (
                  <span
                    key={i}
                    className={[
                      'flex-1 text-center text-[10px]',
                      i + 1 === moisCourant
                        ? 'font-semibold text-ink-900'
                        : 'text-ink-400',
                    ].join(' ')}
                  >
                    {lettre}
                  </span>
                ))}
              </div>
              {recurrentes.map(({ rdv }) => {
                const mois = moisDeRecurrence(rdv);
                const teinte = TEINTES[rdv.recurrence!.court] ?? TEINTE_DEFAUT;
                return (
                  <div key={rdv.titre} className="mt-1.5 flex gap-1">
                    {INITIALES_MOIS.map((_, i) => {
                      const du = mois.includes(i + 1);
                      return (
                        <span key={i} className="flex flex-1 justify-center">
                          <span
                            className={[
                              'h-2 w-2 rounded-full',
                              !du
                                ? 'bg-transparent'
                                : i + 1 < moisCourant
                                  ? teinte.passe
                                  : teinte.plein,
                            ].join(' ')}
                          />
                        </span>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5">
            {recurrentes.map(({ rdv, quand }) => {
              const teinte = TEINTES[rdv.recurrence!.court] ?? TEINTE_DEFAUT;
              return (
                <span
                  key={rdv.titre}
                  className="inline-flex items-center gap-1.5 text-[11px] text-ink-500"
                >
                  <span className={`h-2 w-2 shrink-0 rounded-full ${teinte.plein}`} />
                  <span className={`font-semibold ${teinte.texte}`}>
                    {rdv.recurrence!.court}
                  </span>
                  <span>
                    {rdv.recurrence!.legende ?? rdv.titre} — prochaine&nbsp;:{' '}
                    {quand}
                    {rdv.recurrence!.condition && `, ${rdv.recurrence!.condition}`}
                  </span>
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
