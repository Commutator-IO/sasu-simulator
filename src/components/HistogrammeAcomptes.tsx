import { eur } from '../lib/format';
import type { ResultatAcomptes } from '../lib/acomptes';

/**
 * Quarterly instalments as grouped bars: what is called for against what is
 * actually paid, plus the balance as a separate, detached bar.
 *
 * Hand-drawn SVG scaled through the viewBox, like the other chart — no
 * external dependency.
 */

const W = 720;
const H = 300;
const HAUT = 24;
const BAS = 62;
const GAUCHE = 8;
const DROITE = 8;

/** Rounds an axis step to 1, 2, 2.5 or 5 times a power of ten. */
function pasLisible(brut: number): number {
  if (brut <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(brut));
  const palier = [1, 2, 2.5, 5, 10].find((p) => brut / magnitude <= p) ?? 10;
  return palier * magnitude;
}

export function HistogrammeAcomptes({ r }: { r: ResultatAcomptes }) {
  const solde = r.solde;
  const colonnes = [
    ...r.echeances.map((e) => ({
      cle: `t${e.rang}`,
      libelle: e.date,
      appele: e.parDefaut,
      verse: e.ajuste,
      passee: e.passee,
      estSolde: false,
    })),
    {
      cle: 'solde',
      libelle: '15 mai',
      appele: 0,
      // A refund points the other way; the bar shows its size either way.
      verse: Math.abs(solde),
      passee: false,
      estSolde: true,
    },
  ];

  const maxi = Math.max(...colonnes.flatMap((c) => [c.appele, c.verse]), 1);
  const pas = pasLisible(maxi / 3);
  const plafond = Math.ceil(maxi / pas) * pas;

  const largeurUtile = W - GAUCHE - DROITE;
  const largeurColonne = largeurUtile / colonnes.length;
  const y = (v: number) => HAUT + (1 - v / plafond) * (H - HAUT - BAS);
  const hauteur = (v: number) => Math.max(v > 0 ? 2 : 0, (v / plafond) * (H - HAUT - BAS));

  const graduations: number[] = [];
  for (let v = 0; v <= plafond + 1; v += pas) graduations.push(v);

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full select-none"
        role="img"
        aria-label="Montants versés à chaque échéance trimestrielle"
      >
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

        {colonnes.map((c, i) => {
          const centre = GAUCHE + largeurColonne * (i + 0.5);
          const largeurBarre = Math.min(38, largeurColonne * 0.3);
          const gauche = centre - largeurBarre - 2;
          const droite = centre + 2;

          return (
            <g key={c.cle}>
              {/* Called for: outlined, since it is a reference rather than a payment */}
              {!c.estSolde && c.appele > 0 && (
                <rect
                  x={gauche}
                  y={y(c.appele)}
                  width={largeurBarre}
                  height={hauteur(c.appele)}
                  rx="3"
                  fill="var(--color-ink-200)"
                />
              )}

              <rect
                x={c.estSolde ? centre - largeurBarre / 2 : droite}
                y={y(c.verse)}
                width={largeurBarre}
                height={hauteur(c.verse)}
                rx="3"
                fill={
                  c.estSolde
                    ? solde > 0.5
                      ? 'var(--color-gold-500)'
                      : 'var(--color-brand-300)'
                    : c.passee
                      ? 'var(--color-ink-500)'
                      : 'var(--color-brand-500)'
                }
              />

              {c.verse > 0 && (
                <text
                  x={c.estSolde ? centre : droite + largeurBarre / 2}
                  y={y(c.verse) - 6}
                  textAnchor="middle"
                  className="tabular"
                  fontSize="11"
                  fontWeight="600"
                  fill="var(--color-ink-700)"
                >
                  {eur(c.verse)}
                </text>
              )}

              <text
                x={centre}
                y={H - BAS + 18}
                textAnchor="middle"
                fontSize="12"
                fill="var(--color-ink-600)"
              >
                {c.libelle}
              </text>
              <text
                x={centre}
                y={H - BAS + 34}
                textAnchor="middle"
                fontSize="10"
                fill="var(--color-ink-400)"
              >
                {c.estSolde
                  ? solde > 0.5
                    ? 'à payer'
                    : solde < -0.5
                      ? 'restitué'
                      : 'rien à payer'
                  : c.passee
                    ? 'déjà versé'
                    : 'à venir'}
              </text>
            </g>
          );
        })}
      </svg>

      <figcaption className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-ink-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-ink-200" /> Appelé
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-ink-500" /> Déjà versé
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-brand-500" /> À verser
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className={`h-2.5 w-2.5 rounded-sm ${solde > 0.5 ? 'bg-gold-500' : 'bg-brand-300'}`}
          />
          Solde
        </span>
      </figcaption>
    </figure>
  );
}
