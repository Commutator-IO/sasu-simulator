import { eur } from '../lib/format';
import type { ResultatProjection } from '../lib/projection';

/**
 * Monthly turnover across the year: invoiced months solid, projected months
 * lighter, with a running cumulative line reaching the year-end total and a
 * dashed reference line at the monthly average.
 *
 * Hand-drawn SVG scaled through the viewBox — no external dependency, like the
 * instalment chart.
 */

const W = 860;
const H = 320;
const HAUT = 24;
const BAS = 52;
const GAUCHE = 8;
const DROITE = 8;

/** Rounds an axis step to 1, 2, 2.5 or 5 times a power of ten. */
function pasLisible(brut: number): number {
  if (brut <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(brut));
  const palier = [1, 2, 2.5, 5, 10].find((p) => brut / magnitude <= p) ?? 10;
  return palier * magnitude;
}

export function HistogrammeProjection({ r }: { r: ResultatProjection }) {
  const maxi = Math.max(...r.mois.map((m) => m.montant), 1);
  const pas = pasLisible(maxi / 3);
  const plafond = Math.ceil(maxi / pas) * pas;

  const largeurColonne = (W - GAUCHE - DROITE) / r.mois.length;
  const y = (v: number) => HAUT + (1 - v / plafond) * (H - HAUT - BAS);
  const hauteur = (v: number) =>
    Math.max(v > 0 ? 2 : 0, (v / plafond) * (H - HAUT - BAS));

  const graduations: number[] = [];
  for (let v = 0; v <= plafond + 1; v += pas) graduations.push(v);

  // First projected month, to tint the rest of the year behind the bars.
  const premierProjete = r.mois.findIndex((m) => m.projete);
  const debutProjection =
    premierProjete >= 0 ? GAUCHE + largeurColonne * premierProjete : W - DROITE;

  const yMoyenne = y(r.moyenneMensuelle);

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full select-none"
        role="img"
        aria-label="Chiffre d'affaires mensuel, mois facturés puis mois projetés"
      >
        {/* The projected part of the year sits on its own tinted band */}
        {premierProjete >= 0 && (
          <>
            <rect
              x={debutProjection}
              y={HAUT - 16}
              width={W - DROITE - debutProjection}
              height={H - HAUT - BAS + 16}
              fill="var(--color-ink-100)"
              opacity="0.55"
              rx="6"
            />
            <text
              x={debutProjection + 8}
              y={HAUT - 4}
              fontSize="10"
              fontWeight="600"
              fill="var(--color-ink-400)"
              letterSpacing="0.05em"
            >
              PROJETÉ
            </text>
          </>
        )}

        {graduations.map((v) => (
          <g key={v}>
            <line
              x1={GAUCHE}
              x2={W - DROITE}
              y1={y(v)}
              y2={y(v)}
              stroke="var(--color-ink-200)"
              strokeDasharray={v === 0 ? undefined : '3 4'}
            />
            <text
              x={GAUCHE + 2}
              y={y(v) - 5}
              className="tabular"
              fontSize="11"
              fill="var(--color-ink-400)"
            >
              {eur(v)}
            </text>
          </g>
        ))}

        {r.mois.map((m, i) => {
          const centre = GAUCHE + largeurColonne * (i + 0.5);
          const largeurBarre = Math.min(30, largeurColonne * 0.5);
          return (
            <g key={m.nom}>
              <rect
                x={centre - largeurBarre / 2}
                y={y(m.montant)}
                width={largeurBarre}
                height={hauteur(m.montant)}
                rx="3"
                fill={m.projete ? 'var(--color-brand-200)' : 'var(--color-brand-500)'}
              />
              <text
                x={centre}
                y={H - BAS + 18}
                textAnchor="middle"
                fontSize="10.5"
                fill="var(--color-ink-500)"
              >
                {m.court}
              </text>
            </g>
          );
        })}

        {/* Average of the invoiced months: the extrapolation basis */}
        {r.moyenneMensuelle > 0 && (
          <>
            <line
              x1={GAUCHE}
              x2={W - DROITE}
              y1={yMoyenne}
              y2={yMoyenne}
              stroke="var(--color-gold-500)"
              strokeWidth="1.5"
              strokeDasharray="6 4"
            />
            <text
              x={W - DROITE - 2}
              y={yMoyenne - 6}
              textAnchor="end"
              className="tabular"
              fontSize="11"
              fontWeight="600"
              fill="var(--color-gold-600)"
            >
              moyenne {eur(r.moyenneMensuelle)}
            </text>
          </>
        )}
      </svg>

      <figcaption className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-ink-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-brand-500" /> Facturé
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-brand-200" /> Projeté
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded bg-gold-500" /> Moyenne mensuelle
        </span>
      </figcaption>
    </figure>
  );
}
