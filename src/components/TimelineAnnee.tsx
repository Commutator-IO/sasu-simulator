import { useEffect, useRef } from 'react';
import {
  INITIALES_MOIS,
  moisDeRecurrence,
  prochainesRecurrences,
  type Rendezvous,
} from '../lib/actualites';

/**
 * The company's year on one axis.
 *
 * Everything sits on the same twelve months: the annual milestones that give
 * the year its shape, and the returns that come back every month. Two strips
 * one above the other read as two scales for the same year — the whole point
 * of putting them together is that they share a time axis.
 *
 * Only the monthly duties still ahead are drawn. Behind you they are filed and
 * done with, and a dot for a settled return would compete with the ones that
 * still need doing.
 */

/** One hue per recurring duty, taken from the palette the site already uses. */
const TEINTES: Record<string, { fond: string; texte: string }> = {
  DSN: { fond: 'bg-brand-500', texte: 'text-brand-700' },
  TVA: { fond: 'bg-gold-500', texte: 'text-gold-700' },
};
const TEINTE_DEFAUT = { fond: 'bg-ink-400', texte: 'text-ink-600' };

export function TimelineAnnee({
  calendrier,
  aujourdhui = new Date(),
}: {
  calendrier: Rendezvous[];
  aujourdhui?: Date;
}) {
  const moisCourant = aujourdhui.getMonth() + 1;

  // Annual milestones, by the month they fall in.
  const annuels = new Map<number, Rendezvous[]>();
  for (const r of calendrier.filter((x) => x.jour)) {
    const m = Number(r.jour!.slice(0, 2));
    annuels.set(m, [...(annuels.get(m) ?? []), r]);
  }

  const recurrents = calendrier.filter((r) => r.recurrence);
  const legende = prochainesRecurrences(aujourdhui, calendrier);

  // On a narrow screen the year does not fit, and it would otherwise open on
  // January — the part that is behind you. Centre on the current month instead,
  // by setting scrollLeft rather than scrollIntoView, which would drag the page.
  const piste = useRef<HTMLDivElement>(null);
  const marqueur = useRef<HTMLLIElement>(null);
  useEffect(() => {
    const p = piste.current;
    const m = marqueur.current;
    if (!p || !m || p.scrollWidth <= p.clientWidth) return;
    p.scrollLeft = Math.max(0, m.offsetLeft - p.clientWidth / 2 + m.offsetWidth / 2);
  }, [moisCourant]);

  if (!annuels.size && !recurrents.length) return null;

  return (
    <div>
      <div ref={piste} className="overflow-x-auto">
        <div className="relative min-w-[34rem] pt-1">
          {/* The rule runs through the marker band, so every dot sits on it. */}
          <div
            aria-hidden="true"
            className="absolute top-[2.05rem] right-0 left-0 h-px bg-ink-200"
          />
          <ol className="relative m-0 flex list-none gap-1 p-0">
            {INITIALES_MOIS.map((lettre, i) => {
              const mois = i + 1;
              const jalons = annuels.get(mois) ?? [];
              const courant = mois === moisCourant;
              const aVenir = recurrents.filter(
                (r) => mois >= moisCourant && moisDeRecurrence(r).includes(mois),
              );
              return (
                <li
                  key={mois}
                  ref={courant ? marqueur : undefined}
                  className="flex flex-1 flex-col items-center"
                >
                  <span
                    className={[
                      'text-[11px]',
                      courant ? 'font-semibold text-brand-700' : 'text-ink-400',
                    ].join(' ')}
                  >
                    {lettre}
                  </span>
                  <span
                    className={[
                      'mt-1 flex h-5 w-full items-center justify-center gap-1 rounded',
                      courant ? 'bg-brand-50' : '',
                    ].join(' ')}
                  >
                    {jalons.map((r) => (
                      <span
                        key={r.titre}
                        title={`${r.quand} — ${r.titre}`}
                        className={[
                          'h-2.5 w-2.5 shrink-0 rounded-full',
                          mois < moisCourant
                            ? 'bg-ink-300'
                            : 'border-2 border-brand-600 bg-white',
                        ].join(' ')}
                      />
                    ))}
                    {aVenir.map((r) => (
                      <span
                        key={r.titre}
                        title={`${r.quand} — ${r.titre}`}
                        className={[
                          'h-1.5 w-1.5 shrink-0 rounded-full',
                          (TEINTES[r.recurrence!.court] ?? TEINTE_DEFAUT).fond,
                        ].join(' ')}
                      />
                    ))}
                  </span>
                  <span
                    className={[
                      'mt-1 text-center text-[10px] leading-tight',
                      courant ? 'font-medium text-brand-700' : 'text-ink-500',
                    ].join(' ')}
                  >
                    {courant
                      ? 'aujourd’hui'
                      : jalons.map((r) => r.court ?? r.quand).join(' · ')}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-ink-100 pt-4">
        <span className="inline-flex items-center gap-1.5 text-[11px] text-ink-500">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full border-2 border-brand-600 bg-white" />
          échéance annuelle à venir
        </span>
        {legende.map(({ rdv, quand }) => {
          const teinte = TEINTES[rdv.recurrence!.court] ?? TEINTE_DEFAUT;
          return (
            <span
              key={rdv.titre}
              className="inline-flex items-center gap-1.5 text-[11px] text-ink-500"
            >
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${teinte.fond}`} />
              <span className={`font-semibold ${teinte.texte}`}>
                {rdv.recurrence!.court}
              </span>
              <span>
                {rdv.recurrence!.legende ?? rdv.titre} — prochaine&nbsp;: {quand}
                {rdv.recurrence!.condition && `, ${rdv.recurrence!.condition}`}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
