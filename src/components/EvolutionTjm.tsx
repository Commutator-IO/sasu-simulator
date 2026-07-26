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
  points: { annee: number; valeur: number; estime?: boolean }[];
};

const W = 760;
const H = 300;
const HAUT = 30;
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
}: {
  series: SerieTemporelle[];
  evenements: Evenement[];
  tjmUtilisateur?: number;
}) {
  const toutesValeurs = series.flatMap((s) => s.points.map((p) => p.valeur));
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

        {/* Events — labels staggered over two rows so close dates don't collide */}
        {[...evenements]
          .map((e) => ({ ...e, a: anneeDecimale(e.date) }))
          .sort((u, v) => u.a - v.a)
          .map((e, i) => {
            const ax = x(e.a);
            if (ax < GAUCHE || ax > W - DROITE) return null;
            const ty = i % 2 === 0 ? HAUT - 18 : HAUT - 6;
            return (
              <g key={e.date}>
                <line x1={ax} x2={ax} y1={ty + 3} y2={H - BAS} stroke="var(--color-gold-500)"
                  strokeWidth="1.2" strokeDasharray="2 3" opacity="0.8" />
                <text x={ax} y={ty} textAnchor="middle" fontSize="9.5"
                  fontWeight="600" fill="var(--color-gold-600)">{e.label}</text>
              </g>
            );
          })}

        {/* Series */}
        {series.map((s) => {
          const pts = [...s.points].sort((a, b) => a.annee - b.annee);
          return (
            <g key={s.label}>
              {pts.slice(1).map((p, i) => {
                const prev = pts[i];
                const estime = p.estime || prev.estime || p.annee - prev.annee > 1.5;
                return (
                  <line key={i} x1={x(prev.annee)} y1={y(prev.valeur)} x2={x(p.annee)}
                    y2={y(p.valeur)} stroke={s.couleur} strokeWidth={s.epais ? 2.5 : 1.5}
                    strokeLinecap="round" strokeDasharray={estime ? '4 4' : undefined}
                    opacity={s.epais ? 1 : 0.55} />
                );
              })}
              {pts.map((p) => (
                <circle key={p.annee} cx={x(p.annee)} cy={y(p.valeur)} r={s.epais ? 4 : 3}
                  fill={p.estime ? '#fff' : s.couleur} stroke={p.estime ? s.couleur : '#fff'}
                  strokeWidth="1.5" opacity={s.epais ? 1 : 0.6} />
              ))}
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
        {series.some((s) => s.points.some((p) => p.estime)) && (
          <span className="flex items-center gap-1.5 text-ink-400">
            <span className="h-2 w-2 rounded-full border border-ink-400 bg-white" />
            2024-2025 : estimation
          </span>
        )}
      </figcaption>
    </figure>
  );
}
