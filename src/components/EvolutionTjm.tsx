import { eur } from '../lib/format';
import type { Evenement } from '../lib/barometreTjm';
import { anneeDecimale } from '../lib/barometreTjm';

/**
 * Day-rate evolution over time. Hand-drawn SVG, scaled through the viewBox — no
 * dependency, like the other charts.
 *
 * Estimated points (2024-2025, not archived) and any segment touching them are
 * drawn dashed with a hollow marker, so they read as a trend, not measured data.
 * The 2023 and 2026 endpoints are real measured points.
 */

export type SerieTemporelle = {
  label: string;
  couleur: string;
  epais?: boolean;
  points: {
    annee: number;
    valeur: number;
    estime?: boolean;
    /** Projected, not measured: drawn inside a shaded band past the cut-off. */
    projete?: boolean;
    bas?: number;
    haut?: number;
  }[];
};

const W = 760;
const H = 300;
/** Headroom above the plot, enough for three rows of event labels. */
const HAUT = 46;
const RANGEES_EVT = [12, 24, 36];
const BAS = 40;
const GAUCHE = 46;
const DROITE = 14;

function pasLisible(brut: number): number {
  if (brut <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(brut));
  const palier = [1, 2, 2.5, 5, 10].find((p) => brut / mag <= p) ?? 10;
  return palier * mag;
}

export function EvolutionTjm({
  series,
  evenements,
  tjmUtilisateur,
  finMesures,
}: {
  series: SerieTemporelle[];
  evenements: Evenement[];
  tjmUtilisateur?: number;
  /** Decimal year where measurements stop and projections begin. */
  finMesures?: number;
}) {
  const toutesValeurs = series.flatMap((s) =>
    s.points.flatMap((p) => [p.valeur, p.bas, p.haut].filter((v): v is number => v !== undefined)),
  );
  if (tjmUtilisateur) toutesValeurs.push(tjmUtilisateur);
  const toutesAnnees = series.flatMap((s) => s.points.map((p) => p.annee));
  const anneesEvt = evenements.map((e) => anneeDecimale(e.date));

  const anMin = Math.floor(Math.min(...toutesAnnees, ...anneesEvt) - 0.2);
  const anMax = Math.ceil(Math.max(...toutesAnnees) + 0.2);

  const vMaxBrut = Math.max(...toutesValeurs);
  const vMinBrut = Math.min(...toutesValeurs);
  const pasY = pasLisible((vMaxBrut - vMinBrut || vMaxBrut) / 4);
  const vMin = Math.max(0, Math.floor(vMinBrut / pasY) * pasY);
  const vMax = Math.ceil((vMaxBrut + pasY / 4) / pasY) * pasY;

  const x = (a: number) => GAUCHE + ((a - anMin) / (anMax - anMin || 1)) * (W - GAUCHE - DROITE);
  const y = (v: number) => HAUT + (1 - (v - vMin) / (vMax - vMin || 1)) * (H - HAUT - BAS);

  const graduationsY: number[] = [];
  for (let v = vMin; v <= vMax + 1; v += pasY) graduationsY.push(v);
  const annees: number[] = [];
  for (let a = anMin; a <= anMax; a++) annees.push(a);

  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full select-none" role="img"
        aria-label="Évolution du tarif jour moyen dans le temps">
        {/* Everything past the last measurement is hypothetical: shade it, and
            draw a hard divider so it cannot be mistaken for measured data. */}
        {finMesures !== undefined && finMesures > 0 && x(finMesures) < W - DROITE && (
          <g>
            <rect x={x(finMesures)} y={HAUT} width={W - DROITE - x(finMesures)} height={H - HAUT - BAS}
              fill="var(--color-ink-100)" opacity="0.7" />
            <line x1={x(finMesures)} x2={x(finMesures)} y1={HAUT} y2={H - BAS}
              stroke="var(--color-ink-400)" strokeWidth="1" />
            <text x={x(finMesures) + 5} y={HAUT + 11} fontSize="9.5" fontWeight="600"
              fill="var(--color-ink-500)">
              projection
            </text>
          </g>
        )}

        {/* Horizontal grid */}
        {graduationsY.map((v) => (
          <g key={v}>
            <line x1={GAUCHE} x2={W - DROITE} y1={y(v)} y2={y(v)}
              stroke="var(--color-ink-200)" strokeDasharray={v === vMin ? undefined : '3 4'} />
            <text x={GAUCHE - 8} y={y(v) + 4} textAnchor="end" className="tabular"
              fontSize="11" fill="var(--color-ink-400)">{eur(v)}</text>
          </g>
        ))}

        {/* Year ticks */}
        {annees.map((a) => (
          <text key={a} x={x(a)} y={H - BAS + 20} textAnchor="middle" className="tabular"
            fontSize="11" fill="var(--color-ink-400)">{a}</text>
        ))}

        {/* Events — a label only drops to a lower row when it would overlap the
            previous one, and it shifts inward rather than spilling off the edge. */}
        {(() => {
          const fins = RANGEES_EVT.map(() => -Infinity);
          return [...evenements]
            .map((e) => ({ ...e, a: anneeDecimale(e.date) }))
            .sort((u, v) => u.a - v.a)
            .map((e) => {
              const ax = x(e.a);
              if (ax < GAUCHE || ax > W - DROITE) return null;
              // Rough text width: enough to detect overlaps at this font size.
              const demi = (e.label.length * 4.6) / 2;
              const tx = Math.min(Math.max(ax, GAUCHE + demi), W - DROITE - demi);
              // First row where this label fits; otherwise the emptiest one.
              let rangee = fins.findIndex((fin) => tx - demi >= fin + 6);
              if (rangee < 0) rangee = fins.indexOf(Math.min(...fins));
              fins[rangee] = tx + demi;
              const ty = RANGEES_EVT[rangee];
              return (
                <g key={e.date}>
                  <line x1={ax} x2={ax} y1={ty + 3} y2={H - BAS} stroke="var(--color-gold-500)"
                    strokeWidth="1.2" strokeDasharray="2 3" opacity="0.8" />
                  <text x={tx} y={ty} textAnchor="middle" fontSize="9.5"
                    fontWeight="600" fill="var(--color-gold-600)">{e.label}</text>
                </g>
              );
            });
        })()}

        {/* Series */}
        {series.map((s) => {
          const pts = [...s.points].sort((a, b) => a.annee - b.annee);
          // Uncertainty band: the last measured point plus every projected one.
          const iPremierProj = pts.findIndex((p) => p.projete);
          const bande =
            iPremierProj > 0
              ? [{ ...pts[iPremierProj - 1], bas: pts[iPremierProj - 1].valeur, haut: pts[iPremierProj - 1].valeur },
                 ...pts.slice(iPremierProj)].filter((p) => p.bas !== undefined && p.haut !== undefined)
              : [];
          return (
            <g key={s.label}>
              {bande.length > 1 && (
                <polygon
                  points={[
                    ...bande.map((p) => `${x(p.annee)},${y(p.haut as number)}`),
                    ...[...bande].reverse().map((p) => `${x(p.annee)},${y(p.bas as number)}`),
                  ].join(' ')}
                  fill={s.couleur}
                  opacity="0.13"
                />
              )}
              {pts.slice(1).map((p, i) => {
                const prev = pts[i];
                const incertain = p.projete || p.estime || prev.estime;
                return (
                  <line key={i} x1={x(prev.annee)} y1={y(prev.valeur)} x2={x(p.annee)}
                    y2={y(p.valeur)} stroke={s.couleur} strokeWidth={s.epais ? 2.5 : 1.5}
                    strokeLinecap="round" strokeDasharray={incertain ? '2 4' : undefined}
                    opacity={s.epais ? (p.projete ? 0.65 : 1) : 0.55} />
                );
              })}
              {pts.map((p) =>
                p.projete ? (
                  // Hollow diamond: unmistakably not a measured point.
                  <rect key={p.annee} x={x(p.annee) - 3.5} y={y(p.valeur) - 3.5} width="7" height="7"
                    transform={`rotate(45 ${x(p.annee)} ${y(p.valeur)})`}
                    fill="#fff" stroke={s.couleur} strokeWidth="1.5" />
                ) : (
                  <circle key={p.annee} cx={x(p.annee)} cy={y(p.valeur)} r={s.epais ? 4 : 3}
                    fill={p.estime ? '#fff' : s.couleur} stroke={p.estime ? s.couleur : '#fff'}
                    strokeWidth="1.5" opacity={s.epais ? 1 : 0.6} />
                ),
              )}
            </g>
          );
        })}

        {/* User's rate */}
        {tjmUtilisateur !== undefined && tjmUtilisateur > 0 && (
          <>
            <line x1={GAUCHE} x2={W - DROITE} y1={y(tjmUtilisateur)} y2={y(tjmUtilisateur)}
              stroke="var(--color-brand-600)" strokeWidth="1.5" strokeDasharray="5 3" />
            <text x={W - DROITE} y={y(tjmUtilisateur) - 6} textAnchor="end" className="tabular"
              fontSize="11" fontWeight="600" fill="var(--color-brand-700)">
              votre TJM · {eur(tjmUtilisateur)}
            </text>
          </>
        )}
      </svg>

      <figcaption className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-ink-500">
        {series.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.couleur }} />
            {s.label}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="h-0 w-4 border-t-2 border-dashed border-gold-500" /> Événement
        </span>
        {series.some((s) => s.points.some((p) => p.projete)) && (
          <span className="flex items-center gap-1.5 text-ink-400">
            <span className="h-2 w-2 rotate-45 border border-ink-400 bg-white" />
            2027-2028&nbsp;: projection hypothétique (fourchette grisée)
          </span>
        )}
      </figcaption>
    </figure>
  );
}
