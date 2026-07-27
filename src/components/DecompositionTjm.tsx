import { useMemo, useState } from 'react';
import { eur } from '../lib/format';
import { PLATEFORMES } from '../lib/barometreTjm';
import { DEFAUTS_ARBITRAGE } from '../lib/arbitrage';
import { decomposerCdi, decomposerTjm, MARGE_ESN_TYPIQUE } from '../lib/rentabilite';

/**
 * Where one billed day actually goes, channel by channel.
 *
 * A part-to-whole comparison, so a stacked bar is the form. Every bar is on one
 * absolute scale — a body shop's bar runs longer because the client pays above
 * the invoiced rate — so segment lengths can be read against each other rather
 * than only within a bar. The last bar takes the same envelope as a salaried
 * job, split the same way, which is what makes the two comparable.
 *
 * The hues are a validated categorical set; the contrast warning on two of them
 * is answered by labelling each segment's value directly.
 */

type Segment = { cle: string; label: string; couleur: string; fond?: string; classe?: string };

/** Texture, not a hue: the extras sit outside the envelope being divided. */
const HACHURE =
  'repeating-linear-gradient(45deg, #1e9970 0 4px, #6ec4a4 4px 8px)';

// Drawn in this order, so on the salaried bar everything borne by the employee
// sits on the left and what the employer carries on top of the gross sits on
// the right — the two sides of a payslip, read left to right.
const SEGMENTS: Segment[] = [
  { cle: 'net', label: 'Net en poche', couleur: '#1e9970' },
  { cle: 'salariales', label: 'Cotisations salarié', couleur: '#8a5a00' },
  { cle: 'cotisations', label: 'Cotisations sociales', couleur: '#d99b1f' },
  { cle: 'ir', label: 'Impôt sur le revenu', couleur: '#7c3aed' },
  // Same family as the income tax, so the same hue: a seventh distinguishable
  // colour does not exist here, and the gap plus its own label separate them.
  { cle: 'is', label: 'Impôt sur les sociétés', couleur: '#7c3aed' },
  { cle: 'frais', label: 'Frais de la société', couleur: '#0ea5e9' },
  // On the frontier by design: funded by the employer, received by the employee.
  { cle: 'avantages', label: 'Avantages CDI', couleur: '#1e9970', fond: HACHURE },
  { cle: 'patronales', label: 'Cotisations employeur', couleur: '#d99b1f' },
  // A published fee, deducted from your own invoice: a known figure, so a solid
  // colour.
  { cle: 'commission', label: 'Commission prélevée sur vous (publiée)', couleur: '#db2777' },
  // Taken on the client side and not published: an estimate, so neutral and
  // dashed rather than dressed as measured.
  {
    cle: 'marge',
    label: 'Marge de l’intermédiaire (estimée)',
    couleur: 'transparent',
    fond: 'var(--color-ink-100)',
    classe: 'border border-dashed border-ink-300 !text-ink-500',
  },
];

type Ligne = {
  cle: string;
  titre: string;
  detail: string;
  total: number;
  parts: Record<string, number>;
  compare?: boolean;
};

export function DecompositionTjm({ tjm, jours }: { tjm: number; jours: number }) {
  const [survol, setSurvol] = useState<{ ligne: string; seg: string } | null>(null);

  const lignes = useMemo<Ligne[]>(() => {
    if (tjm <= 0) return [];
    const base = DEFAUTS_ARBITRAGE;

    // One bar per published commission. A negative rate flags an intermediary
    // whose margin is negotiated rather than published: it cannot be drawn as a
    // figure, so it is named on the body-shop bar, whose model it follows.
    const parTaux = new Map<number, string[]>();
    const negocies: string[] = [];
    for (const p of PLATEFORMES) {
      if (p.taux < 0) negocies.push(p.nom);
      else parTaux.set(p.taux, [...(parTaux.get(p.taux) ?? []), p.nom]);
    }

    const canaux: Ligne[] = [...parTaux.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([taux, noms]) => {
        const parts = decomposerTjm(tjm, taux, base, { jours });
        return {
          cle: `t${taux}`,
          titre: taux === 0 ? 'Sans intermédiaire' : `Commission ${Math.round(taux * 100)} %`,
          detail: noms.join(', '),
          total: parts.clientPaie,
          parts: { ...parts },
        };
      });

    const esn = decomposerTjm(tjm, 0, base, { jours, marge: MARGE_ESN_TYPIQUE });
    canaux.push({
      cle: 'esn',
      titre: `ESN / régie · marge ${Math.round(MARGE_ESN_TYPIQUE * 100)} %`,
      detail: negocies.length
        ? `${negocies.join(', ')} — marge négociée, prise au-dessus de votre tarif`
        : 'la marge se prend au-dessus de votre tarif',
      total: esn.clientPaie,
      parts: { ...esn },
    });

    const cdi = decomposerCdi(tjm, base, { jours });
    canaux.push({
      cle: 'cdi',
      titre: 'Le même consultant en CDI dans une ESN',
      detail:
        'l’ESN garde de quoi financer sa structure, l’intercontrat et sa marge',
      total: cdi.clientPaie,
      parts: { ...cdi, marge: cdi.marge },
      compare: true,
    });
    return canaux;
  }, [tjm, jours]);

  if (!lignes.length) return null;
  // Bars are not padded to a common width: their length is what the client pays,
  // so the salaried mission visibly runs longest. The extras sit outside the
  // envelope, so the scale leaves room for them.
  const echelle = Math.max(...lignes.map((l) => l.total + (l.parts.avantages ?? 0)));
  const lu = survol
    ? lignes.find((l) => l.cle === survol.ligne)?.parts[survol.seg]
    : null;
  const segmentSurvole = SEGMENTS.find((s) => s.cle === survol?.seg);

  return (
    <figure className="m-0">
      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-500">
        {SEGMENTS.filter((s) => s.cle !== 'is').map((s) => (
          <span key={s.cle} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.fond ?? s.couleur }} />
            {s.cle === 'ir' ? 'Impôts — revenu, puis sociétés' : s.label}
          </span>
        ))}

      </figcaption>

      <div className="mt-4 space-y-3">
        {lignes.map((l) => (
          <div key={l.cle} className={l.compare ? 'border-t border-ink-200 pt-3' : undefined}>
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-medium text-ink-900">
                {l.titre}
                <span className="ml-2 text-xs font-normal text-ink-400">{l.detail}</span>
              </p>
              {/* Both ends of the day: what is charged for it, and what is kept
                  of it — the take-home alone left the rate out of sight. */}
              <p className="tabular shrink-0 text-sm">
                <span className="text-ink-500">{eur(Math.round(l.total))}</span>
                <span className="text-ink-300"> → </span>
                <span className="font-semibold text-ink-900">
                  {eur(Math.round(l.parts.net))}
                </span>
                <span className="text-ink-400"> / jour</span>
              </p>
            </div>

            <div className="mt-1.5 flex h-7 gap-[2px]">
              {SEGMENTS.map((s) => {
                const valeur = l.parts[s.cle] ?? 0;
                if (valeur <= 0) return null;
                const actif = survol?.ligne === l.cle && survol.seg === s.cle;
                return (
                  <button
                    key={s.cle}
                    type="button"
                    aria-label={`${l.titre} — ${s.label} : ${eur(Math.round(valeur))} par jour`}
                    onMouseEnter={() => setSurvol({ ligne: l.cle, seg: s.cle })}
                    onMouseLeave={() => setSurvol(null)}
                    onFocus={() => setSurvol({ ligne: l.cle, seg: s.cle })}
                    onBlur={() => setSurvol(null)}
                    className={[
                      'flex items-center justify-center overflow-hidden text-[11px] font-semibold text-white transition-opacity first:rounded-l last:rounded-r',
                      s.classe ?? '',
                    ].join(' ')}
                    style={{
                      width: `${(valeur / echelle) * 100}%`,
                      // Extras are small against a day rate; a floor keeps them
                      // perceptible rather than letting them vanish.
                      ...(s.cle === 'avantages' ? { minWidth: '10px' } : {}),
                      background: s.fond ?? s.couleur,
                      opacity: survol && !actif ? 0.55 : 1,
                    }}
                  >
                    {/* Labelled directly wherever the segment is wide enough — the
                        relief the contrast check asks for. */}
                    {valeur / echelle > 0.038 ? eur(Math.round(valeur)) : ''}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <p className="field-hint mt-3 min-h-[1.25rem]">
        {survol && lu ? (
          `${segmentSurvole?.label} : ${eur(Math.round(lu))} par jour, soit ${Math.round(
            (lu / (lignes.find((l) => l.cle === survol.ligne)?.total ?? 1)) * 100,
          )} % de ce que paie le client.`
        ) : (
          <>
            Sur {eur(tjm)} conservés par jour, {Math.round(jours)} jours par an, au
            meilleur arbitrage salaire/dividendes. Les marges sont des ordres de
            grandeur négociés. En régie freelance l'intermédiaire prend 10 à
            30&nbsp;%. Pour un consultant salarié, seuls 58&nbsp;% environ de ce que
            paie le client financent son emploi&nbsp;: le reste couvre la structure,
            l'intercontrat et la marge — d'où un net sensiblement inférieur à
            tarif comparable, alors même que le client paie davantage. Les grands
            cabinets de conseil facturent encore au-dessus, couramment
            1&nbsp;000 à 1&nbsp;200&nbsp;€ par jour à séniorité comparable.
          </>
        )}
      </p>
    </figure>
  );
}
