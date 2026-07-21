import { useMemo, useRef, useState } from 'react';
import { eur } from '../lib/format';

export type Point = { brut: number; net: number };

type Props = {
  points: Point[];
  brutCourant: number;
  brutOptimal: number;
  /** Plage de rémunérations équivalentes à l'optimum, à la tolérance près. */
  plateau?: { min: number; max: number; tolerance: number };
  onScrub?: (brut: number) => void;
};

const L = 56; // marge gauche
const R = 16;
const T = 16;
const B = 34;
const W = 720;
const H = 260;

/** Arrondit un pas de graduation à 1, 2, 2,5 ou 5 fois une puissance de dix. */
function pasLisible(brut: number): number {
  if (brut <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(brut));
  const normalise = brut / magnitude;
  const palier = [1, 2, 2.5, 5, 10].find((p) => normalise <= p) ?? 10;
  return palier * magnitude;
}

/**
 * Courbe du net en poche en fonction de la rémunération brute.
 * Tracé en SVG, redimensionné par viewBox — aucune dépendance externe.
 */
export function Courbe({ points, brutCourant, brutOptimal, plateau, onScrub }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [survol, setSurvol] = useState<Point | null>(null);

  const { chemin, aire, x, y, netMin, netMax, brutMax, pasY } = useMemo(() => {
    const brutMax = Math.max(...points.map((p) => p.brut), 1);
    const netMaxBrut = Math.max(...points.map((p) => p.net));
    const netMinBrut = Math.min(...points.map((p) => p.net));
    // On ne repart pas systématiquement de zéro : c'est l'écart entre les
    // stratégies qui doit se lire. L'arrondi des graduations fournit l'air
    // nécessaire au-dessus et en dessous de la courbe.
    const pasY = pasLisible((netMaxBrut - netMinBrut || netMaxBrut) / 4);
    const netMin = Math.max(0, Math.floor(netMinBrut / pasY) * pasY);
    const netMax = Math.ceil((netMaxBrut + pasY / 4) / pasY) * pasY;

    const x = (b: number) => L + (b / brutMax) * (W - L - R);
    const y = (n: number) =>
      T + (1 - (n - netMin) / (netMax - netMin || 1)) * (H - T - B);

    const chemin = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.brut).toFixed(1)},${y(p.net).toFixed(1)}`)
      .join(' ');
    const aire = `${chemin} L${x(brutMax).toFixed(1)},${H - B} L${L},${H - B} Z`;

    return { chemin, aire, x, y, netMin, netMax, brutMax, pasY };
  }, [points]);

  const graduationsY = useMemo(() => {
    const valeurs: number[] = [];
    for (let v = netMin; v <= netMax + 1; v += pasY) valeurs.push(v);
    return valeurs;
  }, [netMin, netMax, pasY]);

  const graduationsX = useMemo(() => {
    const pas = pasLisible(brutMax / 4);
    const valeurs: number[] = [];
    for (let v = 0; v <= brutMax; v += pas) valeurs.push(v);
    return valeurs;
  }, [brutMax]);

  const pointLePlusProche = (clientX: number): Point | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const ratio = (clientX - rect.left) / rect.width;
    const brut = ((ratio * W - L) / (W - L - R)) * brutMax;
    return points.reduce(
      (meilleur, p) =>
        Math.abs(p.brut - brut) < Math.abs(meilleur.brut - brut) ? p : meilleur,
      points[0],
    );
  };

  const courant = points.reduce(
    (meilleur, p) =>
      Math.abs(p.brut - brutCourant) < Math.abs(meilleur.brut - brutCourant) ? p : meilleur,
    points[0],
  );
  const optimal = points.reduce(
    (meilleur, p) =>
      Math.abs(p.brut - brutOptimal) < Math.abs(meilleur.brut - brutOptimal) ? p : meilleur,
    points[0],
  );

  const affiche = survol ?? courant;

  return (
    <figure className="m-0">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none select-none"
        role="img"
        aria-label="Net en poche selon le niveau de rémunération brute"
        onMouseMove={(e) => setSurvol(pointLePlusProche(e.clientX))}
        onMouseLeave={() => setSurvol(null)}
        onClick={(e) => {
          const p = pointLePlusProche(e.clientX);
          if (p && onScrub) onScrub(p.brut);
        }}
      >
        <defs>
          <linearGradient id="degradeAire" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-brand-500)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--color-brand-500)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grille horizontale */}
        {graduationsY.map((v) => (
          <g key={v}>
            <line
              x1={L}
              x2={W - R}
              y1={y(v)}
              y2={y(v)}
              stroke="var(--color-ink-200)"
              strokeDasharray="3 4"
            />
            <text
              x={L - 10}
              y={y(v) + 4}
              textAnchor="end"
              className="tabular"
              fontSize="11"
              fill="var(--color-ink-400)"
            >
              {eur(v)}
            </text>
          </g>
        ))}

        {/* Axe des abscisses */}
        {graduationsX.map((v, i) => (
          <text
            key={v}
            x={x(v)}
            y={H - B + 20}
            textAnchor={i === 0 ? 'start' : 'middle'}
            className="tabular"
            fontSize="11"
            fill="var(--color-ink-400)"
          >
            {eur(v)}
          </text>
        ))}

        {/* Zone où le net ne varie pas de façon significative */}
        {plateau && plateau.max > plateau.min && (
          <rect
            x={x(plateau.min)}
            y={T}
            width={x(plateau.max) - x(plateau.min)}
            height={H - T - B}
            fill="var(--color-gold-500)"
            opacity="0.12"
          />
        )}

        <path d={aire} fill="url(#degradeAire)" />
        <path
          d={chemin}
          fill="none"
          stroke="var(--color-brand-500)"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Optimum */}
        <line
          x1={x(optimal.brut)}
          x2={x(optimal.brut)}
          y1={T}
          y2={H - B}
          stroke="var(--color-gold-500)"
          strokeWidth="1.5"
          strokeDasharray="4 4"
        />
        <circle
          cx={x(optimal.brut)}
          cy={y(optimal.net)}
          r="5"
          fill="var(--color-gold-500)"
          stroke="#fff"
          strokeWidth="2"
        />

        {/* Position courante / survolée */}
        <line
          x1={x(affiche.brut)}
          x2={x(affiche.brut)}
          y1={T}
          y2={H - B}
          stroke="var(--color-brand-600)"
          strokeWidth="1.5"
        />
        <circle
          cx={x(affiche.brut)}
          cy={y(affiche.net)}
          r="6"
          fill="var(--color-brand-600)"
          stroke="#fff"
          strokeWidth="2.5"
        />
      </svg>

      <figcaption className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-ink-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-brand-600" />
          Votre choix — {eur(affiche.brut)} de brut → {eur(affiche.net)} net
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-gold-500" />
          Optimum — {eur(optimal.brut)} de brut
        </span>
        {plateau && plateau.max > plateau.min && (
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-4 rounded-sm bg-gold-500/20" />
            Zone équivalente à {eur(plateau.tolerance)} près — {eur(plateau.min)} à{' '}
            {eur(plateau.max)}
          </span>
        )}
        <span className="text-ink-400">Cliquez sur la courbe pour vous y placer.</span>
      </figcaption>
    </figure>
  );
}
