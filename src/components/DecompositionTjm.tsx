import { useMemo, useState } from 'react';
import { eur } from '../lib/format';
import { PLATEFORMES } from '../lib/barometreTjm';
import { DEFAUTS_ARBITRAGE } from '../lib/arbitrage';
import { decomposerTjm, type PartTjm } from '../lib/rentabilite';

/**
 * Where one billed day actually goes, commission by commission.
 *
 * A part-to-whole comparison across commission levels, so a stacked bar is the
 * form: each bar is the same invoiced rate, cut into what the platform takes,
 * what the company spends, what the State takes, and what is left. Platforms
 * charging the same are one bar — three identical rows would be noise.
 *
 * The four hues are the validated categorical set; the contrast warning on two
 * of them is answered by labelling every segment's value directly.
 */

const PARTS = [
  { cle: 'net' as const, label: 'Net en poche', couleur: '#1e9970' },
  { cle: 'prelevements' as const, label: 'Cotisations, IS et IR', couleur: '#d99b1f' },
  { cle: 'frais' as const, label: 'Frais de la société', couleur: '#0ea5e9' },
  { cle: 'commission' as const, label: 'Commission plateforme', couleur: '#db2777' },
];

export function DecompositionTjm({ tjm, jours }: { tjm: number; jours: number }) {
  const [survol, setSurvol] = useState<{ ligne: string; part: string } | null>(null);

  const lignes = useMemo(() => {
    // One bar per distinct commission, naming the platforms that share it.
    const parTaux = new Map<number, string[]>();
    for (const p of PLATEFORMES) {
      parTaux.set(p.taux, [...(parTaux.get(p.taux) ?? []), p.nom]);
    }
    return [...parTaux.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([taux, noms]) => ({
        cle: `${taux}`,
        taux,
        titre: taux === 0 ? 'Sans commission' : `Commission ${Math.round(taux * 100)} %`,
        noms,
        parts: decomposerTjm(tjm, taux, DEFAUTS_ARBITRAGE, { jours }),
      }));
  }, [tjm, jours]);

  if (tjm <= 0) return null;
  const lu = survol
    ? lignes
        .find((l) => l.cle === survol.ligne)
        ?.parts[survol.part as keyof PartTjm]
    : null;

  return (
    <figure className="m-0">
      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-500">
        {PARTS.map((p) => (
          <span key={p.cle} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: p.couleur }} />
            {p.label}
          </span>
        ))}
      </figcaption>

      <div className="mt-4 space-y-3">
        {lignes.map((l) => (
          <div key={l.cle}>
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-medium text-ink-900">
                {l.titre}
                <span className="ml-2 text-xs font-normal text-ink-400">
                  {l.noms.join(', ')}
                </span>
              </p>
              <p className="tabular shrink-0 text-sm">
                <span className="font-semibold text-ink-900">
                  {eur(Math.round(l.parts.net))}
                </span>
                <span className="text-ink-400"> / jour</span>
              </p>
            </div>

            <div className="mt-1.5 flex h-7 gap-[2px] overflow-hidden rounded">
              {PARTS.map((p) => {
                const valeur = l.parts[p.cle];
                if (valeur <= 0) return null;
                const actif = survol?.ligne === l.cle && survol.part === p.cle;
                return (
                  <button
                    key={p.cle}
                    type="button"
                    aria-label={`${p.label} : ${eur(Math.round(valeur))} par jour`}
                    onMouseEnter={() => setSurvol({ ligne: l.cle, part: p.cle })}
                    onMouseLeave={() => setSurvol(null)}
                    onFocus={() => setSurvol({ ligne: l.cle, part: p.cle })}
                    onBlur={() => setSurvol(null)}
                    className="flex items-center justify-center overflow-hidden text-[11px] font-semibold text-white transition-opacity first:rounded-l last:rounded-r"
                    style={{
                      width: `${(valeur / tjm) * 100}%`,
                      backgroundColor: p.couleur,
                      opacity: survol && !actif ? 0.55 : 1,
                    }}
                  >
                    {/* Labelled directly wherever the segment is wide enough — the
                        relief the contrast check asks for. */}
                    {valeur / tjm > 0.12 ? eur(Math.round(valeur)) : ''}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <p className="field-hint mt-3 min-h-[1.25rem]">
        {survol && lu !== null && lu !== undefined
          ? `${PARTS.find((p) => p.cle === survol.part)?.label} : ${eur(Math.round(lu))} par jour, soit ${Math.round((lu / tjm) * 100)} % de votre tarif facturé.`
          : `Sur ${eur(tjm)} facturés par jour, réparti au meilleur arbitrage salaire/dividendes, sur ${Math.round(jours)} jours facturés par an.`}
      </p>
    </figure>
  );
}
