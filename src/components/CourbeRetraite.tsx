import { useMemo } from 'react';
import { eur } from '../lib/format';
import type { Resultat } from '../lib/simulation';

const L = 56;
const R = 16;
const T = 24;
const B = 34;
const W = 720;
const H = 220;

/** Yearly pension per €1,000 of company cost, between two salary levels. */
function rendement(a: Resultat, b: Resultat): number {
  const cout = b.coutEmployeur - a.coutEmployeur;
  return cout > 0 ? ((b.retraiteAcquiseBrute - a.retraiteAcquiseBrute) / cout) * 1_000 : 0;
}

/**
 * The yearly pension this year's salary buys, across salary levels. The slope
 * is what each extra euro of cost buys; it halves past the social security
 * ceiling, where the base pension stops growing.
 */
export function CourbeRetraite({
  points,
  brutCourant,
}: {
  points: { brut: number; resultat: Resultat }[];
  brutCourant: number;
}) {
  const { chemin, x, y, maxRente, brutMax, plafond, sous, dessus, courant } = useMemo(() => {
    const brutMax = Math.max(...points.map((p) => p.brut), 1);
    const maxRente = Math.max(...points.map((p) => p.resultat.retraiteAcquiseBrute), 1);
    const x = (b: number) => L + (b / brutMax) * (W - L - R);
    const y = (v: number) => T + (1 - v / maxRente) * (H - T - B);
    const chemin = points
      .map((p, i) => `${i ? 'L' : 'M'}${x(p.brut).toFixed(1)},${y(p.resultat.retraiteAcquiseBrute).toFixed(1)}`)
      .join(' ');
    // Where the base pension stops growing: the company salary at which the
    // combined pay, outside job included, reaches the ceiling.
    const dernier = points[points.length - 1]?.resultat;
    const plafond = dernier ? Math.max(0, dernier.plafondTranche1 - dernier.salaireExterneBrut) : 0;
    const avant = points.filter((p) => p.brut < plafond);
    const apres = points.filter((p) => p.brut > plafond);
    const sous = avant.length > 1 ? rendement(avant[0].resultat, avant[avant.length - 1].resultat) : null;
    const dessus = apres.length > 1 ? rendement(apres[0].resultat, apres[apres.length - 1].resultat) : null;
    const courant = points.reduce(
      (m, p) => (Math.abs(p.brut - brutCourant) < Math.abs(m.brut - brutCourant) ? p : m),
      points[0],
    );
    return { chemin, x, y, maxRente, brutMax, plafond, sous, dessus, courant };
  }, [points, brutCourant]);

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="Rente annuelle de retraite acquise selon la rémunération brute"
      >
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={L} x2={W - R} y1={y(maxRente * f)} y2={y(maxRente * f)} stroke="var(--color-ink-200)" strokeDasharray="3 4" />
            <text x={L - 10} y={y(maxRente * f) + 4} textAnchor="end" fontSize="11" fill="var(--color-ink-400)" className="tabular">
              {eur(maxRente * f)}
            </text>
          </g>
        ))}
        {plafond > 0 && plafond < brutMax && (
          <g>
            <line x1={x(plafond)} x2={x(plafond)} y1={T} y2={H - B} stroke="var(--color-ink-300)" strokeDasharray="1 3" />
            <text x={x(plafond)} y={T - 8} textAnchor="middle" fontSize="10" fill="var(--color-ink-400)">
              PASS
            </text>
          </g>
        )}
        <path d={chemin} fill="none" stroke="var(--color-brand-500)" strokeWidth="2.5" strokeLinejoin="round" />
        <circle
          cx={x(courant.brut)}
          cy={y(courant.resultat.retraiteAcquiseBrute)}
          r="5"
          fill="var(--color-brand-600)"
          stroke="#fff"
          strokeWidth="2"
        />
        <text x={L} y={H - B + 20} fontSize="11" fill="var(--color-ink-400)" className="tabular">
          0 €
        </text>
        <text x={W - R} y={H - B + 20} textAnchor="end" fontSize="11" fill="var(--color-ink-400)" className="tabular">
          {eur(brutMax)} de brut
        </text>
      </svg>
      <figcaption className="mt-2 text-xs leading-relaxed text-ink-500">
        Votre choix : {eur(courant.resultat.retraiteAcquiseBrute)} de rente annuelle brute
        pour {eur(courant.brut)} de brut.
        {sous !== null && (
          <>
            {' '}
            Sous le plafond, chaque tranche de 1 000 € de coût achète{' '}
            <strong className="font-semibold text-ink-800">{eur(sous)}</strong> de rente
            annuelle
            {dessus !== null && (
              <>
                {' '}; au-delà, <strong className="font-semibold text-ink-800">{eur(dessus)}</strong>,
                car la retraite de base cesse de progresser
              </>
            )}
            .
          </>
        )}
      </figcaption>
    </figure>
  );
}
