import type { HypothesesAcomptes } from './acomptes';
import { arrondi, booleen, MAX_MONTANT, nombre } from './url';

/**
 * Serialisation of an instalment simulation into the URL.
 *
 * Same two principles as the salary simulator: only what differs from the
 * defaults is written, and everything read back is clamped. The validation
 * primitives are shared with `url.ts` so both tools stay consistent.
 */

const CLES = {
  precedent: 'precedent',
  avantDernier: 'avantDernier',
  previsionnel: 'previsionnel',
  isReduit: 'isReduit',
  premierExercice: 'premierExercice',
  moduler: 'moduler',
} as const;

export function encoderAcomptes(
  h: HypothesesAcomptes,
  defauts: HypothesesAcomptes,
): string {
  const params = new URLSearchParams();
  const ajouter = (cle: string, valeur: number | boolean, defaut: number | boolean) => {
    if (valeur === defaut) return;
    params.set(cle, typeof valeur === 'boolean' ? (valeur ? '1' : '0') : String(valeur));
  };

  ajouter(CLES.precedent, arrondi(h.beneficePrecedent), defauts.beneficePrecedent);
  ajouter(
    CLES.avantDernier,
    arrondi(h.beneficeAvantDernier),
    defauts.beneficeAvantDernier,
  );
  ajouter(
    CLES.previsionnel,
    arrondi(h.beneficePrevisionnel),
    defauts.beneficePrevisionnel,
  );
  ajouter(CLES.isReduit, h.eligibleISReduit, defauts.eligibleISReduit);
  ajouter(CLES.premierExercice, h.premierExercice, defauts.premierExercice);
  ajouter(CLES.moduler, h.moduler, defauts.moduler);

  const chaine = params.toString();
  return chaine === '' ? '' : `?${chaine}`;
}

export function decoderAcomptes(
  recherche: string,
  defauts: HypothesesAcomptes,
): HypothesesAcomptes {
  const p = new URLSearchParams(recherche);
  return {
    beneficePrecedent: nombre(
      p.get(CLES.precedent),
      defauts.beneficePrecedent,
      0,
      MAX_MONTANT,
    ),
    beneficeAvantDernier: nombre(
      p.get(CLES.avantDernier),
      defauts.beneficeAvantDernier,
      0,
      MAX_MONTANT,
    ),
    beneficePrevisionnel: nombre(
      p.get(CLES.previsionnel),
      defauts.beneficePrevisionnel,
      0,
      MAX_MONTANT,
    ),
    eligibleISReduit: booleen(p.get(CLES.isReduit), defauts.eligibleISReduit),
    premierExercice: booleen(p.get(CLES.premierExercice), defauts.premierExercice),
    moduler: booleen(p.get(CLES.moduler), defauts.moduler),
  };
}

/** Absolute URL to share, keeping the current path. */
export function lienPartageAcomptes(
  h: HypothesesAcomptes,
  defauts: HypothesesAcomptes,
): string {
  if (typeof window === 'undefined') return '';
  const { origin, pathname } = window.location;
  return `${origin}${pathname}${encoderAcomptes(h, defauts)}`;
}
