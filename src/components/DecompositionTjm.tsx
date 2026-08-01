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

/*
 * Two families, told apart by saturation rather than by hue — which survives
 * colour-blindness and a black-and-white print.
 *
 *  · Saturated: your side of the day — what you keep and what is levied on you.
 *  · Neutral: the intermediary's side — money that never reaches you, the solid
 *    grey a published fee, the pale dashed one an estimate.
 */

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
  { cle: 'commission', label: 'Commission prélevée sur vous', couleur: '#475569' },
  // Taken on the client side and not published: an estimate, so neutral and
  // dashed rather than dressed as measured.
  {
    cle: 'marge',
    label: 'Marge prise côté client',
    couleur: 'transparent',
    fond: '#e2e8f0',
    classe: 'border border-slate-300 !text-slate-600',
  },
];

type Ligne = {
  cle: string;
  titre: string;
  detail: string;
  total: number;
  parts: Record<string, number>;
  /** Client-side share is an estimate here, so its block is dashed. */
  margeEstimee?: boolean;
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
    // Grouped by both cuts, not just the published one: a platform that also
    // bills the client is not the same deal as one that may not.
    const parModele = new Map<
      string,
      { taux: number; marge: number; publiee: boolean; noms: string[] }
    >();
    const negocies: string[] = [];
    for (const p of PLATEFORMES) {
      if (p.taux < 0) {
        negocies.push(p.nom);
        continue;
      }
      const marge = p.margeClient ?? 0;
      const publiee = p.margeClientPubliee !== false;
      const cle = `${p.taux}|${marge}|${publiee}`;
      const g = parModele.get(cle) ?? { taux: p.taux, marge, publiee, noms: [] };
      g.noms.push(p.nom);
      parModele.set(cle, g);
    }

    const canaux: Ligne[] = [...parModele.values()]
      .sort((a, b) => a.taux + a.marge - (b.taux + b.marge))
      .map(({ taux, marge, publiee, noms }) => {
        const parts = decomposerTjm(tjm, taux, base, { jours, marge });
        return {
          // `publiee` splits the groups above, so it has to be in the key too:
          // two channels charging the same rates are still two rows, and the
          // hover resolves a row by this key.
          cle: `t${taux}-${marge}-${publiee}`,
          titre:
            taux === 0 && marge === 0
              ? 'Sans intermédiaire'
              : taux === 0
                ? `Rien sur vous, ${Math.round(marge * 100)} % au client`
                : marge > 0
                  ? `${Math.round(taux * 100)} % sur vous + ${Math.round(marge * 100)} % au client`
                  : `Commission ${Math.round(taux * 100)} % sur vous`,
          detail:
            taux === 0 && marge === 0
              ? noms.join(', ')
              : taux === 0
                ? `${noms.join(', ')} — votre facture est intacte`
                : marge > 0
                  ? `${noms.join(', ')} — ${publiee ? 'prélève des deux côtés' : 'part client estimée, non publiée'}`
                  : noms.join(', '),
          total: parts.clientPaie,
          parts: { ...parts },
          margeEstimee: !publiee,
        };
      });

    const inter = decomposerTjm(tjm, 0, base, { jours, marge: MARGE_ESN_TYPIQUE });
    if (negocies.length) {
      canaux.push({
        cle: 'intermediation',
        titre: 'Intermédiaire, marge non publiée',
        detail: `${negocies.join(', ')} — votre tarif est intact, marge estimée`,
        total: inter.clientPaie,
        parts: { ...inter },
        margeEstimee: true,
      });
    }
    canaux.push({
      cle: 'esn',
      titre: `Régie via une ESN · marge ${Math.round(MARGE_ESN_TYPIQUE * 100)} %`,
      detail: 'vous restez freelance, l’ESN revend votre journée',
      total: inter.clientPaie,
      parts: { ...inter },
      margeEstimee: true,
    });

    const cdi = decomposerCdi(tjm, base, { jours });
    canaux.push({
      cle: 'cdi',
      titre: 'Salarié en CDI dans une ESN',
      detail:
        'l’ESN garde de quoi financer sa structure, l’intercontrat et sa marge',
      total: cdi.clientPaie,
      parts: { ...cdi, marge: cdi.marge },
      margeEstimee: true,
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
      {/* Grouped so the reading rule is stated, not left to be inferred. */}
      <figcaption className="space-y-1.5 text-xs text-ink-500">
        {[
          { titre: 'Ce qui vous concerne', cles: ['net', 'salariales', 'cotisations', 'ir', 'frais', 'avantages', 'patronales'] },
          { titre: 'Ce que garde l’intermédiaire', cles: ['commission', 'marge'] },
        ].map((famille) => (
          <div key={famille.titre} className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="font-medium text-ink-400">{famille.titre}</span>
            {famille.cles
              .map((c) => SEGMENTS.find((s) => s.cle === c))
              .filter((s): s is Segment => !!s)
              .map((s) => (
                <span key={s.cle} className="flex items-center gap-1.5">
                  <span
                    className={[
                      'h-2.5 w-2.5 rounded-sm',
                      s.cle === 'marge' ? 'border border-dashed border-slate-400' : '',
                    ].join(' ')}
                    style={{ background: s.fond ?? s.couleur }}
                  />
                  {s.cle === 'ir'
                    ? 'Impôts — revenu, puis sociétés'
                    : s.cle === 'marge'
                      ? 'Marge côté client (pointillé : estimée)'
                      : s.label}
                </span>
              ))}
          </div>
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
                      // Dashed only where the share is an estimate, solid where
                      // the platform publishes it.
                      s.cle === 'marge' && l.margeEstimee ? 'border-dashed !border-slate-400' : '',
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
