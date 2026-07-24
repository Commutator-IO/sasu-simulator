import { NB_MOIS, type HypothesesProjection } from './projection';
import { arrondi, booleen, MAX_MONTANT, nombre } from './url';

/**
 * Serialisation of a projection into the URL.
 *
 * Same two principles as the other tools: only what differs from the defaults
 * is written, and everything read back is clamped. The validation primitives
 * are shared with `url.ts`.
 */

const CLES = {
  ca: 'ca',
  moisFactures: 'moisFactures',
  fraisMensuels: 'fraisMensuels',
  tauxVariable: 'tauxVariable',
  isReduit: 'isReduit',
} as const;

/** Monthly turnover travels as a comma-separated list of twelve amounts. */
function encoderFacturation(facturation: number[]): string {
  return Array.from({ length: NB_MOIS }, (_, i) => String(arrondi(facturation[i] ?? 0))).join(
    ',',
  );
}

function decoderFacturation(brut: string | null, defaut: number[]): number[] {
  if (brut === null || brut.trim() === '') return [...defaut];
  const parts = brut.split(',');
  return Array.from({ length: NB_MOIS }, (_, i) =>
    nombre(parts[i] ?? null, defaut[i] ?? 0, 0, MAX_MONTANT),
  );
}

export function encoderProjection(
  h: HypothesesProjection,
  defauts: HypothesesProjection,
): string {
  const params = new URLSearchParams();
  const ajouter = (cle: string, valeur: number | boolean, defaut: number | boolean) => {
    if (valeur === defaut) return;
    params.set(cle, typeof valeur === 'boolean' ? (valeur ? '1' : '0') : String(valeur));
  };

  const facturation = encoderFacturation(h.facturation);
  if (facturation !== encoderFacturation(defauts.facturation)) {
    params.set(CLES.ca, facturation);
  }
  ajouter(CLES.moisFactures, arrondi(h.moisFactures), defauts.moisFactures);
  ajouter(CLES.fraisMensuels, arrondi(h.fraisMensuels), defauts.fraisMensuels);
  // The rate keeps three decimals: 12,5 % must survive the round trip.
  ajouter(
    CLES.tauxVariable,
    arrondi(h.tauxFraisVariables, 3),
    defauts.tauxFraisVariables,
  );
  ajouter(CLES.isReduit, h.eligibleISReduit, defauts.eligibleISReduit);

  const chaine = params.toString();
  return chaine === '' ? '' : `?${chaine}`;
}

export function decoderProjection(
  recherche: string,
  defauts: HypothesesProjection,
): HypothesesProjection {
  const p = new URLSearchParams(recherche);
  return {
    facturation: decoderFacturation(p.get(CLES.ca), defauts.facturation),
    moisFactures: nombre(p.get(CLES.moisFactures), defauts.moisFactures, 0, NB_MOIS),
    fraisMensuels: nombre(p.get(CLES.fraisMensuels), defauts.fraisMensuels, 0, MAX_MONTANT),
    tauxFraisVariables: nombre(
      p.get(CLES.tauxVariable),
      defauts.tauxFraisVariables,
      0,
      1,
      3,
    ),
    eligibleISReduit: booleen(p.get(CLES.isReduit), defauts.eligibleISReduit),
  };
}

/** Absolute URL to share, keeping the current path. */
export function lienPartageProjection(
  h: HypothesesProjection,
  defauts: HypothesesProjection,
): string {
  if (typeof window === 'undefined') return '';
  const { origin, pathname } = window.location;
  return `${origin}${pathname}${encoderProjection(h, defauts)}`;
}

/**
 * Link that opens the salary / dividend arbitration with this projected
 * result already loaded. The result before remuneration is exactly that
 * tool's input.
 */
export function lienVersArbitrage(
  resultatAvantRemuneration: number,
  eligibleISReduit: boolean,
): string {
  const base = typeof window === 'undefined' ? '' : window.location.origin;
  const params = new URLSearchParams();
  params.set('resultat', String(arrondi(Math.max(0, resultatAvantRemuneration))));
  if (!eligibleISReduit) params.set('isReduit', '0');
  return `${base}/?${params.toString()}`;
}

/**
 * Link that seeds the instalment forecast with this projected result. That
 * tool's forecast profit is taxable after the president's pay, so this is only
 * a starting point — hence the honest wording in the interface.
 */
export function lienVersAcomptes(
  resultatAvantRemuneration: number,
  eligibleISReduit: boolean,
): string {
  const base = typeof window === 'undefined' ? '' : window.location.origin;
  const params = new URLSearchParams();
  params.set('previsionnel', String(arrondi(Math.max(0, resultatAvantRemuneration))));
  if (!eligibleISReduit) params.set('isReduit', '0');
  return `${base}/acomptes/?${params.toString()}`;
}
