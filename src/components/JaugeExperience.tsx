import { eur } from '../lib/format';
import { positionner, type NiveauExperience } from '../lib/barometreTjm';

/**
 * Where a rate sits within its seniority bracket: the low-to-high range the source
 * shows, the average, and the user's own rate as a pointer.
 */
export function JaugeExperience({
  tjm,
  niveau,
}: {
  tjm: number;
  niveau: NiveauExperience;
}) {
  const W = 760;
  const H = 96;
  const L = 12;
  const R = 12;
  const yBarre = 52;
  const largeur = W - L - R;

  const p = positionner(tjm, niveau);
  const x = (v: number) =>
    L + Math.max(0, Math.min(1, (v - niveau.bas) / (niveau.haut - niveau.bas || 1))) * largeur;
  const xMoyen = x(niveau.moyen);
  const xTjm = x(tjm);

  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full select-none" role="img"
        aria-label="Position du TJM dans la plage de la tranche d'expérience">
        <defs>
          <linearGradient id="jauge" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--color-ink-200)" />
            <stop offset="100%" stopColor="var(--color-brand-300)" />
          </linearGradient>
        </defs>

        <rect x={L} y={yBarre - 6} width={largeur} height="12" rx="6" fill="url(#jauge)" />

        {/* Bounds */}
        <text x={L} y={yBarre + 26} fontSize="11" fill="var(--color-ink-400)">
          {eur(niveau.bas)} et -
        </text>
        <text x={W - R} y={yBarre + 26} textAnchor="end" fontSize="11" fill="var(--color-ink-400)">
          {eur(niveau.haut)} et +
        </text>

        {/* Average */}
        <line x1={xMoyen} x2={xMoyen} y1={yBarre - 16} y2={yBarre + 16}
          stroke="var(--color-gold-500)" strokeWidth="2" />
        <text x={xMoyen} y={yBarre + 30} textAnchor="middle" fontSize="11"
          fontWeight="600" fill="var(--color-gold-600)">
          moyenne {eur(niveau.moyen)}
        </text>

        {/* User's rate pointer */}
        <circle cx={xTjm} cy={yBarre} r="8" fill="var(--color-brand-600)" stroke="#fff" strokeWidth="2.5" />
        <text x={xTjm} y={yBarre - 16} textAnchor="middle" className="tabular" fontSize="12"
          fontWeight="700" fill="var(--color-brand-700)">
          {eur(tjm)}
        </text>
      </svg>

      <p className="mt-1 text-sm leading-relaxed text-ink-600">
        {p.ecartMoyen === 0 ? (
          <>Vous êtes pile sur la moyenne de la tranche <strong>{niveau.label}</strong>.</>
        ) : (
          <>
            Votre TJM est{' '}
            <strong className={p.auDessusDeLaMoyenne ? 'text-brand-700' : 'text-gold-700'}>
              {eur(Math.abs(p.ecartMoyen))} {p.auDessusDeLaMoyenne ? 'au-dessus' : 'en dessous'}
            </strong>{' '}
            de la moyenne de la tranche <strong>{niveau.label}</strong> ({eur(niveau.moyen)}),
            au {Math.round(p.positionDansPlage * 100)}ᵉ centile de la fourchette affichée.
          </>
        )}
      </p>
    </figure>
  );
}
